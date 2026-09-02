import { describe, it, expect } from 'vitest';
import { jobClassifier, extractJobPostingSchema } from '../../src/content/detection/jobClassifier';
import { GreenhouseScraper } from '../../src/content/scrapers/greenhouseScraper';
import { LeverScraper } from '../../src/content/scrapers/leverScraper';
import { extractSkillsFromText, cleanText } from '../../src/content/scrapers/keywordExtractor';
import { calculateAtsScore, normalizeWeights } from '../../src/services/scoring/atsEngine';
import { calculateKeywordMatch } from '../../src/services/scoring/keywordMatcher';
import { evaluateParseSuccess } from '../../src/services/scoring/parseSuccessEvaluator';
import { calculateRelevance } from '../../src/services/scoring/relevanceScorer';
import { tailorResumeLocally } from '../../src/services/tailor/localTailorEngine';
import { TAILOR_RESUME_SYSTEM_PROMPT } from '../../src/prompts/tailorResume';
import { generateDocxResume } from '../../src/services/export/docxExporter';
import { generateResumeHtml } from '../../src/services/export/pdfExporter';
import {
  createDomDocument,
  formFiller,
  splitCandidateName,
} from '../helpers/domUtils';
import {
  ALGOMASTER_NEGATIVE_DOM_FIXTURE,
  MDN_DOCS_NEGATIVE_DOM_FIXTURE,
  LEETCODE_NEGATIVE_DOM_FIXTURE,
  GITHUB_ISSUE_NEGATIVE_DOM_FIXTURE,
  MEDIUM_BLOG_NEGATIVE_DOM_FIXTURE,
  MALFORMED_JSON_LD_DOM_FIXTURE,
  EMPTY_MINIMAL_DOM_FIXTURE,
  NO_INPUTS_FORM_DOM_FIXTURE,
  DISABLED_FIELDS_FORM_DOM_FIXTURE,
  GREENHOUSE_DOM_FIXTURE,
} from '../fixtures/domFixtures';
import {
  MOCK_SENIOR_FULLSTACK_RESUME,
  MOCK_MINIMAL_RESUME,
  MOCK_DEGENERATE_RESUME,
} from '../fixtures/mockResumes';
import { JobPosting } from '../../src/types/job';
import { Resume } from '../../src/types/resume';

