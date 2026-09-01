import { describe, it, expect } from 'vitest';
import { buildInterviewPrepPrompt, INTERVIEW_PREP_SYSTEM_PROMPT } from '../src/prompts/interviewPrep';
import { convertBriefingToMarkdown } from '../src/services/export/markdownExporter';
import { settingsStorage } from '../src/services/storage/settingsStorage';
import { DEFAULT_SETTINGS } from '../src/types/settings';
import { JobPosting } from '../src/types/job';
import { InterviewPrepBriefing } from '../src/types/interview';

describe('Interview Prep & Settings', () => {
  const mockJob: JobPosting = {
    id: 'job_prep',
    title: 'Lead Site Reliability Engineer',
    company: 'Fintech Corp',
    description: 'Ensure 99.99% uptime on Kubernetes and AWS.',
    requiredSkills: ['kubernetes', 'aws', 'prometheus'],
    url: 'https://fintech.com/jobs/1',
    source: 'linkedin',
    scrapedAt: new Date().toISOString(),
  };

  it('Interview prep prompt contains system prompt and target job fields', () => {
    expect(INTERVIEW_PREP_SYSTEM_PROMPT).toContain('roleSynthesis');
    expect(INTERVIEW_PREP_SYSTEM_PROMPT).toContain('technicalQuestions');
    expect(INTERVIEW_PREP_SYSTEM_PROMPT).toContain('behavioralQuestions');
    expect(INTERVIEW_PREP_SYSTEM_PROMPT).toContain('questionsToAskInterviewer');

    const prompt = buildInterviewPrepPrompt(mockJob);
    expect(prompt).toContain('Lead Site Reliability Engineer');
    expect(prompt).toContain('Fintech Corp');
  });

  it('Markdown exporter formats briefing into structured cheat sheet', () => {
    const mockBriefing: InterviewPrepBriefing = {
      id: 'prep_1',
      jobId: 'job_prep',
      jobTitle: 'Lead Site Reliability Engineer',
      companyName: 'Fintech Corp',
      createdAt: new Date().toISOString(),
      roleSynthesis: 'High priority on zero-downtime deployments and distributed tracing.',
      coreConcepts: [
        {
          concept: 'Kubernetes Ingress & Service Meshes',
          explanation: 'Essential for routing traffic across isolated pods.',
          category: 'DevOps',
        },
      ],
      technicalQuestions: [
        {
          question: 'How do you troubleshoot a crashlooping pod in production?',
          category: 'DevOps',
          suggestedTalkingPoints: ['Check kubectl logs --previous', 'Inspect resource limits and OOMKilled events'],
          keyTermsToMention: ['kubectl describe', 'OOMKilled', 'Liveness Probe'],
        },
      ],
      behavioralQuestions: [
        {
          question: 'Describe an outage where you led incident response.',
          targetedValue: 'Calm Under Pressure / Postmortem Culture',
          starFrameworkTip: 'Focus on communication with stakeholders and root cause analysis.',
        },
      ],
      questionsToAskInterviewer: [
        {
          question: 'What is the on-call rotation schedule and how are alerts prioritized?',
          purpose: 'Evaluates engineering team health and operational maturity.',
        },
      ],
    };

    const markdown = convertBriefingToMarkdown(mockBriefing);
    expect(markdown).toContain('# Interview Prep Cheat Sheet: Lead Site Reliability Engineer');
    expect(markdown).toContain('What This Role Actually Cares About');
    expect(markdown).toContain('Kubernetes Ingress & Service Meshes');
    expect(markdown).toContain('crashlooping pod');
    expect(markdown).toContain('on-call rotation');
  });

  it('Settings service retrieves defaults and allows updating', async () => {
    const initial = await settingsStorage.getSettings();
    expect(initial.aiProvider).toBe('anthropic');
    expect(initial.anthropicModel).toBe(DEFAULT_SETTINGS.anthropicModel);

    const updated = await settingsStorage.updateSettings({ anthropicModel: 'claude-3-opus-20240229' });
    expect(updated.anthropicModel).toBe('claude-3-opus-20240229');
  });
});
