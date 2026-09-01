import { describe, it, expect } from 'vitest';
import { TAILOR_RESUME_SYSTEM_PROMPT, buildTailorResumePrompt } from '../src/prompts/tailorResume';
import { generateDocxResume } from '../src/services/export/docxExporter';
import { generateResumeHtml } from '../src/services/export/pdfExporter';
import { JobPosting } from '../src/types/job';
import { Resume } from '../src/types/resume';

describe('Resume Customization & Guardrails', () => {
  const mockJob: JobPosting = {
    id: 'job_test',
    title: 'Senior Distributed Systems Engineer',
    company: 'CloudScale',
    description: 'Build backend pipelines in Go, Kafka, and Kubernetes.',
    requiredSkills: ['go', 'kafka', 'kubernetes'],
    url: 'https://cloudscale.io/jobs/1',
    source: 'generic',
    scrapedAt: new Date().toISOString(),
  };

  const mockResume: Resume = {
    id: 'res_test',
    name: 'Jane Doe',
    tag: 'Backend',
    fileName: 'resume.pdf',
    fileType: 'pdf',
    uploadedAt: new Date().toISOString(),
    rawText: 'Jane Doe...',
    sections: {
      contact: { name: 'Jane Doe', email: 'jane@example.com' },
      summary: 'Experienced Backend Engineer.',
      experience: [
        {
          id: 'exp_1',
          company: 'Acme Corp',
          title: 'Software Engineer',
          startDate: '2020',
          endDate: 'Present',
          bullets: ['Developed backend services in Go.'],
        },
      ],
      education: [],
      skills: ['go', 'docker', 'postgresql'],
      projects: [],
    },
  };

  it('System prompt must explicitly enforce ZERO FABRICATION guardrail', () => {
    expect(TAILOR_RESUME_SYSTEM_PROMPT).toContain('NEVER FABRICATE');
    expect(TAILOR_RESUME_SYSTEM_PROMPT).toContain('ZERO HALLUCINATION');
    expect(TAILOR_RESUME_SYSTEM_PROMPT).toContain('unresolvedGaps');
  });

  it('buildTailorResumePrompt should serialize target job and resume truthfully', () => {
    const prompt = buildTailorResumePrompt(mockJob, mockResume);
    expect(prompt).toContain('Senior Distributed Systems Engineer');
    expect(prompt).toContain('CloudScale');
    expect(prompt).toContain('Jane Doe');
    expect(prompt).toContain('Acme Corp');
  });

  it('DOCX exporter should generate a valid blob', async () => {
    const blob = await generateDocxResume(mockResume.sections, 'Jane Doe');
    expect(blob).toBeDefined();
    expect(blob.size).toBeGreaterThan(100);
  });

  it('PDF HTML exporter should render clean structured HTML', () => {
    const html = generateResumeHtml(mockResume.sections, 'Jane Doe');
    expect(html).toContain('Jane Doe');
    expect(html).toContain('jane@example.com');
    expect(html).toContain('Acme Corp');
    expect(html).toContain('Work Experience');
  });
});
