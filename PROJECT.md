# Project: RezBuilder Job-Application Copilot

## Product Vision
- Free Chrome extension, no paid AI. Every engine (detection, Best Fit %, ATS scoring, tailoring, interview prep) is deterministic and runs in the browser. BYO-key LLM providers remain optional and are never required.
- Parse job postings on any website; every non-job page must stay non-parseable (negative-veto classifier).
- A required **Candidate Profile** (name, education with graduating class, skills rated 1-5, experiences, certifications, story/drives) gates the Job, Tailor and Prep tabs. Importable from a resume, from the user's own LinkedIn profile page, or from a LinkedIn data export. LinkedIn OAuth is deliberately not used: its public API does not expose skills/experience to third-party apps.
- **Best Fit %** per posting: explainable profile-vs-job estimate with factor breakdown, strengths, improvements and hard blockers.
- Phase 2 (design only, see `docs/AUTO_APPLY_ROADMAP.md`): saved searches, job watch, answer bank, templated cover letters, review-then-submit automation. Not started until the roadmap's entry criteria are met.

## Architecture
RezBuilder is a Chrome Extension (Manifest V3) structured into six primary layers:
1. **Extension Lifecycle & Runtime**: Manifest V3 background service worker (`src/background/`), Side Panel UI (`src/sidepanel/`), and Content Script injection (`src/content/`).
2. **Precision Detection & Scraping Engine**:
   - Multi-signal page classifier combining negative veto filters (URL/content rules for educational/docs/courses), Schema.org `JobPosting` JSON-LD parser, DOM structural indicators (apply buttons, application forms, salary/experience chips, metadata headers).
   - Dedicated platform scrapers (LinkedIn, Indeed, Greenhouse, Lever, Workday, Ashby, Generic).
3. **ATS Scoring & Resume Tailoring Engine**:
   - 5-factor weighted formula (Keyword, Placement, Section, Parse, Relevance) with action verb recommendations.
   - Deterministic local resume tailoring (weak verb replacement, bullet reordering, skill prioritization) paired with unified `TailorService` supporting Gemini, OpenAI, Anthropic LLMs with local fallback.
4. **Automated Application Form Auto-Filler**:
   - Field detection and mapping engine for Greenhouse, Lever, Workday, and custom/generic application forms.
   - Synthetic event dispatcher (`input`, `change`, `blur`) for single-page dynamic applications.
5. **Candidate Profile Layer** (`src/services/profile/`, `src/services/storage/profileStorage.ts`, `src/content/linkedinProfile/`, `src/background/linkedinImport.ts`):
   - Single local source of truth about the user (`rezbuilder_profile`), completeness gate, merge rules for imports.
   - Importers: resume → profile, LinkedIn own-profile page scraper (content script, anchor-id based), LinkedIn data-export CSV parser.
6. **Best Fit Engine** (`src/services/fit/`):
   - `extractJobRequirements` turns a posting into required/nice-to-have skills, degree and graduation-window rules, role level, clearance/sponsorship flags, remote/location/employment type, and culture themes.
   - Six weighted factors (skills 40, experience 25, education 15, story 10, certifications 5, preferences 5) with weight redistribution for non-applicable factors, hard blockers capping the score at 35, and a confidence tier.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Extension UI & Side Panel | Clean Manifest V3 side panel mounting, React 18 createRoot, Tailwind styling, no CSP warnings | M3 | R1 |
