import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  extractActionVerbRecommendations,
  scoreResume,
} from '../src/services/scoring/atsEngine';
import {
  tailorService,
  extractJsonFromResponse,
} from '../src/services/tailor/tailorService';
import { AIFactory } from '../src/services/ai/aiFactory';
import { JobPosting } from '../src/types/job';
import { Resume } from '../src/types/resume';

describe('Adversarial Stress Test: ATS Action Verb Extractor', () => {
  const dummyJob: JobPosting = {
    id: 'job_adv_test',
    title: 'Senior Software Engineer',
    company: 'TechCorp',
    description: 'Looking for a Senior Software Engineer with Go, TypeScript, and AWS experience.',
    requiredSkills: ['go', 'typescript', 'aws'],
    url: 'https://techcorp.com/jobs/1',
    source: 'greenhouse',
    scrapedAt: new Date().toISOString(),
  };

  const createResume = (bullets: string[]): Resume => ({
    id: 'res_test',
    name: 'Jane Doe',
    tag: 'Engineering',
    fileName: 'resume.pdf',
    fileType: 'pdf',
    uploadedAt: new Date().toISOString(),
    rawText: 'Jane Doe Senior Software Engineer Go TypeScript AWS',
    sections: {
      contact: { name: 'Jane Doe', email: 'jane@example.com' },
      summary: 'Experienced Senior Software Engineer.',
      experience: [
        {
          id: 'exp_1',
          company: 'TechCorp',
          title: 'Senior Software Engineer',
          startDate: '2020',
          endDate: 'Present',
          isCurrent: true,
          bullets,
        },
      ],
      education: [
        {
          id: 'edu_1',
          institution: 'MIT',
          degree: 'BS Computer Science',
          graduationYear: '2020',
        },
      ],
      skills: ['go', 'typescript', 'aws'],
      projects: [],
    },
  });

  describe('1. Empty and whitespace bullets', () => {
    it('handles empty strings, whitespace, and nullish elements in bullets without throwing', () => {
      const bullets = ['', '   ', '\t\n', null as any, undefined as any];
      const resume = createResume(bullets);

      const recs = extractActionVerbRecommendations(resume);
      expect(recs).toEqual([]);

      const score = scoreResume(dummyJob, resume);
      expect(score).toBeDefined();
      expect(score.actionVerbRecommendations).toEqual([]);
    });
  });

  describe('2. Bullets without weak verbs', () => {
    it('does not flag bullets that use strong or neutral verbs', () => {
      const bullets = [
        'Architected and deployed high-throughput Go microservices.',
        'Spearheaded cloud migration to AWS.',
        'Optimized PostgreSQL queries reducing latency by 45%.',
        'Implemented distributed tracing with OpenTelemetry.',
      ];
      const resume = createResume(bullets);

      const recs = extractActionVerbRecommendations(resume);
      expect(recs).toEqual([]);
    });
  });

  describe('3. Weak verbs as substrings of other words (false positive prevention)', () => {
    it('does NOT trigger on words where weak verb is a substring', () => {
      const bullets = [
        'Commanded an incident response team during major outages.', // "managed" / "did" substring check
        'Unhelped customers were escalated to dedicated support.', // "helped with"
        'Unmanaged servers were migrated to ECS clusters.',
        'Custom-made test fixtures were created for integration testing.', // "made"
        'Candidly addressed technical debt in sprint retrospectives.', // "did"
        'Prefixed all internal REST endpoints with version tags.', // "fixed"
        'Rewrote legacy Perl scripts into modern Go tools.', // "wrote"
        'Overworked data pipelines were refactored for horizontal scalability.', // "worked on"
      ];
      const resume = createResume(bullets);

      const recs = extractActionVerbRecommendations(resume);
      expect(recs).toEqual([]);
    });
  });

  describe('4. Bullet point prefix symbols', () => {
    it('recognizes standard bullet symbols •, -, *, tabs and spaces before weak verbs', () => {
      const bullets = [
        '• worked on real-time data streaming.',
        '- helped with customer escalations.',
        '* responsible for database clustering.',
        '\t handled high-priority bug fixes.',
      ];
      const resume = createResume(bullets);

      const recs = extractActionVerbRecommendations(resume);
      expect(recs.length).toBe(4);
      expect(recs[0].suggested).toBe('Engineered');
      expect(recs[1].suggested).toBe('Spearheaded');
      expect(recs[2].suggested).toBe('Architected and delivered');
      expect(recs[3].suggested).toBe('Managed and optimized');
    });

    it('tests numbered bullet prefixes like "1. "', () => {
      const bullets = [
        '1. worked on cloud infrastructure.',
        '2. helped with Kubernetes deployments.',
      ];
      const resume = createResume(bullets);

      const recs = extractActionVerbRecommendations(resume);
      // Let us observe if numbered prefixes match or do not match
      console.log('Numbered bullets recommendations:', recs);
    });
  });

  describe('5. Mixed case verbs', () => {
    it('correctly matches UPPERCASE, TitleCase, and mixed case weak verbs', () => {
      const bullets = [
        'WORKED ON GraphQL API gateway.',
        'Helped With onboarding new team members.',
        'RESPONSIBLE FOR cross-region disaster recovery.',
        'DID performance profiling on backend services.',
        'mAdE core infrastructure enhancements.',
      ];
      const resume = createResume(bullets);

      const recs = extractActionVerbRecommendations(resume);
      expect(recs.length).toBe(5);
      expect(recs[0].current).toBe('WORKED ON');
      expect(recs[0].suggested).toBe('Engineered');
      expect(recs[1].current).toBe('Helped With');
      expect(recs[1].suggested).toBe('Spearheaded');
      expect(recs[2].current).toBe('RESPONSIBLE FOR');
      expect(recs[3].current).toBe('DID');
      expect(recs[4].current).toBe('mAdE');
    });
  });
});

