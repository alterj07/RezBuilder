import { describe, expect, it } from 'vitest';
import { calculateBestFit, HARD_BLOCKER_CAP } from '../src/services/fit';
import { DEFAULT_FIT_WEIGHTS, FitResult } from '../src/types/fit';
import { UserProfile } from '../src/types/profile';
import {
  MOCK_CLEARANCE_JOB,
  MOCK_EMPTY_PROFILE,
  MOCK_INTERNSHIP_JOB,
  MOCK_MASTERS_REQUIRED_JOB,
  MOCK_NO_SPONSORSHIP_JOB,
  MOCK_SENIOR_BACKEND_JOB,
  MOCK_SENIOR_PROFILE,
  MOCK_STUDENT_PROFILE,
  MOCK_THIN_JOB,
} from './fixtures/mockProfiles';

const JOBS = [MOCK_SENIOR_BACKEND_JOB, MOCK_INTERNSHIP_JOB, MOCK_CLEARANCE_JOB, MOCK_NO_SPONSORSHIP_JOB, MOCK_THIN_JOB, MOCK_MASTERS_REQUIRED_JOB];
const PROFILES = [MOCK_SENIOR_PROFILE, MOCK_STUDENT_PROFILE, MOCK_EMPTY_PROFILE];

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

function withSkillRating(profile: UserProfile, name: string, rating: 1 | 2 | 3 | 4 | 5): UserProfile {
  const p = clone(profile);
  const skill = p.skills.find((s) => s.name === name);
  if (!skill) throw new Error(`fixture has no skill ${name}`);
  skill.rating = rating;
  return p;
}

function factor(result: FitResult, key: string) {
  const f = result.factors.find((x) => x.key === key);
  if (!f) throw new Error(`missing factor ${key}`);
  return f;
}

function stripTime(r: FitResult) {
  const { calculatedAt: _ignored, ...rest } = r;
  return rest;
}

describe('calculateBestFit — headline behaviour', () => {
  it('scores the senior profile highly on the senior backend role with high confidence and no blockers', () => {
    const r = calculateBestFit(MOCK_SENIOR_BACKEND_JOB, MOCK_SENIOR_PROFILE);
    expect(r.fitPercent).toBeGreaterThanOrEqual(85);
    expect(r.confidence).toBe('high');
    expect(r.hardBlockers).toEqual([]);
    expect(factor(r, 'skills').score).toBeGreaterThanOrEqual(85);
    expect(r.matchedSkills).toContainEqual({ name: 'TypeScript', rating: 5, required: true });
    expect(r.matchedSkills.find((m) => m.name === 'Kafka')?.required).toBe(false);
  });

  it('scores the student well on the summer 2027 internship', () => {
    const r = calculateBestFit(MOCK_INTERNSHIP_JOB, MOCK_STUDENT_PROFILE);
    expect(r.fitPercent).toBeGreaterThanOrEqual(65);
    expect(r.hardBlockers).toEqual([]);
    expect(factor(r, 'education').score).toBe(100);
    expect(factor(r, 'education').evidence.join(' ')).toMatch(/Graduating 2027/);
  });

  it('ranks the internship above the senior role for the student, and vice versa for the senior', () => {
    const studentIntern = calculateBestFit(MOCK_INTERNSHIP_JOB, MOCK_STUDENT_PROFILE).fitPercent;
    const studentSenior = calculateBestFit(MOCK_SENIOR_BACKEND_JOB, MOCK_STUDENT_PROFILE).fitPercent;
    const seniorIntern = calculateBestFit(MOCK_INTERNSHIP_JOB, MOCK_SENIOR_PROFILE).fitPercent;
    const seniorSenior = calculateBestFit(MOCK_SENIOR_BACKEND_JOB, MOCK_SENIOR_PROFILE).fitPercent;
    expect(studentIntern).toBeGreaterThan(studentSenior);
    expect(seniorSenior).toBeGreaterThan(seniorIntern);
  });

  it('gives an empty profile a low score and low confidence', () => {
    const r = calculateBestFit(MOCK_SENIOR_BACKEND_JOB, MOCK_EMPTY_PROFILE);
    expect(r.fitPercent).toBeLessThan(30);
    expect(r.confidence).toBe('low');
    expect(r.strengths).toEqual([]);
  });

  it('returns an ISO timestamp', () => {
    const r = calculateBestFit(MOCK_THIN_JOB, MOCK_EMPTY_PROFILE);
    expect(new Date(r.calculatedAt).toISOString()).toBe(r.calculatedAt);
  });
});

