(() => {
  const API = (window.API_BASE || "").replace(/\/$/, "");
  const STAGES = window.STAGES;
  const OUTCOMES = window.OUTCOMES;
  const app = document.getElementById("app");
  const toastEl = document.getElementById("toast");

  // ---------- helpers ----------
  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const outcomeLabel = (k) => OUTCOMES.find((o) => o.key === k)?.label || k || "Not logged";

  async function api(path, opts = {}) {
    const res = await fetch(API + path, {
      ...opts,
      headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  }

  let toastTimer;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toastEl.hidden = true), 4000);
  }

  function fmtTime(iso) {
    const d = new Date(iso);
    const today = new Date().toDateString() === d.toDateString();
    const t = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return today ? `Today ${t}` : `${d.toLocaleDateString([], { day: "numeric", month: "short" })} ${t}`;
  }

  // ---------- live call state (kept in sessionStorage so a refresh does not lose a call) ----------
  const KEY = "ccg_live_call";
  let live = null; // { call, stage, records: { [n]: { happened: [], words: "" } }, startedAt }
  let timerId;

  function saveLive() {
    try { live ? sessionStorage.setItem(KEY, JSON.stringify(live)) : sessionStorage.removeItem(KEY); } catch {}
  }
  function loadLive() {
    try { live = JSON.parse(sessionStorage.getItem(KEY) || "null"); } catch { live = null; }
  }
  const rec = (n) => (live.records[n] ||= { happened: [], words: "" });

  // ---------- router ----------
  function route() {
    clearInterval(timerId);
    const hash = location.hash || "#/new";
    document.querySelectorAll("[data-nav]").forEach((a) =>
      a.classList.toggle("active", hash.startsWith("#/" + a.dataset.nav))
    );
    const m = hash.match(/^#\/calls\/([0-9a-f-]{36})$/i);
    if (m) return renderCallDetail(m[1]);
    if (hash.startsWith("#/calls")) return renderCalls();
    if (hash.startsWith("#/call") && live) return renderStage();
    return renderNew();
  }
  window.addEventListener("hashchange", route);

  // ---------- new call ----------
  function renderNew() {
    if (live) {
      app.innerHTML = `
        <section class="card narrow">
          <h1>A call is still open</h1>
          <p class="muted">${esc(live.call.prospect_name)}${live.call.company ? ", " + esc(live.call.company) : ""}, at stage ${live.stage} of 8.</p>
          <div class="row">
            <a class="btn primary" href="#/call">Back to the call</a>
            <button class="btn ghost" id="discard">Discard it</button>
          </div>
        </section>`;
      document.getElementById("discard").onclick = () => { live = null; saveLive(); renderNew(); };
      return;
    }
    let caller = "";
    try { caller = localStorage.getItem("ccg_caller") || ""; } catch {}
    app.innerHTML = `
      <section class="card narrow">
        <h1>Who are you calling?</h1>
        <p class="muted">Check the name and company before you dial. 13 of 100 past calls reached someone who had left or was the wrong person.</p>
        <form id="newForm" class="form">
          <label>Prospect name<input name="prospect_name" required maxlength="120" placeholder="Rajan Iyer"></label>
          <label>Role<input name="prospect_role" maxlength="120" placeholder="Director, Strategic Marketing"></label>
          <label>Company<input name="company" maxlength="160" placeholder="Aerolink Signal Systems"></label>
          <label>Your name<input name="caller" maxlength="80" value="${esc(caller)}" placeholder="Meera"></label>
          <button class="btn primary big" type="submit">Start call</button>
        </form>
      </section>`;
    document.getElementById("newForm").onsubmit = async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector("button");
      btn.disabled = true;
      btn.textContent = "Starting...";
      const body = Object.fromEntries(new FormData(e.target));
      try { localStorage.setItem("ccg_caller", body.caller || ""); } catch {}
      try {
        const call = await api("/calls", { method: "POST", body });
        live = { call, stage: 1, records: {}, startedAt: Date.now() };
        saveLive();
        location.hash = "#/call";
      } catch (err) {
        toast("Could not start the call: " + err.message + ". The backend may be waking up, try again in 30 seconds.");
        btn.disabled = false;
        btn.textContent = "Start call";
      }
    };
  }

  // ---------- the call screen ----------
  function renderStage() {
    const s = STAGES[live.stage - 1];
    const r = rec(s.n);
    const next = STAGES[s.n];
    const c = live.call;

    app.innerHTML = `
      <section class="call">
        <div class="callhead">
          <div>
            <div class="who">${esc(c.prospect_name)}</div>
            <div class="muted small">${esc([c.prospect_role, c.company].filter(Boolean).join(" · ")) || "&nbsp;"}</div>
          </div>
          <div class="timer" id="timer">00:00</div>
        </div>

        <ol class="steps">
          ${STAGES.map((x) => {
            const done = live.records[x.n] && (live.records[x.n].happened.length || live.records[x.n].words);
            return `<li><button data-jump="${x.n}" class="${x.n === s.n ? "cur" : ""} ${done ? "done" : ""}" title="${esc(x.name)}">${x.n}</button></li>`;
          }).join("")}
        </ol>

        <div class="stagecard">
          <div class="eyebrow">STAGE ${s.n} OF 8</div>
          <h1>${esc(s.name)}</h1>
          <p class="forwhat">${esc(s.forWhat)}</p>

          <div class="block">
            <div class="label">THEY MAY SAY</div>
            <ul class="mayhear">${s.mayHear.map((m) => `<li>${esc(m)}</li>`).join("")}</ul>
            <p class="fromcalls">${esc(s.fromCalls)}</p>
          </div>

          <div class="block">
            <div class="label">WHAT HAPPENED</div>
            <div class="taps">
              ${s.taps.map((t) => `<button class="tap ${r.happened.includes(t) ? "on" : ""}" data-tap="${esc(t)}">${esc(t)}</button>`).join("")}
            </div>
          </div>

          <div class="block">
            <div class="label">${s.wordsKey ? "THEIR WORDS · WRITE IT EXACTLY" : "THEIR WORDS"}</div>
            <textarea id="words" class="${s.wordsKey ? "key" : ""}" rows="${s.wordsKey ? 4 : 2}" maxlength="2000" placeholder="${esc(s.wordsHint)}">${esc(r.words)}</textarea>
          </div>

          <div class="actions">
            ${next ? `<button class="btn primary" id="next">Next: ${esc(next.name)} →</button>` : ""}
            <button class="btn ${next ? "danger" : "primary"}" id="end">${next ? "End call" : "Close and save the call"}</button>
          </div>
        </div>

        <div id="closePanel"></div>
      </section>`;

    // timer
    const tick = () => {
      const sec = Math.floor((Date.now() - live.startedAt) / 1000);
      const el = document.getElementById("timer");
      if (el) el.textContent = `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
    };
    tick();
    timerId = setInterval(tick, 1000);

    app.querySelectorAll("[data-tap]").forEach((b) => (b.onclick = () => {
      const t = b.dataset.tap;
      r.happened = r.happened.includes(t) ? r.happened.filter((x) => x !== t) : [...r.happened, t];
      b.classList.toggle("on");
      saveLive();
    }));
    document.getElementById("words").oninput = (e) => { r.words = e.target.value; saveLive(); };

    app.querySelectorAll("[data-jump]").forEach((b) => (b.onclick = async () => {
      const to = Number(b.dataset.jump);
      if (to === s.n) return;
      await saveStage(s.n, to > s.n);
      live.stage = to;
      saveLive();
      renderStage();
    }));

    const nextBtn = document.getElementById("next");
    if (nextBtn) nextBtn.onclick = async () => {
      await saveStage(s.n, true);
      live.stage = s.n + 1;
      saveLive();
      renderStage();
      window.scrollTo({ top: 0 });
    };
    document.getElementById("end").onclick = () => renderClosePanel();
  }

  // Save one stage to the backend. Forward moves always save, so the call
  // records how far it got even if nothing was tapped.
  async function saveStage(n, force) {
    const r = live.records[n];
    const has = r && (r.happened.length || r.words.trim());
    if (!has && !force) return;
    try {
      await api(`/calls/${live.call.id}/stages`, {
        method: "POST",
        body: { stage: n, happened: r?.happened || [], prospect_words: r?.words || "" },
      });
    } catch (err) {
      toast("Stage not saved: " + err.message);
    }
  }

  function renderClosePanel() {
    const panel = document.getElementById("closePanel");
    const stepWords = live.records[7]?.words || "";
    panel.innerHTML = `
      <div class="card closecard">
        <h2>End the call at stage ${live.stage}: ${esc(STAGES[live.stage - 1].name)}</h2>
        <form id="closeForm" class="form">
          <div class="label">OUTCOME</div>
          <div class="outcomes">
            ${OUTCOMES.map((o) => `
              <label class="radio"><input type="radio" name="outcome" value="${o.key}" required><span>${esc(o.label)}</span></label>`).join("")}
          </div>
          <label>Next step, with a time or channel<input name="next_step" maxlength="300" value="${esc(stepWords)}" placeholder="Report on WhatsApp, call Tuesday after 2 PM"></label>
          <div class="row">
            <button class="btn primary" type="submit">Save call</button>
            <button class="btn ghost" type="button" id="cancelClose">Back to the call</button>
          </div>
        </form>
      </div>`;
    panel.scrollIntoView({ behavior: "smooth" });
    document.getElementById("cancelClose").onclick = () => (panel.innerHTML = "");
    document.getElementById("closeForm").onsubmit = async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector("button[type=submit]");
      btn.disabled = true;
      btn.textContent = "Saving and checking...";
      const body = Object.fromEntries(new FormData(e.target));
      try {
        await saveStage(live.stage, true);
        const saved = await api(`/calls/${live.call.id}/close`, { method: "POST", body });
        live = null;
        saveLive();
        renderSaved(saved);
      } catch (err) {
        toast("Could not save: " + err.message);
        btn.disabled = false;
        btn.textContent = "Save call";
      }
    };
  }

  function renderSaved(c) {
    clearInterval(timerId);
    app.innerHTML = `
      <section class="card narrow">
        <div class="eyebrow">CALL SAVED</div>
        <h1>${esc(c.prospect_name)}</h1>
        ${c.summary ? `<p class="summary">${esc(c.summary)}</p>` : `<p class="muted">${c.llm_available === false ? "Summary not available right now (LLM did not answer). The call is saved." : ""}</p>`}
        <dl class="facts">
          <dt>Reached</dt><dd>Stage ${c.stage_reached}: ${esc(STAGES[c.stage_reached - 1].name)}</dd>
          <dt>You logged</dt><dd>${esc(outcomeLabel(c.outcome))}</dd>
          ${c.next_step ? `<dt>Next step</dt><dd>${esc(c.next_step)}</dd>` : ""}
        </dl>
        ${c.outcome_mismatch ? `
          <div class="warn">
            <strong>Check the outcome.</strong> The record reads more like “${esc(outcomeLabel(c.llm_outcome))}”. ${esc(c.llm_reason || "")}
          </div>` : ""}
        <div class="row">
          <a class="btn primary" href="#/new">Next call</a>
          <a class="btn ghost" href="#/calls">Past calls</a>
        </div>
      </section>`;
  }

  // ---------- past calls ----------
  async function renderCalls() {
    app.innerHTML = `<section class="card"><p class="muted">Loading past calls... (the backend sleeps when idle, the first load can take 30 to 50 seconds)</p></section>`;
    let calls;
    try {
      calls = await api("/calls");
    } catch (err) {
      app.innerHTML = `<section class="card"><p>Could not load calls: ${esc(err.message)}</p><button class="btn ghost" onclick="location.reload()">Try again</button></section>`;
      return;
    }
    const closed = calls.filter((c) => c.ended_at);
    const counts = STAGES.map((s) => closed.filter((c) => c.stage_reached === s.n).length);
    const max = Math.max(1, ...counts);

    app.innerHTML = `
      <section class="card">
        <h1>Past calls</h1>
        ${closed.length ? `
        <div class="label">WHERE CALLS END · ${closed.length} CALL${closed.length === 1 ? "" : "S"}</div>
        <div class="ends">
          ${STAGES.map((s, i) => `
            <div class="endrow">
              <span class="endname">${s.n} ${esc(s.name)}</span>
              <span class="bar"><span style="width:${(counts[i] / max) * 100}%"></span></span>
              <span class="endn">${counts[i]}</span>
            </div>`).join("")}
        </div>` : `<p class="muted">No calls saved yet. <a href="#/new">Start one.</a></p>`}
      </section>
      <section class="list">
        ${calls.map((c) => `
          <a class="callrow" href="#/calls/${c.id}">
            <div class="callmain">
              <div class="who">${esc(c.prospect_name)}${c.company ? `, <span class="muted">${esc(c.company)}</span>` : ""}</div>
              <div class="small">${esc(c.summary || c.next_step || (c.ended_at ? outcomeLabel(c.outcome) : "Call still open"))}</div>
              ${c.outcome_mismatch ? `<div class="small flag">Outcome may not match the call</div>` : ""}
            </div>
            <div class="callside">
              <span class="chip">${esc(STAGES[c.stage_reached - 1].name.toUpperCase())}</span>
              <span class="small muted">${fmtTime(c.started_at)}</span>
            </div>
          </a>`).join("")}
      </section>`;
  }

  async function renderCallDetail(id) {
    app.innerHTML = `<section class="card"><p class="muted">Loading...</p></section>`;
    let c;
    try { c = await api(`/calls/${id}`); }
    catch (err) { app.innerHTML = `<section class="card"><p>${esc(err.message)}</p></section>`; return; }
    app.innerHTML = `
      <section class="card narrow">
        <a href="#/calls" class="small">← Past calls</a>
        <h1>${esc(c.prospect_name)}</h1>
        <p class="muted">${esc([c.prospect_role, c.company].filter(Boolean).join(" · "))}</p>
        ${c.summary ? `<p class="summary">${esc(c.summary)}</p>` : ""}
        <dl class="facts">
          <dt>When</dt><dd>${fmtTime(c.started_at)}${c.caller ? ` · by ${esc(c.caller)}` : ""}</dd>
          <dt>Reached</dt><dd>Stage ${c.stage_reached}: ${esc(STAGES[c.stage_reached - 1].name)}</dd>
          <dt>Logged</dt><dd>${esc(c.ended_at ? outcomeLabel(c.outcome) : "Call still open")}</dd>
          ${c.next_step ? `<dt>Next step</dt><dd>${esc(c.next_step)}</dd>` : ""}
        </dl>
        ${c.outcome_mismatch ? `<div class="warn"><strong>Check the outcome.</strong> The record reads more like “${esc(outcomeLabel(c.llm_outcome))}”. ${esc(c.llm_reason || "")}</div>` : ""}
        <div class="label">STAGE BY STAGE</div>
        <ol class="timeline">
          ${c.stages.map((s) => `
            <li>
              <div class="tlname">${s.stage} ${esc(STAGES[s.stage - 1].name)}</div>
              ${s.happened.length ? `<div class="small">${s.happened.map(esc).join(" · ")}</div>` : ""}
              ${s.prospect_words ? `<blockquote>${esc(s.prospect_words)}</blockquote>` : ""}
            </li>`).join("") || `<li class="muted">No stages recorded.</li>`}
        </ol>
      </section>`;
  }

  loadLive();
  route();
})();
