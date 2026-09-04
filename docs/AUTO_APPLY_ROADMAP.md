# Auto-Apply Roadmap (Phase 2 — design only, not implemented)

Status: **design document**. Nothing in this file is built yet. Phase 1 (Candidate Profile, Best Fit %, any-site detection) must be stable in real browsers before any of this starts. See "Entry criteria" at the bottom.

## Goal

The user describes the jobs they want ("SWE internships, summer 2027, remote or Bay Area, fit ≥ 70%"). RezBuilder then:

1. notices matching postings as soon as they appear,
2. prepares a complete application (form fields, short-answer questions, cover letter) from the Candidate Profile,
3. submits it, or hands it to the user for a one-click review, depending on the mode they chose,
4. records everything in a tracker.

Constraint from the product vision: **no paid AI**. Every generated word comes from deterministic templates filled from the profile, or (later, optional) a free in-browser model.

## Hard constraints that shape the design

| Constraint | Consequence |
|---|---|
| LinkedIn, Indeed, Glassdoor and most aggregators prohibit automated applying in their terms. Easy-Apply bots get accounts restricted. | Fully automatic submission only targets **first-party ATS boards** (Greenhouse, Lever, Ashby, Workday, SmartRecruiters, Workable). Aggregators are used only for *discovery*; the extension follows the "Apply on company site" link. |
| CAPTCHAs, bot detection, one-time email codes. | The runner must be able to pause and ask the user to finish a step. Never attempt to bypass a CAPTCHA. |
| MV3 service workers sleep after ~30 s idle. | Polling uses `chrome.alarms` (minimum 1 min period), state lives in `chrome.storage`, nothing is kept in worker memory. |
| Free product, no backend. | Discovery polls public, unauthenticated board APIs directly from the browser. No server, no accounts. |
| Wrong answers on an application are worse than no application. | Default mode is **Review before submit**. "Hands-off" is opt-in per source and only where an answer bank entry exists for every question. |

## Architecture

```
Saved Searches ──► Job Watch (alarms) ──► Fit Gate ──► Application Queue
                                                            │
                        Answer Bank + Cover Letter Templates │
                                                            ▼
                                 Application Runner (tab + content script)
                                                            │
                                     Review UI (side panel) ◄┘──► Tracker
```

### 1. Saved Searches (`src/services/watch/savedSearch.ts`)
A saved search is what the user means by "a description of jobs":
```ts
interface SavedSearch {
  id: string; name: string;
  titles: string[];                 // "Software Engineer Intern", "SWE New Grad"
  keywords: string[]; excludeKeywords: string[];
  locations: string[]; remote: 'remote'|'hybrid'|'onsite'|'any';
  employmentTypes: ('internship'|'full_time'|...)[];
  minFitPercent: number;            // reuse Best Fit %
  sources: WatchSource[];           // which boards to poll
  mode: 'notify' | 'prepare' | 'review_then_submit' | 'hands_off';
  createdAt: string; lastRunAt?: string;
}
```

### 2. Job Watch (`src/services/watch/jobWatch.ts`)
Polls **free public board endpoints** on a `chrome.alarms` schedule (default every 15 min, user configurable, per-source rate limit and ETag caching to stay polite):

| Source | Endpoint (no auth) |
|---|---|
| Greenhouse | `https://boards-api.greenhouse.io/v1/boards/{board}/jobs?content=true` |
| Lever | `https://api.lever.co/v0/postings/{company}?mode=json` |
| Ashby | `https://api.ashbyhq.com/posting-api/job-board/{org}` |
| Workday | `https://{tenant}.myworkdayjobs.com/wday/cxs/{tenant}/{site}/jobs` (POST, public) |
| SmartRecruiters | `https://api.smartrecruiters.com/v1/companies/{company}/postings` |
| Company career pages with `JobPosting` JSON-LD | fetch + reuse `extractJobPostingSchema` |

The user adds companies by pasting a careers URL; the extension recognises the board type from the URL. New postings (id not seen before) are converted to `JobPosting` with the existing scrapers' field shapes, scored with `calculateBestFit`, and those ≥ `minFitPercent` enter the queue. A "new match" badge and optional `chrome.notifications` notify the user.

