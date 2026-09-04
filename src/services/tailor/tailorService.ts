import { JobPosting } from '../../types/job';
import { Resume, ResumeSections, TailoredResume, TailoredBulletDiff } from '../../types/resume';
import { AIProviderType, UserSettings } from '../../types/settings';
import { UserProfile } from '../../types/profile';
import { AIFactory, getStoredSettings } from '../ai/aiFactory';
import { TAILOR_RESUME_SYSTEM_PROMPT, buildTailorResumePrompt } from '../../prompts/tailorResume';
import { tailorResumeLocally } from './localTailorEngine';
import { calculateAtsScore } from '../scoring/atsEngine';

export interface TailoredResumeResult {
  tailoredResume: TailoredResume;
  strategy: 'ai_llm' | 'local_heuristic';
  provider?: AIProviderType | string;
  model?: string;
  diffs?: TailoredBulletDiff[];
  matchScoreImprovement?: {
    before: number;
    after: number;
    delta: number;
  };
  fallbackReason?: string;
}

export interface TailorOptions {
  provider?: AIProviderType;
  apiKey?: string;
  model?: string;
  /** Candidate profile; its 1-5 skill ratings steer the local engine's ordering. */
  profile?: UserProfile | null;
}

/**
 * Sanitizes and extracts a valid JSON object string from an LLM response
 */
export function extractJsonFromResponse(raw: string): any {
  if (!raw || typeof raw !== 'string') {
    throw new Error('Empty or invalid response from LLM');
  }

  let text = raw.trim();

  // Strip markdown code fences if present
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  }

  // Find first { and last }
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    text = text.substring(firstBrace, lastBrace + 1);
  }

  return JSON.parse(text);
}

/**
 * Unified Resume Tailoring Service
 * Uses AI LLMs (Anthropic Claude, OpenAI, Gemini) when configured,
 * and seamlessly falls back to the deterministic local heuristic tailoring engine.
 */
export class TailorService {
  /**
   * Main tailoring entry point
   */
  public async tailorResume(
    job: JobPosting,
    resume: Resume,
    options?: TailorOptions
  ): Promise<TailoredResumeResult> {
    const beforeScore = calculateAtsScore(job, resume).overallScore;

    // Resolve provider, key, model from options or persistent storage
    let providerType: AIProviderType | undefined = options?.provider;
    let apiKey: string | undefined = options?.apiKey;
    let model: string | undefined = options?.model;

    if (!apiKey) {
      try {
        const settings: UserSettings = await getStoredSettings();
        providerType = providerType || settings.aiProvider;
        if (providerType === 'openai') {
          apiKey = settings.openaiApiKey;
          model = model || settings.openaiModel;
        } else if (providerType === 'gemini') {
          apiKey = settings.geminiApiKey;
          model = model || settings.geminiModel;
        } else {
          apiKey = settings.anthropicApiKey;
          model = model || settings.anthropicModel;
        }
      } catch {
        // Ignore settings load failures and proceed to local fallback
      }
    }

    // If API key is available, attempt AI LLM tailoring
    if (apiKey && apiKey.trim() !== '') {
      try {
        const provider = AIFactory.getProvider(providerType || 'anthropic', apiKey.trim(), model);
        const prompt = buildTailorResumePrompt(job, resume);

        const rawResponse = await provider.generateText(prompt, {
          systemPrompt: TAILOR_RESUME_SYSTEM_PROMPT,
          temperature: 0.2,
        });

        const parsed = extractJsonFromResponse(rawResponse);

        if (!parsed || typeof parsed !== 'object') {
          throw new Error('LLM response could not be parsed into a JSON object');
        }

        const tailoredSections: ResumeSections = {
          contact: resume.sections.contact,
          summary: typeof parsed.summary === 'string' && parsed.summary.trim() ? parsed.summary.trim() : resume.sections.summary,
          skills: Array.isArray(parsed.skills) && parsed.skills.length > 0 ? parsed.skills : resume.sections.skills,
          experience: Array.isArray(parsed.experience) && parsed.experience.length > 0 ? parsed.experience : resume.sections.experience,
          education: resume.sections.education,
          projects: resume.sections.projects,
          certifications: resume.sections.certifications,
        };

        // Extract all bullet diffs
        const diffs: TailoredBulletDiff[] = [];
        for (const exp of tailoredSections.experience) {
          if (exp.bulletDiffs && Array.isArray(exp.bulletDiffs)) {
            diffs.push(...exp.bulletDiffs);
          }
        }

        // Calculate improved ATS score
        const tempResume: Resume = {
          ...resume,
          sections: tailoredSections,
        };
        const afterScore = calculateAtsScore(job, tempResume).overallScore;
        const matchScoreImprovement = {
          before: beforeScore,
          after: afterScore,
          delta: Math.max(0, afterScore - beforeScore),
        };

        const tailoredResume: TailoredResume = {
          id: 'tailored_ai_' + Date.now(),
          baseResumeId: resume.id,
          jobId: job.id,
          createdAt: new Date().toISOString(),
          sections: tailoredSections,
          rawText: '',
          changesSummary: Array.isArray(parsed.changesSummary) && parsed.changesSummary.length > 0
            ? parsed.changesSummary
            : ['AI-optimized summary and bullet points for target job requirements.'],
          unresolvedGaps: Array.isArray(parsed.unresolvedGaps) ? parsed.unresolvedGaps : [],
          atsScore: afterScore,
        };

        return {
          tailoredResume,
          strategy: 'ai_llm',
          provider: providerType || 'anthropic',
          model,
          diffs: diffs.length > 0 ? diffs : undefined,
          matchScoreImprovement,
        };
      } catch (err: any) {
        console.warn(
          `[TailorService] AI tailoring failed (${err?.message || 'unknown error'}), falling back to local heuristic engine.`
        );
        return this.executeLocalFallback(job, resume, beforeScore, err?.message || 'AI provider error', options?.profile);
      }
    }

    // No API key provided: seamless local heuristic tailoring
    return this.executeLocalFallback(job, resume, beforeScore, 'No API key configured. Using local deterministic heuristic.', options?.profile);
  }

  /**
   * Alias method for interface contract compatibility
   */
  public async tailor(
    job: JobPosting,
    resume: Resume,
    options?: TailorOptions
  ): Promise<TailoredResumeResult> {
    return this.tailorResume(job, resume, options);
  }

  private executeLocalFallback(
    job: JobPosting,
    resume: Resume,
    beforeScore: number,
    reason: string,
    profile?: UserProfile | null
  ): TailoredResumeResult {
    const localTailored = tailorResumeLocally(job, resume, { profile });

    const tempResume: Resume = {
      ...resume,
      sections: localTailored.sections,
    };
    const afterScore = calculateAtsScore(job, tempResume).overallScore;
    localTailored.atsScore = afterScore;

    const diffs: TailoredBulletDiff[] = [];
    for (const exp of localTailored.sections.experience) {
      if (exp.bulletDiffs && Array.isArray(exp.bulletDiffs)) {
        diffs.push(...exp.bulletDiffs);
      }
    }

    return {
      tailoredResume: localTailored,
      strategy: 'local_heuristic',
      fallbackReason: reason,
      diffs: diffs.length > 0 ? diffs : undefined,
      matchScoreImprovement: {
        before: beforeScore,
        after: afterScore,
        delta: Math.max(0, afterScore - beforeScore),
      },
    };
  }
}

export const tailorService = new TailorService();
