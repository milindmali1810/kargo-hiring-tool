# Kargo Hiring Tool — Status

**Live app:** https://kargo-hiring-tool.vercel.app
**Repo:** https://github.com/milindmali1810/kargo-hiring-tool (private)
**Login:** milindmali1810@gmail.com / password shared in chat when the account was created (not repeated here — it's a secret, kept out of this file and out of git)

## What it does

Scores CVs for Kargo's Product Manager / Senior Product Manager hiring against `Rubric.txt`'s six weighted criteria (operational domain fluency, zero-to-one ownership, shipped-and-measured outcomes, independent judgment, multiplier effect, role-scope fit), with a hard gate: if (a)+(b) < 15/45, the candidate is capped at "Hold" regardless of raw total. Gate logic and banding (Advance ≥70 / Hold 40–69 or gated / Decline <40) are computed in application code, not left to the model — only the six criterion scores, evidence quotes, and rationale come from Gemini.

Pipeline: upload (PDF/DOCX) → text extraction → PII-stripped normalization → duplicate check → PM/SPM role tagging → Gemini scoring → dashboard. The same pipeline seeded the original 60 applications and handles ad hoc new candidates from `/candidates/new`.

## Stack

- **Next.js 16** (App Router) on **Vercel**
- **Neon Postgres** via **Drizzle ORM**
- **Gemini** (`gemini-3.1-pro-preview` for scoring, a flash-lite model for the lighter normalize/tag/draft steps)
- **Resend** for email drafts (draft-only in the app; the only send route requires an explicit per-candidate click)
- Custom single-account auth (bcrypt + signed JWT cookie, no third-party auth provider)

## Verified

- **Calibration**: live Gemini scoring reproduces Rubric.txt's documented table exactly — Lavanya Iyer 98 (Advance), Vikram Nair 46 (Hold), Preetham Rao 41 (Hold, gate-capped).
- **Full dataset scored**: 60 applications ingested; 57 scored (11 Advance / 42 Hold / 4 Decline), 3 correctly tagged "unclear" and excluded until a role is assigned.
- **Unclear-role recovery**: a candidate tagged "unclear" now gets a role-picker UI (with the tagger's stated reasoning shown) instead of silently failing to score. Verified end-to-end on a real candidate (Priya Sharma → assigned PM → scored 0/100, correctly declined given a pure marketing background → decline draft generated).
- **Email drafting**: verified generating a real, personalized decline draft through the live pipeline.
- **One-click Invite/Reject from the dashboard**: each candidate row shows all six rubric criteria as compact color-coded chips (no click-through needed) plus Invite/Reject buttons that draft-and-send in one action, with an inline "Yes, send / Cancel" confirm. Verified live: sending a real decline to Harsh Reddy triggered a real Resend API call and got back Resend's exact sandbox rejection (confirming the pipeline is correct and only blocked on the domain setup below).
- **Visual design**: indigo/orange palette, Poppins/Open Sans typography, hover/gradient effects, verified on all five pages (login, dashboard, candidate detail, add-candidate, calibration).
- Build and lint clean on every change; dark-mode/contrast bug (OS dark mode was blacking out the light-only UI) found and fixed.

## Known gaps — not yet closed

1. **Sending real candidate emails will not work yet.** `RESEND_FROM_EMAIL` is set to Resend's sandbox address (`onboarding@resend.dev`), which can only send to the account's own signup email (confirmed live: `milindmali1810@gmail.com`), not real candidates. Needs a verified sending domain in Resend (DNS records added at whatever domain you want mail to come from) before Invite/Reject will actually deliver anywhere. Drafting and the send pipeline itself both work — only the final delivery is blocked, by Resend, not by this app.
2. **Duplicate-detection is implemented but never triggered on real data.** None of the 60 real applications happened to contain an actual duplicate, so the dedupe logic (exact content-hash match + fuzzy name/contact match) has only been verified by code review, not by watching it fire live.
3. **2 candidates still need manual role assignment**: Arnav Sen and Shiva Kumar are tagged "unclear" and sitting under "Pending scoring" on the dashboard — same recovery flow as Priya Sharma, just not yet exercised by a human reviewer.
4. **No automated tests.** Verification so far has been manual (build/lint + live browser walkthroughs), not a test suite.
5. There's an unrelated stray file, `Milind_section A_ E101.pdf`, sitting in this project folder — not created by this project, not committed, still awaiting a decision on whether to move or delete it.

## Environment variables (set in Vercel + local `.env.local`)

`DATABASE_URL`, `AUTH_EMAIL`, `AUTH_PASSWORD_HASH`, `AUTH_SECRET`, `GEMINI_API_KEY`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL` — see `.env.example` for the full list. Note: locally, bcrypt hashes in `.env.local` must have their `$` characters escaped (`\$`) because Next.js's dev-mode env loader does `$VAR` expansion; this does not affect Vercel's production env vars, which are injected directly.
