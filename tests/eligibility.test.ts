import { describe, expect, it } from 'vitest';
import { calculateBestFit, evaluateEligibility, extractJobRequirements, resolveEligibility } from '../src/services/fit';
import { calculateAtsScore, ELIGIBILITY_KNOCKOUT_CAP } from '../src/services/scoring/atsEngine';
import { inferEligibilityFromText } from '../src/services/profile';
import { mergeProfileImport } from '../src/services/profile/merge';
import { JobPosting } from '../src/types/job';
import { ProfileEligibility, UserProfile } from '../src/types/profile';
import {
  MOCK_CLEARANCE_JOB,
  MOCK_NO_SPONSORSHIP_JOB,
  MOCK_SENIOR_BACKEND_JOB,
  MOCK_SENIOR_PROFILE,
} from './fixtures/mockProfiles';
import { MOCK_SENIOR_FULLSTACK_RESUME } from './fixtures/mockResumes';

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

function withEligibility(eligibility: ProfileEligibility, base: UserProfile = MOCK_SENIOR_PROFILE): UserProfile {
  const p = clone(base);
  p.eligibility = eligibility;
  return p;
}

/** The senior fixture with the legacy story flags cleared, so nothing is known about eligibility. */
function undisclosed(eligibility: ProfileEligibility = {}): UserProfile {
  const p = withEligibility(eligibility);
  delete p.story.authorizedToWork;
  delete p.story.needsSponsorship;
  return p;
}

function job(description: string, overrides: Partial<JobPosting> = {}): JobPosting {
  return {
    id: 'job_elig',
    title: 'Software Engineer',
    company: 'Acme',
    description,
    requiredSkills: [],
    url: 'https://example.com/job',
    source: 'manual',
    scrapedAt: '2026-09-01T12:00:00.000Z',
    ...overrides,
  };
}

const reqs = (description: string, overrides: Partial<JobPosting> = {}) => extractJobRequirements(job(description, overrides));

// ---------------------------------------------------------------------------

