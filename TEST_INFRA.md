# E2E Test Infra: RezBuilder

## Test Philosophy
- Opaque-box, requirement-driven, testing against the acceptance criteria in `ORIGINAL_REQUEST.md`.
- Methodology: Category-Partition + Boundary Value Analysis (BVA) + Pairwise Combinatorial Testing + Real-World Workload Testing.

## Feature Inventory
| # | Feature | Source (Requirement) | Tier 1 | Tier 2 | Tier 3 |
|---|---------|----------------------|:------:|:------:|:------:|
| 1 | Job Page Classifier & Negative Veto | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ |
| 2 | Platform Job Scrapers | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ |
| 3 | ATS Match Scoring & Verb Recommendations | ORIGINAL_REQUEST §R3 | 5 | 5 | ✓ |
| 4 | Resume Tailoring Engine (Local + AI) | ORIGINAL_REQUEST §R3 | 5 | 5 | ✓ |
| 5 | Form Auto-Fill Engine | ORIGINAL_REQUEST §R3 | 5 | 5 | ✓ |

## Test Architecture
- Test Runner: Vitest (`npm test` / `npx vitest run`)
- Test Directory Layout:
  - `tests/unit/` or `tests/*.test.ts`: Unit tests for scoring, tailoring, scraping, parsing, autofill.
  - `tests/e2e/`: End-to-end integration workflows (Job Detection Pipeline, ATS Evaluation Flow, Resume Tailoring Flow, Application Auto-Fill Flow).
- Mock DOM / Chrome API: `jsdom` or synthetic DOM elements with mock `chrome.runtime`, `chrome.storage`, `chrome.sidePanel`.

## Real-World Application Scenarios (Tier 4)
| # | Scenario | Features Exercised | Complexity |
|---|----------|--------------------|------------|
| 1 | Algomaster System Design Course Navigation (Negative Test) | Classifier, Negative Veto Filters, Floating Button suppression | High |
| 2 | Greenhouse Job Application & Auto-Fill Flow | Greenhouse Scraper, ATS Scoring, Local Tailoring, Greenhouse Form Auto-Fill | High |
| 3 | Lever Job Application & Auto-Fill Flow | Lever Scraper, Keyword Gap Analysis, Lever Form Auto-Fill | High |
| 4 | Workday Enterprise Application Flow | Workday Scraper, Multi-Resume Ranking, Workday Form Auto-Fill | High |
| 5 | Generic Job Page with Schema.org JSON-LD | Generic Scraper, Schema.org Parser, ATS Scoring, Generic Form Auto-Fill | High |

## Coverage Thresholds
- Tier 1: $\ge 5$ tests per feature (Total $\ge 25$ tests)
- Tier 2: $\ge 5$ boundary/corner tests per feature (Total $\ge 25$ tests)
- Tier 3: Pairwise cross-feature combinations ($\ge 5$ tests)
- Tier 4: $\ge 5$ realistic end-to-end application scenarios
- **Total Minimum Test Count: $\ge 60$ tests**