describe('calculateBestFit — invariants', () => {
  it('is deterministic for identical inputs', () => {
    for (const job of JOBS) {
      for (const profile of PROFILES) {
        const a = calculateBestFit(job, profile);
        const b = calculateBestFit(job, profile);
        expect(stripTime(a)).toEqual(stripTime(b));
      }
    }
  });

  it('always produces weights that sum to exactly 100', () => {
    for (const job of JOBS) {
      for (const profile of PROFILES) {
        const r = calculateBestFit(job, profile);
        const sum = r.factors.reduce((s, f) => s + f.weight, 0);
        expect(sum, `${job.id} × ${profile.id}`).toBe(100);
        for (const f of r.factors) {
          if (!f.applicable) expect(f.weight).toBe(0);
          expect(f.score).toBeGreaterThanOrEqual(0);
          expect(f.score).toBeLessThanOrEqual(100);
        }
        expect(r.fitPercent).toBeGreaterThanOrEqual(0);
        expect(r.fitPercent).toBeLessThanOrEqual(100);
      }
    }
  });

  it('never lowers fitPercent when a matched skill rating rises from 2 to 5 (monotonicity)', () => {
    const low = calculateBestFit(MOCK_INTERNSHIP_JOB, MOCK_STUDENT_PROFILE); // React rated 2
    const high = calculateBestFit(MOCK_INTERNSHIP_JOB, withSkillRating(MOCK_STUDENT_PROFILE, 'React', 5));
    expect(high.fitPercent).toBeGreaterThanOrEqual(low.fitPercent);
    expect(factor(high, 'skills').score).toBeGreaterThan(factor(low, 'skills').score);
  });

  it('never raises fitPercent when any matched skill is downgraded to 1', () => {
    const baseline = calculateBestFit(MOCK_SENIOR_BACKEND_JOB, MOCK_SENIOR_PROFILE).fitPercent;
    for (const skill of MOCK_SENIOR_PROFILE.skills) {
      const r = calculateBestFit(MOCK_SENIOR_BACKEND_JOB, withSkillRating(MOCK_SENIOR_PROFILE, skill.name, 1));
      expect(r.fitPercent, skill.name).toBeLessThanOrEqual(baseline);
    }
  });

  it('runs 1000 evaluations in under 2 seconds', () => {
    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      const job = JOBS[i % JOBS.length];
      const profile = PROFILES[i % PROFILES.length];
      calculateBestFit(job, profile);
    }
    expect(performance.now() - start).toBeLessThan(2000);
  });
});

describe('calculateBestFit — weight redistribution', () => {
  it('zeroes non-applicable factors and spreads their weight over the rest', () => {
    const r = calculateBestFit(MOCK_NO_SPONSORSHIP_JOB, MOCK_SENIOR_PROFILE); // no degree signal, no certs
    expect(factor(r, 'education').applicable).toBe(false);
    expect(factor(r, 'education').weight).toBe(0);
    expect(factor(r, 'certifications').weight).toBe(0);
    expect(factor(r, 'skills').weight).toBeGreaterThan(DEFAULT_FIT_WEIGHTS.skills);
    expect(factor(r, 'experience').weight).toBeGreaterThan(DEFAULT_FIT_WEIGHTS.experience);
  });

  it('marks skills not applicable when the posting lists no skills', () => {
    const r = calculateBestFit(MOCK_THIN_JOB, MOCK_SENIOR_PROFILE);
    expect(factor(r, 'skills').applicable).toBe(false);
    expect(factor(r, 'skills').weight).toBe(0);
    expect(r.matchedSkills).toEqual([]);
  });

  it('marks story not applicable when neither side has narrative signal', () => {
    const r = calculateBestFit(MOCK_THIN_JOB, MOCK_EMPTY_PROFILE);
    expect(factor(r, 'story').applicable).toBe(false);
    expect(factor(r, 'preferences').applicable).toBe(true);
  });

  it('honours weight overrides — all weight on skills reproduces the skills score', () => {
    const r = calculateBestFit(MOCK_SENIOR_BACKEND_JOB, MOCK_SENIOR_PROFILE, {
      skills: 100,
      experience: 0,
      education: 0,
      certifications: 0,
      story: 0,
      preferences: 0,
    });
    expect(factor(r, 'skills').weight).toBe(100);
    expect(r.fitPercent).toBe(factor(r, 'skills').score);
  });
});

