import { describe, it, expect } from 'vitest';
import { tailorResumeLocally } from '../src/services/tailor/localTailorEngine';
import { JobPosting } from '../src/types/job';
import { Resume } from '../src/types/resume';
import { UserProfile, createEmptyProfile } from '../src/types/profile';

const job: JobPosting = {
  id: 'job_ratings',
  title: 'Backend Engineer',
  company: 'Acme',
  description: 'We need Python, Go, and Kubernetes experience. Docker is a plus.',
  requiredSkills: ['Python', 'Go', 'Kubernetes', 'Docker'],
  url: 'https://boards.greenhouse.io/acme/jobs/1',
  source: 'greenhouse',
  scrapedAt: '2026-09-01T00:00:00.000Z',
};

const resume: Resume = {
  id: 'res_ratings',
  name: 'Base',
  tag: 'General',
  fileName: 'base.pdf',
  fileType: 'pdf',
  uploadedAt: '2026-09-01T00:00:00.000Z',
  rawText: '',
  sections: {
    contact: { name: 'Cher' },
    summary: '',
    experience: [
      {
        id: 'exp1',
        company: 'Acme',
        title: 'Engineer',
        startDate: '2023',
        endDate: '2025',
        bullets: [
          'Built services in Go for internal tools.',
          'Wrote Python pipelines processing 2M records daily.',
          'Maintained Kubernetes clusters.',
        ],
      },
    ],
    education: [],
    skills: ['Go', 'Python', 'Kubernetes', 'Excel'],
    projects: [],
  },
};

function profileWith(ratings: Record<string, 1 | 2 | 3 | 4 | 5>): UserProfile {
  const p = createEmptyProfile('2026-09-01T00:00:00.000Z');
  p.contact.name = 'Cher';
  p.skills = Object.entries(ratings).map(([name, rating], i) => ({ id: 's' + i, name, rating }));
  return p;
}

describe('Local tailoring honours profile skill ratings', () => {
  it('orders the skills section by rating when a profile is supplied', () => {
    const profile = profileWith({ Python: 5, Go: 2, Kubernetes: 4 });
    const out = tailorResumeLocally(job, resume, { profile });
    expect(out.sections.skills.slice(0, 3)).toEqual(['Python', 'Kubernetes', 'Go']);
    expect(out.changesSummary.some((c) => /confidence ratings/i.test(c))).toBe(true);
  });

  it('keeps the original matched-first order without a profile', () => {
    const out = tailorResumeLocally(job, resume);
    expect(out.sections.skills.slice(0, 3)).toEqual(['Go', 'Python', 'Kubernetes']);
    expect(out.changesSummary.some((c) => /confidence ratings/i.test(c))).toBe(false);
  });

  it('elevates bullets mentioning higher-rated skills', () => {
    const profile = profileWith({ Python: 5, Go: 1, Kubernetes: 1 });
    const out = tailorResumeLocally(job, resume, { profile });
    expect(out.sections.experience[0].bullets[0]).toMatch(/Python/);
  });

  it('never fabricates skills from the profile that the resume lacks', () => {
    const profile = profileWith({ Rust: 5, Python: 3 });
    const out = tailorResumeLocally(job, resume, { profile });
    expect(out.sections.skills).not.toContain('Rust');
  });

  it('treats an empty profile as no ratings', () => {
    const out = tailorResumeLocally(job, resume, { profile: createEmptyProfile() });
    expect(out.sections.skills.slice(0, 3)).toEqual(['Go', 'Python', 'Kubernetes']);
  });
});
