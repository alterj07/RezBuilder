import {
  ProfileCertification,
  ProfileContact,
  ProfileEducation,
  ProfileExperience,
  ProfileImport,
  ProfileSkill,
  ProfileSource,
  ProfileStory,
  SkillRating,
  UserProfile,
} from '../../types/profile';
import { createProfileEntityId } from './inference';

/** Rating assigned to imported skills that carry no rating of their own. */
export const DEFAULT_IMPORTED_SKILL_RATING: SkillRating = 3;

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function normKey(value: string | undefined | null): string {
  return (value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function clampRating(rating: number | undefined): SkillRating {
  if (rating === undefined || !Number.isFinite(rating)) return DEFAULT_IMPORTED_SKILL_RATING;
  return Math.max(1, Math.min(5, Math.round(rating))) as SkillRating;
}

function mergeContact(base: ProfileContact, imp: Partial<ProfileContact> | undefined): ProfileContact {
  const result: ProfileContact = { ...base };
  if (!imp) return result;
  const keys: (keyof ProfileContact)[] = ['name', 'email', 'phone', 'location', 'linkedinUrl', 'website', 'github'];
  for (const key of keys) {
    const incoming = imp[key];
    // Never overwrite a filled base field with an empty import value.
    if (hasText(incoming)) result[key] = incoming.trim();
  }
  return result;
}

function mergeSkills(base: ProfileSkill[], imp: ProfileImport['skills']): ProfileSkill[] {
  const result = base.map((s) => ({ ...s }));
  if (!imp) return result;
  const index = new Map<string, ProfileSkill>();
  for (const skill of result) index.set(normKey(skill.name), skill);

  for (const incoming of imp) {
    if (!hasText(incoming?.name)) continue;
    const key = normKey(incoming.name);
    const existing = index.get(key);
    if (existing) {
      // An explicit import rating can raise the rating; the import's default never changes a base rating.
      if (incoming.rating !== undefined) {
        existing.rating = Math.max(existing.rating, clampRating(incoming.rating)) as SkillRating;
      }
      if (!existing.category && incoming.category) existing.category = incoming.category;
      continue;
    }
    const created: ProfileSkill = {
      id: createProfileEntityId('skill'),
      name: incoming.name.trim(),
      rating: clampRating(incoming.rating),
    };
    if (incoming.category) created.category = incoming.category;
    result.push(created);
    index.set(key, created);
  }
  return result;
}

function fillMissing<T extends object>(target: T, source: Partial<T>, keys: (keyof T)[]): void {
  for (const key of keys) {
    const current = target[key];
    const incoming = source[key];
    const currentEmpty = current === undefined || current === null || (typeof current === 'string' && !current.trim());
    const incomingPresent =
      incoming !== undefined && incoming !== null && !(typeof incoming === 'string' && !incoming.trim());
    if (currentEmpty && incomingPresent) target[key] = incoming as T[keyof T];
  }
}

function mergeEducation(base: ProfileEducation[], imp: ProfileImport['education']): ProfileEducation[] {
  const result = base.map((e) => ({ ...e }));
  if (!imp) return result;
  const keyOf = (e: { institution: string; degreeLevel: string }) => `${normKey(e.institution)}|${e.degreeLevel}`;
  const index = new Map<string, ProfileEducation>();
  for (const entry of result) index.set(keyOf(entry), entry);

  for (const incoming of imp) {
    if (!hasText(incoming?.institution)) continue;
    const key = keyOf(incoming);
    const existing = index.get(key);
    if (existing) {
      fillMissing(existing, incoming, ['degree', 'fieldOfStudy', 'graduationYear', 'graduationMonth', 'gpa']);
      continue;
    }
    const created: ProfileEducation = { ...incoming, id: createProfileEntityId('edu'), institution: incoming.institution.trim() };
    result.push(created);
    index.set(key, created);
  }
  return result;
}

function mergeBullets(existing: string[], incoming: string[] | undefined): string[] {
  const result = [...existing];
  if (!incoming) return result;
  const seen = new Set(result.map(normKey));
  for (const bullet of incoming) {
    if (!hasText(bullet)) continue;
    const key = normKey(bullet);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(bullet.trim());
  }
  return result;
}

function mergeStringSet(existing: string[] | undefined, incoming: string[] | undefined): string[] | undefined {
  if (!existing && !incoming) return undefined;
  return mergeBullets(existing || [], incoming);
}

function mergeExperiences(base: ProfileExperience[], imp: ProfileImport['experiences']): ProfileExperience[] {
  const result = base.map((x) => ({ ...x, bullets: [...(x.bullets || [])] }));
  if (!imp) return result;
  const keyOf = (x: { company: string; title: string }) => `${normKey(x.company)}|${normKey(x.title)}`;
  const index = new Map<string, ProfileExperience>();
  for (const entry of result) index.set(keyOf(entry), entry);

  for (const incoming of imp) {
    if (!incoming || (!hasText(incoming.company) && !hasText(incoming.title))) continue;
    const key = keyOf(incoming);
    const existing = index.get(key);
    if (existing) {
      existing.bullets = mergeBullets(existing.bullets, incoming.bullets);
      fillMissing(existing, incoming, ['type', 'startDate', 'endDate', 'isCurrent', 'location']);
      const skillsUsed = mergeStringSet(existing.skillsUsed, incoming.skillsUsed);
      if (skillsUsed) existing.skillsUsed = skillsUsed;
      continue;
    }
    const created: ProfileExperience = {
      ...incoming,
      id: createProfileEntityId('exp'),
      company: (incoming.company || '').trim(),
      title: (incoming.title || '').trim(),
      bullets: mergeBullets([], incoming.bullets),
    };
    if (incoming.skillsUsed) created.skillsUsed = mergeBullets([], incoming.skillsUsed);
    result.push(created);
    index.set(key, created);
  }
  return result;
}

function mergeCertifications(
  base: ProfileCertification[],
  imp: ProfileImport['certifications']
): ProfileCertification[] {
  const result = base.map((c) => ({ ...c }));
  if (!imp) return result;
  const index = new Map<string, ProfileCertification>();
  for (const entry of result) index.set(normKey(entry.name), entry);

  for (const incoming of imp) {
    if (!hasText(incoming?.name)) continue;
    const key = normKey(incoming.name);
    const existing = index.get(key);
    if (existing) {
      fillMissing(existing, incoming, ['issuer', 'issuedYear', 'expiresYear', 'credentialUrl']);
      continue;
    }
    const created: ProfileCertification = { ...incoming, id: createProfileEntityId('cert'), name: incoming.name.trim() };
    result.push(created);
    index.set(key, created);
  }
  return result;
}

function mergeStory(base: ProfileStory, imp: Partial<ProfileStory> | undefined): ProfileStory {
  const result: ProfileStory = {
    ...base,
    drives: [...(base.drives || [])],
    targetRoles: [...(base.targetRoles || [])],
    targetIndustries: [...(base.targetIndustries || [])],
    preferredLocations: [...(base.preferredLocations || [])],
    employmentTypes: [...(base.employmentTypes || [])],
  };
  if (!imp) return result;

  if (!hasText(result.summary) && hasText(imp.summary)) result.summary = imp.summary.trim();

  const listKeys: ('drives' | 'targetRoles' | 'targetIndustries' | 'preferredLocations')[] = [
    'drives',
    'targetRoles',
    'targetIndustries',
    'preferredLocations',
  ];
  for (const key of listKeys) {
    const incoming = imp[key];
    if (result[key].length === 0 && incoming && incoming.length > 0) {
      result[key] = mergeBullets([], incoming);
    }
  }
  if (result.employmentTypes.length === 0 && imp.employmentTypes && imp.employmentTypes.length > 0) {
    result.employmentTypes = Array.from(new Set(imp.employmentTypes));
  }
  if ((!result.remotePreference || result.remotePreference === 'any') && imp.remotePreference) {
    result.remotePreference = imp.remotePreference;
  }
  if (result.authorizedToWork === undefined && imp.authorizedToWork !== undefined) {
    result.authorizedToWork = imp.authorizedToWork;
  }
  if (result.needsSponsorship === undefined && imp.needsSponsorship !== undefined) {
    result.needsSponsorship = imp.needsSponsorship;
  }
  return result;
}

/**
 * Merges an importer's partial profile into an existing profile.
 *
 * Pure: neither argument is mutated. Rules:
 * - Contact: non-empty import values win; empty ones never clobber the base.
 * - Skills: deduped case-insensitively. An explicit import rating can raise
 *   a rating; a base rating always beats an import's default (3).
 * - Education (institution + degree level), experiences (company + title) and
 *   certifications (name) are deduped case-insensitively; matching entries only
 *   fill fields the base left empty, and experience bullets are unioned.
 * - Story fields are only filled when empty in the base.
 * - A `ProfileSource` for this import is appended and `updatedAt` is bumped.
 */
export function mergeProfileImport(
  base: UserProfile,
  imp: ProfileImport,
  now: string = new Date().toISOString(),
  resumeId?: string
): UserProfile {
  const source: ProfileSource = { kind: imp.source, importedAt: now };
  if (resumeId) source.resumeId = resumeId;

  return {
    ...base,
    contact: mergeContact(base.contact || { name: '' }, imp.contact),
    education: mergeEducation(base.education || [], imp.education),
    skills: mergeSkills(base.skills || [], imp.skills),
    experiences: mergeExperiences(base.experiences || [], imp.experiences),
    certifications: mergeCertifications(base.certifications || [], imp.certifications),
    story: mergeStory(base.story, imp.story),
    sources: [...(base.sources || []), source],
    updatedAt: now,
  };
}
