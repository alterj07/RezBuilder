import { describe, it, expect, beforeEach } from 'vitest';
import { jobClassifier } from '../../src/content/detection/jobClassifier';
import { scraperRegistry } from '../../src/content/scrapers/scraperRegistry';
import { calculateAtsScore } from '../../src/services/scoring/atsEngine';
import { compareResumesAgainstJob } from '../../src/services/scoring/multiResumeComparator';
import { tailorResumeLocally } from '../../src/services/tailor/localTailorEngine';
import { generateDocxResume } from '../../src/services/export/docxExporter';
import { generateResumeHtml } from '../../src/services/export/pdfExporter';
import {
  createDomDocument,
  formFiller,
} from '../helpers/domUtils';
import { setupMockChrome } from '../helpers/mockChrome';
import {
  GREENHOUSE_DOM_FIXTURE,
  LEVER_DOM_FIXTURE,
  WORKDAY_DOM_FIXTURE,
  ALGOMASTER_NEGATIVE_DOM_FIXTURE,
} from '../fixtures/domFixtures';
import {
  MOCK_SENIOR_FULLSTACK_RESUME,
  MOCK_JUNIOR_FRONTEND_RESUME,
  MOCK_PRODUCT_MANAGER_RESUME,
} from '../fixtures/mockResumes';

