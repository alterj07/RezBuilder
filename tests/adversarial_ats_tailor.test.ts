import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  extractActionVerbRecommendations,
  calculateAtsScore,
} from '../src/services/scoring/atsEngine';
import {
  tailorService,
  extractJsonFromResponse,
} from '../src/services/tailor/tailorService';
import { AIFactory } from '../src/services/ai/aiFactory';
import { JobPosting } from '../src/types/job';
import { Resume } from '../src/types/resume';

describe('Adversarial Verification: ATS Action Verb Recommendations', () => {
  const dummyJob: JobPosting = {
    id: 'job_adv_1',
    title: 'Senior Software Engineer',
    company: 'TestCorp',
    description: 'Looking for a Senior Software Engineer with Go, TypeScript, Kubernetes, and AWS experience.',
    requiredSkills: ['go', 'typescript', 'kubernetes', 'aws'],
    url: 'https://testcorp.com/jobs/1',
    source: 'greenhouse',
    scrapedAt: new Date().toISOString(),
  };

  const createBaseResume = (): Resume => ({
    id: 'res_base',
    name: 'Alex Mercer',
    tag: 'Backend',
    fileName: 'resume.pdf',
    fileType: 'pdf',
    uploadedAt: new Date().toISOString(),
    rawText: 'Alex Mercer Backend Engineer',
    sections: {
      contact: { name: 'Alex Mercer', email: 'alex@example.com' },
      summary: 'Experienced Backend Engineer.',
      experience: [],
      education: [],
      skills: ['go', 'typescript'],
      projects: [],
    },
  });

  describe('Edge Case 1: Empty and Malformed Resumes', () => {
    it('handles resume with empty sections object gracefully in extractActionVerbRecommendations', () => {
      const emptyResume: Resume = {
        ...createBaseResume(),
        sections: {
          contact: { name: 'Alex' },
          summary: '',
          experience: [],
          education: [],
          skills: [],
          projects: [],
        },
      };

      const recs = extractActionVerbRecommendations(emptyResume);
      expect(recs).toEqual([]);

      const score = calculateAtsScore(dummyJob, emptyResume);
      expect(score).toBeDefined();
      expect(score.actionVerbRecommendations).toEqual([]);
      expect(score.overallScore).toBeGreaterThanOrEqual(0);
    });

    it('extractActionVerbRecommendations handles undefined / null experience section safely', () => {
      const resumeNoExp: Resume = {
        ...createBaseResume(),
        sections: {
          contact: { name: 'Test' },
          summary: 'Summary',
          experience: undefined as any,
          education: [],
          skills: [],
          projects: [],
        },
      };

      const recs = extractActionVerbRecommendations(resumeNoExp);
      expect(recs).toEqual([]);
    });

    it('handles experience entries with null/empty bullets arrays or non-string bullets safely', () => {
      const resumeCorruptBullets: Resume = {
        ...createBaseResume(),
        sections: {
          contact: { name: 'Test' },
          summary: 'Summary',
          experience: [
            {
              id: 'exp_corrupt_1',
              company: 'Bad Data Inc',
              title: 'Dev',
              bullets: null as any,
            },
            {
              id: 'exp_corrupt_2',
              company: 'Bad Data Inc 2',
              title: 'Dev',
              bullets: ['', '   ', null as any, undefined as any, 123 as any, '•   '],
            },
          ],
          education: [],
          skills: [],
          projects: [],
        },
      };

      const recs = extractActionVerbRecommendations(resumeCorruptBullets);
      expect(recs).toEqual([]);
    });
  });

  describe('Edge Case 2: Substring Collisions and False Positive Prevention', () => {
    it('does NOT flag words that contain weak verbs as substrings', () => {
      const resumeSubstrings: Resume = {
        ...createBaseResume(),
        sections: {
          contact: { name: 'Test' },
          summary: 'Summary',
          experience: [
            {
              id: 'exp_sub',
              company: 'Tech Co',
              title: 'Lead Engineer',
              bullets: [
                'Unhelped users were guided through custom onboarding workflows.',
                'Unmanaged legacy servers were decommissioned during cloud migration.',
                'Candidly communicated system risks to executive leadership.',
                'Custom-made benchmark tools to evaluate distributed database throughput.',
                'Prefixed API routes with v2 endpoints to prevent breaking changes.',
                'Rewrote legacy Perl microservices into high-performance Go services.',
                'Confused requirements were clarified with product owners.',
                'Diffused team blockers during cross-functional sprints.',
              ],
            },
          ],
          education: [],
          skills: ['go'],
          projects: [],
        },
      };

      const recs = extractActionVerbRecommendations(resumeSubstrings);
      expect(recs).toEqual([]);
    });

    it('correctly flags genuine weak verbs while ignoring substring words later in bullet', () => {
      const resumeMixed: Resume = {
        ...createBaseResume(),
        sections: {
          contact: { name: 'Test' },
          summary: 'Summary',
          experience: [
            {
              id: 'exp_mixed',
              company: 'Tech Co',
              title: 'Developer',
              bullets: [
                'Worked on custom-made benchmark tools.',
                'Helped with unmanaged legacy servers.',
                'Handled candid customer inquiries.',
              ],
            },
          ],
          education: [],
          skills: ['go'],
          projects: [],
        },
      };

      const recs = extractActionVerbRecommendations(resumeMixed);
      expect(recs.length).toBe(3);
      expect(recs[0].current.toLowerCase()).toBe('worked on');
      expect(recs[0].suggested).toBe('Engineered');
      expect(recs[1].current.toLowerCase()).toBe('helped with');
      expect(recs[1].suggested).toBe('Spearheaded');
      expect(recs[2].current.toLowerCase()).toBe('handled');
      expect(recs[2].suggested).toBe('Managed and optimized');
    });
  });

  describe('Edge Case 3: Casing Variations and Bullet Prefixes', () => {
    it('matches uppercase, lowercase, and title case weak verbs', () => {
      const resumeCasing: Resume = {
        ...createBaseResume(),
        sections: {
          contact: { name: 'Test' },
          summary: 'Summary',
          experience: [
            {
              id: 'exp_case',
              company: 'Tech Co',
              title: 'Developer',
              bullets: [
                'WORKED ON Kubernetes cluster automation.',
                'Helped With CI/CD deployment pipeline stabilization.',
                'RESPONSIBLE FOR database replication across AWS regions.',
                'Did production incident triage and root cause analyses.',
                'MADE architectural improvements to message bus.',
                'Built real-time streaming pipelines in Go.',
              ],
            },
          ],
          education: [],
          skills: ['kubernetes', 'aws', 'go'],
          projects: [],
        },
      };

      const recs = extractActionVerbRecommendations(resumeCasing);
      expect(recs.length).toBe(6);
      expect(recs[0].current).toBe('WORKED ON');
      expect(recs[0].suggested).toBe('Engineered');
      expect(recs[1].current).toBe('Helped With');
      expect(recs[1].suggested).toBe('Spearheaded');
      expect(recs[2].current).toBe('RESPONSIBLE FOR');
      expect(recs[3].current).toBe('Did');
      expect(recs[4].current).toBe('MADE');
      expect(recs[5].current).toBe('Built');
    });

    it('strips leading bullet symbols (•, -, *, tab, spaces) before checking weak verbs', () => {
      const resumeBulletSymbols: Resume = {
        ...createBaseResume(),
        sections: {
          contact: { name: 'Test' },
          summary: 'Summary',
          experience: [
            {
              id: 'exp_symbols',
              company: 'Tech Co',
              title: 'Developer',
              bullets: [
                '•   worked on distributed caching with Redis.',
                '-   helped with QA automation scripts.',
                '*   did daily standups and sprint planning.',
                '\t\t  responsible for monitoring alerting thresholds.',
              ],
            },
          ],
          education: [],
          skills: [],
          projects: [],
        },
      };

      const recs = extractActionVerbRecommendations(resumeBulletSymbols);
      expect(recs.length).toBe(4);
      expect(recs[0].suggested).toBe('Engineered');
      expect(recs[1].suggested).toBe('Spearheaded');
      expect(recs[2].suggested).toBe('Executed');
      expect(recs[3].suggested).toBe('Architected and delivered');
    });
  });

  describe('Edge Case 4: Bullets with Multiple Weak Verbs', () => {
    it('handles bullets containing multiple weak verbs cleanly without duplicating suggestions for one bullet', () => {
      const resumeMultiWeak: Resume = {
        ...createBaseResume(),
        sections: {
          contact: { name: 'Test' },
          summary: 'Summary',
          experience: [
            {
              id: 'exp_multi',
              company: 'Tech Co',
              title: 'Developer',
              bullets: [
                'Worked on the backend, helped with frontend, and did database maintenance.',
              ],
            },
          ],
          education: [],
          skills: [],
          projects: [],
        },
      };

      const recs = extractActionVerbRecommendations(resumeMultiWeak);
      expect(recs.length).toBe(1);
      expect(recs[0].current.toLowerCase()).toBe('worked on');
      expect(recs[0].suggested).toBe('Engineered');
      expect(recs[0].context).toContain('Worked on the backend');
    });
  });
});

