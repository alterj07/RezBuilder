import { describe, expect, it } from 'vitest';
import { JobPosting } from '../src/types/job';
import { extractJobRequirements, extractThemesFromText, mapDrivesToThemes, matchCertifications } from '../src/services/fit';
import {
  MOCK_CLEARANCE_JOB,
  MOCK_INTERNSHIP_JOB,
  MOCK_MASTERS_REQUIRED_JOB,
  MOCK_NO_SPONSORSHIP_JOB,
  MOCK_SENIOR_BACKEND_JOB,
  MOCK_THIN_JOB,
} from './fixtures/mockProfiles';

function makeJob(overrides: Partial<JobPosting> & { description: string }): JobPosting {
  return {
    id: 'job_x',
    title: 'Software Engineer',
    company: 'Test Co',
    requiredSkills: [],
    url: 'https://example.com/job',
    source: 'generic',
    scrapedAt: '2026-09-01T12:00:00.000Z',
    ...overrides,
  };
}

describe('extractJobRequirements — fixtures', () => {
  it('splits the senior backend posting into required and nice-to-have skills', () => {
    const r = extractJobRequirements(MOCK_SENIOR_BACKEND_JOB);
    for (const s of ['typescript', 'node.js', 'postgresql', 'kubernetes', 'aws', 'docker']) expect(r.requiredSkills).toContain(s);
    for (const s of ['kafka', 'graphql', 'terraform']) expect(r.niceToHaveSkills).toContain(s);
    expect(r.requiredSkills).not.toContain('kafka');
  });

  it('reads years, level, degree, remote, employment, location and certifications from the senior posting', () => {
    const r = extractJobRequirements(MOCK_SENIOR_BACKEND_JOB);
    expect(r.requiredYears).toBe(5);
    expect(r.roleLevel).toBe('senior');
    expect(r.minDegree).toBe('bachelor');
    expect(r.degreeRequired).toBe(false); // "or equivalent experience"
    expect(r.remote).toBe('remote');
    expect(r.employmentType).toBe('full_time');
    expect(r.locations).toEqual(['San Francisco, CA']);
    expect(r.certificationsMentioned).toEqual(['AWS']);
    expect(r.themes).toEqual(expect.arrayContaining(['scale', 'mentorship', 'autonomy', 'impact']));
    expect(r.requiresClearance).toBe(false);
    expect(r.requiresSponsorshipUnavailable).toBe(false);
  });

  it('recognises the internship posting, its graduation window and student-level degree wording', () => {
    const r = extractJobRequirements(MOCK_INTERNSHIP_JOB);
    expect(r.roleLevel).toBe('internship');
    expect(r.employmentType).toBe('internship');
    expect(r.graduationWindow).toEqual({ minYear: 2026, maxYear: 2027 });
    expect(r.minDegree).toBe('bachelor');
    expect(r.remote).toBe('hybrid');
    expect(r.requiredSkills).toEqual(expect.arrayContaining(['python', 'java']));
    expect(r.niceToHaveSkills).toContain('react');
    expect(r.requiredYears).toBeUndefined();
  });

  it('flags clearance postings and does not turn "security clearance" into a skill', () => {
    const r = extractJobRequirements(MOCK_CLEARANCE_JOB);
    expect(r.requiresClearance).toBe(true);
    expect(r.requiresSponsorshipUnavailable).toBe(false);
    expect(r.roleLevel).toBe('mid');
    expect(r.remote).toBe('onsite');
    expect(r.requiredSkills).not.toContain('security');
    expect(r.degreeRequired).toBe(true);
  });

  it('flags postings that will not sponsor visas', () => {
    const r = extractJobRequirements(MOCK_NO_SPONSORSHIP_JOB);
    expect(r.requiresSponsorshipUnavailable).toBe(true);
    expect(r.requiresClearance).toBe(false);
    expect(r.themes).toEqual(expect.arrayContaining(['fast_paced', 'autonomy']));
  });

  it('returns an empty/unknown record for a thin posting', () => {
    const r = extractJobRequirements(MOCK_THIN_JOB);
    expect(r.requiredSkills).toEqual([]);
    expect(r.niceToHaveSkills).toEqual([]);
    expect(r.roleLevel).toBe('unknown');
    expect(r.remote).toBe('unknown');
    expect(r.employmentType).toBe('unknown');
    expect(r.minDegree).toBeUndefined();
    expect(r.certificationsMentioned).toEqual([]);
  });

  it('takes the lowest mentioned degree as the minimum ("Master\'s or PhD" → master)', () => {
    const r = extractJobRequirements(MOCK_MASTERS_REQUIRED_JOB);
    expect(r.minDegree).toBe('master');
    expect(r.degreeRequired).toBe(true);
  });
});

