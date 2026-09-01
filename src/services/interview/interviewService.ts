import { JobPosting } from '../../types/job';
import { Resume } from '../../types/resume';
import { InterviewPrepBriefing } from '../../types/interview';
import { getActiveAIProvider } from '../ai/aiFactory';
import { INTERVIEW_PREP_SYSTEM_PROMPT, buildInterviewPrepPrompt } from '../../prompts/interviewPrep';

const BRIEFINGS_KEY = 'rezbuilder_interview_briefings';

export class InterviewService {
  /**
   * Generates a complete interview preparation briefing for a job
   */
  async generateBriefing(job: JobPosting, resume?: Resume): Promise<InterviewPrepBriefing> {
    const aiProvider = await getActiveAIProvider();
    const prompt = buildInterviewPrepPrompt(job, resume);

    const payload = await aiProvider.generateStructuredJson<any>(prompt, {
      systemPrompt: INTERVIEW_PREP_SYSTEM_PROMPT,
      temperature: 0.3,
    });

    const briefing: InterviewPrepBriefing = {
      id: 'prep_' + Date.now(),
      jobId: job.id,
      jobTitle: job.title,
      companyName: job.company,
      createdAt: new Date().toISOString(),
      roleSynthesis: payload.roleSynthesis || 'Key focus on execution, engineering rigor, and teamwork.',
      coreConcepts: payload.coreConcepts || [],
      technicalQuestions: payload.technicalQuestions || [],
      behavioralQuestions: payload.behavioralQuestions || [],
      questionsToAskInterviewer: payload.questionsToAskInterviewer || [],
    };

    await this.saveBriefing(briefing);
    return briefing;
  }

  /**
   * Save briefing to local storage
   */
  async saveBriefing(briefing: InterviewPrepBriefing): Promise<void> {
    const briefings = await this.getAllBriefings();
    const index = briefings.findIndex((b) => b.jobId === briefing.jobId);
    if (index >= 0) {
      briefings[index] = briefing;
    } else {
      briefings.unshift(briefing);
    }

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      await chrome.storage.local.set({ [BRIEFINGS_KEY]: briefings.slice(0, 20) });
    }
  }

  /**
   * Retrieve all saved briefings
   */
  async getAllBriefings(): Promise<InterviewPrepBriefing[]> {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      const result = await chrome.storage.local.get([BRIEFINGS_KEY]);
      return result[BRIEFINGS_KEY] || [];
    }
    return [];
  }

  /**
   * Get briefing for specific job
   */
  async getBriefingByJobId(jobId: string): Promise<InterviewPrepBriefing | null> {
    const all = await this.getAllBriefings();
    return all.find((b) => b.jobId === jobId) || null;
  }
}

export const interviewService = new InterviewService();