describe('Adversarial Verification: TailorService Fallback Resilience', () => {
  const dummyJob: JobPosting = {
    id: 'job_adv_tailor',
    title: 'Senior Cloud Architect',
    company: 'CloudWorks',
    description: 'Requires expertise in AWS, Kubernetes, Terraform, Go, and Python.',
    requiredSkills: ['aws', 'kubernetes', 'terraform', 'go', 'python'],
    url: 'https://cloudworks.com/jobs/arch',
    source: 'lever',
    scrapedAt: new Date().toISOString(),
  };

  const dummyResume: Resume = {
    id: 'res_adv_tailor',
    name: 'Jordan Rivera',
    tag: 'Cloud Architect',
    fileName: 'jordan_resume.pdf',
    fileType: 'pdf',
    uploadedAt: new Date().toISOString(),
    rawText: 'Jordan Rivera Cloud Architect',
    sections: {
      contact: { name: 'Jordan Rivera', email: 'jordan@example.com' },
      summary: 'Cloud Architect with 7 years of infrastructure experience.',
      experience: [
        {
          id: 'exp_1',
          company: 'ScaleCo',
          title: 'Infrastructure Engineer',
          startDate: '2020',
          endDate: 'Present',
          isCurrent: true,
          bullets: [
            'worked on AWS cloud architectures and Kubernetes clusters.',
            'helped with Terraform automation scripts for VPC provisioning.',
          ],
        },
      ],
      education: [],
      skills: ['aws', 'kubernetes', 'terraform'],
      projects: [],
    },
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('extractJsonFromResponse stress testing', () => {
    it('handles markdown wrapped JSON with complex formatting', () => {
      const markdown = '```json\n{\n  "summary": "Tailored Architect",\n  "skills": ["AWS", "Terraform"],\n  "experience": []\n}\n```';
      const parsed = extractJsonFromResponse(markdown);
      expect(parsed.summary).toBe('Tailored Architect');
      expect(parsed.skills).toEqual(['AWS', 'Terraform']);
    });

    it('handles conversational text before and after markdown code blocks', () => {
      const response = `Certainly! Here is the tailored resume tailored for the Senior Cloud Architect role:
\`\`\`json
{
  "summary": "Strategic Cloud Architect specializing in AWS and Kubernetes.",
  "skills": ["AWS", "Kubernetes", "Terraform", "Go"],
  "changesSummary": ["Updated summary and prioritized cloud skills."]
}
\`\`\`
Please let me know if you need any further modifications!`;

      const parsed = extractJsonFromResponse(response);
      expect(parsed.summary).toBe('Strategic Cloud Architect specializing in AWS and Kubernetes.');
      expect(parsed.skills).toContain('Kubernetes');
      expect(parsed.changesSummary.length).toBe(1);
    });

    it('handles raw JSON without code blocks', () => {
      const raw = '{"summary": "Direct JSON", "skills": ["Go"]}';
      const parsed = extractJsonFromResponse(raw);
      expect(parsed.summary).toBe('Direct JSON');
    });

    it('throws error on non-JSON strings so caller can trigger fallback', () => {
      expect(() => extractJsonFromResponse('')).toThrow();
      expect(() => extractJsonFromResponse('Internal Server Error: Service Unavailable')).toThrow();
      expect(() => extractJsonFromResponse('{ "summary": "Unfinished json')).toThrow();
    });
  });

  describe('TailorService Fallback Under Adversarial Provider Responses', () => {
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
      expect(result.tailoredResume.sections.summary).toBeDefined();
      expect(result.tailoredResume.sections.experience[0].bullets[0]).toContain('Engineered');
    });

    it('falls back to local heuristic on HTTP 500 / 401 / 429 Provider Exceptions', async () => {
      const mockProvider = {
        name: 'openai',
        generateText: vi.fn().mockRejectedValue(new Error('OpenAI API Error (401): Incorrect API key provided')),
        generateStructuredJson: vi.fn(),
      };
      vi.spyOn(AIFactory, 'getProvider').mockReturnValue(mockProvider as any);

      const result = await tailorService.tailor(dummyJob, dummyResume, {
        provider: 'openai',
        apiKey: 'sk-invalid-key',
      });

      expect(result.strategy).toBe('local_heuristic');
      expect(result.fallbackReason).toContain('401');
      expect(result.tailoredResume.sections.experience.length).toBe(1);
    });

    it('falls back to local heuristic when AI returns garbage / truncated text', async () => {
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
      expect(result.tailoredResume.sections.skills).toContain('AWS');
    });

    it('falls back cleanly when API key is empty or whitespace-only', async () => {
      const resultWhitespaceKey = await tailorService.tailor(dummyJob, dummyResume, {
        apiKey: '    ',
      });

      expect(resultWhitespaceKey.strategy).toBe('local_heuristic');
      expect(resultWhitespaceKey.fallbackReason).toContain('No API key');
      expect(resultWhitespaceKey.tailoredResume).toBeDefined();
    });

    it('resiliently handles partial / missing sections in valid AI JSON response', async () => {
      // LLM only returns summary and changesSummary, omitting skills, experience, and unresolvedGaps
      const partialJson = JSON.stringify({
        summary: 'AI-tailored cloud architect summary.',
        changesSummary: ['Refined summary.'],
      });

      const mockProvider = {
        name: 'anthropic',
        generateText: vi.fn().mockResolvedValue(partialJson),
        generateStructuredJson: vi.fn(),
      };
      vi.spyOn(AIFactory, 'getProvider').mockReturnValue(mockProvider as any);

      const result = await tailorService.tailor(dummyJob, dummyResume, {
        provider: 'anthropic',
        apiKey: 'sk-ant-valid',
      });

      expect(result.strategy).toBe('ai_llm');
      expect(result.tailoredResume.sections.summary).toBe('AI-tailored cloud architect summary.');
      // Should preserve base resume skills and experience when missing in AI response
      expect(result.tailoredResume.sections.skills).toEqual(dummyResume.sections.skills);
      expect(result.tailoredResume.sections.experience).toEqual(dummyResume.sections.experience);
      expect(result.tailoredResume.unresolvedGaps).toEqual([]);
      expect(result.tailoredResume.atsScore).toBeDefined();
    });
  });
});