describe('extractJobRequirements — degree & graduation phrasing', () => {
  it('parses "Class of 2027"', () => {
    const r = extractJobRequirements(makeJob({ title: 'Software Engineer Intern', description: 'Open to students in the Class of 2027 pursuing a BS in Computer Science.' }));
    expect(r.graduationWindow).toEqual({ minYear: 2027, maxYear: 2027 });
    expect(r.minDegree).toBe('bachelor');
  });

  it('parses "graduating in May 2027" and "expected graduation between Dec 2026 and June 2027"', () => {
    const a = extractJobRequirements(makeJob({ title: 'Intern', description: 'Students graduating in May 2027 are encouraged to apply.' }));
    expect(a.graduationWindow).toEqual({ minYear: 2027, maxYear: 2027 });
    const b = extractJobRequirements(makeJob({ title: 'Intern', description: 'Expected graduation between Dec 2026 and June 2027.' }));
    expect(b.graduationWindow).toEqual({ minYear: 2026, maxYear: 2027 });
  });

  it('derives the graduation year for "rising senior" from the program summer', () => {
    const r = extractJobRequirements(makeJob({ title: 'Summer 2027 Engineering Intern', description: 'We welcome rising seniors currently pursuing a degree in computer science for Summer 2027.' }));
    expect(r.graduationWindow).toEqual({ minYear: 2028, maxYear: 2028 });
    expect(r.roleLevel).toBe('internship');
  });

  it('distinguishes a required degree from a preferred one', () => {
    const req = extractJobRequirements(makeJob({ description: 'Requirements\n- Bachelor\'s degree in Computer Science required.\n- 3 years of experience.' }));
    expect(req.minDegree).toBe('bachelor');
    expect(req.degreeRequired).toBe(true);
    const pref = extractJobRequirements(makeJob({ description: 'Nice to have\n- Bachelor\'s degree in Computer Science preferred.' }));
    expect(pref.minDegree).toBe('bachelor');
    expect(pref.degreeRequired).toBe(false);
  });

  it('recognises abbreviated degrees like "BS/MS in CS"', () => {
    const r = extractJobRequirements(makeJob({ description: 'Requirements: BS/MS in CS or a related field.' }));
    expect(r.minDegree).toBe('bachelor');
  });
});

describe('extractJobRequirements — role level', () => {
  const level = (title: string, description = 'We build software.') => extractJobRequirements(makeJob({ title, description })).roleLevel;

  it('maps title keywords to levels', () => {
    expect(level('Staff Software Engineer')).toBe('lead');
    expect(level('Principal Engineer')).toBe('lead');
    expect(level('Engineering Manager')).toBe('lead');
    expect(level('Senior Data Scientist')).toBe('senior');
    expect(level('Junior Developer')).toBe('junior');
    expect(level('New Grad Software Engineer')).toBe('new_grad');
    expect(level('Software Engineering Intern')).toBe('internship');
    expect(level('Software Engineer')).toBe('unknown');
  });

  it('falls back to years of experience in the text', () => {
    expect(level('Software Engineer', 'Requirements: 7+ years of experience building services.')).toBe('senior');
    expect(level('Software Engineer', 'Requirements: 3+ years of experience building services.')).toBe('mid');
    expect(level('Software Engineer', 'Entry level role. Bachelor\'s degree required.')).toBe('junior');
  });
});

