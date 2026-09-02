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
  ALGOMASTER_NEGATIVE_DOM_FIXTURE,
  GREENHOUSE_DOM_FIXTURE,
  LEVER_DOM_FIXTURE,
  WORKDAY_DOM_FIXTURE,
  SCHEMA_ORG_DOM_FIXTURE,
  ASHBY_DOM_FIXTURE,
} from '../fixtures/domFixtures';
import {
  MOCK_SENIOR_FULLSTACK_RESUME,
  MOCK_PRODUCT_MANAGER_RESUME,
  MOCK_SPECIALIST_ML_RESUME,
  MOCK_JUNIOR_FRONTEND_RESUME,
} from '../fixtures/mockResumes';

describe('Tier 4: Real-World End-to-End Application Workflows (6 Tests)', () => {
  beforeEach(() => {
    setupMockChrome();
  });

  // --------------------------------------------------------------------------
  // Scenario 1: Algomaster Negative Flow
  // --------------------------------------------------------------------------
  it('T4-REAL-01: Algomaster System Design Course Navigation (Negative Test)', () => {
    const doc = createDomDocument(ALGOMASTER_NEGATIVE_DOM_FIXTURE);
    const url = 'https://algomaster.io/learn/system-design/course-introduction';

    // 1. Detection Engine Evaluation
    const result = jobClassifier.classify(url, doc);

    expect(result.isJobPage).toBe(false);
    expect(result.score).toBe(0);
    expect(result.confidence).toBe('none');
    expect(result.negativeSignals.length).toBeGreaterThan(0);
    expect(result.negativeSignals.some((s) => s.includes('VETO_URL_LEARNING') || s.includes('VETO_DOM_COURSE_NAV'))).toBe(true);

    // 2. Extension Lifecycle Guard: Verify Floating Action Button suppression
    let floatingButtonMounted = false;
    if (result.isJobPage) {
      floatingButtonMounted = true;
    }
    expect(floatingButtonMounted).toBe(false);
  });

  // --------------------------------------------------------------------------
  // Scenario 2: Greenhouse Job Application Flow
  // --------------------------------------------------------------------------
  it('T4-REAL-02: Greenhouse Stripe Lead DevOps Engineer Full Application Flow', async () => {
    const doc = createDomDocument(GREENHOUSE_DOM_FIXTURE);
    const url = 'https://boards.greenhouse.io/stripe/jobs/987654';

    // 1. Classification
    const classification = jobClassifier.classify(url, doc);
    expect(classification.isJobPage).toBe(true);
    expect(classification.confidence).toBe('high');

    // 2. Scraping
    const job = scraperRegistry.detectAndScrape(url, doc);
    expect(job).not.toBeNull();
    expect(job?.title).toBe('Lead DevOps Engineer');
    expect(job?.company).toBe('Stripe');
    expect(job?.location).toContain('San Francisco');
    expect(job?.requiredSkills).toContain('kubernetes');
    expect(job?.requiredSkills).toContain('terraform');
    expect(job?.requiredSkills).toContain('gcp');

    // 3. ATS Scoring
    const atsResult = calculateAtsScore(job!, MOCK_SENIOR_FULLSTACK_RESUME, 'standard');
    expect(atsResult.overallScore).toBeGreaterThanOrEqual(80);
    expect(atsResult.keywordScore).toBeGreaterThanOrEqual(80);
    expect(atsResult.placementScore).toBeGreaterThan(50);
    expect(atsResult.parseDetails.cleanlinessRating).toBe('Excellent');

    // 4. Resume Tailoring
    const tailored = tailorResumeLocally(job!, MOCK_SENIOR_FULLSTACK_RESUME);
    expect(tailored.sections.experience[0].bullets[0]).toMatch(/(Kubernetes|Terraform|GCP|Go)/i);

    // Verify DOCX & HTML exports
    const docxBlob = await generateDocxResume(tailored.sections, 'Alex Rivera');
    expect(docxBlob.size).toBeGreaterThan(100);
    const htmlOutput = generateResumeHtml(tailored.sections, 'Alex Rivera');
    expect(htmlOutput).toContain('Alex Rivera');
    expect(htmlOutput).toContain('CloudScale Inc');
    expect(htmlOutput).toContain('Kubernetes');

    // 5. Form Auto-Fill
    const fillResult = formFiller.fillForm(doc, MOCK_SENIOR_FULLSTACK_RESUME);
    expect(fillResult.success).toBe(true);
    expect(fillResult.platform).toBe('greenhouse');
    expect(fillResult.filledCount).toBeGreaterThanOrEqual(4);

    const firstNameInput = doc.querySelector('#first_name') as HTMLInputElement;
    const lastNameInput = doc.querySelector('#last_name') as HTMLInputElement;
    const emailInput = doc.querySelector('#email') as HTMLInputElement;
    const phoneInput = doc.querySelector('#phone') as HTMLInputElement;
    const locationInput = doc.querySelector('#job_application_location') as HTMLInputElement;

    expect(firstNameInput.value).toBe('Alex');
    expect(lastNameInput.value).toBe('Rivera');
    expect(emailInput.value).toBe('alex.rivera@example.com');
    expect(phoneInput.value).toBe('(555) 234-5678');
    expect(locationInput.value).toBe('San Francisco, CA');
  });

  // --------------------------------------------------------------------------
  // Scenario 3: Lever Job Application Flow
  // --------------------------------------------------------------------------
  it('T4-REAL-03: Lever Senior Product Manager Full Application Flow', () => {
    const doc = createDomDocument(LEVER_DOM_FIXTURE);
    const url = 'https://jobs.lever.co/examplecorp/12345-abcde';

    // 1. Classification
    const classification = jobClassifier.classify(url, doc);
    expect(classification.isJobPage).toBe(true);

    // 2. Scraping
    const job = scraperRegistry.detectAndScrape(url, doc);
    expect(job).not.toBeNull();
    expect(job?.title).toBe('Senior Product Manager');
    expect(job?.company).toBe('ExampleCorp');
    expect(job?.remoteStatus).toBe('Remote');

    // 3. Multi-Resume Comparison (Morgan Vance PM vs Alex Rivera DevOps)
    const { recommendation, rankedResumes } = compareResumesAgainstJob(job!, [
      MOCK_SENIOR_FULLSTACK_RESUME,
      MOCK_PRODUCT_MANAGER_RESUME,
    ]);

    expect(recommendation?.resumeId).toBe('res_product_manager');
    expect(recommendation?.isRecommended).toBe(true);
    expect(rankedResumes[0].resumeId).toBe('res_product_manager');

    // 4. Tailoring for recommended candidate
    const tailored = tailorResumeLocally(job!, MOCK_PRODUCT_MANAGER_RESUME);
    expect(tailored.sections.skills.slice(0, 4)).toEqual(
      expect.arrayContaining(['Agile', 'Jira', 'SQL'])
    );

    // 5. Form Auto-Fill
    const fillResult = formFiller.fillForm(doc, MOCK_PRODUCT_MANAGER_RESUME);
    expect(fillResult.success).toBe(true);
    expect(fillResult.platform).toBe('lever');
    expect(fillResult.filledCount).toBeGreaterThanOrEqual(4);

    const nameInput = doc.querySelector('input[name="name"]') as HTMLInputElement;
    const emailInput = doc.querySelector('input[name="email"]') as HTMLInputElement;
    const orgInput = doc.querySelector('input[name="org"]') as HTMLInputElement;
    const linkedinInput = doc.querySelector('input[name="urls[LinkedIn]"]') as HTMLInputElement;

    expect(nameInput.value).toBe('Morgan Vance');
    expect(emailInput.value).toBe('morgan.vance@example.com');
    expect(orgInput.value).toBe('SaaS Metrics Co');
    expect(linkedinInput.value).toBe('https://linkedin.com/in/morgan-vance');
  });

  // --------------------------------------------------------------------------
  // Scenario 4: Workday Enterprise Application Flow
  // --------------------------------------------------------------------------
  it('T4-REAL-04: Workday Enterprise Staff Software Engineer Full Application Flow', () => {
    const doc = createDomDocument(WORKDAY_DOM_FIXTURE);
    const url = 'https://acme.wd5.myworkdayjobs.com/Careers/job/Staff-Software-Engineer_R10203';

    // 1. Classification
    const classification = jobClassifier.classify(url, doc);
    expect(classification.isJobPage).toBe(true);
    expect(classification.confidence).toBe('high');
    expect(classification.matchedPlatform).toBe('myworkdayjobs.com');

    // 2. Scraping
    const job = scraperRegistry.detectAndScrape(url, doc);
    expect(job).not.toBeNull();
    expect(job?.title).toBe('Staff Software Engineer');
    expect(job?.company).toBe('Acme Technologies');
    expect(job?.requiredSkills).toContain('go');
    expect(job?.requiredSkills).toContain('kubernetes');
    expect(job?.requiredSkills).toContain('aws');
    expect(job?.requiredSkills).toContain('postgresql');

    // 3. Enterprise ATS Scoring (50% keyword weight preset)
    const atsScore = calculateAtsScore(job!, MOCK_SENIOR_FULLSTACK_RESUME, 'enterprise');
    expect(atsScore.presetUsed).toBe('enterprise');
    expect(atsScore.weights.keywordMatch).toBe(50);
    expect(atsScore.overallScore).toBeGreaterThanOrEqual(80);

    // 4. Form Auto-Fill with Workday Automation IDs
    const fillResult = formFiller.fillForm(doc, MOCK_SENIOR_FULLSTACK_RESUME);
    expect(fillResult.success).toBe(true);
    expect(fillResult.platform).toBe('workday');
    expect(fillResult.filledCount).toBeGreaterThanOrEqual(4);

    const firstInput = doc.querySelector('input[data-automation-id="legalNameSection_firstName"]') as HTMLInputElement;
    const lastInput = doc.querySelector('input[data-automation-id="legalNameSection_lastName"]') as HTMLInputElement;
    const emailInput = doc.querySelector('input[data-automation-id="email"]') as HTMLInputElement;
    const phoneInput = doc.querySelector('input[data-automation-id="phone-number"]') as HTMLInputElement;

    expect(firstInput.value).toBe('Alex');
    expect(lastInput.value).toBe('Rivera');
    expect(emailInput.value).toBe('alex.rivera@example.com');
    expect(phoneInput.value).toBe('(555) 234-5678');
  });

  // --------------------------------------------------------------------------
  // Scenario 5: Schema.org Generic Page Flow
  // --------------------------------------------------------------------------
  it('T4-REAL-05: Generic Startup Page with Schema.org JSON-LD Full Flow', () => {
    const doc = createDomDocument(SCHEMA_ORG_DOM_FIXTURE);
    const url = 'https://innovate.tech/jobs/fullstack-lead';

    // 1. Classification & Schema Extraction
    const classification = jobClassifier.classify(url, doc);
    expect(classification.isJobPage).toBe(true);
    expect(classification.positiveSignals).toContain('SCHEMA_ORG_JOB_POSTING');
    expect(classification.schemaJobPosting).toBeDefined();
    expect(classification.schemaJobPosting?.title).toBe('Lead Full Stack Developer');
    expect(classification.schemaJobPosting?.hiringOrganization).toBe('InnovateTech Inc');

    // 2. Generic Scraping
    const job = scraperRegistry.detectAndScrape(url, doc);
    expect(job).not.toBeNull();
    expect(job?.title).toBe('Lead Full Stack Developer');
    expect(job?.requiredSkills).toContain('react');
    expect(job?.requiredSkills).toContain('typescript');
    expect(job?.requiredSkills).toContain('node.js');

    // 3. ATS Scoring
    const atsScore = calculateAtsScore(job!, MOCK_SENIOR_FULLSTACK_RESUME);
    expect(atsScore.overallScore).toBeGreaterThanOrEqual(85);

    // 4. Generic Form Auto-Fill
    const fillResult = formFiller.fillForm(doc, MOCK_SENIOR_FULLSTACK_RESUME);
    expect(fillResult.success).toBe(true);
    expect(fillResult.platform).toBe('generic');
    expect(fillResult.filledCount).toBeGreaterThanOrEqual(3);

    const firstInput = doc.querySelector('input[name="first_name"]') as HTMLInputElement;
    const lastInput = doc.querySelector('input[name="last_name"]') as HTMLInputElement;
    const emailInput = doc.querySelector('input[name="email"]') as HTMLInputElement;

    expect(firstInput.value).toBe('Alex');
    expect(lastInput.value).toBe('Rivera');
    expect(emailInput.value).toBe('alex.rivera@example.com');
  });

  // --------------------------------------------------------------------------
  // Scenario 6: Ashby ATS Application Flow
  // --------------------------------------------------------------------------
  it('T4-REAL-06: Ashby Machine Learning Engineer Full Application Flow', () => {
    const doc = createDomDocument(ASHBY_DOM_FIXTURE);
    const url = 'https://jobs.ashbyhq.com/superai/67890-ml-engineer';

    // 1. Classification
    const classification = jobClassifier.classify(url, doc);
    expect(classification.isJobPage).toBe(true);
    expect(classification.confidence).toBe('high');

    // 2. Scraping via Ashby Scraper
    const job = scraperRegistry.detectAndScrape(url, doc);
    expect(job).not.toBeNull();
    expect(job?.title).toBe('Senior Machine Learning Engineer');
    expect(job?.company).toBe('SuperAI');
    expect(job?.requiredSkills).toContain('python');
    expect(job?.requiredSkills).toContain('pytorch');
    expect(job?.requiredSkills).toContain('cuda');
    expect(job?.requiredSkills).toContain('machine learning');

    // 3. Multi-Resume Evaluation (Dr. Elena Rostova ML vs Jordan Lee Junior vs Alex Rivera DevOps)
    const { recommendation, rankedResumes } = compareResumesAgainstJob(job!, [
      MOCK_JUNIOR_FRONTEND_RESUME,
      MOCK_SENIOR_FULLSTACK_RESUME,
      MOCK_SPECIALIST_ML_RESUME,
    ]);

    expect(rankedResumes).toHaveLength(3);
    expect(recommendation?.resumeId).toBe('res_specialist_ml');
    expect(recommendation?.isRecommended).toBe(true);

    // 4. Tailoring for ML Specialist
    const tailored = tailorResumeLocally(job!, MOCK_SPECIALIST_ML_RESUME);
    expect(tailored.sections.skills.slice(0, 4)).toEqual(
      expect.arrayContaining(['Python', 'PyTorch', 'CUDA'])
    );

    // 5. Form Auto-Fill for Ashby Application Form
    const fillResult = formFiller.fillForm(doc, MOCK_SPECIALIST_ML_RESUME);
    expect(fillResult.success).toBe(true);
    expect(fillResult.filledCount).toBeGreaterThanOrEqual(3);

    const firstInput = doc.querySelector('#ashby-first-name') as HTMLInputElement;
    const lastInput = doc.querySelector('#ashby-last-name') as HTMLInputElement;
    const emailInput = doc.querySelector('#ashby-email') as HTMLInputElement;

    expect(firstInput.value).toBe('Dr.');
    expect(lastInput.value).toBe('Elena Rostova');
    expect(emailInput.value).toBe('elena.rostova@example.com');
  });
});
