import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  calculateAtsScore,
  normalizeWeights,
} from '../../src/services/scoring/atsEngine';
import { calculateKeywordMatch, isKeywordPresent } from '../../src/services/scoring/keywordMatcher';
import { calculatePlacementScore } from '../../src/services/scoring/placementScorer';
import { evaluateParseSuccess } from '../../src/services/scoring/parseSuccessEvaluator';
import { calculateRelevance, extractRequiredYearsFromJob, calculateTenureYearsFromResume } from '../../src/services/scoring/relevanceScorer';
import { compareResumesAgainstJob } from '../../src/services/scoring/multiResumeComparator';
import { extractActionVerbRecommendations, stripBulletPrefix } from '../../src/services/scoring/actionVerbExtractor';
import {
  tailorResumeLocally,
} from '../../src/services/tailor/localTailorEngine';
import {
  tailorService,
  extractJsonFromResponse,
} from '../../src/services/tailor/tailorService';
import { AIFactory } from '../../src/services/ai/aiFactory';
import {
  formFiller,
} from '../../src/content/autofill/formFiller';
import {
  detectFieldType,
} from '../../src/content/autofill/fieldDetector';
import {
  setNativeValue,
  setNativeChecked,
  setSelectOption,
} from '../../src/content/autofill/domEvents';
import {
  createDomDocument,
} from '../helpers/domUtils';
import {
  GREENHOUSE_DOM_FIXTURE,
  LEVER_DOM_FIXTURE,
  WORKDAY_DOM_FIXTURE,
  SCHEMA_ORG_DOM_FIXTURE,
} from '../fixtures/domFixtures';
import {
  MOCK_SENIOR_FULLSTACK_RESUME,
  MOCK_JUNIOR_FRONTEND_RESUME,
  MOCK_SPECIALIST_ML_RESUME,
  MOCK_PRODUCT_MANAGER_RESUME,
  MOCK_MINIMAL_RESUME,
  MOCK_DEGENERATE_RESUME,
} from '../fixtures/mockResumes';
import { JobPosting } from '../../src/types/job';
import { Resume } from '../../src/types/resume';
import { AtsWeights } from '../../src/types/scoring';

