import { describe, it, expect, vi, beforeEach } from 'vitest';
import { tailorService, extractJsonFromResponse } from '../src/services/tailor/tailorService';
import { AIFactory } from '../src/services/ai/aiFactory';
import { JobPosting } from '../src/types/job';
import { MOCK_SENIOR_FULLSTACK_RESUME, MOCK_PRODUCT_MANAGER_RESUME } from './fixtures/mockResumes';

describe('Unified TailorService (AI LLM + Heuristic Fallback)', () => {
  const targetJob: JobPosting = {
    id: 'job_fullstack_ai',
    title: 'Senior Full Stack Cloud Engineer',
    company: 'NextGen Cloud',
    description: 'Looking for a Senior Full Stack Engineer experienced with React, TypeScript, Node.js, Kubernetes, and AWS.',
    requiredSkills: ['react', 'typescript', 'node.js', 'kubernetes', 'aws', 'postgresql', 'docker'],
    url: 'https://nextgen.io/careers/senior-fullstack',
    source: 'greenhouse',
    scrapedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('extractJsonFromResponse', () => {
    it('should parse clean JSON string', () => {
      const input = '{"summary": "Test Summary", "skills": ["React", "TypeScript"]}';
      const result = extractJsonFromResponse(input);
      expect(result.summary).toBe('Test Summary');
      expect(result.skills).toEqual(['React', 'TypeScript']);
    });

    it('should parse JSON wrapped in markdown codeblocks', () => {
      const input = '```json\n{"summary": "Wrapped Summary", "skills": ["Node.js"]}\n```';
      const result = extractJsonFromResponse(input);
      expect(result.summary).toBe('Wrapped Summary');
      expect(result.skills).toEqual(['Node.js']);
    });

    it('should extract JSON with leading and trailing conversational text', () => {
      const input = 'Here is the tailored resume:\n\n{"summary": "Extracted", "skills": ["AWS"]}\n\nHope this helps!';
      const result = extractJsonFromResponse(input);
      expect(result.summary).toBe('Extracted');
      expect(result.skills).toEqual(['AWS']);
    });

    it('should throw error on invalid non-JSON string', () => {
      expect(() => extractJsonFromResponse('This is not json at all')).toThrow();
    });
  });

  describe('tailorResume - AI Provider Execution', () => {
    it('should tailor resume via AI LLM when API key is provided and response is valid', async () => {
      const mockLLMResponse = JSON.stringify({
        summary: 'Expert Senior Full Stack Cloud Engineer with 8+ years architecting microservices on AWS.',
        skills: ['React', 'TypeScript', 'Node.js', 'Kubernetes', 'AWS', 'PostgreSQL', 'Docker'],
        experience: [
          {
            id: 'exp_sr_1',
            company: 'CloudScale Inc',
            title: 'Lead Infrastructure & Backend Engineer',
            startDate: 'Jan 2021',
            endDate: 'Present',
            isCurrent: true,
            bullets: [
              'Architected microservices in Go, Node.js, and TypeScript on AWS.',
              'Managed Kubernetes clusters and CI/CD pipelines.',
            ],
            bulletDiffs: [
              {
                original: 'Architected microservices in Go, Node.js, and TypeScript serving 50M+ daily requests with 99.99% uptime.',
                tailored: 'Architected microservices in Go, Node.js, and TypeScript on AWS.',
                reason: 'Emphasized AWS microservices',
              },
            ],
          },
        ],
        changesSummary: ['Highlighted AWS and Kubernetes achievements.'],
        unresolvedGaps: [],
      });

      const mockProvider = {
        name: 'anthropic',
        generateText: vi.fn().mockResolvedValue(mockLLMResponse),
        generateStructuredJson: vi.fn(),
      };

      vi.spyOn(AIFactory, 'getProvider').mockReturnValue(mockProvider as any);

      const result = await tailorService.tailorResume(targetJob, MOCK_SENIOR_FULLSTACK_RESUME, {
        provider: 'anthropic',
        apiKey: 'sk-ant-test-key',
        model: 'claude-3-5-sonnet-20241022',
      });

      expect(result.strategy).toBe('ai_llm');
      expect(result.provider).toBe('anthropic');
      expect(result.tailoredResume.sections.summary).toContain('Expert Senior Full Stack');
      expect(result.tailoredResume.sections.skills).toContain('React');
      expect(result.tailoredResume.changesSummary).toContain('Highlighted AWS and Kubernetes achievements.');
      expect(result.diffs).toBeDefined();
      expect(result.diffs?.length).toBeGreaterThan(0);
      expect(result.matchScoreImprovement).toBeDefined();
      expect(result.matchScoreImprovement?.after).toBeGreaterThan(0);
    });

    it('should seamlessly fallback to local heuristic engine on invalid JSON response', async () => {
      const mockProvider = {
        name: 'openai',
        generateText: vi.fn().mockResolvedValue('I am unable to output JSON for this request.'),
        generateStructuredJson: vi.fn(),
      };

      vi.spyOn(AIFactory, 'getProvider').mockReturnValue(mockProvider as any);

      const result = await tailorService.tailorResume(targetJob, MOCK_SENIOR_FULLSTACK_RESUME, {
        provider: 'openai',
        apiKey: 'sk-openai-test-key',
      });

      expect(result.strategy).toBe('local_heuristic');
      expect(result.fallbackReason).toBeDefined();
      expect(result.tailoredResume).toBeDefined();
      expect(result.tailoredResume.sections.summary).toBeDefined();
      expect(result.matchScoreImprovement).toBeDefined();
    });

    it('should seamlessly fallback to local heuristic engine on API error / network failure', async () => {
      const mockProvider = {
        name: 'gemini',
        generateText: vi.fn().mockRejectedValue(new Error('Rate limit exceeded (429)')),
        generateStructuredJson: vi.fn(),
      };

      vi.spyOn(AIFactory, 'getProvider').mockReturnValue(mockProvider as any);

      const result = await tailorService.tailorResume(targetJob, MOCK_SENIOR_FULLSTACK_RESUME, {
        provider: 'gemini',
        apiKey: 'gemini-test-key',
      });

      expect(result.strategy).toBe('local_heuristic');
      expect(result.fallbackReason).toContain('Rate limit exceeded');
      expect(result.tailoredResume.sections.experience.length).toBeGreaterThan(0);
    });

    it('should seamlessly use local heuristic engine when no API key is provided', async () => {
      const result = await tailorService.tailorResume(targetJob, MOCK_PRODUCT_MANAGER_RESUME, {
        apiKey: '',
      });

      expect(result.strategy).toBe('local_heuristic');
      expect(result.fallbackReason).toContain('No API key');
      expect(result.tailoredResume.baseResumeId).toBe('res_product_manager');
      expect(result.matchScoreImprovement?.before).toBeDefined();
      expect(result.matchScoreImprovement?.after).toBeDefined();
    });
  });
});