| 2 | Clean Vite + @crxjs Build | Zero TS errors, clean packaging to `dist/`, zero bundle errors | M3 | R1 |
| 3 | Precision Job Page Classifier | 100% accurate classification, negative veto rules (algomaster.io, educational/docs), Schema.org parser, multi-signal scoring ($\ge 65$) | M1 | R2 |
| 4 | ATS Job Scrapers | Dedicated scrapers for Greenhouse, Lever, Workday, LinkedIn, Indeed, Ashby, Generic | M1 | R2 |
| 5 | ATS Match Scoring & Recommendations | 5-factor weighted match score + action verb recommendations & keyword gap breakdown | M2 | R3 |
| 6 | Resume Tailoring Engine | Local deterministic tailoring + unified LLM `TailorService` (Gemini/OpenAI/Claude) | M2 | R3 |
| 7 | Form Auto-Fill Engine | Automatic field mapping and population for Greenhouse, Lever, Workday, and generic forms | M2 | R3 |
| 8 | Comprehensive E2E & Tier 1-4 Test Suite | Opaque-box and unit tests covering all features with mock DOM/Chrome harnesses | M4 (E2E Track) | R1-R3 |
| 9 | Tier 5 Adversarial Coverage Hardening | White-box stress testing and boundary verification | M4 (Phase 2) | Quality Gate |
| 10 | Conventional Git Commits & Remote Sync | Strict Conventional Commits formatting and sync with remote repository | M5 | R4 |
| 11 | Per-Tab Automatic Job Parsing | Content script auto-parses on load/SPA navigation; background keeps one job per tab and empties the panel on non-job tabs | M6 | R2 |
| 12 | Candidate Profile & Onboarding Gate | Required profile (name, graduating class, 1-5 rated skills, experiences, certifications, story); wizard + editor; Job/Tailor/Prep locked until complete | M7 | Vision |
| 13 | Profile Importers | Resume → profile, LinkedIn own-profile page scrape (no API), LinkedIn data-export CSVs; deterministic merge with rating precedence | M7 | Vision |
| 14 | Best Fit % Engine & Card | Explainable profile-vs-job score with factor breakdown, matched/missing skills with ratings, strengths, improvements, hard blockers, confidence | M7 | Vision |
| 15 | Rating-Aware Tailoring | Local tailoring orders skills and bullets by the user's confidence ratings; no fabrication | M7 | Vision |
| 16 | Auto-Apply Roadmap | Phase 2 design (saved searches, job watch on public board APIs, answer bank, templated cover letters, review-then-submit) — design only | Phase 2 | Vision |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| E2E | E2E Test Suite Creation | Build 4-Tier test suite (Tiers 1-4) across detection, ATS, tailoring, and autofill | None | DONE |
| M1 | Precision Job Page Detection Engine | Implement `JobClassifier`, negative veto filters, Schema.org parser, Workday/Ashby scrapers, eliminate false positives on algomaster.io | None | DONE |
| M2 | ATS Enhancements, Resume Tailoring & Form Auto-Fill | Action verb recommendations in ATS score, unified `TailorService`, complete `FormFiller` engine & tests | M1 | DONE |
| M3 | UI Runtime Integration & CSP Polish | Remove external font link CSP warnings, verify sidepanel & floating button integration | M2 | DONE |
| M4 | Final Milestone: E2E Test Suite Pass & Adversarial Hardening | Pass 100% of E2E test suite (Tiers 1-4) + Tier 5 Adversarial Coverage Hardening | E2E, M3 | DONE |
| M5 | Conventional Git Commits & Remote Push | Verify all commit messages match Conventional Commits format and push to remote | M4 | DONE |
| M6 | Per-Tab Job State & Automatic Parsing | Replace the single global `activeJob` with a per-tab registry, auto-parse without user action, clear the panel on non-job tabs | M5 | DONE |
| M7 | Candidate Profile, Importers & Best Fit % | Profile types/storage/completeness/merge, resume + LinkedIn page + LinkedIn export importers, fit engine, profile wizard/editor UI, onboarding gate, Best Fit card, rating-aware tailoring | M6 | DONE (needs real-browser validation, see roadmap entry criteria) |
| P2 | Auto-Apply Automation | Saved searches → job watch → answer bank → cover letter templates → review-then-submit runner | M7 validated | DESIGNED (`docs/AUTO_APPLY_ROADMAP.md`) |

## Interface Contracts