describe('calculateBestFit — hard blockers', () => {
  it('flags a clearance posting for a profile without clearance and caps at 35', () => {
    const r = calculateBestFit(MOCK_CLEARANCE_JOB, MOCK_SENIOR_PROFILE);
    expect(r.hardBlockers).toContain('Requires a security clearance or U.S. citizenship');
    expect(r.fitPercent).toBeLessThanOrEqual(HARD_BLOCKER_CAP);
  });

  it('does not flag clearance when the profile lists one', () => {
    const cleared = clone(MOCK_SENIOR_PROFILE);
    cleared.certifications.push({ id: 'c_clr', name: 'Active TS/SCI clearance' });
    const r = calculateBestFit(MOCK_CLEARANCE_JOB, cleared);
    expect(r.hardBlockers.some((b) => /clearance/.test(b))).toBe(false);
  });

  it('flags a no-sponsorship posting only when the user needs sponsorship', () => {
    const needs = clone(MOCK_SENIOR_PROFILE);
    needs.story.needsSponsorship = true;
    const blocked = calculateBestFit(MOCK_NO_SPONSORSHIP_JOB, needs);
    expect(blocked.hardBlockers).toContain('Posting does not offer visa sponsorship');
    expect(blocked.fitPercent).toBeLessThanOrEqual(HARD_BLOCKER_CAP);
    const fine = calculateBestFit(MOCK_NO_SPONSORSHIP_JOB, MOCK_SENIOR_PROFILE);
    expect(fine.hardBlockers).toEqual([]);
    expect(fine.fitPercent).toBeGreaterThan(HARD_BLOCKER_CAP);
  });

  it('flags a required Master\'s for a Bachelor\'s holder', () => {
    const r = calculateBestFit(MOCK_MASTERS_REQUIRED_JOB, MOCK_SENIOR_PROFILE);
    expect(r.hardBlockers).toContain("Requires a Master's degree (your highest: Bachelor's)");
    expect(r.fitPercent).toBe(0);
  });

  it('does not flag a degree that is merely preferred / "or equivalent experience"', () => {
    const noDegree = clone(MOCK_SENIOR_PROFILE);
    noDegree.education = [];
    const r = calculateBestFit(MOCK_SENIOR_BACKEND_JOB, noDegree);
    expect(r.hardBlockers).toEqual([]);
  });

  it('counts an in-progress Bachelor\'s only for student-level postings', () => {
    const intern = calculateBestFit(MOCK_INTERNSHIP_JOB, MOCK_STUDENT_PROFILE);
    expect(intern.hardBlockers.some((b) => /degree/.test(b))).toBe(false);
    const mid = calculateBestFit(MOCK_CLEARANCE_JOB, MOCK_STUDENT_PROFILE);
    expect(mid.hardBlockers).toContain("Requires a completed Bachelor's degree (yours is still in progress)");
  });

  it('flags employment-type conflicts in both directions', () => {
    const seniorOnIntern = calculateBestFit(MOCK_INTERNSHIP_JOB, MOCK_SENIOR_PROFILE);
    expect(seniorOnIntern.hardBlockers).toContain('Internship, but you are not open to internships');
    expect(seniorOnIntern.fitPercent).toBeLessThanOrEqual(HARD_BLOCKER_CAP);
    const studentOnFullTime = calculateBestFit(MOCK_SENIOR_BACKEND_JOB, MOCK_STUDENT_PROFILE);
    expect(studentOnFullTime.hardBlockers).toContain('Full-time role, but your preferences only include: Internship');
    const open = clone(MOCK_SENIOR_PROFILE);
    open.story.employmentTypes = [];
    expect(calculateBestFit(MOCK_SENIOR_BACKEND_JOB, open).hardBlockers).toEqual([]);
  });
});