describe('extractJobRequirements — blockers, remote, employment', () => {
  it('treats U.S. citizenship as a clearance-type blocker and honours negations', () => {
    expect(extractJobRequirements(makeJob({ description: 'Must be a U.S. citizen due to contract requirements.' })).requiresClearance).toBe(true);
    expect(extractJobRequirements(makeJob({ description: 'Applicants must be able to obtain a TS/SCI.' })).requiresClearance).toBe(true);
    expect(extractJobRequirements(makeJob({ description: 'No security clearance required for this role.' })).requiresClearance).toBe(false);
  });

  it('detects several "no sponsorship" phrasings but not positive ones', () => {
    const yes = [
      'We are unable to sponsor visas for this position.',
      'This role does not offer visa sponsorship.',
      'Candidates must be authorized to work in the US without sponsorship.',
      'No visa sponsorship available.',
    ];
    for (const d of yes) expect(extractJobRequirements(makeJob({ description: d })).requiresSponsorshipUnavailable, d).toBe(true);
    expect(extractJobRequirements(makeJob({ description: 'We happily sponsor visas for the right candidate.' })).requiresSponsorshipUnavailable).toBe(false);
  });

  it('prefers remoteStatus, then location, then text — hybrid beats remote in text', () => {
    expect(extractJobRequirements(makeJob({ description: 'This role is fully remote.' })).remote).toBe('remote');
    expect(extractJobRequirements(makeJob({ description: 'Hybrid: 3 days in office, remote otherwise.' })).remote).toBe('hybrid');
    expect(extractJobRequirements(makeJob({ description: 'This is not a remote role; in-office in Denver.' })).remote).toBe('onsite');
    expect(extractJobRequirements(makeJob({ remoteStatus: 'On-site', description: 'remote remote remote' })).remote).toBe('onsite');
    expect(extractJobRequirements(makeJob({ location: 'Remote - US', description: 'Great job.' })).remote).toBe('remote');
  });

  it('detects employment types from title and text', () => {
    expect(extractJobRequirements(makeJob({ title: 'Part-time Bookkeeper', description: 'Flexible hours.' })).employmentType).toBe('part_time');
    expect(extractJobRequirements(makeJob({ description: 'This is a 6-month contract role, full-time hours.' })).employmentType).toBe('contract');
    expect(extractJobRequirements(makeJob({ description: 'Full-time position with benefits.' })).employmentType).toBe('full_time');
  });

  it('splits multi-location strings and drops remote markers', () => {
    const r = extractJobRequirements(makeJob({ location: 'Austin, TX; Seattle, WA | Remote', description: 'x' }));
    expect(r.locations).toEqual(['Austin, TX', 'Seattle, WA']);
  });
});

describe('extractJobRequirements — skill handling', () => {
  it('keeps explicitly listed skills that never appear in the text as required', () => {
    const r = extractJobRequirements(makeJob({ description: 'We build great things for customers.', requiredSkills: ['Rust'] }));
    expect(r.requiredSkills).toContain('rust');
  });

  it('drops ambiguous dictionary words like "go" unless they are used as a technology', () => {
    const noise = extractJobRequirements(makeJob({ description: 'You will go to market quickly and go above and beyond.', requiredSkills: ['go'] }));
    expect(noise.requiredSkills).not.toContain('go');
    expect(noise.niceToHaveSkills).not.toContain('go');
    const real = extractJobRequirements(makeJob({ description: 'Requirements: experience with Go, Rust and Kubernetes.' }));
    expect(real.requiredSkills).toEqual(expect.arrayContaining(['go', 'rust', 'kubernetes']));
  });

  it('demotes skills that only appear in nice-to-have context even when the scraper listed them', () => {
    const r = extractJobRequirements(
      makeJob({
        description: 'Requirements\n- Strong TypeScript.\nNice to have\n- Experience with Kafka.',
        requiredSkills: ['typescript', 'kafka'],
      }),
    );
    expect(r.requiredSkills).toEqual(['typescript']);
    expect(r.niceToHaveSkills).toEqual(['kafka']);
  });

  it('canonicalises aliases (k8s → kubernetes, node → node.js)', () => {
    const r = extractJobRequirements(makeJob({ description: 'Requirements: k8s and Node experience.', requiredSkills: ['K8s', 'nodejs'] }));
    expect(r.requiredSkills).toContain('kubernetes');
    expect(r.requiredSkills).toContain('node.js');
    expect(r.requiredSkills).not.toContain('k8s');
  });
});

describe('themes and certifications', () => {
  it('maps free-text drives onto theme ids', () => {
    expect(mapDrivesToThemes(['fast-paced startup', 'research', 'mentorship'], '')).toEqual(['mentorship', 'fast_paced', 'innovation']);
    expect(mapDrivesToThemes(['growth/learning'], '')).toEqual(['growth']);
    expect(mapDrivesToThemes([], 'I love shipping things that make a real impact for customers.')).toEqual(['impact', 'customer_focus']);
    expect(mapDrivesToThemes([], '')).toEqual([]);
  });

  it('extracts themes from posting text in lexicon order', () => {
    const themes = extractThemesFromText('Join our mission-driven, fast-paced team and own your work end-to-end. We are remote-first.');
    expect(themes).toEqual(['mission', 'autonomy', 'fast_paced', 'remote_first']);
  });

  it('matches certification mentions fuzzily', () => {
    expect(matchCertifications('CISSP or CompTIA Security+ preferred; AWS Certified Solutions Architect a plus.')).toEqual(['AWS', 'CISSP', 'Security+']);
    expect(matchCertifications('PMP required. CKA desirable.')).toEqual(['PMP', 'CKA']);
    expect(matchCertifications('No certs needed.')).toEqual([]);
  });
});
