# HireSpeak — AI-native, voice-first recruiting for SMEs

Employers, candidates and recruitment firms **speak or type** what they need. AI agents do the work:
writing job descriptions, company profiles, resumes, offer letters and acceptance letters, matching
people to jobs, and keeping a trust score for everyone. There are no forms after sign-up.

Works in the **web app** (mic + chat). A **WhatsApp** channel (text, voice notes, resume files) is built
and included, but not live in this demo (see *Known limits*).

---

## What it does

| Requirement | How it works |
|---|---|
| Job description from voice/text | *"Post a job for an accounts executive, 2 years, Tally, 25-30k, Andheri"* → JD Agent writes the full JD and posts it |
| Company description from voice/text | *"Sharma Industries, 50-person auto parts maker in Bhiwandi"* → Company Profile Agent |
| Candidate applies by voice/text or file | Resume Agent builds a resume from speech, or reads an uploaded PDF/photo (laptop, phone, or WhatsApp). *"Apply to the first one"* applies with the latest resume |
| Offer letters from voice/text | *"Send an offer to Priya Shah for the CA job, 70k, joining 15 Nov"* → Offer Letter Agent |
| Offer acceptance from voice/text | *"Accept the offer from Greenleaf"* → Acceptance Agent writes a formal acceptance letter |
| Plain-language search | *"Find me a CA with 2 years at an SME in Mumbai from manufacturing"* / *"Accountant job in Andheri East paying 30,000"* → Matching Agent ranks results with a match % and a reason |
| Trust scores | Everyone starts at 100. −5 for: accepting and not joining, not taking a candidate after an offer, leaving without notice, firing without notice |
| Score lookup | Employers/recruiters check candidates by **name, company or Aadhaar**; candidates check companies |
| Dashboards | Separate dashboards for candidates, employers and recruitment firms: stats, status lists, quick actions, AI activity |
| Central data lake | One database holding every resume (all versions), job, application, offer, acceptance, hiring record, score event and AI action, with a viewer at `/data-lake` |
| Permissions | Microphone and file access from laptop or mobile are live. WhatsApp linking (one-time code) is built; see *Known limits* |

## Agents

Every message goes to the **Intake Agent**, which works out the intent and details, then hands off
to one specialist. Every agent action is written to `agent_logs` (visible in the data lake).

| Agent | Job |
|---|---|
| Intake | Understands the message (handles speech errors like "sea" → "CA") and routes it |
| Company / Firm Profile | Writes and saves the employer or recruitment-firm profile |
| Job Description | Writes and posts JDs; updates instead of duplicating |
| Resume | Builds resumes from speech/text, reads uploaded files, fills the candidate profile, keeps every version |
| Matching | Ranks candidates for a role, or jobs for a candidate, using the whole data lake |
| Application | Works out which job "the first one" means and applies |
| Offer Letter | Writes offer letters (salary, CTC, joining date, notice, documents) |
| Acceptance | Writes acceptance letters in the candidate's words |
| Employment | Records joinings, no-shows and exits, and files score reports |
| Score | Score lookups, history, disputes |
| Transcription | Turns WhatsApp voice notes (English, Hindi, Marathi) into text |

## Fairness and privacy decisions

- **Dispute window.** A report made *against someone else* stays pending and can be disputed. It only
  lowers the score if not disputed in time (3 days in production, 2 minutes in the demo). Actions a
  person takes themselves (backing out of an accepted offer, withdrawing an offer) apply at once, after
  an explicit warning and confirmation. Declining before accepting costs nothing. Duplicate reports are blocked.
- **Aadhaar.** Never stored. Only a salted SHA-256 hash (for lookups) and the last 4 digits (for display).
  It is masked in AI logs too.
- **Data access.** Row Level Security is on for every table; the browser cannot read tables directly.
  All access goes through server routes. Recruiters see the whole data lake; employers and candidates
  see only their own records.
- **No invented facts.** Agents are told to use only what the user said or what is in their file.

## Stack

Next.js 16 (App Router, TypeScript, Tailwind) · Supabase (Postgres, Auth, Storage) ·
Google Gemini (flash-lite first for speed, flash as fallback) · Browser speech recognition (en-IN) ·
Twilio WhatsApp · Vercel. Most of the code was written with an AI coding assistant.

## Run it

1. Create a Supabase project, turn on automatic RLS, and run `supabase/schema.sql` in the SQL editor.
2. `cp .env.example .env.local` and fill it in.
3. `npm install` then `npm run dev` and open http://localhost:3000
4. Optional demo data (15 fictional candidates, 8 jobs, some lowered scores; no AI quota used):
   `node --env-file=.env.local scripts/seed.mjs`

### WhatsApp (Twilio) — built, not live in this demo

1. Deploy (WhatsApp needs a public URL).
2. Twilio Console → Messaging → Try it out → Send a WhatsApp message → **Sandbox settings**:
   "When a message comes in" = `https://<your-app>/api/whatsapp`, method **POST**.
3. Put the sandbox join phrase in `TWILIO_SANDBOX_JOIN`.
4. On the dashboard, follow **Connect WhatsApp**: send the join phrase, then `LINK <code>`.

## Known limits of this MVP

- Search and matching are shown on a **seeded set of 15 fictional candidates and 8 jobs**
  (`scripts/seed.mjs`). Everything created in the demo itself was generated live by the agents.
- **WhatsApp is built but not connected in this demo.** The code is complete (`src/app/api/whatsapp`,
  `src/lib/whatsapp.ts`): number linking by one-time code, Twilio signature checks, text and voice-note
  messages (transcribed by AI, English/Hindi/Marathi), resume files, and replies from the same agents.
  It could not go live because Twilio's limited trial only allows pre-approved template messages, which
  blocks the agents' free-text replies. Turning it on needs a paid Twilio account (or Meta's WhatsApp Cloud
  API) plus the setup steps above; no code changes. Unofficial WhatsApp libraries were rejected because
  they break WhatsApp's terms and risk banning the number.
- Gemini **free tier** has daily limits; the app switches models automatically when one runs out.
- Voice input in the browser needs Chrome or Edge.
- Disputes are recorded and pause the penalty; a human review step would be added for production.

## Next steps

Admin review queue for disputes · Aadhaar verification through a licensed provider (DigiLocker) ·
Hindi and Marathi in the web app · semantic search with embeddings as the data lake grows ·
email/WhatsApp notifications when an offer or report arrives.