describe('calculateBestFit — confidence', () => {
  it('is low for a thin posting even with a rich profile', () => {
    expect(calculateBestFit(MOCK_THIN_JOB, MOCK_SENIOR_PROFILE).confidence).toBe('low');
  });

  it('is medium for a rich posting with a sparse-but-usable profile', () => {
    expect(calculateBestFit(MOCK_SENIOR_BACKEND_JOB, MOCK_STUDENT_PROFILE).confidence).toBe('medium');
  });
});

describe('calculateBestFit — factor details', () => {
  it('credits an unrated skill found in experience bullets at rating 3', () => {
    const r = calculateBestFit(MOCK_SENIOR_BACKEND_JOB, MOCK_STUDENT_PROFILE);
    expect(r.matchedSkills).toContainEqual({ name: 'PostgreSQL', rating: 3, required: true });
    expect(factor(r, 'skills').evidence).toContain('PostgreSQL — used in your experience (required)');
  });

  it('lists missing required skills as "Add or rate" improvements', () => {
    const r = calculateBestFit(MOCK_INTERNSHIP_JOB, MOCK_SENIOR_PROFILE);
    expect(r.missingSkills).toContain('Java');
    expect(r.improvements).toContain('Add or rate: Java (required)');
  });

  it('caps strengths and improvements at three entries', () => {
    for (const job of JOBS) {
      for (const profile of PROFILES) {
        const r = calculateBestFit(job, profile);
        expect(r.strengths.length).toBeLessThanOrEqual(3);
        expect(r.improvements.length).toBeLessThanOrEqual(3);
      }
    }
  });

  it('asks an empty profile to add experiences and education', () => {
    const r = calculateBestFit(MOCK_CLEARANCE_JOB, MOCK_EMPTY_PROFILE);
    expect(r.improvements).toContain('Add your experiences or target roles so title fit can be scored');
    expect(r.improvements).toContain('Add your education');
  });

  it('asks for drives when the posting has themes but the user has none', () => {
    const quiet = clone(MOCK_SENIOR_PROFILE);
    quiet.story.drives = [];
    quiet.story.summary = '';
    const r = calculateBestFit(MOCK_SENIOR_BACKEND_JOB, quiet);
    expect(factor(r, 'story').gaps).toContain('Fill in your drives so culture fit can be scored');
  });

  it('penalises a clear remote/on-site conflict but keeps unknowns neutral', () => {
    const conflict = calculateBestFit(MOCK_CLEARANCE_JOB, MOCK_SENIOR_PROFILE); // on-site vs remote pref
    expect(factor(conflict, 'preferences').gaps).toContain('Posting is on-site; you prefer remote');
    const neutral = calculateBestFit(MOCK_THIN_JOB, MOCK_SENIOR_PROFILE);
    expect(factor(neutral, 'preferences').score).toBe(70);
  });

  it('rewards the AWS certification when the posting mentions it', () => {
    const r = calculateBestFit(MOCK_SENIOR_BACKEND_JOB, MOCK_SENIOR_PROFILE);
    const certs = factor(r, 'certifications');
    expect(certs.applicable).toBe(true);
    expect(certs.score).toBe(100);
    expect(certs.evidence).toContain('Holds AWS certification (mentioned in posting)');
  });

  it('penalises over-qualification only mildly', () => {
    const r = calculateBestFit(MOCK_NO_SPONSORSHIP_JOB, MOCK_SENIOR_PROFILE); // mid-level vs ~10 years
    expect(factor(r, 'experience').score).toBeGreaterThanOrEqual(80);
    expect(factor(r, 'experience').gaps).toContain('You may be over-qualified for this mid-level posting');
  });
});
