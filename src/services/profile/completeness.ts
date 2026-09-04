import { ProfileCompleteness, UserProfile } from '../../types/profile';

/** Minimum requirements for the onboarding gate. */
export const PROFILE_MIN_SKILLS = 3;

const WEIGHTS = {
  name: 15,
  education: 20,
  skills: 25,
  experiences: 25,
  summary: 10,
  certifications: 5,
} as const;

const SKILLS_FOR_FULL_CREDIT = 5;
const EXPERIENCES_FOR_FULL_CREDIT = 2;

function hasText(value: string | undefined | null): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Onboarding gate: is the profile usable for Best Fit %?
 *
 * Required for `isComplete`: a name, one education entry with an institution and
 * graduating class, at least three skills, and one experience (projects count)
 * with an organization and title. Certifications and the story are optional
 * but improve the `score` and produce `suggestions`.
 */
export function checkProfileCompleteness(profile: UserProfile | null | undefined): ProfileCompleteness {
  const missing: string[] = [];
  const suggestions: string[] = [];

  if (!profile) {
    return {
      isComplete: false,
      score: 0,
      missing: [
        'Add your name',
        'Add at least one education entry with a school and graduating year',
        `Add at least ${PROFILE_MIN_SKILLS} skills`,
        'Add at least one experience or project with an organization and title',
      ],
      suggestions: [
        'Write a short summary about yourself',
        'Add what drives you (e.g. impact, mentorship, fast-paced teams)',
        'Add the roles you are targeting',
        'Add certifications, if you have any',
        'Add an email address so applications can be auto-filled',
      ],
    };
  }

  let score = 0;

  // Name — 15
  const hasName = hasText(profile.contact?.name);
  if (hasName) score += WEIGHTS.name;
  else missing.push('Add your name');

  // Education — 20
  const validEducation = (profile.education || []).filter(
    (e) => hasText(e.institution) && typeof e.graduationYear === 'number' && Number.isFinite(e.graduationYear)
  );
  const hasEducation = validEducation.length > 0;
  if (hasEducation) score += WEIGHTS.education;
  else missing.push('Add at least one education entry with a school and graduating year');

  // Skills — 25, scaled by min(count, 5) / 5
  const validSkills = (profile.skills || []).filter((s) => hasText(s.name));
  const skillCount = validSkills.length;
  score += WEIGHTS.skills * (Math.min(skillCount, SKILLS_FOR_FULL_CREDIT) / SKILLS_FOR_FULL_CREDIT);
  const hasEnoughSkills = skillCount >= PROFILE_MIN_SKILLS;
  if (!hasEnoughSkills) {
    missing.push(
      skillCount === 0
        ? `Add at least ${PROFILE_MIN_SKILLS} skills`
        : `Add at least ${PROFILE_MIN_SKILLS} skills (you have ${skillCount})`
    );
  }

  // Experiences — 25, scaled by min(count, 2) / 2. Projects count.
  const validExperiences = (profile.experiences || []).filter((x) => hasText(x.company) && hasText(x.title));
  const experienceCount = validExperiences.length;
  score +=
    WEIGHTS.experiences *
    (Math.min(experienceCount, EXPERIENCES_FOR_FULL_CREDIT) / EXPERIENCES_FOR_FULL_CREDIT);
  const hasExperience = experienceCount > 0;
  if (!hasExperience) missing.push('Add at least one experience or project with an organization and title');

  // Story summary — 10
  const hasSummary = hasText(profile.story?.summary);
  if (hasSummary) score += WEIGHTS.summary;
  else suggestions.push('Write a short summary about yourself');

  if (!(profile.story?.drives || []).some(hasText)) {
    suggestions.push('Add what drives you (e.g. impact, mentorship, fast-paced teams)');
  }
  if (!(profile.story?.targetRoles || []).some(hasText)) {
    suggestions.push('Add the roles you are targeting');
  }

  // Certifications — 5
  const hasCertifications = (profile.certifications || []).some((c) => hasText(c.name));
  if (hasCertifications) score += WEIGHTS.certifications;
  else suggestions.push('Add certifications, if you have any');

  if (!hasText(profile.contact?.email)) {
    suggestions.push('Add an email address so applications can be auto-filled');
  }

  return {
    isComplete: hasName && hasEducation && hasEnoughSkills && hasExperience,
    score: Math.max(0, Math.min(100, Math.round(score))),
    missing,
    suggestions,
  };
}
