# Cold Call Guide

The screen a caller keeps open beside the phone on a cold call. It keeps them on the structure of the call: which of the eight stages they are in, what the prospect is likely to say next, a tap for what happened, one box for the prospect's own words, and the next stage. After the call it is saved, and a second screen lists past calls and the stage each one reached.

## Live links

| What | URL |
|---|---|
| The screen (Vercel) | https://cold-call-guide-frontend.vercel.app |
| Backend health (Render) | https://cold-call-guide.onrender.com/health |
| Backend base (Render) | https://cold-call-guide.onrender.com |

## LLM: Google Gemini (`gemini-3.8-flash`, free tier)

Used for one thing: **checking the record when a call is closed.** The backend sends the stage taps, the prospect's words and the outcome the caller logged. Gemini returns:

- a one-line summary, led by what the prospect wants, for the caller to read before the next call
- the outcome the record actually supports, and why

If that outcome differs from the one the caller picked, the screen asks them to check it. It never changes the log on its own.

Why this one: in the 100 transcripts, the logged outcome often did not match the call. 13 calls were never logged at all, and a polite yes to receiving a document was sometimes logged as "interested". The structure of a cold call says the record is what the next call is built on, so the LLM sits where the record is made.

The key stays on the Render backend. The browser never sees it. If the key is missing or Gemini does not answer, the call is still saved, just without the summary.

## What each stage shows, and where it came from

Every "they may say" line on the screen comes from what prospects said at that point in the transcripts. A few patterns shaped the screen:

| Stage | What the transcripts showed | What the screen does |
|---|---|---|
| 1 Opening | 13 of 100 calls reached a wrong person or someone who had left the company. "From where?" was asked again in most calls. | Taps for wrong person and left company, so these calls end in two taps. The start form reminds the caller to check the name first. |
| 2 Purpose | Abstract labels got "but what do you do?" twice. Prospects asked about cost, why it is free, and where their number came from. | Those questions are listed so the caller is not surprised. |
| 3 Permission | Prospects named their own callback time or asked for WhatsApp first. | A tap for a callback at their time, and the box takes the time in their words. |
| 4 Their business | Prospects corrected the caller: wrong size, wrong division, decisions made at head office. | A "corrected us" tap, so a correction is logged as information, not a no. |
| 5 Their need | Few calls reached it, and the exact words were rarely written down. | The words box is larger and outlined here. It is the one place to write exactly what was said. |
| 6 Objection | "Not the right person" was the most common no, then "we already have consultants". | Those are the first taps. The box asks for the name of the right person. |
| 7 Next step | A yes to a document was often politeness. | Separate taps for report on WhatsApp, on email, a named time and a referral. |
| 8 Close | Calls dropped mid-sentence. Some logs did not match the call. | The outcome check on close. |

"End call" is on every stage, because most calls end early. The past calls screen shows a "where calls end" bar for each stage, so a caller can see where their calls stop.

## Architecture

```
Browser (Vercel, static HTML/CSS/JS)
   |  fetch
   v
Backend (Render, Node + Express)  ----> Gemini API (summary + outcome check)
   |
   v
Supabase (Postgres): calls, stage_results
```

- **Frontend** (`frontend/`): plain HTML, CSS and JavaScript, no build step. The stage content lives in `frontend/stages.js`. A live call is kept in session storage, so a refresh does not lose it.
- **Backend** (`backend/server.js`): holds the Supabase service key and the Gemini key.
- **Data** (`supabase/schema.sql`): two tables. Row level security is on with no policies, so only the backend can read or write.

## API

| Method | Path | What it does |
|---|---|---|
| GET | `/health` | Up check. Also reports whether the database is reachable and the LLM key is set. |
| POST | `/calls` | Start a call. Body: `prospect_name`, `prospect_role`, `company`, `caller` |
| POST | `/calls/:id/stages` | Save one stage. Body: `stage` (1 to 8), `happened` (taps), `prospect_words` |
| POST | `/calls/:id/close` | Close the call. Body: `outcome`, `next_step`. Runs the LLM check. |
| GET | `/calls` | List past calls, newest first |
| GET | `/calls/:id` | One call with its stage results |

## Run it locally

1. Create a Supabase project and run `supabase/schema.sql` in the SQL editor.
2. Backend:
   ```
   cd backend
   cp .env.example .env    # fill in the values
   npm install
   npm run dev
   ```
3. Frontend: set `window.API_BASE` in `frontend/config.js` to `http://localhost:3000`, then serve the folder, for example `npx serve frontend`.

## Deploy

- **Supabase:** run `supabase/schema.sql`. Copy the project URL and the service role key.
- **Render:** new Web Service from this repo, root directory `backend`, build `npm install`, start `npm start`. Set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `ALLOWED_ORIGINS` (the Vercel URL). The free tier sleeps when idle, so the first request can take up to a minute.
- **Vercel:** new project from this repo, root directory `frontend`, no build command. Put the Render URL in `frontend/config.js`.

## Data note

The transcripts used to design the stages are not in this repo and are not published. Only patterns drawn from them appear on the screen.
