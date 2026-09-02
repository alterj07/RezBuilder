# Project: RezBuilder AI Job-Application Copilot

## Architecture
RezBuilder is a Chrome Extension (Manifest V3) structured into four primary layers:
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

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| E2E | E2E Test Suite Creation | Build 4-Tier test suite (Tiers 1-4) across detection, ATS, tailoring, and autofill | None | DONE |
| M1 | Precision Job Page Detection Engine | Implement `JobClassifier`, negative veto filters, Schema.org parser, Workday/Ashby scrapers, eliminate false positives on algomaster.io | None | DONE |
| M2 | ATS Enhancements, Resume Tailoring & Form Auto-Fill | Action verb recommendations in ATS score, unified `TailorService`, complete `FormFiller` engine & tests | M1 | DONE |
| M3 | UI Runtime Integration & CSP Polish | Remove external font link CSP warnings, verify sidepanel & floating button integration | M2 | DONE |
| M4 | Final Milestone: E2E Test Suite Pass & Adversarial Hardening | Pass 100% of E2E test suite (Tiers 1-4) + Tier 5 Adversarial Coverage Hardening | E2E, M3 | DONE |
| M5 | Conventional Git Commits & Remote Push | Verify all commit messages match Conventional Commits format and push to remote | M4 | DONE |

## Interface Contracts

### Content Script ↔ Background Service Worker
- `GET_JOB_DATA` $\rightarrow$ returns `{ isJobPage: boolean, job?: JobPosting }`
- `TRIGGER_AUTOFILL` $\rightarrow$ payload `{ resume: Resume }`, returns `{ success: boolean, fieldsFilled: string[], message?: string }`
- `OPEN_SIDEPANEL` $\rightarrow$ opens Chrome sidepanel for current tab.

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
- `src/sidepanel/`: React 18 sidepanel application, tabs (Score, Tailor, Interview, Tracker, Settings)
- `tests/`: Unit and integration test suites (`vitest`)