describe('Tier 3: Cross-Feature Integration Pipelines (8 Tests)', () => {
  beforeEach(() => {
    setupMockChrome();
  });

  it('T3-INT-01: Detection -> Scraping Pipeline for Greenhouse Job Board', () => {
    const doc = createDomDocument(GREENHOUSE_DOM_FIXTURE);
    const url = 'https://boards.greenhouse.io/stripe/jobs/987654';

    // Step 1: Page Classification
    const classification = jobClassifier.classify(url, doc);
    expect(classification.isJobPage).toBe(true);
    expect(classification.confidence).toBe('high');

    // Step 2: Automated Scraper Dispatching
    const job = scraperRegistry.detectAndScrape(url, doc);
    expect(job).not.toBeNull();
    expect(job?.title).toBe('Lead DevOps Engineer');
    expect(job?.company).toBe('Stripe');
    expect(job?.source).toBe('greenhouse');
    expect(job?.requiredSkills.length).toBeGreaterThanOrEqual(4);
  });

  it('T3-INT-02: Scraping -> ATS Scoring Candidate Ranking Pipeline', () => {
    const doc = createDomDocument(WORKDAY_DOM_FIXTURE);
    const url = 'https://acme.wd5.myworkdayjobs.com/Careers/job/Staff-Software-Engineer_R10203';

    // Step 1: Scrape Workday posting
    const job = scraperRegistry.detectAndScrape(url, doc);
    expect(job).not.toBeNull();

    // Step 2: Multi-Resume Comparison
    const { recommendation, rankedResumes } = compareResumesAgainstJob(job!, [
      MOCK_JUNIOR_FRONTEND_RESUME,
      MOCK_SENIOR_FULLSTACK_RESUME,
    ]);

    expect(rankedResumes).toHaveLength(2);
    expect(rankedResumes[0].resumeId).toBe('res_senior_fullstack');
    expect(recommendation?.resumeId).toBe('res_senior_fullstack');
    expect(recommendation?.isRecommended).toBe(true);
    expect(rankedResumes[0].scoreResult.overallScore).toBeGreaterThan(
      rankedResumes[1].scoreResult.overallScore
    );
  });

  it('T3-INT-03: ATS Scoring -> Resume Tailoring Enhancement Pipeline', () => {
    const doc = createDomDocument(GREENHOUSE_DOM_FIXTURE);
    const url = 'https://boards.greenhouse.io/stripe/jobs/987654';
    const job = scraperRegistry.detectAndScrape(url, doc)!;

    // Step 1: Baseline ATS Score
    const baselineScore = calculateAtsScore(job, MOCK_SENIOR_FULLSTACK_RESUME);
    expect(baselineScore.overallScore).toBeGreaterThan(0);

    // Step 2: Local Tailoring
    const tailored = tailorResumeLocally(job, MOCK_SENIOR_FULLSTACK_RESUME);
    expect(tailored.sections.skills.slice(0, 10)).toEqual(
      expect.arrayContaining(['Kubernetes', 'Terraform', 'Go', 'TypeScript'])
    );

    // Step 3: Verify tailored bullet points are prioritized
    const topBullet = tailored.sections.experience[0].bullets[0].toLowerCase();
    expect(
      topBullet.includes('kubernetes') ||
      topBullet.includes('terraform') ||
      topBullet.includes('gcp')
    ).toBe(true);
  });

  it('T3-INT-04: Tailored Resume -> Lever Form Auto-Fill Pipeline', () => {
    const doc = createDomDocument(LEVER_DOM_FIXTURE);
    const url = 'https://jobs.lever.co/examplecorp/12345-abcde';
    const job = scraperRegistry.detectAndScrape(url, doc)!;

    // Step 1: Tailor candidate resume for Lever PM role
    const tailored = tailorResumeLocally(job, MOCK_PRODUCT_MANAGER_RESUME);

    // Convert tailored result to resume for autofill
    const tailoredResume = {
      ...MOCK_PRODUCT_MANAGER_RESUME,
      sections: tailored.sections,
    };

    // Step 2: Auto-fill Lever form
    const fillResult = formFiller.fillForm(doc, tailoredResume);
    expect(fillResult.success).toBe(true);
    expect(fillResult.platform).toBe('lever');
    expect(fillResult.filledCount).toBeGreaterThanOrEqual(4);

    const nameInput = doc.querySelector('input[name="name"]') as HTMLInputElement;
    const emailInput = doc.querySelector('input[name="email"]') as HTMLInputElement;
    const orgInput = doc.querySelector('input[name="org"]') as HTMLInputElement;

    expect(nameInput.value).toBe('Morgan Vance');
    expect(emailInput.value).toBe('morgan.vance@example.com');
    expect(orgInput.value).toBe('SaaS Metrics Co');
  });

  it('T3-INT-05: Complete 5-Stage End-to-End Pipeline (Detection -> Scrape -> ATS -> Tailor -> Autofill)', () => {
    const doc = createDomDocument(GREENHOUSE_DOM_FIXTURE);
    const url = 'https://boards.greenhouse.io/stripe/jobs/987654';

    // Stage 1: Detection
    const classification = jobClassifier.classify(url, doc);
    expect(classification.isJobPage).toBe(true);

    // Stage 2: Scraping
    const job = scraperRegistry.detectAndScrape(url, doc);
    expect(job).not.toBeNull();

    // Stage 3: ATS Scoring
    const atsResult = calculateAtsScore(job!, MOCK_SENIOR_FULLSTACK_RESUME);
    expect(atsResult.overallScore).toBeGreaterThanOrEqual(80);

    // Stage 4: Tailoring
    const tailored = tailorResumeLocally(job!, MOCK_SENIOR_FULLSTACK_RESUME);
    expect(tailored.unresolvedGaps).toBeDefined();

    // Stage 5: Form Auto-fill
    const fillResult = formFiller.fillForm(doc, MOCK_SENIOR_FULLSTACK_RESUME);
    expect(fillResult.success).toBe(true);
    expect(fillResult.filledCount).toBeGreaterThanOrEqual(4);

    const firstInput = doc.querySelector('#first_name') as HTMLInputElement;
    const lastInput = doc.querySelector('#last_name') as HTMLInputElement;
    expect(firstInput.value).toBe('Alex');
    expect(lastInput.value).toBe('Rivera');
  });

  it('T3-INT-06: Negative Veto Pipeline Suppression for Algomaster Course Page', () => {
    const doc = createDomDocument(ALGOMASTER_NEGATIVE_DOM_FIXTURE);
    const url = 'https://algomaster.io/learn/system-design/course-introduction';

    // Stage 1: Classifier Negative Veto
    const classification = jobClassifier.classify(url, doc);
    expect(classification.isJobPage).toBe(false);
    expect(classification.score).toBe(0);

    // Downstream stages must be suppressed when isJobPage is false
    let scrapingTriggered = false;
    let autofillTriggered = false;

    if (classification.isJobPage) {
      scrapingTriggered = true;
      autofillTriggered = true;
    }

    expect(scrapingTriggered).toBe(false);
    expect(autofillTriggered).toBe(false);
  });

  it('T3-INT-07: Storage and Extension Runtime State Synchronization Flow', async () => {
    const { store } = setupMockChrome();

    let storageChangedCalled = false;
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.activeJob) {
        storageChangedCalled = true;
      }
    });

    const doc = createDomDocument(GREENHOUSE_DOM_FIXTURE);
    const job = scraperRegistry.detectAndScrape('https://boards.greenhouse.io/stripe/jobs/987654', doc);

    // Simulate content script saving scraped job
    await chrome.storage.local.set({ activeJob: job });

    expect(store.local.activeJob).toBeDefined();
    expect(store.local.activeJob.title).toBe('Lead DevOps Engineer');
    expect(storageChangedCalled).toBe(true);
  });

  it('T3-INT-08: Multi-Format Exporter Integration with Tailored Resume', async () => {
    const doc = createDomDocument(GREENHOUSE_DOM_FIXTURE);
    const job = scraperRegistry.detectAndScrape('https://boards.greenhouse.io/stripe/jobs/987654', doc)!;

    const tailored = tailorResumeLocally(job, MOCK_SENIOR_FULLSTACK_RESUME);

    // Export DOCX
    const docxBlob = await generateDocxResume(tailored.sections, 'Alex Rivera');
    expect(docxBlob).toBeDefined();
    expect(docxBlob.size).toBeGreaterThan(100);

    // Export HTML
    const html = generateResumeHtml(tailored.sections, 'Alex Rivera');
    expect(html).toContain('Alex Rivera');
    expect(html).toContain('CloudScale Inc');
    expect(html).toContain('Lead Infrastructure & Backend Engineer');
  });
});
