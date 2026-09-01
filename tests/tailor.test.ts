import { describe, it, expect } from 'vitest';
import { tailorResumeLocally } from '../src/services/tailor/localTailorEngine';
import { TAILOR_RESUME_SYSTEM_PROMPT, buildTailorResumePrompt } from '../src/prompts/tailorResume';
import { generateDocxResume } from '../src/services/export/docxExporter';
import { generateResumeHtml } from '../src/services/export/pdfExporter';
import { JobPosting } from '../src/types/job';
import { Resume } from '../src/types/resume';

describe('Local Deterministic Resume Customization Engine', () => {
  const mockJob: JobPosting = {
    id: 'job_test',
    title: 'Senior Distributed Systems Engineer',
    company: 'CloudScale',
    description: 'Build high-scale backend pipelines in Go, Kafka, and Kubernetes.',
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
      summary: 'Experienced developer.',
      experience: [
        {
          id: 'exp_1',
          company: 'Acme Corp',
          title: 'Software Engineer',
          startDate: '2020',
          endDate: 'Present',
          bullets: [
            'Helped with maintenance of legacy APIs.',
            'Worked on high-scale Go microservices with kubernetes orchestration handling 100k requests/sec.',
          ],
        },
      ],
      education: [],
      skills: ['postgresql', 'docker', 'go', 'kubernetes'],
      projects: [],
    },
  };

  it('tailorResumeLocally should reorder bullets and enhance action verbs deterministically', () => {
    const tailored = tailorResumeLocally(mockJob, mockResume);

    expect(tailored).toBeDefined();
    expect(tailored.sections.experience.length).toBe(1);

    const bullets = tailored.sections.experience[0].bullets;
    // The high-relevance Go + Kubernetes bullet should be reordered to #1
    expect(bullets[0]).toContain('Engineered');
    expect(bullets[0]).toContain('Kubernetes');
    expect(bullets[0]).toContain('Go');

    // Action verb replaced
    expect(bullets[1]).toContain('Spearheaded');

    // Skills should prioritize job-matching skills at the front
    expect(tailored.sections.skills.slice(0, 2)).toEqual(
      expect.arrayContaining(['Go', 'Kubernetes'])
    );

    // Unresolved gap should flag 'Kafka' because candidate lacks it
    expect(tailored.unresolvedGaps.some((g) => g.toLowerCase().includes('kafka'))).toBe(true);

    // Summary tailored to match target title
    expect(tailored.sections.summary).toContain('Senior Distributed Systems Engineer');
  });

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
