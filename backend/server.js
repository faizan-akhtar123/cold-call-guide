import express from "express";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  GEMINI_API_KEY,
  GEMINI_MODEL = "gemini-3.8-flash",
  GEMINI_FALLBACKS = "gemini-flash-latest,gemini-3.5-flash,gemini-flash-lite-latest",
  ALLOWED_ORIGINS = "",
  PORT = 3000,
} = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// The outcome words the callers use in their logs (from the transcripts README).
const OUTCOMES = [
  "agreed_to_receive_report",
  "next_step_agreed",
  "interested",
  "follow_up",
  "call_again",
  "not_interested",
  "do_not_call",
  "wrong_person",
  "moved_company",
];

const STAGE_NAMES = [
  "Opening",
  "Purpose",
  "Permission",
  "Their business",
  "Their need",
  "Objection",
  "Next step",
  "Close",
];

const app = express();
app.use(express.json({ limit: "100kb" }));

const origins = ALLOWED_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean);
app.use(cors({ origin: origins.length ? origins : true }));

const isUuid = (v) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const clean = (v, max = 2000) =>
  typeof v === "string" ? v.trim().slice(0, max) || null : null;

// Health: answers when the backend is up. Also checks the database is reachable.
app.get("/health", async (_req, res) => {
  const { error } = await db.from("calls").select("id", { head: true, count: "exact" });
  res.status(error ? 503 : 200).json({
    status: error ? "degraded" : "ok",
    database: error ? "unreachable" : "ok",
    llm: GEMINI_API_KEY ? "configured" : "missing key",
    time: new Date().toISOString(),
  });
});

// Start a call.
app.post("/calls", async (req, res) => {
  const prospect_name = clean(req.body?.prospect_name, 120);
  if (!prospect_name) return res.status(400).json({ error: "prospect_name is required" });

  const { data, error } = await db
    .from("calls")
    .insert({
      prospect_name,
      prospect_role: clean(req.body?.prospect_role, 120),
      company: clean(req.body?.company, 160),
      caller: clean(req.body?.caller, 80),
    })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// Save what happened at one stage. Saving the same stage again replaces it.
app.post("/calls/:id/stages", async (req, res) => {
  const { id } = req.params;
  if (!isUuid(id)) return res.status(400).json({ error: "bad call id" });

  const stage = Number(req.body?.stage);
  if (!Number.isInteger(stage) || stage < 1 || stage > 8)
    return res.status(400).json({ error: "stage must be 1 to 8" });

  const happened = Array.isArray(req.body?.happened)
    ? req.body.happened.filter((h) => typeof h === "string").map((h) => h.slice(0, 120)).slice(0, 10)
    : [];

  const { data: call, error: callErr } = await db
    .from("calls").select("id, stage_reached, ended_at").eq("id", id).single();
  if (callErr || !call) return res.status(404).json({ error: "call not found" });
  if (call.ended_at) return res.status(409).json({ error: "call is already closed" });

  const { data, error } = await db
    .from("stage_results")
    .upsert(
      { call_id: id, stage, happened, prospect_words: clean(req.body?.prospect_words) },
      { onConflict: "call_id,stage" }
    )
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });

  if (stage > call.stage_reached) {
    await db.from("calls").update({ stage_reached: stage }).eq("id", id);
  }
  res.json(data);
});

// Close a call: save the outcome, then let the LLM draft the summary and
// check the logged outcome against what was recorded on the call.
app.post("/calls/:id/close", async (req, res) => {
  const { id } = req.params;
  if (!isUuid(id)) return res.status(400).json({ error: "bad call id" });

  const outcome = req.body?.outcome;
  if (!OUTCOMES.includes(outcome))
    return res.status(400).json({ error: `outcome must be one of: ${OUTCOMES.join(", ")}` });

  const { data: call, error: callErr } = await db.from("calls").select("*").eq("id", id).single();
  if (callErr || !call) return res.status(404).json({ error: "call not found" });

  const { data: stages } = await db
    .from("stage_results").select("*").eq("call_id", id).order("stage");

  const next_step = clean(req.body?.next_step, 300);
  const review = await reviewCall({ call, stages: stages || [], outcome, next_step });

  const { data, error } = await db
    .from("calls")
    .update({
      ended_at: new Date().toISOString(),
      outcome,
      next_step,
      summary: review?.summary ?? null,
      llm_outcome: review?.suggested_outcome ?? null,
      llm_reason: review?.reason ?? null,
      outcome_mismatch: Boolean(review && review.suggested_outcome !== outcome),
    })
    .eq("id", id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ...data, llm_available: Boolean(review) });
});

