import { describe, it, expect } from 'vitest';
import { jobClassifier } from '../../src/content/detection/jobClassifier';
import { GreenhouseScraper } from '../../src/content/scrapers/greenhouseScraper';
import { LeverScraper } from '../../src/content/scrapers/leverScraper';
import { WorkdayScraper } from '../../src/content/scrapers/workdayScraper';
import { AshbyScraper } from '../../src/content/scrapers/ashbyScraper';
import { GenericScraper } from '../../src/content/scrapers/genericScraper';
import { scraperRegistry } from '../../src/content/scrapers/scraperRegistry';
import { calculateAtsScore } from '../../src/services/scoring/atsEngine';
import { calculateKeywordMatch } from '../../src/services/scoring/keywordMatcher';
import { calculatePlacementScore } from '../../src/services/scoring/placementScorer';
import { checkSectionCompleteness } from '../../src/services/scoring/sectionChecker';
import { evaluateParseSuccess } from '../../src/services/scoring/parseSuccessEvaluator';
import { compareResumesAgainstJob } from '../../src/services/scoring/multiResumeComparator';
import { tailorResumeLocally } from '../../src/services/tailor/localTailorEngine';
import { generateDocxResume } from '../../src/services/export/docxExporter';
import { generateResumeHtml } from '../../src/services/export/pdfExporter';
import {
  createDomDocument,
  formFiller,
  setInputValue,
} from '../helpers/domUtils';
import {
  GREENHOUSE_DOM_FIXTURE,
  LEVER_DOM_FIXTURE,
  WORKDAY_DOM_FIXTURE,
  ASHBY_DOM_FIXTURE,
  SCHEMA_ORG_DOM_FIXTURE,
} from '../fixtures/domFixtures';
import {
  MOCK_SENIOR_FULLSTACK_RESUME,
  MOCK_JUNIOR_FRONTEND_RESUME,
  MOCK_PRODUCT_MANAGER_RESUME,
} from '../fixtures/mockResumes';
import { JobPosting } from '../../src/types/job';

