# RezBuilder — AI Job-Application Copilot (Chrome Extension)

**RezBuilder** is an intelligent job-application copilot built for Chrome (Manifest V3) that sits right in your browser's Side Panel while you browse job listings. It detects and scrapes job postings in real time, scores your resumes against ATS algorithms using a 5-factor weighted formula, tailors your bullet points deterministically with zero fabrication, and generates interview briefings with exportable cheat sheets.

> [!NOTE]
> **100% Local & Offline by Default**: RezBuilder's tailoring, scoring, and interview prep engines run completely in-browser without requiring any external LLM API keys, subscriptions, or outbound data sharing.

---

## Key Features

1. **Intelligent Job Detection & In-Page Floating Action Button (FAB)**
   - Specialized DOM scrapers for **LinkedIn**, **Indeed**, **Greenhouse**, and **Lever**, plus an intelligent fallback reader for arbitrary career sites.
   - Non-intrusive floating action button injected on detected job pages to capture details with a single click.
   - Right-click text selection fallback (*"Analyze with RezBuilder"*).

2. **Resume Management & Client-Side Ingestion**
   - Upload multiple resumes in **PDF**, **DOCX**, or **TXT** format.
   - Fully parsed in-browser via `pdfjs-dist` and `mammoth.js` into structured sections (*Contact*, *Summary*, *Experience*, *Education*, *Skills*, *Projects*).
   - Auto-bypasses owner password restrictions on encrypted PDFs with an optional password prompt modal for user-encrypted files.
   - Tag resumes by specialization (e.g. `Software Eng — Backend`, `PM — Growth`, `DevOps`).

3. **5-Factor Weighted ATS Scoring Engine**
   - Calculates a deterministic match score (0–100) using the formula:
     $$\text{Score} = (\text{Keyword Match} \times W_1) + (\text{Placement} \times W_2) + (\text{Sections} \times W_3) + (\text{Parse Success} \times W_4) + (\text{Relevance} \times W_5)$$
   - **Platform Presets**:
     - *Standard ATS* ($45 / 15 / 15 / 15 / 10$)
     - *Enterprise ATS* (Workday / Taleo style: $50 / 15 / 15 / 10 / 10$)
     - *Modern ATS* (Greenhouse / Lever style: $40 / 15 / 20 / 10 / 15$)
     - *Custom Weights*
   - Multi-resume comparison ranking with top-fit recommendations.

4. **Zero-LLM Local Resume Customization & Diff Viewer**
   - **Action Verb Standardizer**: Replaces weak openers (*"worked on"*, *"helped with"*) with strong action verbs (*"Engineered"*, *"Architected"*, *"Optimized"*).
   - **Keyword Alignment**: Normalizes technical terminology and casing directly matching target JD requirements.
   - **Relevance Prioritization**: Scores each experience bullet and sorts the most impactful achievements to the top of each role.
   - **Honest Gap Detection**: Pinpoints unmet JD qualifications in a dedicated **Gap Alert Card** without fabricating experience.
   - Interactive Before/After **Diff Viewer** (Unified Inline & Side-by-side split).
   - Export to ATS-safe single-column **DOCX** (`.docx`) and clean **PDF**.

5. **Local Interview Prep Briefing & Cheat Sheet**
   - Synthesizes role focus and core technical concepts.
   - Curated technical Q&As mapped to matched technologies with talking points.
   - Behavioral STAR framework coaching questions.
   - High-signal questions to ask the interviewer.
   - 1-Click export to **Markdown cheat sheet** (`.md`).

6. **100% Client-Side Privacy**
   - All resumes, job postings, and settings are stored exclusively in your browser via `chrome.storage.local`.
   - Zero external tracking, telemetry, or third-party database dependencies.

---

## Tech Stack

- **Manifest V3** Chrome Extension
- **React 18** + **TypeScript** + **Tailwind CSS** (Linear/Notion dark aesthetic)
- **Vite** + **@crxjs/vite-plugin** for HMR and build pipeline
- **pdfjs-dist** (with local bundled worker) & **mammoth.js** for browser-side file parsing
- **docx** library for ATS-compliant DOCX document creation
- **Vitest** for unit test suite

---

## Setup & Installation

### 1. Install Dependencies & Build
```bash
# Clone or navigate to the repository
cd RezBuilder

# Install packages
npm install

# Run automated tests
npm run test

# Build production unpacked extension
npm run build
```

The compiled extension will be generated in the `dist/` directory.

---

## Loading the Extension in Google Chrome

1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** using the toggle in the top-right corner.
3. Click the **Load unpacked** button in the top-left corner.
4. Select the `dist/` directory inside your `RezBuilder` project folder.
5. Pin the **RezBuilder** extension icon to your Chrome toolbar for quick access.

---

## User Guide & Workflow

### Step 1: Upload Your Resumes
1. Click the RezBuilder extension icon to open the **Chrome Side Panel**.
2. Navigate to the **Resumes** tab.
3. Drag and drop your existing PDF or DOCX resume(s).
4. Assign an optional tag (e.g. `Backend Engineer` or `Full Stack`).
5. Click the eye icon to inspect the extracted sections (Summary, Experience, Skills, Education).

### Step 2: Browse Job Postings & ATS Match
1. Browse to any job posting on **LinkedIn**, **Indeed**, **Greenhouse**, or **Lever**.
2. The floating **RezBuilder Action Button** will appear in the bottom-right corner. Click it to capture the JD into your Side Panel.
3. Switch to the **Job** tab to review the **5-Factor ATS Score Breakdown**, matched skills, missing keywords, and recommended action steps.

### Step 3: Tailor Your Resume & Export (Instant Local Engine)
1. In the **Job** tab, click **Tailor Resume for this Role** (or navigate to the **Tailor** tab).
2. Click **Generate Tailored Resume (Instant Local)**.
3. Review the **Diff Viewer** to inspect before/after bullet changes and review any unfulfilled JD skills in the **Unresolved Gaps** card.
4. Make any manual adjustments in the inline editor, then click:
   - **DOCX** to download an ATS-formatted Word document.
   - **PDF** to open a clean print dialog.

### Step 4: Prepare for the Interview
1. Navigate to the **Prep** tab and click **Generate Prep Briefing**.
2. Review the technical talking points, behavioral STAR framework tips, and questions to ask the interviewer.
3. Click **Export .MD** to download your interview cheat sheet.

---

## Running Automated Tests

Run the Vitest test suite covering scrapers, parsers, the 5-factor ATS scoring formula, local tailoring engine, and document exporters:

```bash
npm run test
```