### Content Script ↔ Background Service Worker
- `JOB_DETECTED` $\rightarrow$ payload `JobPosting`; background records it for `sender.tab.id` and mirrors it to `activeJob` when that tab is in view.
- `NO_JOB_DETECTED` $\rightarrow$ background clears that tab's entry, emptying the panel when the tab is in view.
- `REEVALUATE_PAGE` $\rightarrow$ background asks a tab to re-report; returns `{ isJobPage: boolean, job?: JobPosting }`.
- `GET_ACTIVE_TAB_JOB` $\rightarrow$ side panel asks for the job belonging to the tab in view; returns `{ job: JobPosting | null }`.
- `GET_JOB_DATA` $\rightarrow$ returns `{ isJobPage: boolean, job?: JobPosting }`
- `TRIGGER_AUTOFILL` $\rightarrow$ payload `{ resume: Resume }`, returns `{ success: boolean, fieldsFilled: string[], message?: string }`
- `OPEN_SIDEPANEL` $\rightarrow$ opens Chrome sidepanel for current tab.
- `IMPORT_LINKEDIN_PROFILE` (side panel $\rightarrow$ background) $\rightarrow$ multi-page import in one tab: opens `https://www.linkedin.com/in/me/` (active), waits for load (20 s), resolves the slug from the final URL, polls `SCRAPE_LINKEDIN_PROFILE` up to 6× at 1.5 s for the top card, then navigates the same tab to `/in/<slug>/details/experience/`, `education/`, `certifications/`, `projects/`, `volunteering-experiences/`, `skills/` (load 15 s, pause 600 ms, poll 5× — skills 8× — at 1.5 s, passing `knownContextNames` collected so far), and finally sends the tab back to `/in/<slug>/` (best effort). Returns `LinkedInImportResult = { success: boolean, profile?: ProfileImport, error?: string, tabId?: number, pages: { kind: 'profile'|'experience'|'education'|'certifications'|'projects'|'volunteering'|'skills', status: 'ok'|'empty'|'error', count: number }[], cancelled?: boolean }`. `success` is true when the top card or any section produced data; a page that never renders is `empty` (warning: `<Section> did not load — LinkedIn sometimes throttles this page. Scroll the LinkedIn tab, then use "Retry <section>".`), a page that cannot be navigated/messaged is `error`; neither aborts the import. Login/authwall pages return "Please sign in to LinkedIn, then try again.". The tab is never closed. Only one import runs at a time ("A LinkedIn import is already running.").
- `LINKEDIN_IMPORT_PROGRESS` (background $\rightarrow$ broadcast via `chrome.runtime.sendMessage`, no response expected) $\rightarrow$ `{ step: number, total: 7, label: 'Profile'|'Experience'|…, kind }` sent before each page; the side panel renders "Reading experience… (2/7)".
- `CANCEL_LINKEDIN_IMPORT` (side panel $\rightarrow$ background) $\rightarrow$ `{ success: true, cancelled: boolean }`; the running import stops after its current page and returns what was gathered with `cancelled: true` and the warning "Import cancelled; the pages read so far were kept.".
- `IMPORT_LINKEDIN_SECTION` (side panel $\rightarrow$ background) payload `{ kind, tabId?, slug?, knownContextNames?: string[] }` $\rightarrow$ re-reads one section page in the given tab (creates a tab on `/in/<slug|me>/details/<section>/` when it no longer exists; skips the navigation when the tab already shows that page so a user scroll is kept). Returns a `LinkedInImportResult` whose `pages` holds that one section; the side panel merges `profile` via `profileStorage.mergeImport`.
- `SCRAPE_LINKEDIN_PROFILE` (background $\rightarrow$ content script) payload `{ options?: { knownContextNames?: string[], settle?: boolean } }` $\rightarrow$ `{ success: boolean, profile?: ProfileImport, error?: string, page: 'profile'|'experience'|'education'|'certifications'|'projects'|'volunteering'|'skills'|'languages'|'unknown', rendered: string[] }`; a still-loading page answers `success: false, error: 'LinkedIn profile has not finished rendering yet.'`. The background keeps polling while `page` names a different page than the one it navigated to, and treats `success: true` with 0 entries as `ok` only when `rendered` lists that section.