### 3. Answer Bank (`src/services/apply/answerBank.ts`)
Short-answer questions repeat across ATSs. The bank maps **canonical questions** to answers the user wrote once, with fuzzy matching (normalised token overlap + synonym list) against the label text of each form field:

- Work authorization / sponsorship → from `profile.story.authorizedToWork / needsSponsorship`
- Earliest start date, graduation date → from education
- Salary expectations, notice period, relocation, pronouns, demographics (always "prefer not to say" unless the user opts in)
- "Why do you want to work here?" / "Why this role?" → template (below)
- Unknown question → application is parked in **Review** with the question highlighted; the user's answer is saved back into the bank so it never asks twice.

### 4. Cover Letter & Free-Text Templates (`src/services/apply/coverLetter.ts`)
Deterministic slot-filling, no LLM:

1. **Opening** — role + company + the strongest matching theme (from `themes.ts`) phrased from a curated sentence bank keyed by theme.
2. **Proof paragraph** — the two experiences with highest relevance to the posting (reuse `fitEngine` experience scoring), each rendered as "At {company}, I {bullet with strongest verb}", choosing bullets that contain the job's required skills ranked by the user's 1–5 rating.
3. **Skills sentence** — intersection of required skills and profile skills ordered by rating, top 4.
4. **Drive sentence** — user's `drives` mapped to posting themes.
5. **Close** — availability (graduation date / start date) + contact.

Every sentence comes from the user's own profile text or a template bank the user can edit in Settings. The letter is shown in the Review UI and is editable before submit.

Optional later step (still free): a small in-browser model via WebLLM/transformers.js to *rephrase* (never invent) the assembled letter. Behind a flag, off by default, because of model download size and CPU cost.

### 5. Application Runner (`src/content/apply/runner.ts`)
Extends the existing `formFiller` (which already maps Greenhouse/Lever/Workday/generic fields):

- Opens the posting in a background tab, waits for the form, fills contact/education/experience from the **profile** (not just the resume), attaches the tailored resume file (generated by the existing DOCX/PDF exporters, uploaded through the `<input type=file>` via `DataTransfer`), fills short-answers from the Answer Bank, pastes the cover letter.
- Multi-step forms (Workday) are driven page by page with a per-platform step map; each step is checkpointed in storage so a sleeping service worker can resume.
- Stops and surfaces the tab to the user on: unknown required question, CAPTCHA, login wall, file upload failure, validation errors after fill.
- **Submit** is only clicked in `hands_off` mode, and only when the pre-submit checklist passes (all required fields filled, no unanswered questions, fit ≥ threshold, not previously applied to this job id, daily cap not exceeded).

### 6. Review UI & Tracker (`src/sidepanel/tabs/ApplyTab.tsx`)
Queue view with per-application status: `matched → prepared → needs_review → submitted → failed`. Review shows the filled form summary, the cover letter, and unanswered questions. Tracker stores company, role, URL, date, fit %, mode, and outcome, exportable to CSV.

## Safety rails (non-negotiable defaults)
- Default mode `review_then_submit`; `hands_off` requires an explicit per-search toggle with a warning.
- Daily submission cap (default 10) and per-company cap (1 per posting, ever).
- Never apply on LinkedIn/Indeed/Glassdoor directly; always follow to the company ATS.
- Never bypass CAPTCHAs or bot checks.
- Demographic / EEO questions default to "Decline to self-identify".
- Everything logged locally; a "Pause all automation" kill switch in the header.

## Entry criteria (Phase 1 must meet these first)
1. Best Fit % validated by the owner against ≥ 30 real postings across ≥ 5 sites; no obviously wrong numbers.
2. Profile onboarding, resume import, and LinkedIn import each used successfully on a real account.
3. Zero false-positive job detections in a week of ordinary browsing (the classifier's negative vetoes hold).
4. Side panel renders in < 100 ms with a full profile; fit scoring < 5 ms.
5. Full test suite green; build clean; no console errors in the loaded extension.

## Suggested build order for Phase 2
1. Saved Searches + Job Watch (Greenhouse, Lever, Ashby first) + Tracker — discovery-only, `notify` mode.
2. Answer Bank + profile-driven `formFiller` upgrade — `prepare` mode.
3. Cover letter templates — `review_then_submit` mode.
4. Workday/SmartRecruiters multi-step runner.
5. `hands_off` mode, only after 2–4 are stable.
