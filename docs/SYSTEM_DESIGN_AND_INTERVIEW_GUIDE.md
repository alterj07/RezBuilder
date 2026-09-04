# RezBuilder: Comprehensive System Design & Technical Interview Guide

> **Document Purpose**: Complete technical breakdown of RezBuilder for technical interviews (System Design, Frontend Architecture, Senior Software Engineering), deep architectural understanding, and LinkedIn showcase. 
> 
> *Tip for Google Docs: Copy this entire document and paste directly into Google Docs or choose `File > Open > Upload` to convert this Markdown file into a styled Google Doc.*

---

## Table of Contents
1. [Executive Summary & 30-Second Elevator Pitch](#1-executive-summary--30-second-elevator-pitch)
2. [LinkedIn Post Blueprint](#2-linkedin-post-blueprint)
3. [High-Level Architecture & Manifest V3 Design](#3-high-level-architecture--manifest-v3-design)
4. [Core System Design Concepts & Architectural Trade-offs](#4-core-system-design-concepts--architectural-trade-offs)
5. [Deep Dive into Subsystems & Algorithms](#5-deep-dive-into-subsystems--algorithms)
6. [Security, Privacy & Content Security Policy (CSP)](#6-security-privacy--content-security-policy-csp)
7. [Storage Architecture & Performance Optimization ("Why It Never Slows Down")](#7-storage-architecture--performance-optimization-why-it-never-slows-down)
8. [Comprehensive Technical Interview Q&A Bank](#8-comprehensive-technical-interview-qa-bank)

---

## 1. Executive Summary & 30-Second Elevator Pitch

### What is RezBuilder?
**RezBuilder** is an AI-powered, local-first job application copilot built as a modern Google Chrome Extension (Manifest V3). It provides instant **ATS resume scoring**, **Best Fit % candidate matching**, **real-time job scraping**, **profile-based form autofill**, and **interview preparation** directly in a persistent browser side panel.

### The 30-Second Elevator Pitch (For Recruiters & Hiring Managers)
> *"I built RezBuilder to solve a major pain point in the modern job market: candidates waste hours manually tweaking resumes and filling out repetitive applications without knowing if their background actually fits the role or beats applicant tracking systems (ATS).*
> 
> *Instead of building another slow, paid cloud SaaS that sends private resumes to external LLMs, I engineered RezBuilder as a **100% local-first, zero-network Chrome Extension**. It parses resumes locally, scrapes job boards in real-time, and executes a deterministic multi-factor fit algorithm in under 15 milliseconds. It delivers instant ATS keyword diffing, smart form autofilling, and interview prep—with zero subscription cost and zero data exfiltration."*

### The 2-Minute Technical Pitch (For Senior Engineers & System Design Interviewers)
> *"Architecturally, RezBuilder is built on Chrome Manifest V3 using React 18, TypeScript, and Tailwind CSS. The core design challenge was achieving real-time ATS scoring and form autofill across diverse ATS platforms (Greenhouse, Lever, Workday, Ashby, LinkedIn) without slowing down the user's browser or introducing security risks.*
> 
> *To solve this, I implemented:
> 1. **An Open-Closed Platform Registry** that extracts structured job postings using platform-tailored DOM heuristics and JSON-LD schema parsing.
> 2. **A Deterministic Best Fit % Engine** utilizing a 6-factor model with Hamilton-Hare adaptive weight redistribution and strict hard-blocker gating for degree, graduation, and experience mismatches.
> 3. **Dual-Tier Ephemeral/Persistent Storage** utilizing `chrome.storage.session` for active tab memory and `chrome.storage.local` for bounded profile history, completely avoiding memory leaks.
> 4. **Shadow DOM encapsulation** for injected UI components to guarantee zero CSS collisions and isolate host page event listeners.
> 
> *The entire application executes deterministically in-browser with sub-20ms latency, zero backend infrastructure cost, and absolute privacy compliance."*

---

## 2. LinkedIn Post Blueprint

*Ready-to-post template for LinkedIn to showcase your engineering rigor, system design mindset, and technical achievements:*

---

🚀 **I built RezBuilder: A 100% Local-First, Zero-Cost AI Job-Application Copilot (Chrome Extension / Manifest V3)**

Most job search tools today have two fundamental flaws:
1. They require recurring monthly subscriptions to send your private data to external LLMs.
2. They introduce significant network latency and non-deterministic hallucinations when scoring your fit.

I wanted to prove that you don't need a heavy cloud backend to deliver high-performance, real-time application assistance.

Here is how **RezBuilder** works under the hood:

⚡ **1. Sub-15ms Deterministic Best Fit & ATS Engine**
Instead of black-box prompts, RezBuilder evaluates candidates across a 6-factor deterministic model (Skills, Experience, Education, Certifications, Story & Culture, Preferences). It features adaptive weight redistribution (Hamilton largest-remainder method) and hard-blocker gating (e.g., degree requirements, graduation date limits, and seniority mismatches). Same input = identical, explainable score every time.

🛡️ **2. Zero Data Exfiltration & Complete Privacy**
Resumes contain sensitive PII: full names, physical addresses, phone numbers, and complete career histories. RezBuilder parses PDF and DOCX files entirely client-side using `pdfjs-dist` and `mammoth`. Not a single byte of candidate data leaves the browser.

🧩 **3. Extensible Scraping Pipeline**
Engineered an Open-Closed scraper registry supporting Greenhouse, Lever, Workday, Ashby, Indeed, and LinkedIn, backed by semantic fallback heuristics and schema.org JSON-LD parsing.

💾 **4. Dual-Tier Memory & Tab State Architecture**
To eliminate memory leaks when users have dozens of tabs open, RezBuilder splits storage: ephemeral tab state lives in `chrome.storage.session` (auto-garbage collected on tab removal/browser exit), while candidate profiles and bounded rolling histories (capped at 30 items) live in `chrome.storage.local`.

🎨 **5. Web Components & Shadow DOM Injection**
Our floating action button uses an isolated `attachShadow({ mode: 'open' })` root, guaranteeing zero CSS collisions with host websites (like Workday or LinkedIn) while preventing page scripts from reading extension state.

🛠️ **Tech Stack:** TypeScript, React 18, Tailwind CSS, Chrome Extensions API (MV3), Vite, Vitest (630+ automated tests).

Check out the code and architectural breakdown on GitHub: [Link to Repo]

#SoftwareEngineering #SystemDesign #TypeScript #React #ChromeExtension #WebDevelopment #FrontendEngineering #OpenSource

---

## 3. High-Level Architecture & Manifest V3 Design

```
+---------------------------------------------------------------------------------------+
|                                     BROWSER RUNTIME                                   |
|                                                                                       |
|   +--------------------------+                         +--------------------------+   |
|   |       ACTIVE TAB         |                         |    SIDE PANEL (REACT)    |   |
|   |  (e.g. Greenhouse/Lever) |                         |  (Persistent Copilot UI) |   |
|   |                          |                         |                          |   |
|   |  +--------------------+  |                         |  +--------------------+  |   |
|   |  |   Content Script   |  |   chrome.runtime.msg    |  |     ProfileTab     |  |   |
|   |  |  +---------------+ |  |<----------------------->|  +--------------------+  |   |
|   |  |  |ScraperRegistry| |  |                         |  |      JobTab        |  |   |
|   |  |  +---------------+ |  |                         |  +--------------------+  |   |
|   |  |  | FormFiller    | |  |                         |  |      TailorTab     |  |   |
|   |  |  +---------------+ |  |                         |  +--------------------+  |   |
|   |  +--------------------+  |                         |  |     PrepTab        |  |   |
|   |                          |                         |  +--------------------+  |   |
|   |  +--------------------+  |                         +--------------------------+   |
|   |  | Shadow DOM (FAB)   |  |                                      ^                 |
|   |  +--------------------+  |                                      |                 |
|   +--------------------------+                                      |                 |
|                 |                                                   |                 |
|                 v (Runtime Port / Storage Events)                   v (Data Binding)  |
|   +-------------------------------------------------------------------------------+   |
|   |                     BACKGROUND SERVICE WORKER (Event-Driven)                  |   |
|   |                                                                               |   |
|   |  * Tab Lifecycle Tracking (onActivated, onUpdated, onRemoved)                 |   |
|   |  * Active Tab Mirroring & Re-evaluation Coordination                          |   |
|   |  * Context Menus & Command Dispatch                                           |   |
|   +-------------------------------------------------------------------------------+   |
|                 |                                                   |                 |
|                 v                                                   v                 |
|   +-------------------------------+               +-------------------------------+   |
|   |    chrome.storage.session     |               |     chrome.storage.local      |   |
|   |  (Ephemeral Tab Job Cache)    |               |  (Profile, Settings, History) |   |
|   +-------------------------------+               +-------------------------------+   |
+---------------------------------------------------------------------------------------+
```

### Manifest V3 (MV3) Lifecycle Mechanics
Chrome Manifest V3 represents a massive shift from legacy MV2 extensions:
1. **Background Service Workers replace Background Pages**:
   - In MV2, background scripts stayed resident in RAM indefinitely, creating severe memory leaks.
   - In MV3, background service workers are **event-driven and stateless**. They spin up in response to events (e.g., tab switch, context menu click, runtime message) and automatically terminate after ~30 seconds of idle time.
2. **No Remote Code Execution**:
   - Arbitrary string execution (`eval()`, `new Function()`, CDN script tags) is strictly prohibited. All parsing, scoring, and UI rendering code must be bundled locally into static assets.
3. **Dedicated Chrome Side Panel API**:
   - Rather than injecting heavy iframes or modals into every webpage (which can break page layouts or get blocked by CSP), RezBuilder utilizes `chrome.sidePanel`. This provides a separate native web context adjacent to the active tab.

---

## 4. Core System Design Concepts & Architectural Trade-offs

### 1. Local-First / Zero-Network vs. Cloud Backend Architecture

| Dimension | Cloud AI Microservice Architecture | RezBuilder Local-First Architecture |
|---|---|---|
| **Latency** | 800ms - 3,500ms (Network Round-Trip + LLM Generation) | **< 15ms** (Deterministic local scoring) |
| **Cost** | High ($0.02 - $0.05 per analyzed job via LLM API) | **$0.00** (Zero server/API bills) |
| **Data Privacy** | High Risk: PII leaves client to 3rd-party servers | **Zero Risk**: Zero bytes leave the client |
| **Offline Support** | Fails without active internet connection | **Fully Functional** offline / flight mode |
| **Scalability** | Must manage autoscaling, rate limits, API keys | **Infinite Client-Side Horizontal Scalability** |
| **Determinism** | Non-deterministic (stochastic temperature drift) | **Strictly Deterministic** (100% reproducible) |

#### Why this choice was made:
Job hunting is inherently stressful; users should not wait 3 seconds for a loading spinner every time they view a job. Furthermore, resumes contain full contact details, employment history, and education records. Storing or processing this on a remote server introduces immense GDPR/CCPA compliance overhead, database costs, and user hesitation. Local computation is fast, private, and free.

---

### 2. Deterministic Scoring vs. LLM "Vibe" Scoring

#### The Problem with LLMs for Fit Scoring:
When prompt-based LLMs are used to calculate fit percentages, they suffer from:
- **Hallucination & Inconsistency**: Refreshing the page might change an 85% match to a 62% match.
- **Violation of Monotonicity**: Adding a required skill or increasing a skill proficiency from 2/5 to 5/5 can unpredictably *lower* the score due to context window token shifts.
- **Latency & Token Costs**: Re-evaluating 5 resumes against a 1,000-word job posting consumes thousands of tokens per page visit.

#### RezBuilder's Deterministic Approach:
RezBuilder implements mathematical algorithms with mathematical guarantees:
- **Monotonicity**: Upgrading a skill rating from 1 to 5 is mathematically guaranteed to never decrease `fitPercent`.
- **Explainability**: Every point awarded is backed by a discrete evidence array (e.g., *"TypeScript — used in your experience (required)"*).
- **Hard Blocker Gating**: If a posting requires a Master's degree and the user is an undergraduate, the system immediately drops the fit to **0%** without ambiguous middle ground.

---

### 3. Open-Closed Registry Pattern for Job Scraping
The scraping architecture follows the **Open-Closed Principle (OCP)**: open for extension, closed for modification.

```
                  +----------------------+
                  |   ScraperRegistry    |
                  +----------------------+
                             |
         +-------------------+-------------------+
         |                   |                   |
+-----------------+ +-----------------+ +-----------------+
|GreenhouseScraper| |   LeverScraper  | | GenericScraper  |
+-----------------+ +-----------------+ +-----------------+
 (DOM: .job-post)    (DOM: .posting)     (JSON-LD / Fallback)
```

- Every scraper implements a shared `JobScraper` interface:
  ```ts
  interface JobScraper {
    name: string;
    canScrape(url: string, document: Document): boolean;
    scrape(document: Document, url: string): Promise<JobPosting | null>;
  }
  ```
- The `ScraperRegistry` runs through registered platform adapters in priority order.
- If a site is not explicitly recognized (e.g., custom company site), the pipeline falls back to `GenericScraper`, which searches for:
  1. `application/ld+json` Schema.org `JobPosting` data.
  2. Common semantic tags (`<article>`, `<main>`, classnames containing `job-description`, `roles`, `careers`).

---

### 4. Shadow DOM UI Injection
Content scripts must often inject user-facing controls into host pages (such as the Floating Action Button).
- **The Problem**: Host pages like LinkedIn, Workday, or Greenhouse have massive global CSS stylesheets (e.g. `!important` resets, CSS resets, or high-specificity rules) that mangle injected extension HTML. Conversely, injecting extension CSS globally can destroy the host page's layout.
- **The Solution**: RezBuilder attaches an **Open Shadow Root** (`element.attachShadow({ mode: 'open' })`).
- **Benefits**:
  - Encapsulated styles: The FAB stylesheet operates in complete isolation.
  - DOM Event Isolation: Prevents external page scripts from interfering with extension button handlers.

---

## 5. Deep Dive into Subsystems & Algorithms

### 1. Best Fit % Multi-Factor Engine (`src/services/fit/`)
The headline Best Fit score evaluates candidates across six discrete dimensions:

$$\text{Best Fit \%} = \sum_{k \in \text{Factors}} \left( \frac{\text{Score}_k \times \text{Weight}_k}{100} \right)$$

1. **Skills Match (Default Weight: 40%)**: Compares candidate rated skills (1-5) against parsed required and preferred job skills using canonical keyword matching.
2. **Experience Factor (Default Weight: 25%)**: Evaluates title similarity (token overlap), years of experience vs. required years, role seniority level (intern, junior, mid, senior, lead), and required skill occurrences inside past bullet points.
3. **Education Factor (Default Weight: 15%)**: Evaluates degree level attainability (Bachelor's, Master's, PhD), field of study relevance (CS, STEM, Business, Design), and graduation window alignment.
4. **Certifications Factor (Default Weight: 5%)**: Matches industry credentials (AWS, GCP, PMP, CISSP, CKA, etc.) mentioned in the posting.
5. **Story & Culture Factor (Default Weight: 10%)**: Compares user career drivers ("impact", "mentorship", "scale") with cultural themes extracted from the job description.
6. **Preferences Factor (Default Weight: 5%)**: Evaluates remote preferences (Remote, Hybrid, On-site) and employment types.

#### The Hamilton-Hare Largest-Remainder Redistribution Algorithm
What happens when a job posting has no degree requirement or mentions no certifications? If an unmentioned factor scored 0%, it would unfairly penalize the candidate.

RezBuilder implements the **largest-remainder method (Hamilton apportionment)** to dynamically redistribute non-applicable factor weights across applicable factors:
```ts
// redistributeWeights: Normalizes applicable factor weights to always sum to exactly 100
export function redistributeWeights(weights: FitWeights, applicable: Record<FitFactorKey, boolean>): Record<FitFactorKey, number> {
  // 1. Sum available weights
  // 2. Compute proportional raw percentage
  // 3. Floor percentages and assign remainder to largest fractional parts
}
```
*Result*: Weights are guaranteed to sum to exactly 100%, without floating point drift or skewed denominators.

#### Strict 0% Hard-Blocker Rules
Certain mismatches represent non-negotiable disqualifiers:
1. **Degree Level Mismatch**: An undergraduate student applying to a role requiring a minimum Master's or PhD $\rightarrow$ **0%**.
2. **Undergraduate-Only Inversion**: A graduate student (Master's/PhD) applying to a role explicitly restricted to undergraduate students $\rightarrow$ **0%**.
3. **Graduation Date Exceeded**: An applicant graduating after the required deadline (e.g. Class of 2030 applying to a role requiring graduation before 2027) $\rightarrow$ **0%**.
4. **Experience Seniority Mismatch**: A candidate with under 1 year of experience applying to a Senior or Lead role requiring 5+ years $\rightarrow$ **0%**.

---

### 2. Deterministic ATS Match Engine (`src/services/scoring/atsEngine.ts`)
Applicant Tracking Systems (such as Taleo, iCIMS, or Greenhouse) score resumes based on parseability and keyword placement. RezBuilder mirrors this with a 5-pillar ATS Composite Score (0-100%):

1. **Keyword Match (35%)**: Exact and synonym match of core technologies.
2. **Keyword Placement (20%)**: Keywords located in the professional summary or recent job titles receive higher weighting than those buried in older experiences.
3. **Section Completeness (15%)**: Validates presence of essential ATS sections: Contact, Experience, Education, Skills.
4. **Formatting & Parseability (15%)**: Assesses bullet point density, date format standardization (`YYYY-MM`), contact info parseability, and absence of complex tables/columns that choke ATS parsers.
5. **Role Relevance & Action Verbs (15%)**: Analyzes sentence structure using a curated action verb lexicon (`actionVerbExtractor.ts`) ensuring bullets begin with high-impact past-tense verbs (e.g., *"Architected"*, *"Spearheaded"*, *"Optimized"*).

---

### 3. Resume Tailoring Engine & Semantic Diffing (`src/services/tailor/`)
When the user tailors a resume for a specific job:
1. The engine calculates an ATS keyword gap analysis (`GapAlertCard.tsx`).
2. It generates a diff between the baseline resume and the tailored variant using the Myers diff algorithm (`diff` package).
3. The tailored output can be exported to **PDF** (via `pdfjs-dist` rendering), **DOCX** (via `docx` XML generation), or **Markdown**—all formatted to be clean, single-column, and ATS-compliant.

---

### 4. Smart Form Autofill Engine (`src/content/autofill/`)
Automating job applications requires bridging the gap between stored candidate profiles and arbitrary HTML forms:
- **Heuristic Input Classifier (`fieldDetector.ts`)**: Evaluates `name`, `id`, `placeholder`, `aria-label`, and adjacent `<label>` text using regex lexicons to identify fields (e.g. First Name, GitHub URL, Years of Experience, Sponsorship Status).
- **Synthetic Event Dispatching (`domEvents.ts`)**: Modern frontend frameworks (React, Angular, Vue) use controlled components. Simply setting `input.value = "Jane"` does not trigger React's internal `onChange` state updater. RezBuilder calls the native input prototype setter and dispatches synthetic `input`, `change`, and `blur` events so forms register the user data correctly.

---

## 6. Security, Privacy & Content Security Policy (CSP)

### 1. Zero Data Exfiltration
- **No telemetry, no tracking analytics, no cloud databases.**
- All user profile records, resumes, and scraped job descriptions reside in Chrome's sandboxed browser storage.
- If the user enables optional AI features, API calls are made directly from their browser to OpenAI/Anthropic/Gemini using their own API key (stored encrypted in `chrome.storage.local`).

### 2. Strict Content Security Policy Compliance
Manifest V3 enforces a hardened CSP:
```json
"content_security_policy": {
  "extension_pages": "script-src 'self'; object-src 'self';"
}
```
- No external CDN scripts can be imported at runtime.
- No `eval()`, preventing DOM-based script injection attacks.
- PDF parsing via `pdfjs-dist` runs without web workers requiring remote origins.

### 3. Isolation of Host Privileges
- Host permissions are tightly scoped to career platforms (`*.linkedin.com`, `boards.greenhouse.io`, `jobs.lever.co`, etc.).
- Content scripts run at `document_idle` to prevent delaying page load or blocking host execution threads.

---

## 7. Storage Architecture & Performance Optimization ("Why It Never Slows Down")

A common issue with browser extensions is that they degrade browser performance over time, causing high CPU usage and sluggish tabs. RezBuilder was specifically engineered to avoid this.

### 1. Dual-Tier Storage Strategy
Extensions have access to different storage areas with distinct performance characteristics:

| Storage Area | Lifecycle | Use in RezBuilder |
|---|---|---|
| `chrome.storage.session` | Cleared when browser closes | Stores ephemeral `tabJobs` (map of `tabId` $\rightarrow$ parsed job). Auto-cleans tab entries on `chrome.tabs.onRemoved`. |
| `chrome.storage.local` | Persistent across restarts | Stores candidate profile (`rezbuilder_profile`), active job mirror, user settings, and resume files. |

#### Why this prevents memory bloat:
If tab scraping data were stored in `chrome.storage.local`, every tab you ever opened would leave permanent residue in storage. By keeping per-tab state in `chrome.storage.session` and deleting keys as soon as tabs close, the storage footprint remains flat regardless of how many tabs you browse.

### 2. Strict Bounded History (Sliding Window FIFO)
Unchecked arrays in storage are a primary cause of extension lag. RezBuilder enforces strict capacity limits:
- `jobHistory` is limited to a maximum of **30 entries** (`history.slice(0, 30)`).
- Profile experience and project lists enforce duplicate deduplication by normalized entity keys.
- Stored profile size is typically $< 50\text{ KB}$, well beneath Chrome's 10MB local storage limit.

### 3. Pre-compiled Regex Singletons
Regex creation is expensive in JavaScript. If an extension compiles regular expressions inside an input loop or DOM traversal, the garbage collector spikes CPU usage.
- All lexicons in RezBuilder (skills, degree ranks, certifications, stop words) are instantiated as **module-level RegExp singletons** compiled once at script evaluation time:
  ```ts
  const CLEARANCE_RE = /\bsecurity\s+clearance\b|\bts\/sci\b/i; // Compiled once
  ```

### 4. Algorithmic Complexity: Sub-15ms Execution
- **Tokenization**: O(N) where N is text length.
- **Skill Extraction & Matching**: Uses `Set<string>` lookups ($O(1)$) rather than nested array scans ($O(N \times M)$).
- In automated benchmarks (`tests/fitEngine.test.ts`), **1,000 full candidate evaluations execute in under 1.8 seconds** (~1.8ms per evaluation).

---

## 8. Comprehensive Technical Interview Q&A Bank

Here are real-world questions senior interviewers will ask about this project, along with high-scoring answers.

---

### Q1: "Why did you build RezBuilder as a Chrome Extension instead of a standard Web Application?"
**Answer:**
> *"I chose a Chrome Extension for three reasons: **context proximity**, **frictionless scraping**, and **privacy**.
> 
> A standard SaaS requires candidates to manually copy-paste job descriptions into a web dashboard, which introduces high friction. With an extension using the Chrome Side Panel API, the assistant sits directly beside the live application on Greenhouse or LinkedIn. 
> 
> Second, browser extensions operate with user-permitted DOM access, allowing direct client-side parsing of job boards without maintaining brittle headless scrapers (Puppeteer/Playwright) on a backend server that frequently get blocked by Cloudflare or Akamai bot protections.
> 
> Finally, it allows a true **local-first architecture**: sensitive resume data never leaves the client machine, eliminating server costs and compliance burdens."*

---

### Q2: "How did you ensure deterministic scoring without relying on non-deterministic LLMs?"
**Answer:**
> *"LLMs are great for creative rephrasing, but they make terrible evaluative scoring engines because of temperature drift, token context sensitivity, and high latency.
> 
> I designed a deterministic 6-factor model that parses structured requirements (skills, years, degree level, graduation date) and compares them against the candidate's profile using set theory and token similarity metrics. 
> 
> For missing job fields, I implemented the Hamilton-Hare largest-remainder apportionment algorithm to redistribute weights so that the total is always normalized to 100%. This ensures mathematical monotonicity: improving a skill rating or adding relevant experience is guaranteed to never reduce your fit score, which builds user trust."*

---

### Q3: "What happens if a user opens 50 tabs at once? How do you prevent memory leaks?"
**Answer:**
> *"We address this at both the storage and runtime levels.
> 
> First, background processing is stateless under Manifest V3; there is no persistent background page consuming RAM. 
> 
> Second, per-tab scraping results are partitioned in `chrome.storage.session`, indexed by `tabId`. We attach a listener to `chrome.tabs.onRemoved` that immediately cleans up tab data when closed. 
> 
> Third, persistent history in `chrome.storage.local` is maintained using a sliding window bounded at 30 items. 
> 
> Finally, content script DOM manipulation is injected at `document_idle`, minimizing memory overhead and avoiding blocking the page's main thread."*

---

### Q4: "How do you handle scraping Single Page Applications (SPAs) where job content renders dynamically?"
**Answer:**
> *"Modern platforms like Workday, Lever, and LinkedIn use client-side hydration (React/Vue), so standard initial HTML parsing often fails. 
> 
> Our architecture addresses this through:
> 1. **`document_idle` execution**: Ensuring scripts run after initial DOM parsing completes.
> 2. **Re-evaluation messages**: When tabs update via `chrome.tabs.onUpdated` (status === 'complete') or when switching tabs via `chrome.tabs.onActivated`, the background worker asks the content script to re-evaluate the DOM.
> 3. **Structured Schema Fallback**: We inspect `document.querySelector('script[type="application/ld+json"]')` to read Schema.org `JobPosting` JSON directly from the page data layer, bypassing volatile DOM hierarchies."*

---

### Q5: "How does the autofill engine handle React-controlled inputs that ignore programmatic value assignment?"
**Answer:**
> *"In React 16+, assigning `input.value = 'My Name'` directly updates the DOM node, but React tracks input values using an internal value tracker. When the next render cycle occurs, React detects that no native event occurred and overwrites the input with the old state.
> 
> To solve this in `domEvents.ts`, we extract the native property setter directly from `window.HTMLInputElement.prototype`:
> ```ts
> const nativeSetter = Object.getOwnPropertyDescriptor(
>   window.HTMLInputElement.prototype, 'value'
> )?.set;
> nativeSetter?.call(inputElement, value);
> inputElement.dispatchEvent(new Event('input', { bubbles: true }));
> inputElement.dispatchEvent(new Event('change', { bubbles: true }));
> inputElement.dispatchEvent(new Event('blur', { bubbles: true }));
> ```
> This forces React’s synthetic event dispatcher to register the change and synchronize its component state."*

---

### Q6: "How do you handle schema versioning in local storage without an SQL migration runner?"
**Answer:**
> *"Every `UserProfile` stored in `chrome.storage.local` contains a literal `version: 1` field.
> 
> In `profileStorage.ts`, we implement a schema hydration function that intercepts every read. If an older schema version is detected (or missing new fields, such as `certifications` or `undergradOnly`), the migration pipeline applies pure transformation functions to upgrade the schema in memory and writes the updated object back to storage atomically. This guarantees backward compatibility without requiring remote migration scripts."*

---

### Q7: "How did you design the Best Fit algorithm to handle severe mismatches like an undergrad applying for a Master's role?"
**Answer:**
> *"A common bug in weighted scoring algorithms is that a candidate with 100% in skills and certifications can score an 85% overall, even if they fail a mandatory requirement like holding a Master's degree or possessing a Top Secret clearance.
> 
> To fix this, I introduced **Hard Blocker Gating**. Before weights are computed, the engine checks for hard blockers:
> - Degree level mismatch (e.g. Undergrad vs. Master's/PhD requirement).
> - Target audience restrictions (e.g. Graduate student applying to an Undergrad-only role).
> - Graduation date deadline passed (e.g. Class of 2030 applying to a job requiring graduation by 2027).
> - Seniority mismatch (Student applying to Lead/Staff position).
> 
> If any hard restriction is violated, the headline score is clamped immediately to **0%**, and a descriptive blocker chip is surfaced in the UI to give the user transparent feedback."*

---

### Q8: "If you were to scale this product to 100,000 active users, what would you improve next?"
**Answer:**
> *"From a product perspective, I would implement **Phase 2: Automated Board Polling & Auto-Apply**:
> 1. **Client-Side Scheduled Polling**: Use `chrome.alarms` to poll public, unauthenticated board endpoints (Greenhouse API, Lever JSON API) for new postings matching saved search criteria.
> 2. **Canonical Answer Bank**: An encrypted question-answer bank that fuzzy-matches common application questions ('Why do you want to work here?', EEO surveys, visa questions) to eliminate repetitive typing.
> 3. **On-Device SLM (Small Language Model)**: Integrate Chrome's built-in `window.ai` (Gemini Nano) or WebLLM to perform completely private, client-side rephrasing of cover letters without external API dependencies."*

---
*Author: RezBuilder Engineering Team*  
*Document Version: 1.0.0*  
*Last Updated: September 2026*