// List past calls, newest first.
app.get("/calls", async (_req, res) => {
  const { data, error } = await db
    .from("calls")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(200);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// One call with its stage results.
app.get("/calls/:id", async (req, res) => {
  const { id } = req.params;
  if (!isUuid(id)) return res.status(400).json({ error: "bad call id" });
  const { data: call, error } = await db.from("calls").select("*").eq("id", id).single();
  if (error || !call) return res.status(404).json({ error: "call not found" });
  const { data: stages } = await db
    .from("stage_results").select("*").eq("call_id", id).order("stage");
  res.json({ ...call, stages: stages || [] });
});

// Ask Gemini for a one-line summary and the outcome the call itself supports.
// Returns null if there is no key or the call fails, so closing a call never
// depends on the LLM.
async function reviewCall({ call, stages, outcome, next_step }) {
  if (!GEMINI_API_KEY) return null;

  const record = stages
    .map((s) => {
      const taps = s.happened.length ? s.happened.join("; ") : "nothing tapped";
      const words = s.prospect_words ? ` | prospect said: "${s.prospect_words}"` : "";
      return `Stage ${s.stage} ${STAGE_NAMES[s.stage - 1]}: ${taps}${words}`;
    })
    .join("\n");

  const prompt = `You review the record of one cold call made by a caller from a growth consulting firm.
Prospect: ${call.prospect_name}${call.prospect_role ? `, ${call.prospect_role}` : ""}${call.company ? `, ${call.company}` : ""}
Furthest stage reached: ${call.stage_reached} ${STAGE_NAMES[call.stage_reached - 1]}
Stage record:
${record || "No stages recorded."}
Next step agreed: ${next_step || "none"}
Outcome the caller logged: ${outcome}

Tasks:
1. Write a one-line summary (max 18 words) that the caller will read before the next call. Lead with what the prospect wants or said, not with the caller's pitch. Plain words.
2. Pick the outcome that the record actually supports, using these meanings:
   agreed_to_receive_report: agreed to receive a document on WhatsApp or email
   next_step_agreed: a meeting, a call at a set time, or a report plus a follow-up call was agreed
   interested: said they were interested, without a fixed next step
   follow_up: the caller is to call again (busy, travelling, asked to call later)
   call_again: the number is to be called again because of language or line quality
   not_interested: declined
   do_not_call: asked not to be called
   wrong_person: the person reached was not the right person
   moved_company: the person no longer works at the company
   A polite yes to a document is agreed_to_receive_report, not interested. "Call me later" with no set time is follow_up, not next_step_agreed.
3. Give the reason in one short sentence.

Answer only as JSON: {"summary": "...", "suggested_outcome": "...", "reason": "..."}`;

  // Free-tier models are sometimes busy (503) or rate limited (429), so try
  // the configured model first and then the fallbacks.
  const models = [...new Set([GEMINI_MODEL, ...GEMINI_FALLBACKS.split(",").map((m) => m.trim()).filter(Boolean)])];
  for (const model of models) {
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
          }),
          signal: AbortSignal.timeout(15000),
        }
      );
      if (!r.ok) {
        console.error(`Gemini ${model} error`, r.status, (await r.text()).slice(0, 300));
        continue;
      }
      const body = await r.json();
      const text = body?.candidates?.[0]?.content?.parts?.[0]?.text;
      const parsed = JSON.parse(text);
      if (!OUTCOMES.includes(parsed.suggested_outcome)) parsed.suggested_outcome = outcome;
      return {
        summary: String(parsed.summary || "").slice(0, 300),
        suggested_outcome: parsed.suggested_outcome,
        reason: String(parsed.reason || "").slice(0, 300),
      };
    } catch (err) {
      console.error(`Gemini ${model} call failed`, err.message);
    }
  }
  return null;
}

app.listen(PORT, () => console.log(`Cold call guide backend on port ${PORT}`));