describe('Tier 1: Core Feature Coverage Test Suite (30 Tests)', () => {
  // --------------------------------------------------------------------------
  // Feature 1: Precision Job Page Classifier (6 Tests)
  // --------------------------------------------------------------------------
  describe('Feature 1: Precision Job Page Classifier', () => {
    it('T1-DET-01: should classify Greenhouse job board page with high confidence', () => {
      const doc = createDomDocument(GREENHOUSE_DOM_FIXTURE);
      const url = 'https://boards.greenhouse.io/stripe/jobs/987654';
      const result = jobClassifier.classify(url, doc);

      expect(result.isJobPage).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(80);
      expect(result.confidence).toBe('high');
      expect(result.positiveSignals).toContain('SIG_KNOWN_ATS_URL');
      expect(result.positiveSignals).toContain('SIG_APP_FORM_RESUME');
      expect(result.negativeSignals).toHaveLength(0);
    });

    it('T1-DET-02: should classify Lever job posting with positive ATS signals', () => {
      const doc = createDomDocument(LEVER_DOM_FIXTURE);
      const url = 'https://jobs.lever.co/examplecorp/12345-abcde';
      const result = jobClassifier.classify(url, doc);

      expect(result.isJobPage).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(65);
      expect(result.positiveSignals).toContain('SIG_KNOWN_ATS_URL');
      expect(result.positiveSignals).toContain('SIG_APPLY_CTA');
    });

    it('T1-DET-03: should classify Workday enterprise job page with high confidence', () => {
      const doc = createDomDocument(WORKDAY_DOM_FIXTURE);
      const url = 'https://acme.wd5.myworkdayjobs.com/Careers/job/Staff-Software-Engineer_R10203';
      const result = jobClassifier.classify(url, doc);

      expect(result.isJobPage).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(80);
      expect(result.confidence).toBe('high');
      expect(result.matchedPlatform).toBe('myworkdayjobs.com');
      expect(result.positiveSignals).toContain('SIG_JOB_DESC_CONTAINER');
    });

    it('T1-DET-04: should classify Schema.org JSON-LD job posting with structured data boost', () => {
      const doc = createDomDocument(SCHEMA_ORG_DOM_FIXTURE);
      const url = 'https://innovate.tech/jobs/fullstack-lead';
      const result = jobClassifier.classify(url, doc);

      expect(result.isJobPage).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(70);
      expect(result.positiveSignals).toContain('SCHEMA_ORG_JOB_POSTING');
      expect(result.schemaJobPosting).toBeDefined();
      expect(result.schemaJobPosting?.title).toBe('Lead Full Stack Developer');
      expect(result.schemaJobPosting?.hiringOrganization).toBe('InnovateTech Inc');
      expect(result.schemaJobPosting?.jobLocation?.addressLocality).toBe('Austin');
    });

    it('T1-DET-05: should classify Ashby job posting with high confidence', () => {
      const doc = createDomDocument(ASHBY_DOM_FIXTURE);
      const url = 'https://jobs.ashbyhq.com/superai/67890-ml-engineer';
      const result = jobClassifier.classify(url, doc);

      expect(result.isJobPage).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(80);
      expect(result.confidence).toBe('high');
      expect(result.positiveSignals).toContain('SIG_KNOWN_ATS_URL');
    });

    it('T1-DET-06: should produce structured SignalDetails with valid weights and evidence', () => {
      const doc = createDomDocument(GREENHOUSE_DOM_FIXTURE);
      const url = 'https://boards.greenhouse.io/stripe/jobs/987654';
      const result = jobClassifier.classify(url, doc);

      expect(result.details.length).toBeGreaterThan(0);
      for (const signal of result.details) {
        expect(signal.id).toBeDefined();
        expect(signal.name).toBeDefined();
        expect(signal.weight).toBeGreaterThan(0);
        expect(signal.matched).toBe(true);
        expect(signal.evidence).toBeDefined();
      }
    });
  });

  // --------------------------------------------------------------------------
  // Feature 2: Platform Job Scrapers (6 Tests)
  // --------------------------------------------------------------------------
  describe('Feature 2: Platform Job Scrapers', () => {
    it('T1-SCR-01: GreenhouseScraper should extract title, company, location, and technical skills', () => {
      const scraper = new GreenhouseScraper();
      const doc = createDomDocument(GREENHOUSE_DOM_FIXTURE);
      const url = 'https://boards.greenhouse.io/stripe/jobs/987654';

      expect(scraper.canHandle(url, doc)).toBe(true);
      const job = scraper.scrape(url, doc);

      expect(job).not.toBeNull();
      expect(job?.title).toBe('Lead DevOps Engineer');
      expect(job?.company).toBe('Stripe');
      expect(job?.location).toContain('San Francisco');
      expect(job?.source).toBe('greenhouse');
      expect(job?.requiredSkills).toContain('kubernetes');
      expect(job?.requiredSkills).toContain('terraform');
      expect(job?.requiredSkills).toContain('gcp');
      expect(job?.requiredSkills).toContain('go');
      expect(job?.requiredSkills).toContain('postgresql');
    });

    it('T1-SCR-02: LeverScraper should extract role headline, remote workplace type, and skills', () => {
      const scraper = new LeverScraper();
      const doc = createDomDocument(LEVER_DOM_FIXTURE);
      const url = 'https://jobs.lever.co/examplecorp/12345-abcde';

      expect(scraper.canHandle(url, doc)).toBe(true);
      const job = scraper.scrape(url, doc);

      expect(job).not.toBeNull();
      expect(job?.title).toBe('Senior Product Manager');
      expect(job?.company).toBe('ExampleCorp');
      expect(job?.remoteStatus).toBe('Remote');
      expect(job?.source).toBe('lever');
      expect(job?.requiredSkills).toContain('agile');
      expect(job?.requiredSkills).toContain('jira');
      expect(job?.requiredSkills).toContain('sql');
    });

    it('T1-SCR-03: WorkdayScraper should extract data-automation-id metadata and technical skills', () => {
      const scraper = new WorkdayScraper();
      const doc = createDomDocument(WORKDAY_DOM_FIXTURE);
      const url = 'https://acme.wd5.myworkdayjobs.com/Careers/job/Staff-Software-Engineer_R10203';

      expect(scraper.canHandle(url, doc)).toBe(true);
      const job = scraper.scrape(url, doc);

      expect(job).not.toBeNull();
      expect(job?.title).toBe('Staff Software Engineer');
      expect(job?.company).toBe('Acme Technologies');
      expect(job?.source).toBe('workday');
      expect(job?.requiredSkills).toContain('go');
      expect(job?.requiredSkills).toContain('kubernetes');
      expect(job?.requiredSkills).toContain('aws');
      expect(job?.requiredSkills).toContain('postgresql');
      expect(job?.qualifications?.some((q) => q.includes('R10203'))).toBe(true);
    });

    it('T1-SCR-04: AshbyScraper should extract Ashby data-testid fields and ML requirements', () => {
      const scraper = new AshbyScraper();
      const doc = createDomDocument(ASHBY_DOM_FIXTURE);
      const url = 'https://jobs.ashbyhq.com/superai/67890-ml-engineer';

      expect(scraper.canHandle(url, doc)).toBe(true);
      const job = scraper.scrape(url, doc);

      expect(job).not.toBeNull();
      expect(job?.title).toBe('Senior Machine Learning Engineer');
      expect(job?.company).toBe('SuperAI');
      expect(job?.source).toBe('ashby');
      expect(job?.requiredSkills).toContain('python');
      expect(job?.requiredSkills).toContain('pytorch');
      expect(job?.requiredSkills).toContain('cuda');
      expect(job?.requiredSkills).toContain('machine learning');
    });

    it('T1-SCR-05: GenericScraper should extract unstructured job descriptions and tech skills', () => {
      const scraper = new GenericScraper();
      const doc = createDomDocument(SCHEMA_ORG_DOM_FIXTURE);
      const url = 'https://innovate.tech/jobs/fullstack-lead';

      expect(scraper.canHandle(url, doc)).toBe(true);
      const job = scraper.scrape(url, doc);

      expect(job).not.toBeNull();
      expect(job?.title).toBe('Lead Full Stack Developer');
      expect(job?.requiredSkills).toContain('react');
      expect(job?.requiredSkills).toContain('typescript');
      expect(job?.requiredSkills).toContain('node.js');
      expect(job?.requiredSkills).toContain('postgresql');
      expect(job?.requiredSkills).toContain('aws');
    });

    it('T1-SCR-06: ScraperRegistry should dispatch to appropriate platform scraper automatically', () => {
      const ghDoc = createDomDocument(GREENHOUSE_DOM_FIXTURE);
      const ghJob = scraperRegistry.detectAndScrape('https://boards.greenhouse.io/stripe/jobs/987654', ghDoc);
      expect(ghJob).not.toBeNull();
      expect(ghJob?.source).toBe('greenhouse');

      const leverDoc = createDomDocument(LEVER_DOM_FIXTURE);
      const leverJob = scraperRegistry.detectAndScrape('https://jobs.lever.co/examplecorp/12345-abcde', leverDoc);
      expect(leverJob).not.toBeNull();
      expect(leverJob?.source).toBe('lever');
    });
  });

  // --------------------------------------------------------------------------
  // Feature 3: ATS Match Scoring & Recommendations (6 Tests)
  // --------------------------------------------------------------------------
  describe('Feature 3: ATS Match Scoring & Recommendations', () => {
    const devOpsJob: JobPosting = {
      id: 'job_devops_stripe',
      title: 'Lead DevOps Engineer',
      company: 'Stripe',
      description: 'Manage Kubernetes clusters, Terraform infrastructure, Docker, GCP, and Go microservices.',
      requiredSkills: ['kubernetes', 'terraform', 'docker', 'gcp', 'go', 'postgresql'],
      url: 'https://boards.greenhouse.io/stripe/jobs/987654',
      source: 'greenhouse',
      scrapedAt: new Date().toISOString(),
    };

    it('T1-ATS-01: should compute 5-factor weighted score accurately matching formula', () => {
      const scoreResult = calculateAtsScore(devOpsJob, MOCK_SENIOR_FULLSTACK_RESUME, 'standard');

      expect(scoreResult.overallScore).toBeGreaterThanOrEqual(80);
      expect(scoreResult.weights.keywordMatch).toBe(45);
      expect(scoreResult.weights.placement).toBe(15);
      expect(scoreResult.weights.sectionCompleteness).toBe(15);
      expect(scoreResult.weights.parseSuccess).toBe(15);
      expect(scoreResult.weights.relevance).toBe(10);

      const computedRaw =
        (scoreResult.keywordScore * scoreResult.weights.keywordMatch +
          scoreResult.placementScore * scoreResult.weights.placement +
          scoreResult.sectionScore * scoreResult.weights.sectionCompleteness +
          scoreResult.parseScore * scoreResult.weights.parseSuccess +
          scoreResult.relevanceScore * scoreResult.weights.relevance) /
        100;
      expect(scoreResult.overallScore).toBe(Math.min(100, Math.max(0, Math.round(computedRaw))));
    });

    it('T1-ATS-02: KeywordMatcher should match synonyms bidirectionally', () => {
      const kwResult = calculateKeywordMatch(devOpsJob, MOCK_SENIOR_FULLSTACK_RESUME);

      expect(kwResult.totalKeywords).toBeGreaterThanOrEqual(6);
      expect(kwResult.matchedKeywords).toBeGreaterThanOrEqual(5);
      expect(kwResult.score).toBeGreaterThanOrEqual(80);
      expect(kwResult.items.find((k) => k.keyword === 'kubernetes')?.foundInResume).toBe(true);
      expect(kwResult.items.find((k) => k.keyword === 'terraform')?.foundInResume).toBe(true);
    });

    it('T1-ATS-03: PlacementScorer should reward keywords in titles and experience bullets', () => {
      const kwResult = calculateKeywordMatch(devOpsJob, MOCK_SENIOR_FULLSTACK_RESUME);
      const placement = calculatePlacementScore(kwResult.items);

      expect(placement.score).toBeGreaterThan(60);
      expect(placement.experienceKeywordsCount).toBeGreaterThan(0);
      expect(placement.details.length).toBeGreaterThan(0);
    });

    it('T1-ATS-04: SectionChecker should evaluate complete sections vs missing sections', () => {
      const completeRes = checkSectionCompleteness(MOCK_SENIOR_FULLSTACK_RESUME);
      expect(completeRes.score).toBeGreaterThanOrEqual(90);
      expect(completeRes.items.every((i) => i.present)).toBe(true);

      const juniorRes = checkSectionCompleteness(MOCK_JUNIOR_FRONTEND_RESUME);
      expect(juniorRes.score).toBeLessThan(completeRes.score);
    });

    it('T1-ATS-05: ParseSuccessEvaluator should score formatting and assign cleanliness rating', () => {
      const parseResult = evaluateParseSuccess(MOCK_SENIOR_FULLSTACK_RESUME);
      expect(parseResult.cleanlinessRating).toBe('Excellent');
      expect(parseResult.score).toBeGreaterThanOrEqual(85);
      expect(parseResult.issues.filter((i) => i.severity === 'error')).toHaveLength(0);
    });

    it('T1-ATS-06: MultiResumeComparator should rank candidates and flag top recommendation', () => {
      const { recommendation, rankedResumes } = compareResumesAgainstJob(devOpsJob, [
        MOCK_JUNIOR_FRONTEND_RESUME,
        MOCK_SENIOR_FULLSTACK_RESUME,
      ]);

      expect(rankedResumes).toHaveLength(2);
      expect(rankedResumes[0].resumeId).toBe('res_senior_fullstack');
      expect(rankedResumes[1].resumeId).toBe('res_junior_frontend');
      expect(recommendation?.resumeId).toBe('res_senior_fullstack');
      expect(recommendation?.isRecommended).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 4: Resume Tailoring Engine (6 Tests)
  // --------------------------------------------------------------------------
  describe('Feature 4: Resume Tailoring Engine', () => {
    const targetJob: JobPosting = {
      id: 'job_senior_backend',
      title: 'Senior Backend Engineer',
      company: 'DataFlow Systems',
      description: 'Design microservices in Go, PostgreSQL, Kafka, and Kubernetes. Experience with Terraform on AWS.',
      requiredSkills: ['go', 'postgresql', 'kafka', 'kubernetes', 'terraform', 'aws'],
      url: 'https://dataflow.io/jobs/senior-backend',
      source: 'generic',
      scrapedAt: new Date().toISOString(),
    };

    it('T1-TLR-01: should reorder experience bullets descending by relevance score', () => {
      const tailored = tailorResumeLocally(targetJob, MOCK_SENIOR_FULLSTACK_RESUME);
      const bullets = tailored.sections.experience[0].bullets;

      expect(bullets).toBeDefined();
      expect(bullets.length).toBeGreaterThan(0);
      // Top bullet should contain high-impact keywords (Go, Kubernetes, Terraform)
      const topBullet = bullets[0].toLowerCase();
      expect(
        topBullet.includes('go') ||
        topBullet.includes('kubernetes') ||
        topBullet.includes('terraform') ||
        topBullet.includes('postgresql')
      ).toBe(true);
    });

    it('T1-TLR-02: should replace weak verbs with high-impact action verbs', () => {
      const candidateWithWeakVerbs = {
        ...MOCK_SENIOR_FULLSTACK_RESUME,
        sections: {
          ...MOCK_SENIOR_FULLSTACK_RESUME.sections,
          experience: [
            {
              id: 'exp_weak',
              company: 'OldTech Co',
              title: 'Backend Developer',
              bullets: [
                'worked on Go and Kubernetes services.',
                'helped with database optimization in PostgreSQL.',
                'responsible for Kafka message queues.',
              ],
            },
          ],
        },
      };

      const tailored = tailorResumeLocally(targetJob, candidateWithWeakVerbs);
      const tailoredBullets = tailored.sections.experience[0].bullets;

      expect(tailoredBullets[0]).toMatch(/^(Engineered|Spearheaded|Architected and delivered)/);
      expect(tailoredBullets[1]).toMatch(/^(Engineered|Spearheaded|Architected and delivered)/);
      expect(tailoredBullets[2]).toMatch(/^(Engineered|Spearheaded|Architected and delivered)/);
    });

    it('T1-TLR-03: should prioritize JD-matching skills to the front with canonical casing', () => {
      const tailored = tailorResumeLocally(targetJob, MOCK_SENIOR_FULLSTACK_RESUME);
      const skills = tailored.sections.skills;

      expect(skills.slice(0, 5)).toEqual(
        expect.arrayContaining(['Go', 'PostgreSQL', 'Apache Kafka', 'Kubernetes', 'Terraform'])
      );
    });

    it('T1-TLR-04: should honestly report skill gaps without fabricating false experience', () => {
      const pmJob: JobPosting = {
        id: 'job_pm',
        title: 'Senior Product Manager',
        company: 'SaaS Corp',
        description: 'Requires Agile, Jira, Product Strategy, User Research, and Figma.',
        requiredSkills: ['agile', 'jira', 'product strategy', 'user research', 'figma'],
        url: 'https://saascorp.com/jobs/pm',
        source: 'generic',
        scrapedAt: new Date().toISOString(),
      };

      // Alex Rivera (DevOps Engineer) lacks Figma and Product Strategy
      const tailored = tailorResumeLocally(pmJob, MOCK_SENIOR_FULLSTACK_RESUME);
      expect(tailored.unresolvedGaps.length).toBeGreaterThan(0);
      expect(tailored.unresolvedGaps.some((g) => g.toLowerCase().includes('figma') || g.toLowerCase().includes('agile'))).toBe(true);
    });

    it('T1-TLR-05: should align professional summary statement with target job title', () => {
      const resumeWithoutSummary = {
        ...MOCK_JUNIOR_FRONTEND_RESUME,
        sections: {
          ...MOCK_JUNIOR_FRONTEND_RESUME.sections,
          summary: '',
        },
      };
      const tailored = tailorResumeLocally(targetJob, resumeWithoutSummary);
      expect(tailored.sections.summary).toContain('Senior Backend Engineer');
    });

    it('T1-TLR-06: should generate valid DOCX Blob and HTML export formats', async () => {
      const tailored = tailorResumeLocally(targetJob, MOCK_SENIOR_FULLSTACK_RESUME);
      const docxBlob = await generateDocxResume(tailored.sections, 'Alex Rivera');
      expect(docxBlob).toBeDefined();
      expect(docxBlob.size).toBeGreaterThan(100);

      const html = generateResumeHtml(tailored.sections, 'Alex Rivera');
      expect(html).toContain('Alex Rivera');
      expect(html).toContain('alex.rivera@example.com');
      expect(html).toContain('Work Experience');
      expect(html).toContain('CloudScale Inc');
    });
  });

  // --------------------------------------------------------------------------
  // Feature 5: Form Auto-Fill Engine (6 Tests)
  // --------------------------------------------------------------------------
  describe('Feature 5: Form Auto-Fill Engine', () => {
    it('T1-FIL-01: should map and populate Greenhouse application form inputs', () => {
      const doc = createDomDocument(GREENHOUSE_DOM_FIXTURE);
      const result = formFiller.fillForm(doc, MOCK_SENIOR_FULLSTACK_RESUME);

      expect(result.success).toBe(true);
      expect(result.platform).toBe('greenhouse');
      expect(result.filledCount).toBeGreaterThanOrEqual(4);

      const firstNameEl = doc.querySelector('#first_name') as HTMLInputElement;
      const lastNameEl = doc.querySelector('#last_name') as HTMLInputElement;
      const emailEl = doc.querySelector('#email') as HTMLInputElement;
      const phoneEl = doc.querySelector('#phone') as HTMLInputElement;

      expect(firstNameEl.value).toBe('Alex');
      expect(lastNameEl.value).toBe('Rivera');
      expect(emailEl.value).toBe('alex.rivera@example.com');
      expect(phoneEl.value).toBe('(555) 234-5678');
    });

    it('T1-FIL-02: should map and populate Lever application form inputs', () => {
      const doc = createDomDocument(LEVER_DOM_FIXTURE);
      const result = formFiller.fillForm(doc, MOCK_PRODUCT_MANAGER_RESUME);

      expect(result.success).toBe(true);
      expect(result.platform).toBe('lever');
      expect(result.filledCount).toBeGreaterThanOrEqual(4);

      const nameEl = doc.querySelector('input[name="name"]') as HTMLInputElement;
      const emailEl = doc.querySelector('input[name="email"]') as HTMLInputElement;
      const orgEl = doc.querySelector('input[name="org"]') as HTMLInputElement;

      expect(nameEl.value).toBe('Morgan Vance');
      expect(emailEl.value).toBe('morgan.vance@example.com');
      expect(orgEl.value).toBe('SaaS Metrics Co');
    });

    it('T1-FIL-03: should map and populate Workday application form automation IDs', () => {
      const doc = createDomDocument(WORKDAY_DOM_FIXTURE);
      const result = formFiller.fillForm(doc, MOCK_SENIOR_FULLSTACK_RESUME);

      expect(result.success).toBe(true);
      expect(result.platform).toBe('workday');
      expect(result.filledCount).toBeGreaterThanOrEqual(4);

      const firstNameEl = doc.querySelector('input[data-automation-id="legalNameSection_firstName"]') as HTMLInputElement;
      const lastNameEl = doc.querySelector('input[data-automation-id="legalNameSection_lastName"]') as HTMLInputElement;
      const emailEl = doc.querySelector('input[data-automation-id="email"]') as HTMLInputElement;
      const cityEl = doc.querySelector('input[data-automation-id="addressSection_city"]') as HTMLInputElement;

      expect(firstNameEl.value).toBe('Alex');
      expect(lastNameEl.value).toBe('Rivera');
      expect(emailEl.value).toBe('alex.rivera@example.com');
      expect(cityEl.value).toBe('San Francisco, CA');
    });

    it('T1-FIL-04: should map and populate generic application form inputs using heuristics', () => {
      const doc = createDomDocument(SCHEMA_ORG_DOM_FIXTURE);
      const result = formFiller.fillForm(doc, MOCK_SENIOR_FULLSTACK_RESUME);

      expect(result.success).toBe(true);
      expect(result.platform).toBe('generic');
      expect(result.filledCount).toBeGreaterThanOrEqual(3);

      const firstNameEl = doc.querySelector('input[name="first_name"]') as HTMLInputElement;
      const lastNameEl = doc.querySelector('input[name="last_name"]') as HTMLInputElement;
      const emailEl = doc.querySelector('input[name="email"]') as HTMLInputElement;

      expect(firstNameEl.value).toBe('Alex');
      expect(lastNameEl.value).toBe('Rivera');
      expect(emailEl.value).toBe('alex.rivera@example.com');
    });

    it('T1-FIL-05: setInputValue should dispatch input, change, and blur synthetic DOM events', () => {
      const input = document.createElement('input');
      input.type = 'text';

      let inputFired = false;
      let changeFired = false;
      let blurFired = false;

      input.addEventListener('input', () => { inputFired = true; });
      input.addEventListener('change', () => { changeFired = true; });
      input.addEventListener('blur', () => { blurFired = true; });

      setInputValue(input, 'Alex Rivera');

      expect(input.value).toBe('Alex Rivera');
      expect(inputFired).toBe(true);
      expect(changeFired).toBe(true);
      expect(blurFired).toBe(true);
    });

    it('T1-FIL-06: should return structured AutofillResult detailing field statuses and counts', () => {
      const doc = createDomDocument(GREENHOUSE_DOM_FIXTURE);
      const result = formFiller.fillForm(doc, MOCK_SENIOR_FULLSTACK_RESUME);

      expect(result.success).toBe(true);
      expect(result.totalFieldsDetected).toBeGreaterThan(0);
      expect(result.filledCount).toBeGreaterThan(0);
      expect(result.fields.every((f) => f.name && f.fieldType && f.status)).toBe(true);
    });
  });
});
