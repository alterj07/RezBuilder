import { Resume } from '../../types/resume';
import {
  ProfileCertification,
  ProfileEducation,
  ProfileExperience,
  ProfileImport,
  ProfileStory,
  SkillRating,
} from '../../types/profile';
import { extractSkillsFromText } from '../../content/scrapers/keywordExtractor';
import { isKeywordPresent } from '../../services/scoring/keywordMatcher';
import {
  inferDegreeLevel,
  inferEducationStatus,
  inferExperienceType,
  isPresentMarker,
  normalizeDate,
  parseYear,
} from './inference';

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Heuristic confidence: a skill mentioned in two or more experience bullets is
 * one the candidate has clearly used (4); one bullet is comfortable (3); a
 * skill only listed in the skills section is familiar (2).
 */
export function rateSkillFromBullets(skill: string, bullets: string[]): SkillRating {
  let hits = 0;
  for (const bullet of bullets) {
    if (isKeywordPresent(skill, bullet)) {
      hits++;
      if (hits >= 2) return 4;
    }
  }
  return hits === 1 ? 3 : 2;
}

/**
 * Converts a parsed resume into a `ProfileImport` for `profileStorage.mergeImport`.
 * Pure and synchronous. `now` only affects the graduated / in-progress inference.
 */
export function resumeToProfileImport(resume: Resume, now: Date = new Date()): ProfileImport {
  const sections = resume.sections || ({} as Resume['sections']);
  const warnings: string[] = [];
  const imp: ProfileImport = { source: 'resume' };

  // ---- Contact -----------------------------------------------------------
  const c = sections.contact || {};
  const contact: NonNullable<ProfileImport['contact']> = {};
  if (hasText(c.name)) contact.name = c.name.trim();
  if (hasText(c.email)) contact.email = c.email.trim();
  if (hasText(c.phone)) contact.phone = c.phone.trim();
  if (hasText(c.location)) contact.location = c.location.trim();
  if (hasText(c.linkedin)) contact.linkedinUrl = c.linkedin.trim();
  if (hasText(c.website)) contact.website = c.website.trim();
  if (hasText(c.github)) contact.github = c.github.trim();
  if (Object.keys(contact).length > 0) imp.contact = contact;
  if (!contact.name) warnings.push('Could not find your name in the resume.');

  // ---- Experience --------------------------------------------------------
  const experiences: Omit<ProfileExperience, 'id'>[] = [];
  const allExperienceBullets: string[] = [];
  for (const item of sections.experience || []) {
    if (!item || (!hasText(item.company) && !hasText(item.title))) continue;
    const bullets = (item.bullets || []).map((b) => b.trim()).filter(Boolean);
    allExperienceBullets.push(...bullets);
    const isCurrent = !!item.isCurrent || isPresentMarker(item.endDate);
    const entry: Omit<ProfileExperience, 'id'> = {
      company: (item.company || '').trim(),
      title: (item.title || '').trim(),
      bullets,
      isCurrent,
    };
    const type = inferExperienceType(item.title);
    if (type) entry.type = type;
    const startDate = normalizeDate(item.startDate);
    if (startDate) entry.startDate = startDate;
    const endDate = isCurrent ? undefined : normalizeDate(item.endDate);
    if (endDate) entry.endDate = endDate;
    if (hasText(item.location)) entry.location = item.location.trim();
    const used = extractSkillsFromText(bullets.join('\n'));
    if (used.length > 0) entry.skillsUsed = used;
    experiences.push(entry);
  }

  // Projects count as experiences of type 'project' for the completeness gate.
  for (const project of sections.projects || []) {
    if (!project || !hasText(project.name)) continue;
    const bullets = [
      ...(hasText(project.description) ? [project.description.trim()] : []),
      ...(project.bullets || []).map((b) => b.trim()).filter(Boolean),
    ];
    const entry: Omit<ProfileExperience, 'id'> = {
      company: project.name.trim(),
      title: 'Project',
      type: 'project',
      bullets,
    };
    const used = Array.from(
      new Set([...(project.technologies || []).map((t) => t.trim()).filter(Boolean), ...extractSkillsFromText(bullets.join('\n'))])
    );
    if (used.length > 0) entry.skillsUsed = used;
    experiences.push(entry);
  }
  if (experiences.length > 0) imp.experiences = experiences;
  if ((sections.experience || []).length === 0) warnings.push('No work experience was found in the resume.');

  // ---- Education ---------------------------------------------------------
  const education: Omit<ProfileEducation, 'id'>[] = [];
  for (const item of sections.education || []) {
    if (!item || !hasText(item.institution)) continue;
    const degreeText = [item.degree, item.fieldOfStudy].filter(hasText).join(' ');
    const graduationYear = parseYear(item.graduationYear);
    const entry: Omit<ProfileEducation, 'id'> = {
      institution: item.institution.trim(),
      degreeLevel: inferDegreeLevel(item.degree || degreeText),
      status: inferEducationStatus(graduationYear, now),
    };
    if (hasText(item.degree)) entry.degree = item.degree.trim();
    if (hasText(item.fieldOfStudy)) entry.fieldOfStudy = item.fieldOfStudy.trim();
    if (graduationYear !== undefined) entry.graduationYear = graduationYear;
    if (hasText(item.gpa)) entry.gpa = item.gpa.trim();
    education.push(entry);
    if (graduationYear === undefined) {
      warnings.push(`Could not find a graduating year for ${entry.institution}.`);
    }
  }
  if (education.length > 0) imp.education = education;
  else warnings.push('No education was found in the resume.');

  // ---- Skills ------------------------------------------------------------
  const skillNames = new Map<string, string>(); // normalized -> display
  for (const raw of sections.skills || []) {
    if (!hasText(raw)) continue;
    const name = raw.trim();
    const key = name.toLowerCase();
    if (!skillNames.has(key)) skillNames.set(key, name);
  }
  for (const found of extractSkillsFromText(resume.rawText || '')) {
    const key = found.toLowerCase();
    if (!skillNames.has(key)) skillNames.set(key, found);
  }
  const skills = Array.from(skillNames.values()).map((name) => ({
    name,
    rating: rateSkillFromBullets(name, allExperienceBullets),
  }));
  if (skills.length > 0) imp.skills = skills;
  else warnings.push('No skills were found in the resume.');

  // ---- Certifications ----------------------------------------------------
  const certifications: Omit<ProfileCertification, 'id'>[] = [];
  for (const raw of sections.certifications || []) {
    if (!hasText(raw)) continue;
    const entry: Omit<ProfileCertification, 'id'> = { name: raw.trim() };
    const year = parseYear(raw);
    if (year !== undefined) entry.issuedYear = year;
    certifications.push(entry);
  }
  if (certifications.length > 0) imp.certifications = certifications;

  // ---- Story -------------------------------------------------------------
  if (hasText(sections.summary)) {
    const story: Partial<ProfileStory> = { summary: sections.summary.trim() };
    imp.story = story;
  }

  if (warnings.length > 0) imp.warnings = warnings;
  return imp;
}
