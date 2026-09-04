import { describe, expect, it } from 'vitest';
import { calculateBestFit } from '../src/services/fit';
import { JobPosting } from '../src/types/job';
import { UserProfile, createEmptyProfile } from '../src/types/profile';

function makeJob(title: string, description: string): JobPosting {
  return {
    id: `job_${Math.random().toString(36).slice(2)}`,
    company: 'TechCorp',
    title,
    description,
    requiredSkills: ['python', 'java'],
    url: 'https://example.com/job',
    source: 'generic',
    scrapedAt: '2026-09-01T12:00:00.000Z',
  };
}

function makeStudentProfile(degreeLevel: 'bachelor' | 'master' | 'phd', graduationYear: number): UserProfile {
  const p = createEmptyProfile('2026-09-01T12:00:00.000Z');
  p.contact = { name: 'Test Candidate' };
  p.education = [
    {
      id: 'edu_1',
      institution: 'State University',
      degreeLevel,
      degree: degreeLevel === 'bachelor' ? 'B.S.' : degreeLevel === 'master' ? 'M.S.' : 'Ph.D.',
      fieldOfStudy: 'Computer Science',
      status: 'in_progress',
      graduationYear,
    },
  ];
  p.skills = [
    { id: 's1', name: 'Python', rating: 4 },
    { id: 's2', name: 'Java', rating: 4 },
    { id: 's3', name: 'SQL', rating: 3 },
  ];
  p.experiences = [
    {
      id: 'exp_1',
      company: 'Lab Inc',
      title: 'Research Project',
      type: 'project',
      startDate: '2026-01',
      bullets: ['Built Python service with Java integration'],
    },
  ];
  return p;
}

describe('Best Fit 0% Restrictions', () => {
  it('gives 0% fit when an undergraduate student applies for a job requiring minimum Master\'s degree', () => {
    const job = makeJob(
      'Senior AI Scientist',
      'Requirements:\n- Master\'s degree or PhD in Computer Science required.\n- Python and Java required.'
    );
    const undergrad = makeStudentProfile('bachelor', 2027);

    const fit = calculateBestFit(job, undergrad);
    expect(fit.fitPercent).toBe(0);
    expect(fit.hardBlockers.some((b) => /Master's/.test(b))).toBe(true);
  });

  it('gives 0% fit when a graduate student applies for an undergraduate-only role', () => {
    const job = makeJob(
      'Software Engineering Intern (Undergraduate Only)',
      'Qualifications:\n- Currently pursuing a Bachelor\'s degree in Computer Science.\n- Open only to undergraduate students.'
    );
    const gradStudent = makeStudentProfile('master', 2027);

    const fit = calculateBestFit(job, gradStudent);
    expect(fit.fitPercent).toBe(0);
    expect(fit.hardBlockers.some((b) => /undergraduate/.test(b))).toBe(true);
  });

  it('allows standard score for Master\'s or undergraduate student applying to general minimum undergraduate role', () => {
    const job = makeJob(
      'Software Engineer',
      'Qualifications:\n- Bachelor\'s degree in Computer Science or related field required.\n- Python and Java required.'
    );
    const undergrad = makeStudentProfile('bachelor', 2027);
    const masters = makeStudentProfile('master', 2027);

    const fitUndergrad = calculateBestFit(job, undergrad);
    const fitMasters = calculateBestFit(job, masters);

    expect(fitUndergrad.fitPercent).toBeGreaterThan(0);
    expect(fitMasters.fitPercent).toBeGreaterThan(0);
  });

  it('gives 0% fit when a student graduates after the job requirement graduation date', () => {
    const job = makeJob(
      'Software Engineer Intern (Summer 2027)',
      'Qualifications:\n- Must graduate before 2027 (class of 2025 or 2026).\n- Python and Java required.'
    );
    const classOf2030 = makeStudentProfile('bachelor', 2030);

    const fit = calculateBestFit(job, classOf2030);
    expect(fit.fitPercent).toBe(0);
    expect(fit.hardBlockers.some((b) => /Graduation year/.test(b))).toBe(true);
  });

  it('gives 0% fit when a student/entry candidate applies to a Senior/Lead role requiring 5+ years', () => {
    const job = makeJob(
      'Senior Software Engineer',
      'Requirements:\n- 5+ years of software engineering experience.\n- Python and Java required.'
    );
    const undergrad = makeStudentProfile('bachelor', 2027);

    const fit = calculateBestFit(job, undergrad);
    expect(fit.fitPercent).toBe(0);
    expect(fit.hardBlockers.some((b) => /senior|5\+ years/i.test(b))).toBe(true);
  });
});