### Candidate Profile
- Storage key `rezbuilder_profile`; `profileStorage.getProfile/saveProfile/updateProfile/mergeImport/clearProfile`.
- `checkProfileCompleteness(profile): ProfileCompleteness` — complete when name, ≥1 education with graduation year, ≥3 skills, ≥1 experience (projects count). Certifications optional.
- `mergeProfileImport(base, imp)` — dedupes skills case-insensitively keeping the higher rating (a manual rating always beats an import default of 3), education by institution+level, experiences by company+title, certifications by name; story fields fill only when empty.
- Importers: `resumeToProfileImport(resume)`, `parseLinkedInExportFiles(files)`, `scrapeLinkedInProfile(document, url)`.

### Best Fit Engine
- `calculateBestFit(job: JobPosting, profile: UserProfile, weights?: Partial<FitWeights>): FitResult`
  - Returns `{ fitPercent, confidence, factors[], matchedSkills[], missingSkills[], hardBlockers[], strengths[], improvements[], calculatedAt }`; factor weights always sum to 100 after redistribution; any hard blocker caps `fitPercent` at 35.
- `extractJobRequirements(job): JobRequirements` — required vs nice-to-have skills by textual context, degree/graduation window, role level, clearance, sponsorship, remote/location/employment type, themes.
- Tailoring accepts `{ profile }` so skill ratings order the skills section and bullet relevance (`tailorResumeLocally(job, resume, { profile })`).

### Detection Engine ↔ Content Script
- `jobClassifier.classify(url: string, document: Document): ClassificationResult`
  - Returns `{ isJobPage: boolean, score: number, confidence: 'high'|'medium'|'low'|'none', positiveSignals: string[], negativeSignals: string[], matchedPlatform?: string }`
- `scraperRegistry.scrape(url: string, document: Document): JobPosting | null`

### ATS Scoring Engine
- `scoreResume(job: JobPosting, resume: Resume, weights?: ATSWeights): ATSScoreResult`
  - Returns `{ overallScore: number, breakdown: { keywordMatch, placementScore, sectionCompleteness, parseSuccess, relevanceScore }, keywordGaps: string[], matchedKeywords: string[], actionVerbRecommendations: { current: string, suggested: string, context: string }[], isRecommended?: boolean }`

### Form Auto-Fill Engine
- `formFiller.fillForm(document: Document, resume: Resume): FillResult`
  - Returns `{ success: boolean, filledCount: number, fields: { name: string, fieldType: string, value: string, status: 'filled'|'skipped'|'error' }[] }`

## Code Layout
- `src/background/`: Background service worker and panel lifecycle
- `src/content/`: Content scripts, floating UI button, DOM watchers
- `src/content/detection/`: Precision job classification engine, negative filters, DOM signal extractors
- `src/content/scrapers/`: Platform-specific job scrapers (LinkedIn, Indeed, Greenhouse, Lever, Workday, Ashby, Generic)
- `src/content/autofill/`: Form field mapping, platform-specific selectors, DOM synthetic event dispatcher
- `src/services/scoring/`: ATS engine, keyword matcher, placement, section, relevance, parse scorers
- `src/services/tailor/`: Deterministic tailoring, `TailorService` (LLM + local fallback)
- `src/services/ai/`: Gemini, OpenAI, Anthropic LLM client providers
- `src/services/profile/`: Completeness gate, import merge rules, resume → profile, LinkedIn export CSV importer, inference helpers
- `src/services/fit/`: Best Fit engine (job requirement extraction, six factor scorers, themes, blockers)
- `src/content/linkedinProfile/`: Own-profile LinkedIn DOM scraper; `src/background/linkedinImport.ts` orchestrates the import tab
- `src/components/profile/`: Profile wizard/editor building blocks and the onboarding gate card
- `src/components/fit/`: Best Fit card, factor rows, skill match chips
- `src/sidepanel/`: React 18 sidepanel application, tabs (Profile, Job, Resumes, Tailor, Prep, Settings)
- `docs/AUTO_APPLY_ROADMAP.md`: Phase 2 design (not implemented)
- `tests/`: Unit and integration test suites (`vitest`)

## Verification & Remote Sync
- **Test Suite Status**: 25 test files passed, 378/378 tests passing (136 E2E tests across Tiers 1-5).
- **Production Build**: Clean Vite + @crxjs packaging with zero TypeScript errors.
- **Git Hygiene**: 100% adherence to Conventional Commits specification synchronized with `origin/main`.
