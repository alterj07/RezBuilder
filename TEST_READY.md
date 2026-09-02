# E2E Test Suite Ready

## Test Runner
- **E2E Suite Command**: `npx vitest run tests/e2e/`
- **Full Test Suite Command**: `npm test` (`npx vitest run`)
- **Expected Outcome**: All tests pass with exit code 0.

## Coverage Summary
| Tier | Count | Description |
|------|------:|-------------|
| 1. Feature Coverage | 30 | 6 tests per feature across 5 core features (Classifier, Scrapers, ATS Scoring, Tailor Engine, Form Filler) |
| 2. Boundary & Corner | 30 | 6 tests per feature covering negative veto (algomaster.io, MDN, LeetCode), empty/malformed DOMs, extreme strings, degenerate weights |
| 3. Cross-Feature | 8 | Multi-module integration pipelines (Detection $\rightarrow$ Scraping $\rightarrow$ ATS Scoring $\rightarrow$ Tailoring $\rightarrow$ Form Auto-fill $\rightarrow$ Export) |
| 4. Real-World Application | 6 | Realistic end-to-end application scenarios (Algomaster Negative, Greenhouse Stripe, Lever PM, Workday Enterprise, Schema.org, Ashby ML) |
| 5. Adversarial Hardening | 62 | White-box adversarial stress testing (29 Detection & Scraper tests + 33 ATS, Tailoring & Form Auto-fill tests) |
| **Total E2E Tests** | **136** | **100% Pass Rate (136/136 E2E, 378/378 Full Repository Tests)** |

## Feature Checklist
| Feature | Tier 1 | Tier 2 | Tier 3 | Tier 4 | Tier 5 |
|---------|:------:|:------:|:------:|:------:|:------:|
| Precision Job Page Classifier & Negative Veto | 6 | 6 | ✓ | ✓ | 13 |
| Platform Job Scrapers (Greenhouse, Lever, Workday, Ashby, Schema.org, Generic) | 6 | 6 | ✓ | ✓ | 16 |
| ATS Match Scoring & Recommendations | 6 | 6 | ✓ | ✓ | 10 |
| Resume Tailoring Engine (Deterministic Local + Guardrails + AI Fallback) | 6 | 6 | ✓ | ✓ | 10 |
| Form Auto-Fill Engine (Platform Mappers, 2-Pass Matching, Synthetic Events) | 6 | 6 | ✓ | ✓ | 13 |

## Test Suite File Index
- `tests/fixtures/domFixtures.ts`: Realistic HTML DOM fixtures for Greenhouse, Lever, Workday, Ashby, Schema.org, Algomaster (negative), MDN (negative), LeetCode (negative), GitHub issues (negative), Medium (negative), and malformed/corner DOMs.
- `tests/fixtures/mockResumes.ts`: Typed candidate resumes (Senior Fullstack, Junior Frontend, ML Specialist, Product Manager, Minimal "Cher", Degenerate).
- `tests/helpers/mockChrome.ts`: In-memory Chrome extension API mock harness (`storage.local/sync`, `runtime.sendMessage`, `sidePanel`, `tabs`).
- `tests/helpers/domUtils.ts`: DOM parser helpers, synthetic event dispatcher (`input`, `change`, `blur`), and `FormFiller` engine.
- `tests/e2e/tier1_feature_coverage.test.ts`: 30 tests covering core feature functionality.
- `tests/e2e/tier2_boundary_corner.test.ts`: 30 tests covering boundaries, edge cases, and negative vetoes.
- `tests/e2e/tier3_cross_feature.test.ts`: 8 tests covering multi-stage integration pipelines.
- `tests/e2e/tier4_real_world.test.ts`: 6 tests covering real-world end-to-end user workflows.
- `tests/e2e/tier5_detection_adversarial.test.ts`: 29 tests covering detection engine & platform scrapers adversarial hardening.
- `tests/e2e/tier5_ats_autofill_adversarial.test.ts`: 33 tests covering ATS scoring, resume tailoring, and form auto-fill adversarial hardening.