describe('Tier 5: Adversarial White-Box Stress & Boundary Hardening Suite', () => {
  const globalBaseJob: JobPosting = {
    id: 'job_adv_base',
    title: 'Senior Distributed Systems Engineer',
    company: 'HighScale Tech',
    description: 'Requires expertise in Go, C++, Kubernetes, AWS, PostgreSQL, Redis, and Kafka. 5+ years of experience.',
    requiredSkills: ['go', 'c++', 'kubernetes', 'aws', 'postgresql', 'redis', 'kafka'],
    url: 'https://highscale.tech/jobs/101',
    source: 'greenhouse',
    scrapedAt: new Date().toISOString(),
  };

  const globalMlJob: JobPosting = {
    id: 'job_ml_frontier',
    title: 'Staff AI/ML Infrastructure Engineer',
    company: 'Frontier AI Labs',
    description: 'Pre-train 70B parameter LLM models using PyTorch, CUDA, C++, and DeepSpeed on multi-node GPU clusters. 7+ years of experience.',
    requiredSkills: ['pytorch', 'cuda', 'c++', 'llm', 'python', 'deepspeed', 'machine learning'],
    url: 'https://frontier.ai/jobs/staff-ml',
    source: 'greenhouse',
    scrapedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // Group 1: ATS Scoring Engine Adversarial & Boundary Stress Tests
  // ==========================================================================
  describe('Group 1: ATS Scoring Engine Adversarial & White-Box Analysis', () => {
    it('T5-ATS-01: should safely normalize extreme, degenerate, and 0-sum custom weights', () => {
      // 1. All-zero weights: should return original without division-by-zero NaN
      const allZeros: AtsWeights = { keywordMatch: 0, placement: 0, sectionCompleteness: 0, parseSuccess: 0, relevance: 0 };
      const normZeros = normalizeWeights(allZeros);
      expect(normZeros.keywordMatch + normZeros.placement + normZeros.sectionCompleteness + normZeros.parseSuccess + normZeros.relevance).toBe(0);

      const scoreWithZeros = calculateAtsScore(globalBaseJob, MOCK_SENIOR_FULLSTACK_RESUME, 'custom', allZeros);
      expect(scoreWithZeros.overallScore).toBe(0);
      expect(Number.isNaN(scoreWithZeros.overallScore)).toBe(false);

      // 2. Fractional / Unbalanced weights summing to 50
      const sumFifty: AtsWeights = { keywordMatch: 20, placement: 10, sectionCompleteness: 10, parseSuccess: 5, relevance: 5 };
      const normFifty = normalizeWeights(sumFifty);
      const totalFifty = normFifty.keywordMatch + normFifty.placement + normFifty.sectionCompleteness + normFifty.parseSuccess + normFifty.relevance;
      expect(totalFifty).toBe(100);

      // 3. Huge sum weights (e.g. sum = 1,000,000)
      const hugeWeights: AtsWeights = { keywordMatch: 500000, placement: 200000, sectionCompleteness: 100000, parseSuccess: 100000, relevance: 100000 };
      const normHuge = normalizeWeights(hugeWeights);
      const totalHuge = normHuge.keywordMatch + normHuge.placement + normHuge.sectionCompleteness + normHuge.parseSuccess + normHuge.relevance;
      expect(totalHuge).toBe(100);

      // 4. 100% single category weight
      const singleCategory: AtsWeights = { keywordMatch: 100, placement: 0, sectionCompleteness: 0, parseSuccess: 0, relevance: 0 };
      const normSingle = normalizeWeights(singleCategory);
      expect(normSingle.keywordMatch).toBe(100);
      expect(normSingle.placement).toBe(0);
    });

    it('T5-ATS-02: should handle regex metacharacters in skill keywords without syntax errors or escaping leaks', () => {
      const symbolJob: JobPosting = {
        id: 'job_symbols',
        title: 'Fullstack .NET & C++ Engineer',
        company: 'Legacy & Modern Corp',
        description: 'Deep knowledge of C++, C#, .NET, ASP.NET, Node.js, Next.js, CI/CD, React.js, and TCP/IP.',
        requiredSkills: ['c++', 'c#', '.net', 'asp.net', 'node.js', 'next.js', 'ci/cd', 'react.js'],
        url: 'https://example.com/job',
        source: 'generic',
        scrapedAt: new Date().toISOString(),
      };

      const candidateResume: Resume = {
        ...MOCK_SENIOR_FULLSTACK_RESUME,
        rawText: 'Expert in C++, C#, .NET, ASP.NET, Node.js, Next.js, and CI/CD pipelines.',
        sections: {
          ...MOCK_SENIOR_FULLSTACK_RESUME.sections,
          skills: ['C++', 'C#', '.NET', 'ASP.NET', 'Node.js', 'Next.js', 'CI/CD'],
        },
      };

      const result = calculateKeywordMatch(symbolJob, candidateResume);
      expect(result.totalKeywords).toBe(8);
      expect(result.matchedKeywords).toBeGreaterThanOrEqual(7);
      expect(result.score).toBeGreaterThanOrEqual(85);

      // Verify specific symbol keywords
      expect(isKeywordPresent('c++', 'We build high performance engines in C++.')).toBe(true);
      expect(isKeywordPresent('c#', 'Backend microservices written in C# on .NET 8.')).toBe(true);
      expect(isKeywordPresent('.net', 'Enterprise applications using .NET framework.')).toBe(true);
      expect(isKeywordPresent('ci/cd', 'Automated CI/CD with GitHub Actions.')).toBe(true);
      expect(isKeywordPresent('node.js', 'Fullstack apps with Node.js and TypeScript.')).toBe(true);
    });

    it('T5-ATS-03: should match single-character & short skills (C, R, Go, AI) without false-positive substrings', () => {
      // Direct keyword presence test
      expect(isKeywordPresent('c', 'Experience with C and Assembly language.')).toBe(true);
      expect(isKeywordPresent('c', 'Experience with Cloud computing and Containers.')).toBe(false); // Substring false-positive prevention

      expect(isKeywordPresent('r', 'Data science pipelines written in R.')).toBe(true);
      expect(isKeywordPresent('r', 'React frontend architecture.')).toBe(false);

      expect(isKeywordPresent('go', 'Microservices implemented in Go.')).toBe(true);
      expect(isKeywordPresent('go', 'Good communications skills with algorithms.')).toBe(false);

      expect(isKeywordPresent('ai', 'Implemented generative AI solutions.')).toBe(true);
      expect(isKeywordPresent('ai', 'Maintained email servers.')).toBe(false);
    });

    it('T5-ATS-04: should rigorously evaluate ParseCleanliness thresholds and date formats', () => {
      // 1. Excellent cleanliness rating (score >= 90)
      const cleanResult = evaluateParseSuccess(MOCK_SENIOR_FULLSTACK_RESUME);
      expect(cleanResult.score).toBeGreaterThanOrEqual(90);
      expect(cleanResult.cleanlinessRating).toBe('Excellent');

      // 2. Poor cleanliness rating (< 50) on empty / malformed resume
      const poorResume: Resume = {
        ...MOCK_DEGENERATE_RESUME,
        rawText: 'Short text scan', // <200 chars (-40 pts), missing headers (-30 pts)
      };
      const poorResult = evaluateParseSuccess(poorResume);
      expect(poorResult.score).toBeLessThan(50);
      expect(poorResult.cleanlinessRating).toBe('Poor');
      expect(poorResult.issues.some((i) => i.type === 'unknown_layout')).toBe(true);
      expect(poorResult.issues.some((i) => i.type === 'missing_header')).toBe(true);

      // 3. Special glyphs / broken encoding detection
      const brokenResume: Resume = {
        ...MOCK_SENIOR_FULLSTACK_RESUME,
        rawText: 'Normal text with broken glyphs \uFFFD \uFFFD \uFFFD \uFFFD \uFFFD \uFFFD \u0000 \u0001' + 'a'.repeat(300),
      };
      const brokenResult = evaluateParseSuccess(brokenResume);
      expect(brokenResult.issues.some((i) => i.type === 'special_characters')).toBe(true);
    });

    it('T5-ATS-05: should score pathological, degenerate, and massive text bomb resumes without throwing', () => {
      // 1. 100k characters text bomb
      const textBombResume: Resume = {
        ...MOCK_SENIOR_FULLSTACK_RESUME,
        rawText: 'Kubernetes Terraform AWS PostgreSQL '.repeat(3000),
      };
      const scoreBomb = calculateAtsScore(globalBaseJob, textBombResume);
      expect(scoreBomb.overallScore).toBeGreaterThanOrEqual(0);
      expect(scoreBomb.overallScore).toBeLessThanOrEqual(100);

      // 2. Degenerate empty resume
      const scoreDegenerate = calculateAtsScore(globalBaseJob, MOCK_DEGENERATE_RESUME);
      expect(scoreDegenerate.overallScore).toBeGreaterThanOrEqual(0);
      expect(scoreDegenerate.keywordScore).toBe(0);
      expect((scoreDegenerate.keywordGaps || []).length).toBeGreaterThan(0);

      // 3. Resume with dates in the distant past / future
      const strangeDatesResume: Resume = {
        ...MOCK_SENIOR_FULLSTACK_RESUME,
        sections: {
          ...MOCK_SENIOR_FULLSTACK_RESUME.sections,
          experience: [
            {
              id: 'exp_fut',
              company: 'Future Corp',
              title: 'Architect',
              startDate: 'Jan 2090',
              endDate: 'Dec 2099',
              bullets: ['Built time machines in Go.'],
            },
          ],
        },
      };
      const scoreDates = calculateAtsScore(globalBaseJob, strangeDatesResume);
      expect(scoreDates.overallScore).toBeGreaterThan(0);
    });

    it('T5-ATS-06: should handle completely blank, malformed, or HTML-injected job postings', () => {
      // 1. Blank job posting
      const emptyJob: JobPosting = {
        id: 'job_empty',
        title: '',
        company: '',
        description: '',
        requiredSkills: [],
        url: 'https://example.com/job',
        source: 'generic',
        scrapedAt: new Date().toISOString(),
      };

      const scoreEmpty = calculateAtsScore(emptyJob, MOCK_SENIOR_FULLSTACK_RESUME);
      expect(scoreEmpty.overallScore).toBeGreaterThanOrEqual(0);
      expect(scoreEmpty.keywordDetails.totalKeywords).toBe(0);

      // 2. HTML and script tag injection job posting
      const xssJob: JobPosting = {
        id: 'job_xss',
        title: '<script>alert("XSS")</script> Senior Fullstack Lead',
        company: '<img src=x onerror=alert(1)> Corp',
        description: '<style>body{display:none}</style> Looking for Go, React, and AWS engineers.',
        requiredSkills: ['go', 'react', 'aws'],
        url: 'https://xss-test.com',
        source: 'generic',
        scrapedAt: new Date().toISOString(),
      };

      const scoreXss = calculateAtsScore(xssJob, MOCK_SENIOR_FULLSTACK_RESUME);
      expect(scoreXss.overallScore).toBeGreaterThan(70);
      expect(scoreXss.matchedKeywords).toContain('go');
      expect(scoreXss.matchedKeywords).toContain('react');
    });

    it('T5-ATS-07: MultiResumeComparator should rank candidates deterministically with ties & empty lists', () => {
      // 1. Empty resumes array
      const emptyComp = compareResumesAgainstJob(globalBaseJob, []);
      expect(emptyComp.recommendation).toBeNull();
      expect(emptyComp.rankedResumes).toHaveLength(0);

      // 2. 100 synthetic candidates stress benchmark
      const syntheticResumes: Resume[] = Array.from({ length: 100 }).map((_, idx) => ({
        ...MOCK_JUNIOR_FRONTEND_RESUME,
        id: `res_candidate_${idx}`,
        name: `Candidate ${idx}`,
        sections: {
          ...MOCK_JUNIOR_FRONTEND_RESUME.sections,
          skills: idx % 2 === 0 ? ['go', 'kubernetes', 'aws'] : ['html', 'css'],
        },
      }));

      const multiComp = compareResumesAgainstJob(globalBaseJob, syntheticResumes);
      expect(multiComp.rankedResumes).toHaveLength(100);
      expect(multiComp.recommendation).not.toBeNull();
      expect(multiComp.recommendation?.isRecommended).toBe(true);
      // Ensure sorted strictly descending
      for (let i = 0; i < multiComp.rankedResumes.length - 1; i++) {
        expect(multiComp.rankedResumes[i].scoreResult.overallScore).toBeGreaterThanOrEqual(
          multiComp.rankedResumes[i + 1].scoreResult.overallScore
        );
      }
    });

    it('T5-ATS-08: ActionVerbExtractor should handle various Unicode bullets, numbering, and corrupted bullet types', () => {
      const unicodeResume: Resume = {
        ...MOCK_SENIOR_FULLSTACK_RESUME,
        sections: {
          ...MOCK_SENIOR_FULLSTACK_RESUME.sections,
          experience: [
            {
              id: 'exp_u1',
              company: 'A',
              title: 'B',
              bullets: [
                '\u2022 worked on distributed caching.', // •
                '\u2023 helped with onboarding.', // ‣
                '\u25E6 responsible for cloud infra.', // ◦
                '\u2043 handled customer escalations.', // ⁃
                '\u2219 made performance improvements.', // ∙
                '1. assisted in database migration.',
                '2) did security audits.',
              ],
            },
          ],
          projects: [
            {
              id: 'proj_u1',
              name: 'Project X',
              description: 'Desc',
              bullets: [
                '• wrote high-performance Go microservices.',
                'fixed latency bottlenecks.',
              ],
            },
          ],
        },
      };

      const recs = extractActionVerbRecommendations(unicodeResume);
      expect(recs.length).toBe(9);
      expect(recs.some((r) => r.suggested === 'Engineered')).toBe(true);
      expect(recs.some((r) => r.suggested === 'Spearheaded')).toBe(true);
      expect(recs.some((r) => r.suggested === 'Architected and delivered')).toBe(true);
      expect(recs.some((r) => r.suggested === 'Authored and deployed')).toBe(true);
      expect(recs.some((r) => r.suggested === 'Resolved and optimized')).toBe(true);

      // Verify stripBulletPrefix directly on various prefixes
      expect(stripBulletPrefix('•  Bullet text')).toBe('Bullet text');
      expect(stripBulletPrefix('1. Numbered bullet')).toBe('Numbered bullet');
      expect(stripBulletPrefix('3) Parenthesized bullet')).toBe('Parenthesized bullet');
      expect(stripBulletPrefix('   \t\n  Indented bullet')).toBe('Indented bullet');
    });

    it('T5-ATS-09: RelevanceScorer should calculate tenure years and education fit across edge cases', () => {
      // 1. Explicit years in JD extraction
      expect(extractRequiredYearsFromJob('Requires 7+ years of experience in distributed systems.')).toBe(7);
      expect(extractRequiredYearsFromJob('3-5 yrs of experience required.')).toBe(3);
      expect(extractRequiredYearsFromJob('No explicit experience mentioned.')).toBeUndefined();

      // 2. Candidate tenure calculation from summary
      const tenureFromSummary: Resume = {
        ...MOCK_SENIOR_FULLSTACK_RESUME,
        sections: {
          ...MOCK_SENIOR_FULLSTACK_RESUME.sections,
          summary: 'Cloud Architect with 12+ years of experience.',
        },
      };
      expect(calculateTenureYearsFromResume(tenureFromSummary)).toBe(12);

      // 3. Candidate tenure calculation from experience date ranges
      const tenureFromDates: Resume = {
        ...MOCK_SENIOR_FULLSTACK_RESUME,
        sections: {
          ...MOCK_SENIOR_FULLSTACK_RESUME.sections,
          summary: 'Software developer.',
          experience: [
            { id: '1', company: 'A', title: 'Dev', startDate: '2015', endDate: '2019', bullets: [] },
            { id: '2', company: 'B', title: 'Dev', startDate: '2019', endDate: '2023', bullets: [] },
          ],
        },
      };
      expect(calculateTenureYearsFromResume(tenureFromDates)).toBe(8);

      // 4. Relevance evaluation with education requirement mismatch
      const degreeJob: JobPosting = {
        ...globalBaseJob,
        description: 'Requires Master degree in Computer Science and 10+ years experience.',
      };
      const candidateNoDegree: Resume = {
        ...MOCK_SENIOR_FULLSTACK_RESUME,
        sections: {
          ...MOCK_SENIOR_FULLSTACK_RESUME.sections,
          education: [],
        },
      };
      const relResult = calculateRelevance(degreeJob, candidateNoDegree);
      expect(relResult.educationMatchScore).toBe(60);
      expect(relResult.notes.some((n) => n.includes('degree'))).toBe(true);
    });

    it('T5-ATS-10: PlacementScorer should score different section keyword placement distributions', () => {
      // 1. Keywords in all 4 sections (title, exp, summary, skills)
      const allPlacements = calculatePlacementScore([
        {
          keyword: 'go',
          foundInResume: true,
          frequencyInJob: 3,
          frequencyInResume: 5,
          placements: ['title', 'experience', 'summary', 'skills'],
        },
      ]);
      expect(allPlacements.score).toBe(100);

      // 2. Keywords only in skills section
      const skillsOnly = calculatePlacementScore([
        {
          keyword: 'kubernetes',
          foundInResume: true,
          frequencyInJob: 2,
          frequencyInResume: 1,
          placements: ['skills'],
        },
      ]);
      expect(skillsOnly.score).toBe(40);
      expect(skillsOnly.skillsKeywordsCount).toBe(1);

      // 3. No matched keywords
      const noneMatched = calculatePlacementScore([
        {
          keyword: 'rust',
          foundInResume: false,
          frequencyInJob: 1,
          frequencyInResume: 0,
          placements: [],
        },
      ]);
      expect(noneMatched.score).toBe(0);
    });
  });

  // ==========================================================================
  // Group 2: Resume Tailoring Engine Adversarial Stress Tests
  // ==========================================================================
  describe('Group 2: Resume Tailoring Engine Adversarial Stress Tests', () => {
    it('T5-TLR-01: should locally tailor resume and reorder bullets descending by score with metric boosts', () => {
      const corruptResume: Resume = {
        ...MOCK_SPECIALIST_ML_RESUME,
        sections: {
          ...MOCK_SPECIALIST_ML_RESUME.sections,
          experience: [
            {
              id: 'exp_c1',
              company: 'AI Lab',
              title: 'ML Dev',
              bullets: [
                'worked on PyTorch distributed training pipelines.',
                'helped with CUDA kernel optimizations for 40% speedup.',
              ],
            },
          ],
        },
      };

      const tailored = tailorResumeLocally(globalMlJob, corruptResume);
      expect(tailored).toBeDefined();
      // Bullet with metric bonus (40% speedup) receives higher score and is prioritized to index 0
      expect(tailored.sections.experience[0].bullets[0]).toContain('Spearheaded CUDA');
      expect(tailored.sections.experience[0].bullets[1]).toContain('Engineered PyTorch');
      expect(tailored.sections.skills).toContain('PyTorch');
      expect(tailored.sections.skills).toContain('CUDA');
    });

    it('T5-TLR-02: should honestly identify 100% skill gaps without fabricating false experience', () => {
      const pmJob: JobPosting = {
        id: 'job_pm_unmatched',
        title: 'VP of Product Strategy',
        company: 'VentureScale',
        description: 'Requires Figma, Product Roadmap, GTM Strategy, User Cohorts, and B2B Pricing.',
        requiredSkills: ['figma', 'product roadmap', 'gtm strategy', 'user cohorts', 'b2b pricing'],
        url: 'https://venturescale.com/jobs/vp',
        source: 'generic',
        scrapedAt: new Date().toISOString(),
      };

      // Dr. Elena Rostova (Staff ML Engineer) has 0 PM skills
      const tailored = tailorResumeLocally(pmJob, MOCK_SPECIALIST_ML_RESUME);
      expect(tailored.unresolvedGaps.length).toBeGreaterThanOrEqual(4);
      expect(tailored.unresolvedGaps.some((g) => g.toLowerCase().includes('figma'))).toBe(true);
      expect(tailored.unresolvedGaps.some((g) => g.toLowerCase().includes('gtm strategy'))).toBe(true);
      // Experience bullets should not fabricate fake PM roles
      expect(tailored.sections.experience[0].company).toBe('Frontier AI Labs');
    });

    it('T5-TLR-03: should detect metrics and job-matching skills to reorder bullets descending by relevance score', () => {
      const backendJob: JobPosting = {
        id: 'job_backend_metrics',
        title: 'Backend Scalability Engineer',
        company: 'CloudScale',
        description: 'Requires Kubernetes, AWS, Go, PostgreSQL, and Redis.',
        requiredSkills: ['kubernetes', 'aws', 'go', 'postgresql', 'redis'],
        url: 'https://cloudscale.com',
        source: 'generic',
        scrapedAt: new Date().toISOString(),
      };

      const candidateWithMetrics: Resume = {
        ...MOCK_SENIOR_FULLSTACK_RESUME,
        sections: {
          ...MOCK_SENIOR_FULLSTACK_RESUME.sections,
          experience: [
            {
              id: 'exp_metrics',
              company: 'CloudScale',
              title: 'Backend Lead',
              bullets: [
                'Maintained legacy internal documentation wiki.', // Score 0
                'Architected PostgreSQL and Redis caching layer.', // 2 JD Skills = Score 20
                'Attended weekly sprint retrospectives.', // Score 0
                'Scaled Kubernetes clusters on AWS serving 50M+ requests with 99.99% uptime.', // 2 JD Skills + Metric = Score 25
              ],
            },
          ],
        },
      };

      const tailored = tailorResumeLocally(backendJob, candidateWithMetrics);
      const bullets = tailored.sections.experience[0].bullets;

      // Top bullet matches Kubernetes + AWS + Metrics (Score 25)
      expect(bullets[0]).toContain('50M+');
      // Second bullet matches PostgreSQL + Redis (Score 20)
      expect(bullets[1]).toContain('PostgreSQL');
    });

    it('T5-TLR-04: should clean job titles with brackets, remote tags, and emojis for summary alignment', () => {
      const strangeTitleJob: JobPosting = {
        ...globalMlJob,
        title: 'Lead AI Infrastructure Engineer (Remote - US Only) [Full-Time] 🚀',
      };

      const resumeNoSummary: Resume = {
        ...MOCK_SPECIALIST_ML_RESUME,
        sections: {
          ...MOCK_SPECIALIST_ML_RESUME.sections,
          summary: '',
        },
      };

      const tailored = tailorResumeLocally(strangeTitleJob, resumeNoSummary);
      expect(tailored.sections.summary).toContain('Lead AI Infrastructure Engineer');
      expect(tailored.sections.summary).not.toContain('remote');
      expect(tailored.sections.summary).not.toContain('full-time');
    });

    it('T5-TLR-05: should preserve non-weak verb prefixes without false-positive replacements', () => {
      const candidateBoundaryVerbs: Resume = {
        ...MOCK_SENIOR_FULLSTACK_RESUME,
        sections: {
          ...MOCK_SENIOR_FULLSTACK_RESUME.sections,
          experience: [
            {
              id: 'exp_bv',
              company: 'Tech',
              title: 'Dev',
              bullets: [
                'Workday system integrations were deployed.',
                'Helping hand provided to internal customers.',
                'Participant in open source Linux kernel drivers.',
                'Handbook for engineering onboarding authored.',
                'Made-up testing fixtures refactored.',
              ],
            },
          ],
        },
      };

      const tailored = tailorResumeLocally(globalMlJob, candidateBoundaryVerbs);
      const bullets = tailored.sections.experience[0].bullets;

      // Verbs that do not match exact weak verb start should remain intact
      expect(bullets.some((b) => b.startsWith('Workday'))).toBe(true);
      expect(bullets.some((b) => b.startsWith('Participant'))).toBe(true);
      expect(bullets.some((b) => b.startsWith('Handbook'))).toBe(true);
    });

    it('T5-TLR-06: should canonicalize skill casings from SKILL_CASING_MAP regardless of input casing', () => {
      const resumeCasing: Resume = {
        ...MOCK_SENIOR_FULLSTACK_RESUME,
        sections: {
          ...MOCK_SENIOR_FULLSTACK_RESUME.sections,
          skills: ['javascript', 'TYPESCRIPT', 'React.js', 'k8s', 'POSTGRESQL', 'gcp', 'GITHUB ACTIONS', 'vitest'],
        },
      };

      const tailored = tailorResumeLocally(globalMlJob, resumeCasing);
      const skills = tailored.sections.skills;

      expect(skills).toContain('JavaScript');
      expect(skills).toContain('TypeScript');
      expect(skills).toContain('React.js');
      expect(skills).toContain('Kubernetes');
      expect(skills).toContain('PostgreSQL');
      expect(skills).toContain('Google Cloud (GCP)');
      expect(skills).toContain('GitHub Actions');
      expect(skills).toContain('Vitest');
    });

    it('T5-TLR-07: extractJsonFromResponse should parse markdown fences, preambles, single quotes, and nested braces', () => {
      // 1. Markdown with triple backticks and json
      const res1 = '```json\n{\n  "summary": "AI tailored summary",\n  "skills": ["Python", "PyTorch"]\n}\n```';
      const p1 = extractJsonFromResponse(res1);
      expect(p1.summary).toBe('AI tailored summary');
      expect(p1.skills).toEqual(['Python', 'PyTorch']);

      // 2. Code fences with preambles and postambles
      const res2 = 'Sure, here is the result:\n```\n{"summary": "Preamble test", "experience": []}\n```\nHope that helps!';
      const p2 = extractJsonFromResponse(res2);
      expect(p2.summary).toBe('Preamble test');

      // 3. Raw JSON without fences
      const res3 = '{"summary": "Direct JSON", "changesSummary": ["Bullet 1", "Bullet 2"]}';
      const p3 = extractJsonFromResponse(res3);
      expect(p3.summary).toBe('Direct JSON');
      expect(p3.changesSummary).toHaveLength(2);

      // 4. Invalid strings throw properly
      expect(() => extractJsonFromResponse('')).toThrow();
      expect(() => extractJsonFromResponse('Error: Rate limit exceeded (429)')).toThrow();
    });

    it('T5-TLR-08: TailorService should seamlessly fall back to local heuristic on any AI provider error', async () => {
      // Test across Anthropic, OpenAI, and Gemini failure modes
      const providers: ('anthropic' | 'openai' | 'gemini')[] = ['anthropic', 'openai', 'gemini'];

      for (const prov of providers) {
        const mockProvider = {
          name: prov,
          generateText: vi.fn().mockRejectedValue(new Error(`${prov} API Timeout (504)`)),
          generateStructuredJson: vi.fn(),
        };
        vi.spyOn(AIFactory, 'getProvider').mockReturnValue(mockProvider as any);

        const result = await tailorService.tailor(globalMlJob, MOCK_SPECIALIST_ML_RESUME, {
          provider: prov,
          apiKey: `sk-${prov}-testkey`,
        });

        expect(result.strategy).toBe('local_heuristic');
        expect(result.fallbackReason).toContain('504');
        expect(result.tailoredResume).toBeDefined();
        expect(result.tailoredResume.sections.skills).toContain('PyTorch');
      }
    });

    it('T5-TLR-09: Tailoring engine should be deterministic and idempotent upon multiple executions', () => {
      const tailored1 = tailorResumeLocally(globalMlJob, MOCK_SPECIALIST_ML_RESUME);
      const tailoredResumeObj1: Resume = {
        ...MOCK_SPECIALIST_ML_RESUME,
        sections: tailored1.sections,
      };

      const tailored2 = tailorResumeLocally(globalMlJob, tailoredResumeObj1);

      expect(tailored2.sections.summary).toBe(tailored1.sections.summary);
      expect(tailored2.sections.skills).toEqual(tailored1.sections.skills);
      expect(tailored2.sections.experience[0].bullets).toEqual(tailored1.sections.experience[0].bullets);
    });

    it('T5-TLR-10: should structure bulletDiffs with reasons and #1 priority marker for top bullet', () => {
      const candidateWeak: Resume = {
        ...MOCK_SPECIALIST_ML_RESUME,
        sections: {
          ...MOCK_SPECIALIST_ML_RESUME.sections,
          experience: [
            {
              id: 'exp_diff',
              company: 'Lab',
              title: 'Dev',
              bullets: [
                'worked on PyTorch distributed training.',
                'helped with CUDA optimizations.',
              ],
            },
          ],
        },
      };

      const tailored = tailorResumeLocally(globalMlJob, candidateWeak);
      const diffs = tailored.sections.experience[0].bulletDiffs;

      expect(diffs).toBeDefined();
      expect(diffs?.length).toBeGreaterThan(0);
      expect(diffs?.[0].reason).toContain('priority');
    });
  });

  // ==========================================================================
  // Group 3: Form Auto-Fill Engine Adversarial DOM & Event Stress Tests
  // ==========================================================================
  describe('Group 3: Form Auto-Fill Engine Adversarial DOM & Event Stress Tests', () => {
    it('T5-FIL-01: should detect fields with detached labels, aria-labelledby, and deep nested wrappers', () => {
      const doc = createDomDocument(`
        <html><body>
          <div class="field-container">
            <div id="first_name_detached_label">Legal First Name</div>
            <div class="input-wrapper">
              <input type="text" id="fn_custom" aria-labelledby="first_name_detached_label" />
            </div>
          </div>

          <div class="field-container">
            <span class="field-label">Primary Contact Email</span>
            <div><input type="email" id="email_custom" /></div>
          </div>

          <div class="field-container">
            <label for="phone_custom">Cellular Telephone Number</label>
            <div><input type="text" id="phone_custom" /></div>
          </div>

          <fieldset>
            <legend>Professional Summary & Bio</legend>
            <textarea id="summary_custom"></textarea>
          </fieldset>
        </body></html>
      `);

      const fnEl = doc.querySelector('#fn_custom') as HTMLElement;
      const emailEl = doc.querySelector('#email_custom') as HTMLElement;
      const phoneEl = doc.querySelector('#phone_custom') as HTMLElement;
      const summaryEl = doc.querySelector('#summary_custom') as HTMLElement;

      expect(detectFieldType(fnEl)?.fieldType).toBe('firstName');
      expect(detectFieldType(emailEl)?.fieldType).toBe('email');
      expect(detectFieldType(phoneEl)?.fieldType).toBe('phone');
      expect(detectFieldType(summaryEl)?.fieldType).toBe('summary');
    });

    it('T5-FIL-02: should disambiguate fullName vs firstName/lastName under conflicting label/name hints', () => {
      const doc = createDomDocument(`
        <html><body>
          <form>
            <!-- Field named "name" but label says First Name -->
            <label>First Name <input type="text" name="name" id="f1" /></label>
            <!-- Field named "name" but label says Last Name -->
            <label>Last Name <input type="text" name="name" id="f2" /></label>
            <!-- Field named "applicant_name" with full name label -->
            <label>Candidate Full Legal Name <input type="text" name="applicant_name" id="f3" /></label>
          </form>
        </body></html>
      `);

      const f1 = doc.querySelector('#f1') as HTMLElement;
      const f2 = doc.querySelector('#f2') as HTMLElement;
      const f3 = doc.querySelector('#f3') as HTMLElement;

      expect(detectFieldType(f1)?.fieldType).toBe('firstName');
      expect(detectFieldType(f2)?.fieldType).toBe('lastName');
      expect(detectFieldType(f3)?.fieldType).toBe('fullName');
    });

    it('T5-FIL-03: should route to correct platform adapter (Greenhouse, Lever, Workday, Generic) accurately', () => {
      const ghDoc = createDomDocument(GREENHOUSE_DOM_FIXTURE);
      expect(formFiller.detectPlatform(ghDoc, 'https://boards.greenhouse.io/stripe/jobs/123')).toBe('greenhouse');

      const leverDoc = createDomDocument(LEVER_DOM_FIXTURE);
      expect(formFiller.detectPlatform(leverDoc, 'https://jobs.lever.co/example/123')).toBe('lever');

      const workdayDoc = createDomDocument(WORKDAY_DOM_FIXTURE);
      expect(formFiller.detectPlatform(workdayDoc, 'https://acme.wd5.myworkdayjobs.com/apply')).toBe('workday');

      const genericDoc = createDomDocument(SCHEMA_ORG_DOM_FIXTURE);
      expect(formFiller.detectPlatform(genericDoc, 'https://unknownstartup.io/careers')).toBe('generic');
    });

    it('T5-FIL-04: should populate <select> elements matching by text, value, or substring case-insensitively with exact match priority', () => {
      const doc = createDomDocument(`
        <html><body>
          <form>
            <label for="country_select">Country</label>
            <select id="country_select" name="country">
              <option value="">Select country...</option>
              <option value="US">United States of America</option>
              <option value="CA">Canada</option>
              <option value="GB">United Kingdom</option>
            </select>
          </form>
        </body></html>
      `);

      const selectEl = doc.querySelector('#country_select') as HTMLSelectElement;

      // Two-pass priority: 'CA' is a substring of 'United States of America', but exact value match for Canada must take precedence
      const matchedExactPriority = setSelectOption(selectEl, 'CA');
      expect(matchedExactPriority).toBe(true);
      expect(selectEl.selectedIndex).toBe(2);
      expect(selectEl.value).toBe('CA');

      // Match by exact text
      const matchedText = setSelectOption(selectEl, 'Canada');
      expect(matchedText).toBe(true);
      expect(selectEl.selectedIndex).toBe(2);
      expect(selectEl.value).toBe('CA');

      // Match by exact value
      const matchedVal = setSelectOption(selectEl, 'US');
      expect(matchedVal).toBe(true);
      expect(selectEl.selectedIndex).toBe(1);
      expect(selectEl.value).toBe('US');

      // Match by unique substring
      const matchedSub = setSelectOption(selectEl, 'Kingdom');
      expect(matchedSub).toBe(true);
      expect(selectEl.selectedIndex).toBe(3);
      expect(selectEl.value).toBe('GB');

      // Unmatched text returns false without changing selection
      const matchedInvalid = setSelectOption(selectEl, 'Atlantis Continent');
      expect(matchedInvalid).toBe(false);
      expect(selectEl.selectedIndex).toBe(3);
    });

    it('T5-FIL-05: should invoke setNativeChecked on radio & checkboxes and dispatch event sequence', () => {
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = false;

      const events: string[] = [];
      ['focus', 'click', 'input', 'change', 'blur'].forEach((e) => {
        checkbox.addEventListener(e, () => events.push(e));
      });

      setNativeChecked(checkbox, true);
      expect(checkbox.checked).toBe(true);
      expect(events).toEqual(['focus', 'click', 'input', 'change', 'blur']);
    });

    it('T5-FIL-06: should bypass React _valueTracker and dispatch bubble/cancelable synthetic events', () => {
      const input = document.createElement('input');
      input.type = 'text';

      let trackerVal = '';
      (input as any)._valueTracker = {
        getValue: () => trackerVal,
        setValue: (val: string) => { trackerVal = val; },
        stop: () => {},
      };

      const eventRecords: { type: string; bubbles: boolean; cancelable: boolean }[] = [];
      ['focus', 'input', 'change', 'blur'].forEach((t) => {
        input.addEventListener(t, (e) => {
          eventRecords.push({ type: e.type, bubbles: e.bubbles, cancelable: e.cancelable });
        });
      });

      setNativeValue(input, 'Tracker Verified 2026');

      expect(input.value).toBe('Tracker Verified 2026');
      expect(trackerVal).toBe('Tracker Verified 2026');
      expect(eventRecords).toHaveLength(4);
      for (const rec of eventRecords) {
        expect(rec.bubbles).toBe(true);
        expect(rec.cancelable).toBe(true);
      }
    });

    it('T5-FIL-07: should respect overwrite policies (overwrite=true vs overwrite=false) across all inputs', () => {
      const doc = createDomDocument(`
        <html><body>
          <form>
            <input type="text" name="first_name" value="PresetFirst" />
            <input type="text" name="last_name" value="" />
            <input type="email" name="email" value="preset@domain.com" />
            <input type="tel" name="phone" value="   " />
          </form>
        </body></html>
      `);

      // 1. overwrite: false -> preserves non-empty fields, fills empty/whitespace fields
      const resNoOverwrite = formFiller.fill(doc, MOCK_SENIOR_FULLSTACK_RESUME, { overwrite: false });
      expect(resNoOverwrite.success).toBe(true);

      const fn = doc.querySelector('input[name="first_name"]') as HTMLInputElement;
      const ln = doc.querySelector('input[name="last_name"]') as HTMLInputElement;
      const em = doc.querySelector('input[name="email"]') as HTMLInputElement;
      const ph = doc.querySelector('input[name="phone"]') as HTMLInputElement;

      expect(fn.value).toBe('PresetFirst'); // Preserved
      expect(ln.value).toBe('Rivera'); // Populated
      expect(em.value).toBe('preset@domain.com'); // Preserved
      expect(ph.value).toBe('(555) 234-5678'); // Populated (was whitespace)

      // 2. overwrite: true -> overwrites everything
      const resOverwrite = formFiller.fill(doc, MOCK_SENIOR_FULLSTACK_RESUME, { overwrite: true });
      expect(resOverwrite.success).toBe(true);
      expect(fn.value).toBe('Alex');
      expect(em.value).toBe('alex.rivera@example.com');
    });

    it('T5-FIL-08: should populate international names, phone numbers, addresses, and Unicode emojis', () => {
      const intlResume: Resume = {
        ...MOCK_MINIMAL_RESUME,
        name: 'François Müller 🌟',
        sections: {
          ...MOCK_MINIMAL_RESUME.sections,
          contact: {
            name: 'François Müller 🌟',
            email: 'francois.muller@munich.de',
            phone: '+49 89 12345678',
            location: 'München, Bayern, Germany 🇩🇪',
            linkedin: 'https://linkedin.com/in/francois-muller',
          },
          summary: 'Software Architekt mit 10+ Jahren Erfahrung in verteilten Systemen.',
        },
      };

      const doc = createDomDocument(`
        <html><body>
          <form>
            <input type="text" name="first_name" />
            <input type="text" name="last_name" />
            <input type="email" name="email" />
            <input type="tel" name="phone" />
            <input type="text" name="city" />
            <input type="text" name="linkedin" />
            <textarea name="summary"></textarea>
          </form>
        </body></html>
      `);

      const result = formFiller.fill(doc, intlResume);
      expect(result.success).toBe(true);

      expect((doc.querySelector('input[name="first_name"]') as HTMLInputElement).value).toBe('François');
      expect((doc.querySelector('input[name="last_name"]') as HTMLInputElement).value).toBe('Müller 🌟');
      expect((doc.querySelector('input[name="email"]') as HTMLInputElement).value).toBe('francois.muller@munich.de');
      expect((doc.querySelector('input[name="phone"]') as HTMLInputElement).value).toBe('+49 89 12345678');
      expect((doc.querySelector('input[name="city"]') as HTMLInputElement).value).toBe('München');
      expect((doc.querySelector('textarea[name="summary"]') as HTMLTextAreaElement).value).toContain('Software Architekt');
    });

    it('T5-FIL-09: should handle degenerate/empty resumes without throwing and report skipped fields', () => {
      const doc = createDomDocument(GREENHOUSE_DOM_FIXTURE);
      const result = formFiller.fill(doc, MOCK_DEGENERATE_RESUME);

      expect(result.success).toBe(false);
      expect(result.filledCount).toBe(0);
      expect(result.fields.every((f) => f.status === 'skipped')).toBe(true);
    });

    it('T5-FIL-10: should handle pathological DOMs with disabled, readonly, hidden, and button inputs safely', () => {
      const doc = createDomDocument(`
        <html><body>
          <form>
            <input type="hidden" name="csrf" value="token123" />
            <input type="text" name="first_name" value="Locked" disabled />
            <input type="text" name="last_name" value="Readonly" readonly />
            <input type="email" name="email" value="" />
            <input type="submit" value="Submit Application" />
            <input type="reset" value="Reset" />
          </form>
        </body></html>
      `);

      const result = formFiller.fill(doc, MOCK_SENIOR_FULLSTACK_RESUME);
      expect(result.success).toBe(true);
      expect(result.filledCount).toBe(1); // Only email should be filled

      expect((doc.querySelector('input[name="first_name"]') as HTMLInputElement).value).toBe('Locked');
      expect((doc.querySelector('input[name="last_name"]') as HTMLInputElement).value).toBe('Readonly');
      expect((doc.querySelector('input[name="email"]') as HTMLInputElement).value).toBe('alex.rivera@example.com');
      expect((doc.querySelector('input[name="csrf"]') as HTMLInputElement).value).toBe('token123');
    });
  });

  // ==========================================================================
  // Group 4: End-to-End Cross-Module Pipeline Stress & Adversarial Combinations
  // ==========================================================================
  describe('Group 4: End-to-End Cross-Module Integration Stress', () => {
    it('T5-INT-01: Full Pipeline (Job -> ATS -> Local Tailor -> Form Auto-Fill) with Symbol-Heavy Tech Stack', () => {
      const enterpriseJob: JobPosting = {
        id: 'job_ent_1',
        title: 'Principal Cloud & Distributed Systems Architect',
        company: 'CloudScale Enterprises',
        description: 'Design multi-region systems using Go, C++, Kubernetes, AWS, PostgreSQL, Redis, and Kafka. CI/CD automation with Terraform.',
        requiredSkills: ['go', 'c++', 'kubernetes', 'aws', 'postgresql', 'redis', 'kafka', 'ci/cd', 'terraform'],
        url: 'https://boards.greenhouse.io/cloudscale/jobs/555',
        source: 'greenhouse',
        scrapedAt: new Date().toISOString(),
      };

      // 1. ATS Scoring
      const initialScore = calculateAtsScore(enterpriseJob, MOCK_SENIOR_FULLSTACK_RESUME);
      expect(initialScore.overallScore).toBeGreaterThanOrEqual(80);

      // 2. Deterministic Local Tailoring
      const tailored = tailorResumeLocally(enterpriseJob, MOCK_SENIOR_FULLSTACK_RESUME);
      expect(tailored.sections.summary).toBeDefined();
      expect(tailored.sections.skills[0]).toBe('Go');

      // 3. Re-evaluate ATS score on tailored resume
      const tailoredResumeObj: Resume = {
        ...MOCK_SENIOR_FULLSTACK_RESUME,
        sections: tailored.sections,
      };
      const postScore = calculateAtsScore(enterpriseJob, tailoredResumeObj);
      expect(postScore.overallScore).toBeGreaterThanOrEqual(initialScore.overallScore);

      // 4. Auto-Fill Greenhouse Form
      const doc = createDomDocument(GREENHOUSE_DOM_FIXTURE);
      const fillResult = formFiller.fill(doc, tailoredResumeObj);

      expect(fillResult.success).toBe(true);
      expect(fillResult.platform).toBe('greenhouse');
      expect(fillResult.filledCount).toBeGreaterThanOrEqual(4);

      expect((doc.querySelector('#first_name') as HTMLInputElement).value).toBe('Alex');
      expect((doc.querySelector('#last_name') as HTMLInputElement).value).toBe('Rivera');
      expect((doc.querySelector('#email') as HTMLInputElement).value).toBe('alex.rivera@example.com');
    });

    it('T5-INT-02: Minimal Profile End-to-End Pipeline without Errors', () => {
      const job: JobPosting = {
        id: 'job_generic_min',
        title: 'Junior Web Developer',
        company: 'Startup',
        description: 'Requires HTML, CSS, JavaScript, and Git.',
        requiredSkills: ['html', 'css', 'javascript', 'git'],
        url: 'https://startup.com/jobs/1',
        source: 'generic',
        scrapedAt: new Date().toISOString(),
      };

      // 1. Score Minimal Profile
      const score = calculateAtsScore(job, MOCK_MINIMAL_RESUME);
      expect(score.overallScore).toBeGreaterThan(0);

      // 2. Tailor Minimal Profile
      const tailored = tailorResumeLocally(job, MOCK_MINIMAL_RESUME);
      expect(tailored.sections.summary).toContain('Junior Web Developer');

      // 3. Auto-Fill Form with Minimal Profile
      const doc = createDomDocument(SCHEMA_ORG_DOM_FIXTURE);
      const tailoredObj: Resume = {
        ...MOCK_MINIMAL_RESUME,
        sections: tailored.sections,
      };
      const fillResult = formFiller.fill(doc, tailoredObj);
      expect(fillResult.success).toBe(true);
      expect((doc.querySelector('input[name="first_name"]') as HTMLInputElement).value).toBe('Cher');
    });

    it('T5-INT-03: Concurrent Multi-Candidate & Multi-Job Stress Simulation (50 Concurrent Runs)', async () => {
      const jobs = [globalBaseJob, globalMlJob];
      const resumes = [
        MOCK_SENIOR_FULLSTACK_RESUME,
        MOCK_JUNIOR_FRONTEND_RESUME,
        MOCK_SPECIALIST_ML_RESUME,
        MOCK_PRODUCT_MANAGER_RESUME,
        MOCK_MINIMAL_RESUME,
      ];

      const tasks: Promise<boolean>[] = [];

      for (let i = 0; i < 50; i++) {
        tasks.push(
          new Promise((resolve) => {
            const j = jobs[i % jobs.length];
            const r = resumes[i % resumes.length];

            const score = calculateAtsScore(j, r);
            const tailored = tailorResumeLocally(j, r);
            const doc = createDomDocument(GREENHOUSE_DOM_FIXTURE);
            const fillRes = formFiller.fill(doc, { ...r, sections: tailored.sections });

            resolve(score.overallScore >= 0 && tailored.sections !== undefined && fillRes !== null);
          })
        );
      }

      const results = await Promise.all(tasks);
      expect(results.every((r) => r === true)).toBe(true);
    });
  });
});