describe('Tier 2: Boundary & Corner Cases Test Suite (30 Tests)', () => {
  // --------------------------------------------------------------------------
  // Feature 1: Classifier Boundary & Negative Veto (6 Tests)
  // --------------------------------------------------------------------------
  describe('Feature 1: Classifier Boundary & Negative Veto', () => {
    it('T2-DET-01: Explicit negative veto for Algomaster course introduction URL and DOM', () => {
      const doc = createDomDocument(ALGOMASTER_NEGATIVE_DOM_FIXTURE);
      const url = 'https://algomaster.io/learn/system-design/course-introduction';
      const result = jobClassifier.classify(url, doc);

      expect(result.isJobPage).toBe(false);
      expect(result.score).toBe(0);
      expect(result.confidence).toBe('none');
      expect(result.negativeSignals.length).toBeGreaterThan(0);
      expect(result.positiveSignals).toHaveLength(0);
    });

    it('T2-DET-02: Negative veto for MDN technical documentation page', () => {
      const doc = createDomDocument(MDN_DOCS_NEGATIVE_DOM_FIXTURE);
      const url = 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/map';
      const result = jobClassifier.classify(url, doc);

      expect(result.isJobPage).toBe(false);
      expect(result.score).toBe(0);
      expect(result.confidence).toBe('none');
    });

    it('T2-DET-03: Negative veto for LeetCode problem statement and code editor', () => {
      const doc = createDomDocument(LEETCODE_NEGATIVE_DOM_FIXTURE);
      const url = 'https://leetcode.com/problems/two-sum/';
      const result = jobClassifier.classify(url, doc);

      expect(result.isJobPage).toBe(false);
      expect(result.score).toBe(0);
      expect(result.confidence).toBe('none');
    });

    it('T2-DET-04: Negative veto for GitHub issue and repository tracker', () => {
      const doc = createDomDocument(GITHUB_ISSUE_NEGATIVE_DOM_FIXTURE);
      const url = 'https://github.com/facebook/react/issues/12345';
      const result = jobClassifier.classify(url, doc);

      expect(result.isJobPage).toBe(false);
      expect(result.score).toBe(0);
    });

    it('T2-DET-05: Negative veto for Medium / Blog tutorial article', () => {
      const doc = createDomDocument(MEDIUM_BLOG_NEGATIVE_DOM_FIXTURE);
      const url = 'https://medium.com/@author/how-to-scale-kubernetes';
      const result = jobClassifier.classify(url, doc);

      expect(result.isJobPage).toBe(false);
      expect(result.score).toBe(0);
    });

    it('T2-DET-06: Malformed / Corrupted JSON-LD Schema resilience without throwing errors', () => {
      const doc = createDomDocument(MALFORMED_JSON_LD_DOM_FIXTURE);
      const schema = extractJobPostingSchema(doc);

      expect(schema).toBeNull();
      const result = jobClassifier.classify('https://example.com/page', doc);
      expect(result.isJobPage).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 2: Scraper Boundary Cases (6 Tests)
  // --------------------------------------------------------------------------
  describe('Feature 2: Scraper Boundary Cases', () => {
    it('T2-SCR-01: Scraper should return null safely for empty / minimal DOM', () => {
      const doc = createDomDocument(EMPTY_MINIMAL_DOM_FIXTURE);
      const ghScraper = new GreenhouseScraper();
      const result = ghScraper.scrape('https://boards.greenhouse.io/empty', doc);

      expect(result).toBeNull();
    });

    it('T2-SCR-02: Scraper should reject short / truncated description (< 50 chars)', () => {
      const doc = createDomDocument(`
        <html><body>
          <h1 class="app-title">Short Role</h1>
          <div id="content">Too short.</div>
        </body></html>
      `);
      const ghScraper = new GreenhouseScraper();
      const result = ghScraper.scrape('https://boards.greenhouse.io/short', doc);

      expect(result).toBeNull();
    });

    it('T2-SCR-03: Scraper should process ultra-long descriptions (100k chars) without crash or leak', () => {
      const longText = 'We need a Senior Go and Kubernetes engineer. '.repeat(2500); // ~112,000 chars
      const doc = createDomDocument(`
        <html><body>
          <div class="posting-headline"><h2>Staff Cloud Engineer</h2></div>
          <div class="section-wrapper">${longText}</div>
        </body></html>
      `);
      const leverScraper = new LeverScraper();
      const result = leverScraper.scrape('https://jobs.lever.co/company/12345', doc);

      expect(result).not.toBeNull();
      expect(result?.title).toBe('Staff Cloud Engineer');
      expect(result?.requiredSkills).toContain('go');
      expect(result?.requiredSkills).toContain('kubernetes');
    });

    it('T2-SCR-04: extractSkillsFromText should handle regex special characters in skills', () => {
      const text = 'Required: C++, C#, .NET, CI/CD, Node.js, and Vue.js experience.';
      const skills = extractSkillsFromText(text);

      expect(skills).toContain('c++');
      expect(skills).toContain('c#');
      expect(skills).toContain('.net');
      expect(skills).toContain('ci/cd');
      expect(skills).toContain('node.js');
      expect(skills).toContain('vue.js');
    });

    it('T2-SCR-05: extractSkillsFromText should return empty array when no tech skills present', () => {
      const text = 'Looking for an office receptionist to answer phones and organize file cabinets.';
      const skills = extractSkillsFromText(text);

      expect(skills).toHaveLength(0);
    });

    it('T2-SCR-06: cleanText should normalize dirty HTML whitespace, nbsp, and newlines', () => {
      const raw = ' \t\r\n Senior  \u00a0  Frontend \n\n\t  Architect  \r\n ';
      const cleaned = cleanText(raw);

      expect(cleaned).toBe('Senior Frontend Architect');
    });
  });

  // --------------------------------------------------------------------------
  // Feature 3: ATS Scoring Boundary Cases (6 Tests)
  // --------------------------------------------------------------------------
  describe('Feature 3: ATS Scoring Boundary Cases', () => {
    const sampleJob: JobPosting = {
      id: 'job_sample',
      title: 'Senior Full Stack Engineer',
      company: 'TechCorp',
      description: 'Require React, TypeScript, Node.js, PostgreSQL, Docker, Kubernetes, AWS.',
      requiredSkills: ['react', 'typescript', 'node.js', 'postgresql', 'docker', 'kubernetes', 'aws'],
      url: 'https://techcorp.com/job/1',
      source: 'generic',
      scrapedAt: new Date().toISOString(),
    };

    it('T2-ATS-01: Zero keyword match should calculate keywordScore 0 without division by zero', () => {
      const zeroSkillResume: Resume = {
        ...MOCK_MINIMAL_RESUME,
        sections: {
          ...MOCK_MINIMAL_RESUME.sections,
          skills: ['cooking', 'gardening', 'painting'],
        },
      };

      const kwResult = calculateKeywordMatch(sampleJob, zeroSkillResume);
      expect(kwResult.matchedKeywords).toBe(0);
      expect(kwResult.score).toBe(0);

      const scoreResult = calculateAtsScore(sampleJob, zeroSkillResume);
      expect(scoreResult.keywordScore).toBe(0);
      expect(scoreResult.overallScore).toBeLessThan(40);
    });

    it('T2-ATS-02: 100% Perfect match and complete sections should cap score at 100', () => {
      const perfectScore = calculateAtsScore(sampleJob, MOCK_SENIOR_FULLSTACK_RESUME);
      expect(perfectScore.overallScore).toBeLessThanOrEqual(100);
      expect(perfectScore.overallScore).toBeGreaterThanOrEqual(85);
    });

    it('T2-ATS-03: normalizeWeights should handle degenerate sums, all zeros, and floats', () => {
      // Degenerate sum (1000)
      const normalizedLarge = normalizeWeights({
        keywordMatch: 500,
        placement: 150,
        sectionCompleteness: 150,
        parseSuccess: 100,
        relevance: 100,
      });
      const sumLarge =
        normalizedLarge.keywordMatch +
        normalizedLarge.placement +
        normalizedLarge.sectionCompleteness +
        normalizedLarge.parseSuccess +
        normalizedLarge.relevance;
      expect(sumLarge).toBe(100);

      // All zeros
      const normalizedZeros = normalizeWeights({
        keywordMatch: 0,
        placement: 0,
        sectionCompleteness: 0,
        parseSuccess: 0,
        relevance: 0,
      });
      expect(normalizedZeros).toBeDefined();

      // Fractional floating weights
      const normalizedFloats = normalizeWeights({
        keywordMatch: 33.33,
        placement: 16.66,
        sectionCompleteness: 16.66,
        parseSuccess: 16.66,
        relevance: 16.69,
      });
      const sumFloats =
        normalizedFloats.keywordMatch +
        normalizedFloats.placement +
        normalizedFloats.sectionCompleteness +
        normalizedFloats.parseSuccess +
        normalizedFloats.relevance;
      expect(sumFloats).toBe(100);
    });

    it('T2-ATS-04: ParseSuccessEvaluator should flag unicode emoji artifacts and apply penalties', () => {
      const brokenEncodingResume: Resume = {
        ...MOCK_SENIOR_FULLSTACK_RESUME,
        rawText: 'Alex Rivera \uFFFD\uFFFD\uFFFD\uFFFD\uFFFD\uFFFD Corrupted text stream from scan',
      };

      const parseResult = evaluateParseSuccess(brokenEncodingResume);
      expect(parseResult.issues.some((i) => i.type === 'special_characters')).toBe(true);
    });

    it('T2-ATS-05: ATS Engine should handle completely degenerate / empty resume without throwing TypeError', () => {
      const result = calculateAtsScore(sampleJob, MOCK_DEGENERATE_RESUME);

      expect(result).toBeDefined();
      expect(result.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.overallScore).toBeLessThanOrEqual(100);
      expect(result.keywordScore).toBe(0);
      expect(result.sectionScore).toBeLessThan(50);
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it('T2-ATS-06: Relevance scorer should handle missing dates and missing JD tenure gracefully', () => {
      const noDateResume: Resume = {
        ...MOCK_SENIOR_FULLSTACK_RESUME,
        sections: {
          ...MOCK_SENIOR_FULLSTACK_RESUME.sections,
          experience: [
            {
              id: 'exp_nodate',
              company: 'NoDate Corp',
              title: 'Software Engineer',
              bullets: ['Built systems.'],
            },
          ],
        },
      };

      const jobWithoutTenure: JobPosting = {
        id: 'job_notenure',
        title: 'Developer',
        company: 'Simple Inc',
        description: 'Need a developer.',
        requiredSkills: ['react'],
        url: 'https://simple.com',
        source: 'generic',
        scrapedAt: new Date().toISOString(),
      };

      const relevance = calculateRelevance(jobWithoutTenure, noDateResume);
      expect(isNaN(relevance.score)).toBe(false);
      expect(relevance.score).toBeGreaterThanOrEqual(0);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 4: Tailoring Boundary Cases (6 Tests)
  // --------------------------------------------------------------------------
  describe('Feature 4: Tailoring Boundary Cases', () => {
    const genericJob: JobPosting = {
      id: 'job_gen',
      title: 'Full Stack Engineer',
      company: 'Omni Tech',
      description: 'Require React, Go, and PostgreSQL.',
      requiredSkills: ['react', 'go', 'postgresql'],
      url: 'https://omni.tech',
      source: 'generic',
      scrapedAt: new Date().toISOString(),
    };

    it('T2-TLR-01: tailorResumeLocally should handle resume with empty experience array', () => {
      const noExpResume: Resume = {
        ...MOCK_MINIMAL_RESUME,
        sections: {
          ...MOCK_MINIMAL_RESUME.sections,
          experience: [],
        },
      };

      const tailored = tailorResumeLocally(genericJob, noExpResume);
      expect(tailored).toBeDefined();
      expect(tailored.sections.experience).toHaveLength(0);
    });

    it('T2-TLR-02: tailorResumeLocally should handle experience roles with empty bullets array', () => {
      const emptyBulletsResume: Resume = {
        ...MOCK_SENIOR_FULLSTACK_RESUME,
        sections: {
          ...MOCK_SENIOR_FULLSTACK_RESUME.sections,
          experience: [
            {
              id: 'exp_nobullet',
              company: 'Empty Corp',
              title: 'Engineer',
              bullets: [],
            },
          ],
        },
      };

      const tailored = tailorResumeLocally(genericJob, emptyBulletsResume);
      expect(tailored.sections.experience[0].bullets).toHaveLength(0);
    });

    it('T2-TLR-03: Bullets with already strong action verbs should be preserved without corruption', () => {
      const strongResume: Resume = {
        ...MOCK_SENIOR_FULLSTACK_RESUME,
        sections: {
          ...MOCK_SENIOR_FULLSTACK_RESUME.sections,
          experience: [
            {
              id: 'exp_strong',
              company: 'Alpha Corp',
              title: 'Lead Architect',
              bullets: [
                'Architected multi-region Kubernetes clusters.',
                'Spearheaded transition to Go microservices.',
              ],
            },
          ],
        },
      };

      const tailored = tailorResumeLocally(genericJob, strongResume);
      const bullets = tailored.sections.experience[0].bullets;

      expect(bullets.some((b) => b.includes('Architected'))).toBe(true);
      expect(bullets.some((b) => b.includes('Spearheaded'))).toBe(true);
      expect(bullets[0]).toContain('Spearheaded'); // Elevated to #1 because of 'Go' keyword match
    });

    it('T2-TLR-04: Empty candidate skills array should honestly list all required JD skills in unresolvedGaps', () => {
      const noSkillsResume: Resume = {
        ...MOCK_MINIMAL_RESUME,
        sections: {
          ...MOCK_MINIMAL_RESUME.sections,
          skills: [],
        },
      };

      const tailored = tailorResumeLocally(genericJob, noSkillsResume);
      expect(tailored.unresolvedGaps.length).toBeGreaterThanOrEqual(3);
      expect(tailored.unresolvedGaps.some((g) => g.toLowerCase().includes('react'))).toBe(true);
      expect(tailored.unresolvedGaps.some((g) => g.toLowerCase().includes('go'))).toBe(true);
      expect(tailored.unresolvedGaps.some((g) => g.toLowerCase().includes('postgresql'))).toBe(true);
    });

    it('T2-TLR-05: System prompt must explicitly enforce ZERO FABRICATION and truthfulness', () => {
      expect(TAILOR_RESUME_SYSTEM_PROMPT).toContain('NEVER FABRICATE');
      expect(TAILOR_RESUME_SYSTEM_PROMPT).toContain('ZERO HALLUCINATION');
      expect(TAILOR_RESUME_SYSTEM_PROMPT).toContain('unresolvedGaps');
    });

    it('T2-TLR-06: Exporters should generate valid output even for degenerate resume with missing fields', async () => {
      const docxBlob = await generateDocxResume(MOCK_DEGENERATE_RESUME.sections, '');
      expect(docxBlob).toBeDefined();
      expect(docxBlob.size).toBeGreaterThan(50);

      const html = generateResumeHtml(MOCK_DEGENERATE_RESUME.sections, '');
      expect(html).toBeDefined();
      expect(typeof html).toBe('string');
      expect(html.length).toBeGreaterThan(50);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 5: Form Auto-Fill Boundary Cases (6 Tests)
  // --------------------------------------------------------------------------
  describe('Feature 5: Form Auto-Fill Boundary Cases', () => {
    it('T2-FIL-01: Should skip disabled and readonly input fields', () => {
      const doc = createDomDocument(DISABLED_FIELDS_FORM_DOM_FIXTURE);
      const result = formFiller.fillForm(doc, MOCK_SENIOR_FULLSTACK_RESUME);

      expect(result.success).toBe(true);
      const firstInput = doc.querySelector('input[name="first_name"]') as HTMLInputElement;
      const lastInput = doc.querySelector('input[name="last_name"]') as HTMLInputElement;

      // Disabled and readonly inputs must retain their initial value and be marked skipped
      expect(firstInput.value).toBe('LockedFirst');
      expect(lastInput.value).toBe('LockedLast');

      const skippedFirst = result.fields.find((f) => f.name === 'first_name');
      expect(skippedFirst?.status).toBe('skipped');
    });

    it('T2-FIL-02: Should respect overwrite=false by preserving pre-filled values', () => {
      const doc = createDomDocument(GREENHOUSE_DOM_FIXTURE);
      const emailEl = doc.querySelector('#email') as HTMLInputElement;
      emailEl.value = 'preexisting@example.com';

      const result = formFiller.fillForm(doc, MOCK_SENIOR_FULLSTACK_RESUME, { overwrite: false });
      expect(emailEl.value).toBe('preexisting@example.com');
      const emailFieldResult = result.fields.find((f) => f.name === 'job_application[email]' || f.fieldType === 'email');
      expect(emailFieldResult?.status).toBe('skipped');
    });

    it('T2-FIL-03: Should safely parse single-name candidates without creating undefined last name', () => {
      const { firstName, lastName } = splitCandidateName('Cher');
      expect(firstName).toBe('Cher');
      expect(lastName).toBe('');

      const doc = createDomDocument(GREENHOUSE_DOM_FIXTURE);
      const result = formFiller.fillForm(doc, MOCK_MINIMAL_RESUME);

      expect(result.success).toBe(true);
      const firstInput = doc.querySelector('#first_name') as HTMLInputElement;
      expect(firstInput.value).toBe('Cher');
    });

    it('T2-FIL-04: Should handle form with zero inputs gracefully without error', () => {
      const doc = createDomDocument(NO_INPUTS_FORM_DOM_FIXTURE);
      const result = formFiller.fillForm(doc, MOCK_SENIOR_FULLSTACK_RESUME);

      expect(result.success).toBe(false);
      expect(result.filledCount).toBe(0);
      expect(result.totalFieldsDetected).toBe(0);
    });

    it('T2-FIL-05: Missing optional candidate fields should be left untouched rather than writing "undefined"', () => {
      const doc = createDomDocument(GREENHOUSE_DOM_FIXTURE);
      const result = formFiller.fillForm(doc, MOCK_MINIMAL_RESUME);
      expect(result.success).toBe(true);

      const phoneEl = doc.querySelector('#phone') as HTMLInputElement;
      expect(phoneEl.value).not.toBe('undefined');
      expect(phoneEl.value).toBe('');
    });

    it('T2-FIL-06: Form filler should discover and fill orphan input fields without a parent form tag', () => {
      const doc = createDomDocument(`
        <!DOCTYPE html>
        <html>
          <body>
            <div>
              <input type="text" name="first_name" placeholder="First Name" />
              <input type="email" name="email" placeholder="Email Address" />
            </div>
          </body>
        </html>
      `);

      const result = formFiller.fillForm(doc, MOCK_SENIOR_FULLSTACK_RESUME);
      expect(result.success).toBe(true);
      expect(result.filledCount).toBeGreaterThanOrEqual(2);

      const firstInput = doc.querySelector('input[name="first_name"]') as HTMLInputElement;
      expect(firstInput.value).toBe('Alex');
    });
  });
});