describe('Adversarial Stress Test: TailorService Resilience', () => {
  const dummyJob: JobPosting = {
    id: 'job_tailor_adv',
    title: 'Senior Cloud Engineer',
    company: 'CloudWorks',
    description: 'Requires AWS, Docker, Kubernetes, and TypeScript.',
    requiredSkills: ['aws', 'docker', 'kubernetes', 'typescript'],
    url: 'https://cloudworks.com/jobs/1',
    source: 'lever',
    scrapedAt: new Date().toISOString(),
  };

  const dummyResume: Resume = {
    id: 'res_tailor_adv',
    name: 'Sam Taylor',
    tag: 'Cloud',
    fileName: 'resume.pdf',
    fileType: 'pdf',
    uploadedAt: new Date().toISOString(),
    rawText: 'Sam Taylor Cloud Engineer AWS Docker Kubernetes TypeScript',
    sections: {
      contact: { name: 'Sam Taylor', email: 'sam@example.com' },
      summary: 'Cloud Engineer specializing in AWS and container platforms.',
      experience: [
        {
          id: 'exp_1',
          company: 'CloudCo',
          title: 'Cloud Engineer',
          startDate: '2021',
          endDate: 'Present',
          isCurrent: true,
          bullets: [
            'worked on AWS ECS and Kubernetes deployments.',
            'helped with Docker container security scanning.',
          ],
        },
      ],
      education: [],
      skills: ['aws', 'docker', 'kubernetes', 'typescript'],
      projects: [],
    },
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Provider throwing errors', () => {
    it('falls back to local heuristic on Network Offline / Fetch Error', async () => {
      const mockProvider = {
        name: 'anthropic',
        generateText: vi.fn().mockRejectedValue(new TypeError('Failed to fetch: net::ERR_INTERNET_DISCONNECTED')),
        generateStructuredJson: vi.fn(),
      };
      vi.spyOn(AIFactory, 'getProvider').mockReturnValue(mockProvider as any);

      const result = await tailorService.tailor(dummyJob, dummyResume, {
        provider: 'anthropic',
        apiKey: 'sk-ant-test',
      });

      expect(result.strategy).toBe('local_heuristic');
      expect(result.fallbackReason).toContain('Failed to fetch');
      expect(result.tailoredResume).toBeDefined();
      expect(result.tailoredResume.sections.experience[0].bullets[0]).toContain('Engineered');
    });

    it('falls back to local heuristic on 401 Unauthorized / 429 Rate Limit / 500 Server Error', async () => {
      const mockProvider = {
        name: 'openai',
        generateText: vi.fn().mockRejectedValue(new Error('OpenAI API Error (401): Invalid API key')),
        generateStructuredJson: vi.fn(),
      };
      vi.spyOn(AIFactory, 'getProvider').mockReturnValue(mockProvider as any);

      const result = await tailorService.tailor(dummyJob, dummyResume, {
        provider: 'openai',
        apiKey: 'sk-invalid',
      });

      expect(result.strategy).toBe('local_heuristic');
      expect(result.fallbackReason).toContain('401');
      expect(result.tailoredResume).toBeDefined();
    });
  });

  describe('2. Provider returning malformed/empty JSON', () => {
    it('falls back when provider returns empty string', async () => {
      const mockProvider = {
        name: 'gemini',
        generateText: vi.fn().mockResolvedValue(''),
        generateStructuredJson: vi.fn(),
      };
      vi.spyOn(AIFactory, 'getProvider').mockReturnValue(mockProvider as any);

      const result = await tailorService.tailor(dummyJob, dummyResume, {
        provider: 'gemini',
        apiKey: 'gemini-key',
      });

      expect(result.strategy).toBe('local_heuristic');
      expect(result.fallbackReason).toBeDefined();
    });

    it('falls back when provider returns HTML error page instead of JSON', async () => {
      const mockProvider = {
        name: 'gemini',
        generateText: vi.fn().mockResolvedValue('<html><body>502 Bad Gateway</body></html>'),
        generateStructuredJson: vi.fn(),
      };
      vi.spyOn(AIFactory, 'getProvider').mockReturnValue(mockProvider as any);

      const result = await tailorService.tailor(dummyJob, dummyResume, {
        provider: 'gemini',
        apiKey: 'gemini-key',
      });

      expect(result.strategy).toBe('local_heuristic');
      expect(result.fallbackReason).toBeDefined();
    });

    it('falls back when provider returns truncated/invalid JSON', async () => {
      const mockProvider = {
        name: 'anthropic',
        generateText: vi.fn().mockResolvedValue('{ "summary": "Truncated summary...'),
        generateStructuredJson: vi.fn(),
      };
      vi.spyOn(AIFactory, 'getProvider').mockReturnValue(mockProvider as any);

      const result = await tailorService.tailor(dummyJob, dummyResume, {
        provider: 'anthropic',
        apiKey: 'sk-ant-test',
      });

      expect(result.strategy).toBe('local_heuristic');
      expect(result.fallbackReason).toBeDefined();
    });
  });

  describe('3. Missing or whitespace API key', () => {
    it('falls back when API key is undefined / empty string / whitespace', async () => {
      const resultEmpty = await tailorService.tailor(dummyJob, dummyResume, {
        apiKey: '',
      });
      expect(resultEmpty.strategy).toBe('local_heuristic');
      expect(resultEmpty.fallbackReason).toContain('No API key');

      const resultSpaces = await tailorService.tailor(dummyJob, dummyResume, {
        apiKey: '   ',
      });
      expect(resultSpaces.strategy).toBe('local_heuristic');
      expect(resultSpaces.fallbackReason).toContain('No API key');
    });
  });

  describe('4. Markdown-wrapped JSON code blocks', () => {
    it('extracts JSON from standard ```json ... ``` fences', () => {
      const raw = '```json\n{\n  "summary": "Tailored Summary",\n  "skills": ["AWS", "Docker"]\n}\n```';
      const parsed = extractJsonFromResponse(raw);
      expect(parsed.summary).toBe('Tailored Summary');
      expect(parsed.skills).toEqual(['AWS', 'Docker']);
    });

    it('extracts JSON with conversational preamble and postamble around code blocks', () => {
      const raw = `Here is your optimized resume:

\`\`\`json
{
  "summary": "Tailored Cloud Engineer Summary",
  "skills": ["AWS", "Docker", "Kubernetes", "TypeScript"],
  "changesSummary": ["Optimized summary and skill prioritization"]
}
\`\`\`

I hope this helps your application!`;

      const parsed = extractJsonFromResponse(raw);
      expect(parsed.summary).toBe('Tailored Cloud Engineer Summary');
      expect(parsed.skills).toContain('Kubernetes');
      expect(parsed.changesSummary).toHaveLength(1);
    });

    it('extracts JSON when codeblock has no json specifier (``` ... ```)', () => {
      const raw = '```\n{\n  "summary": "Fenceless",\n  "skills": ["AWS"]\n}\n```';
      const parsed = extractJsonFromResponse(raw);
      expect(parsed.summary).toBe('Fenceless');
      expect(parsed.skills).toEqual(['AWS']);
    });
  });
});
