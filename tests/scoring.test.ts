import { describe, it, expect } from 'vitest';
import { calculateKeywordMatch, isKeywordPresent } from '../src/services/scoring/keywordMatcher';
import { calculatePlacementScore } from '../src/services/scoring/placementScorer';
import { checkSectionCompleteness } from '../src/services/scoring/sectionChecker';
import { evaluateParseSuccess } from '../src/services/scoring/parseSuccessEvaluator';
import { calculateRelevance } from '../src/services/scoring/relevanceScorer';
import { calculateAtsScore, normalizeWeights } from '../src/services/scoring/atsEngine';
import { compareResumesAgainstJob } from '../src/services/scoring/multiResumeComparator';
import { JobPosting } from '../src/types/job';
import { Resume } from '../src/types/resume';

describe('ATS Scoring Engine - 5-Factor Weighted System', () => {
  const mockJob: JobPosting = {
    id: 'job_123',
    title: 'Senior Full Stack Engineer',
    company: 'Stripe',
    description: `
      We are looking for a Senior Full Stack Engineer with 5+ years of experience.
      Required Skills: React, TypeScript, Node.js, PostgreSQL, Docker, Kubernetes, AWS.
      Bachelor's degree in Computer Science or equivalent practical experience.
    `,
    requiredSkills: ['react', 'typescript', 'node.js', 'postgresql', 'docker', 'kubernetes', 'aws'],
    url: 'https://stripe.com/jobs/123',
    source: 'linkedin',
    scrapedAt: new Date().toISOString(),
  };

  const mockResumeHighMatch: Resume = {
    id: 'res_high',
    name: 'Sarah Connor',
    tag: 'Full Stack',
    fileName: 'sarah_resume.pdf',
    fileType: 'pdf',
    uploadedAt: new Date().toISOString(),
    rawText: `
      Sarah Connor
      sarah@example.com | (555) 987-6543 | San Francisco, CA
      linkedin.com/in/sarahconnor

      Professional Summary
      Senior Full Stack Engineer with 6 years of experience building high-scale cloud platforms using React, Node.js, and AWS.

      Work Experience
      Senior Software Engineer at Fintech Inc
      Jan 2021 - Present
      • Architected microservices in Node.js, TypeScript, and PostgreSQL.
      • Deployed containerized applications with Docker and Kubernetes on AWS.

      Software Engineer at WebApp Co
      Jan 2018 - Dec 2020
      • Built single-page applications using React and TypeScript.

      Education
      UC Berkeley
      Bachelor of Science in Computer Science
      Graduated 2018

      Skills
      React, TypeScript, Node.js, PostgreSQL, Docker, Kubernetes, AWS, GraphQL
    `,
    sections: {
      contact: {
        name: 'Sarah Connor',
        email: 'sarah@example.com',
        phone: '(555) 987-6543',
        location: 'San Francisco, CA',
        linkedin: 'linkedin.com/in/sarahconnor',
      },
      summary: 'Senior Full Stack Engineer with 6 years of experience building high-scale cloud platforms using React, Node.js, and AWS.',
      experience: [
        {
          id: 'exp_1',
          company: 'Fintech Inc',
          title: 'Senior Software Engineer',
          startDate: 'Jan 2021',
          endDate: 'Present',
          isCurrent: true,
          bullets: [
            'Architected microservices in Node.js, TypeScript, and PostgreSQL.',
            'Deployed containerized applications with Docker and Kubernetes on AWS.',
          ],
        },
        {
          id: 'exp_2',
          company: 'WebApp Co',
          title: 'Senior React Developer',
          startDate: 'Jan 2018',
          endDate: 'Dec 2020',
          isCurrent: false,
          bullets: ['Built single-page applications using React and TypeScript.'],
        },
      ],
      education: [
        {
          id: 'edu_1',
          institution: 'UC Berkeley',
          degree: 'Bachelor of Science in Computer Science',
          graduationYear: '2018',
        },
      ],
      skills: ['react', 'typescript', 'node.js', 'postgresql', 'docker', 'kubernetes', 'aws', 'graphql'],
      projects: [],
    },
  };

  const mockResumeLowMatch: Resume = {
    id: 'res_low',
    name: 'Junior Dev',
    tag: 'Frontend',
    fileName: 'junior_resume.pdf',
    fileType: 'pdf',
    uploadedAt: new Date().toISOString(),
    rawText: 'Junior Dev\nSkills: HTML, CSS, JavaScript',
    sections: {
      contact: { name: 'Junior Dev' },
      summary: '',
      experience: [],
      education: [],
      skills: ['html', 'css', 'javascript'],
      projects: [],
    },
  };

  it('1. Keyword Matcher should identify matching and missing skills with synonyms', () => {
    expect(isKeywordPresent('react', 'Built apps using React.js and Redux')).toBe(true);
    expect(isKeywordPresent('k8s', 'Kubernetes cluster deployment')).toBe(true);
    expect(isKeywordPresent('aws', 'Deployed on Amazon Web Services')).toBe(true);

    const matchResult = calculateKeywordMatch(mockJob, mockResumeHighMatch);
    expect(matchResult.matchedKeywords).toBe(7);
    expect(matchResult.missingKeywords).toBe(0);
    expect(matchResult.score).toBe(100);
  });

  it('2. Placement Scorer should reward keywords present in titles and bullets', () => {
    const kwResult = calculateKeywordMatch(mockJob, mockResumeHighMatch);
    const placement = calculatePlacementScore(kwResult.items);

    expect(placement.score).toBeGreaterThan(70);
    expect(placement.titleKeywordsCount).toBeGreaterThan(0);
    expect(placement.experienceKeywordsCount).toBeGreaterThan(0);
  });

  it('3. Section Completeness Checker should evaluate core sections', () => {
    const sectionScoreHigh = checkSectionCompleteness(mockResumeHighMatch);
    expect(sectionScoreHigh.score).toBeGreaterThanOrEqual(90);
    expect(sectionScoreHigh.items.find((i) => i.name === 'Contact Information')?.present).toBe(true);
    expect(sectionScoreHigh.items.find((i) => i.name === 'Work Experience')?.present).toBe(true);

    const sectionScoreLow = checkSectionCompleteness(mockResumeLowMatch);
    expect(sectionScoreLow.score).toBeLessThan(50);
  });

  it('4. Parse Success Evaluator should score layout and flag errors', () => {
    const parseResultHigh = evaluateParseSuccess(mockResumeHighMatch);
    expect(parseResultHigh.cleanlinessRating).toBe('Excellent');
    expect(parseResultHigh.score).toBeGreaterThanOrEqual(85);

    const parseResultLow = evaluateParseSuccess(mockResumeLowMatch);
    expect(parseResultLow.cleanlinessRating).toBe('Poor');
    expect(parseResultLow.issues.length).toBeGreaterThan(0);
  });

  it('5. Relevance Scorer should evaluate tenure and title seniority alignment', () => {
    const relevanceHigh = calculateRelevance(mockJob, mockResumeHighMatch);
    expect(relevanceHigh.score).toBeGreaterThanOrEqual(90);
    expect(relevanceHigh.titleMatchScore).toBe(100);
  });

  it('6. ATS Engine should apply 5-factor weighted formula and platform presets', () => {
    const standardScore = calculateAtsScore(mockJob, mockResumeHighMatch, 'standard');
    expect(standardScore.overallScore).toBeGreaterThanOrEqual(85);
    expect(standardScore.weights.keywordMatch).toBe(45);
    expect(standardScore.weights.placement).toBe(15);
    expect(standardScore.weights.sectionCompleteness).toBe(15);
    expect(standardScore.weights.parseSuccess).toBe(15);
    expect(standardScore.weights.relevance).toBe(10);

    const enterpriseScore = calculateAtsScore(mockJob, mockResumeHighMatch, 'enterprise');
    expect(enterpriseScore.weights.keywordMatch).toBe(50);

    const modernScore = calculateAtsScore(mockJob, mockResumeHighMatch, 'modern');
    expect(modernScore.weights.sectionCompleteness).toBe(20);

    const customNormalized = normalizeWeights({
      keywordMatch: 50,
      placement: 20,
      sectionCompleteness: 20,
      parseSuccess: 10,
      relevance: 10,
    });
    expect(
      customNormalized.keywordMatch +
        customNormalized.placement +
        customNormalized.sectionCompleteness +
        customNormalized.parseSuccess +
        customNormalized.relevance
    ).toBe(100);
  });

  it('7. Multi-Resume Comparator should rank resumes and recommend the best fit', () => {
    const { recommendation, rankedResumes } = compareResumesAgainstJob(mockJob, [
      mockResumeLowMatch,
      mockResumeHighMatch,
    ]);

    expect(rankedResumes.length).toBe(2);
    expect(recommendation?.resumeId).toBe('res_high');
    expect(recommendation?.isRecommended).toBe(true);
    expect(recommendation?.recommendationReason).toContain('Highest match');
  });
});