describe('resolveEligibility — profile-side normalisation', () => {
  it('derives citizenship, US-person status and sponsorship from the authorization answer', () => {
    const citizen = resolveEligibility(withEligibility({ workAuthorization: 'us_citizen' }));
    expect(citizen.isUsCitizen).toBe(true);
    expect(citizen.isUsPerson).toBe(true);
    expect(citizen.needsSponsorshipNow).toBe(false);
    expect(citizen.needsSponsorshipFuture).toBe(false);

    const lpr = resolveEligibility(withEligibility({ workAuthorization: 'us_permanent_resident' }));
    expect(lpr.isUsCitizen).toBe(false);
    expect(lpr.isUsPerson).toBe(true);
    expect(lpr.needsSponsorshipNow).toBe(false);
  });

  it('treats an F-1 student as authorized now but needing sponsorship later, and H-1B as needing both', () => {
    const opt = resolveEligibility(withEligibility({ workAuthorization: 'us_student_visa', visaType: 'f1_opt' }));
    expect(opt.authorizedNow).toBe(true);
    expect(opt.needsSponsorshipNow).toBe(false);
    expect(opt.needsSponsorshipFuture).toBe(true);

    const h1b = resolveEligibility(withEligibility({ workAuthorization: 'us_work_visa', visaType: 'h1b' }));
    expect(h1b.needsSponsorshipNow).toBe(true);
    expect(h1b.needsSponsorshipFuture).toBe(true);
  });

  it('lets an explicit sponsorship answer override the derived default', () => {
    const el = resolveEligibility(withEligibility({ workAuthorization: 'us_work_visa', requiresSponsorshipNow: false }));
    expect(el.needsSponsorshipNow).toBe(false);
    expect(el.needsSponsorshipFuture).toBe(true);
  });

  it('leaves everything unknown for a blank or "prefer not to say" answer', () => {
    const blank = resolveEligibility(undisclosed());
    expect(blank.isUsCitizen).toBeUndefined();
    expect(blank.needsSponsorshipNow).toBeUndefined();
    expect(blank.isEmpty).toBe(true);

    const declined = resolveEligibility(undisclosed({ workAuthorization: 'prefer_not_to_say', veteranStatus: 'prefer_not_to_say' }));
    expect(declined.isUsCitizen).toBeUndefined();
    expect(declined.isVeteran).toBeUndefined();
  });

  it('falls back to the legacy story flags for profiles saved before the eligibility section', () => {
    const legacy = clone(MOCK_SENIOR_PROFILE);
    delete legacy.eligibility;
    legacy.story.needsSponsorship = true;
    const el = resolveEligibility(legacy);
    expect(el.needsSponsorshipNow).toBe(true);
    expect(el.needsSponsorshipFuture).toBe(true);
  });

  it('reads a clearance out of certifications when none was declared, but never over a declared one', () => {
    const fromText = clone(MOCK_SENIOR_PROFILE);
    fromText.certifications.push({ id: 'c_clr', name: 'Active TS/SCI clearance' });
    expect(resolveEligibility(fromText).clearance).toEqual({ level: 'ts_sci', status: 'active', source: 'text' });

    fromText.eligibility = { clearance: { level: 'secret', status: 'inactive' } };
    expect(resolveEligibility(fromText).clearance).toEqual({ level: 'secret', status: 'inactive', source: 'declared' });
  });

  it('does not mistake ordinary "secret" wording for a clearance', () => {
    const p = clone(MOCK_SENIOR_PROFILE);
    p.skills.push({ id: 's_sm', name: 'AWS Secret Manager', rating: 3 });
    expect(resolveEligibility(p).clearance).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------

describe('evaluateEligibility — clearance', () => {
  it('is not applicable to a posting that says nothing about eligibility', () => {
    const assessment = evaluateEligibility(extractJobRequirements(MOCK_SENIOR_BACKEND_JOB), MOCK_SENIOR_PROFILE);
    expect(assessment.applicable).toBe(false);
    expect(assessment.blockers).toEqual([]);
  });

  it('blocks an active-clearance posting when the profile lists none, and says which level', () => {
    const assessment = evaluateEligibility(extractJobRequirements(MOCK_CLEARANCE_JOB), undisclosed());
    expect(assessment.blockers).toContain('Requires an active TS/SCI clearance (your profile lists none)');
    expect(assessment.score).toBe(0);
  });

  it('credits a matching active clearance', () => {
    const cleared = withEligibility({ workAuthorization: 'us_citizen', clearance: { level: 'ts_sci', status: 'active' } });
    const assessment = evaluateEligibility(extractJobRequirements(MOCK_CLEARANCE_JOB), cleared);
    expect(assessment.blockers).toEqual([]);
    expect(assessment.score).toBe(100);
    expect(assessment.evidence).toContain('Holds an active TS/SCI clearance, meeting the TS/SCI clearance requirement');
    expect(assessment.qualifyingAttributes).toContain('active TS/SCI');
  });

  it('flags a lower clearance as a gap rather than a knockout', () => {
    const cleared = withEligibility({ workAuthorization: 'us_citizen', clearance: { level: 'secret', status: 'active' } });
    const assessment = evaluateEligibility(extractJobRequirements(MOCK_CLEARANCE_JOB), cleared);
    expect(assessment.blockers).toEqual([]);
    expect(assessment.gaps.some((g) => /would need an upgrade/.test(g))).toBe(true);
    expect(assessment.score).toBeLessThan(100);
  });

  it('blocks an inactive clearance only when the posting demands an active one', () => {
    const lapsed: ProfileEligibility = { workAuthorization: 'us_citizen', clearance: { level: 'secret', status: 'inactive' } };
    const strict = evaluateEligibility(reqs('Active Secret clearance required.'), withEligibility(lapsed));
    expect(strict.blockers).toContain('Requires an active Secret clearance (yours is inactive)');

    const lenient = evaluateEligibility(reqs('Must be able to obtain a Secret clearance after hire.'), withEligibility(lapsed));
    expect(lenient.blockers).toEqual([]);
  });

  it('lets an uncleared U.S. citizen through an "able to obtain" posting but not a stated non-citizen', () => {
    const citizen = evaluateEligibility(
      reqs('Must be able to obtain a Secret clearance after hire.'),
      withEligibility({ workAuthorization: 'us_citizen' }),
    );
    expect(citizen.blockers).toEqual([]);
    expect(citizen.gaps).toContain('You would need to be sponsored for a Secret clearance');

    const visaHolder = evaluateEligibility(
      reqs('Must be able to obtain a Secret clearance after hire.'),
      withEligibility({ workAuthorization: 'us_work_visa', visaType: 'h1b' }),
    );
    expect(visaHolder.blockers).toContain('Requires a Secret clearance, which is only granted to U.S. citizens');
  });

  it('notes a missing polygraph without knocking the candidate out', () => {
    const cleared = withEligibility({ workAuthorization: 'us_citizen', clearance: { level: 'ts_sci', status: 'active' } });
    const assessment = evaluateEligibility(reqs('Active TS/SCI with full-scope polygraph required.'), cleared);
    expect(assessment.blockers).toEqual([]);
    expect(assessment.gaps).toContain('Posting also requires a full-scope polygraph');
  });
});

describe('evaluateEligibility — citizenship, export control and sponsorship', () => {
  it('blocks a citizenship requirement only for a stated non-citizen', () => {
    const description = 'Must be a U.S. citizen due to contract requirements.';
    expect(evaluateEligibility(reqs(description), withEligibility({ workAuthorization: 'us_permanent_resident' })).blockers).toContain(
      'Requires U.S. citizenship',
    );
    expect(evaluateEligibility(reqs(description), withEligibility({ workAuthorization: 'us_citizen' })).blockers).toEqual([]);
    // Unanswered is unknown, never a "no".
    expect(evaluateEligibility(reqs(description), undisclosed()).blockers).toEqual([]);
  });

  it('accepts a permanent resident for an export-controlled role but not a visa holder', () => {
    const description = 'This position is subject to ITAR; applicants must be U.S. persons.';
    expect(evaluateEligibility(reqs(description), withEligibility({ workAuthorization: 'us_permanent_resident' })).blockers).toEqual([]);
    expect(evaluateEligibility(reqs(description), withEligibility({ workAuthorization: 'us_work_visa' })).blockers).toContain(
      'Export-controlled role: requires a U.S. citizen or permanent resident',
    );
  });

  it('blocks a no-sponsorship posting for someone who needs sponsorship now', () => {
    const assessment = evaluateEligibility(
      extractJobRequirements(MOCK_NO_SPONSORSHIP_JOB),
      withEligibility({ workAuthorization: 'needs_sponsorship' }),
    );
    expect(assessment.blockers).toContain('Posting does not offer visa sponsorship');
  });

  it('distinguishes "will not sponsor now or in the future" from a plain refusal for an F-1 on OPT', () => {
    const opt = withEligibility({ workAuthorization: 'us_student_visa', visaType: 'f1_opt' });
    const future = evaluateEligibility(extractJobRequirements(MOCK_NO_SPONSORSHIP_JOB), opt);
    expect(future.blockers).toContain('Posting will not sponsor now or in the future, and your authorization is time-limited');

    const plain = evaluateEligibility(reqs('We are unable to sponsor visas for this position.'), opt);
    expect(plain.blockers).toEqual([]);
    expect(plain.gaps.some((g) => /need sponsorship later/.test(g))).toBe(true);
  });

  it('credits a posting that positively offers sponsorship to someone who needs it', () => {
    const assessment = evaluateEligibility(
      reqs('Visa sponsorship is available for this role.'),
      withEligibility({ workAuthorization: 'needs_sponsorship' }),
    );
    expect(assessment.evidence).toContain('Employer offers visa sponsorship, which you need');
    expect(assessment.score).toBe(100);
  });
});

describe('evaluateEligibility — veteran and disability preferences', () => {
  const veteranJob = 'Military veterans are encouraged to apply. Candidates with disabilities are welcome.';

  it('rewards a veteran without penalising anyone else', () => {
    const veteran = evaluateEligibility(reqs(veteranJob), withEligibility({ veteranStatus: 'protected_veteran' }));
    expect(veteran.evidence).toContain('Posting states a veteran preference and you have protected veteran status');

    const civilian = evaluateEligibility(reqs(veteranJob), withEligibility({ veteranStatus: 'not_a_veteran' }));
    expect(civilian.blockers).toEqual([]);
    expect(civilian.gaps).toEqual([]);
    expect(civilian.score).toBeLessThan(veteran.score);
    expect(civilian.score).toBe(80);

    const both = evaluateEligibility(reqs(veteranJob), withEligibility({ veteranStatus: 'veteran', disabilityStatus: 'yes' }));
    expect(both.score).toBe(100);
  });

  it('never asks the user to disclose veteran or disability status', () => {
    const assessment = evaluateEligibility(reqs(veteranJob), undisclosed());
    expect(assessment.unknowns).toEqual([]);
  });

  it('ignores EEO boilerplate, which every posting carries', () => {
    const assessment = evaluateEligibility(
      reqs('All qualified applicants will receive consideration without regard to disability or protected veteran status.'),
      withEligibility({ veteranStatus: 'veteran' }),
    );
    expect(assessment.applicable).toBe(false);
  });
});

// ---------------------------------------------------------------------------

describe('Best Fit % — the eligibility factor', () => {
  it('leaves an ordinary posting untouched: the factor carries no weight', () => {
    const r = calculateBestFit(MOCK_SENIOR_BACKEND_JOB, MOCK_SENIOR_PROFILE);
    const factor = r.factors.find((f) => f.key === 'eligibility')!;
    expect(factor.applicable).toBe(false);
    expect(factor.weight).toBe(0);
    expect(r.factors.reduce((sum, f) => sum + f.weight, 0)).toBe(100);
  });

  it('carries weight, evidence and no blocker when the profile clears the posting', () => {
    const cleared = withEligibility({ workAuthorization: 'us_citizen', clearance: { level: 'ts_sci', status: 'active' } });
    const r = calculateBestFit(MOCK_CLEARANCE_JOB, cleared);
    const factor = r.factors.find((f) => f.key === 'eligibility')!;
    expect(factor.applicable).toBe(true);
    expect(factor.weight).toBeGreaterThan(0);
    expect(factor.score).toBe(100);
    expect(r.hardBlockers.some((b) => /clearance|citizenship/.test(b))).toBe(false);
    expect(r.factors.reduce((sum, f) => sum + f.weight, 0)).toBe(100);
  });

  it('caps the headline at the hard-blocker cap when a screening question knocks the candidate out', () => {
    const noSponsorship = withEligibility({ workAuthorization: 'needs_sponsorship' });
    const r = calculateBestFit(MOCK_NO_SPONSORSHIP_JOB, noSponsorship);
    expect(r.hardBlockers).toContain('Posting does not offer visa sponsorship');
    expect(r.fitPercent).toBeLessThanOrEqual(35);
  });

  it('prompts for the missing answer rather than penalising silence', () => {
    const r = calculateBestFit(MOCK_NO_SPONSORSHIP_JOB, undisclosed());
    const factor = r.factors.find((f) => f.key === 'eligibility')!;
    expect(r.hardBlockers).toEqual([]);
    expect(factor.gaps).toContain('Add your work authorization in Profile → Work eligibility');
  });
});

// ---------------------------------------------------------------------------

describe('ATS score — eligibility screening', () => {
  const clearedProfile = withEligibility({ workAuthorization: 'us_citizen', clearance: { level: 'ts_sci', status: 'active' } });

  it('is unchanged when no profile is supplied', () => {
    const withoutProfile = calculateAtsScore(MOCK_CLEARANCE_JOB, MOCK_SENIOR_FULLSTACK_RESUME);
    expect(withoutProfile.eligibilityDetails).toBeUndefined();
    expect(withoutProfile.overallScore).toBe(calculateAtsScore(MOCK_CLEARANCE_JOB, MOCK_SENIOR_FULLSTACK_RESUME).overallScore);
  });

  it('caps the score and explains the knockout when the candidate would be screened out', () => {
    const base = calculateAtsScore(MOCK_NO_SPONSORSHIP_JOB, MOCK_SENIOR_FULLSTACK_RESUME).overallScore;
    const screened = calculateAtsScore(
      MOCK_NO_SPONSORSHIP_JOB,
      MOCK_SENIOR_FULLSTACK_RESUME,
      'standard',
      undefined,
      withEligibility({ workAuthorization: 'needs_sponsorship' }),
    );
    expect(base).toBeGreaterThan(ELIGIBILITY_KNOCKOUT_CAP);
    expect(screened.overallScore).toBe(ELIGIBILITY_KNOCKOUT_CAP);
    expect(screened.eligibilityDetails?.adjustment).toBe(ELIGIBILITY_KNOCKOUT_CAP - base);
    expect(screened.recommendations.some((r) => /screens applicants out/.test(r))).toBe(true);
  });

  it('adds a small bonus for an attribute the posting screens for', () => {
    const base = calculateAtsScore(MOCK_CLEARANCE_JOB, MOCK_SENIOR_FULLSTACK_RESUME).overallScore;
    const screened = calculateAtsScore(MOCK_CLEARANCE_JOB, MOCK_SENIOR_FULLSTACK_RESUME, 'standard', undefined, clearedProfile);
    expect(screened.overallScore).toBeGreaterThan(base);
    expect(screened.overallScore - base).toBeLessThanOrEqual(5);
  });

  it('tells the user when a qualifying clearance never appears on the resume', () => {
    const screened = calculateAtsScore(MOCK_CLEARANCE_JOB, MOCK_SENIOR_FULLSTACK_RESUME, 'standard', undefined, clearedProfile);
    expect(screened.eligibilityDetails?.missingFromResume).toContain('your TS/SCI clearance');
    expect(screened.recommendations.some((r) => /never mentions it/.test(r))).toBe(true);
  });

  it('stays silent about the resume when the clearance is already written on it', () => {
    const resume = clone(MOCK_SENIOR_FULLSTACK_RESUME);
    resume.rawText += '\nActive TS/SCI clearance.';
    const screened = calculateAtsScore(MOCK_CLEARANCE_JOB, resume, 'standard', undefined, clearedProfile);
    expect(screened.eligibilityDetails?.missingFromResume).toEqual([]);
  });
});

// ---------------------------------------------------------------------------

describe('inferEligibilityFromText — resume imports', () => {
  it('reads citizenship, clearance and veteran status off a resume', () => {
    const inferred = inferEligibilityFromText(
      'U.S. Citizen. Active Secret clearance. U.S. Army veteran, honorably discharged.',
    );
    expect(inferred?.workAuthorization).toBe('us_citizen');
    expect(inferred?.clearance).toEqual({ level: 'secret', status: 'active' });
    expect(inferred?.veteranStatus).toBe('veteran');
  });

  it('recognises an F-1 STEM OPT candidate', () => {
    const inferred = inferEligibilityFromText('Work authorization: F-1 STEM OPT, valid through 2028.');
    expect(inferred?.workAuthorization).toBe('us_student_visa');
    expect(inferred?.visaType).toBe('f1_stem_opt');
  });

  it('does not read veteran status out of a Veterans Affairs employer', () => {
    expect(inferEligibilityFromText('Software Engineer, Department of Veterans Affairs')?.veteranStatus).toBeUndefined();
  });

  it('returns nothing for a resume that says nothing about eligibility', () => {
    expect(inferEligibilityFromText('Software engineer with 5 years of React and Node.js experience.')).toBeUndefined();
  });

  it('never infers disability status', () => {
    expect(inferEligibilityFromText('Disability advocate and accessibility engineer.')?.disabilityStatus).toBeUndefined();
  });
});

describe('mergeProfileImport — eligibility', () => {
  it('fills blanks but never overwrites what the user answered', () => {
    const base = withEligibility({ workAuthorization: 'us_citizen' });
    const merged = mergeProfileImport(base, {
      source: 'resume',
      eligibility: { workAuthorization: 'needs_sponsorship', clearance: { level: 'secret', status: 'active' } },
    });
    expect(merged.eligibility?.workAuthorization).toBe('us_citizen');
    expect(merged.eligibility?.clearance).toEqual({ level: 'secret', status: 'active' });
  });
});
