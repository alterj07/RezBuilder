/**
 * Importer for LinkedIn's "Get a copy of your data" archive. The archive is a
 * zip of CSV files; the caller unzips it and hands us `{ name, text }` pairs.
 * Everything here is pure and synchronous.
 */
import {
  ProfileCertification,
  ProfileEducation,
  ProfileExperience,
  ProfileImport,
  ProfileStory,
} from '../../types/profile';
import {
  inferDegreeLevel,
  inferEducationStatus,
  inferExperienceType,
  normalizeDate,
  parseYear,
  splitIntoBullets,
} from './inference';

export interface LinkedInExportFile {
  /** File name or path inside the archive, e.g. "Positions.csv". */
  name: string;
  text: string;
}

export type LinkedInExportFileKind = 'profile' | 'positions' | 'education' | 'skills' | 'certifications';

/** Files we read from the archive; a warning is produced for each one missing. */
export const LINKEDIN_EXPECTED_FILES: { kind: LinkedInExportFileKind; fileName: string }[] = [
  { kind: 'profile', fileName: 'Profile.csv' },
  { kind: 'positions', fileName: 'Positions.csv' },
  { kind: 'education', fileName: 'Education.csv' },
  { kind: 'skills', fileName: 'Skills.csv' },
  { kind: 'certifications', fileName: 'Certifications.csv' },
];

/** Optional extras that enrich contact info but never warn when absent. */
const OPTIONAL_FILES: Record<string, 'emails' | 'phones'> = {
  'email addresses': 'emails',
  emailaddresses: 'emails',
  phonenumbers: 'phones',
  'phone numbers': 'phones',
};

/**
 * Minimal RFC 4180 CSV parser: quoted fields, doubled-quote escapes, embedded
 * commas and newlines, CRLF / CR / LF line endings and a leading UTF-8 BOM.
 * The first row is the header; rows are returned as header -> value records.
 * Fully empty rows are skipped; short rows are padded with "".
 */
export function parseCsv(text: string): Record<string, string>[] {
  if (!text) return [];
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && input[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.trim());
  const records: Record<string, string>[] = [];
  for (const cells of rows.slice(1)) {
    if (cells.every((cell) => cell.trim() === '')) continue;
    const record: Record<string, string> = {};
    header.forEach((key, idx) => {
      if (!key) return;
      record[key] = (cells[idx] ?? '').trim();
    });
    records.push(record);
  }
  return records;
}

function baseNameKey(name: string): string {
  const base = name.split(/[\\/]/).pop() || '';
  return base.replace(/\.csv$/i, '').trim().toLowerCase();
}

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/** Case-insensitive column lookup tolerant of stray spaces. */
function col(record: Record<string, string>, ...names: string[]): string {
  for (const name of names) {
    if (hasText(record[name])) return record[name].trim();
  }
  const wanted = names.map((n) => n.toLowerCase().replace(/\s+/g, ''));
  for (const [key, value] of Object.entries(record)) {
    if (wanted.includes(key.toLowerCase().replace(/\s+/g, '')) && hasText(value)) return value.trim();
  }
  return '';
}

/** Parses LinkedIn's "[PERSONAL:https://a.dev,OTHER:https://github.com/x]" websites cell. */
function parseWebsites(cell: string): { website?: string; github?: string } {
  const urls = cell.match(/https?:\/\/[^\s,\]]+/gi) || [];
  const result: { website?: string; github?: string } = {};
  for (const url of urls) {
    if (/github\.com/i.test(url)) {
      if (!result.github) result.github = url;
    } else if (!result.website) {
      result.website = url;
    }
  }
  return result;
}

/**
 * Builds a `ProfileImport` from the CSV files of a LinkedIn data export.
 * Files are matched by basename (case-insensitive, extension optional) and
 * unknown files are ignored. `now` only affects graduated / in-progress.
 */
export function parseLinkedInExportFiles(files: LinkedInExportFile[], now: Date = new Date()): ProfileImport {
  const imp: ProfileImport = { source: 'linkedin_export' };
  const warnings: string[] = [];
  const found = new Map<LinkedInExportFileKind, Record<string, string>[]>();
  const extras = new Map<'emails' | 'phones', Record<string, string>[]>();

  for (const file of files || []) {
    if (!file || typeof file.name !== 'string') continue;
    const key = baseNameKey(file.name);
    const expected = LINKEDIN_EXPECTED_FILES.find((f) => baseNameKey(f.fileName) === key);
    if (expected) {
      found.set(expected.kind, parseCsv(file.text || ''));
      continue;
    }
    const optional = OPTIONAL_FILES[key];
    if (optional) extras.set(optional, parseCsv(file.text || ''));
  }

  for (const expected of LINKEDIN_EXPECTED_FILES) {
    if (!found.has(expected.kind)) warnings.push(`${expected.fileName} was not found in the export.`);
  }

  // ---- Profile.csv -------------------------------------------------------
  const profileRows = found.get('profile') || [];
  const profile = profileRows[0];
  const contact: NonNullable<ProfileImport['contact']> = {};
  const story: Partial<ProfileStory> = {};
  if (profile) {
    const name = [col(profile, 'First Name'), col(profile, 'Last Name')].filter(Boolean).join(' ').trim();
    if (name) contact.name = name;
    const location = col(profile, 'Geo Location', 'Location');
    if (location) contact.location = location;
    const { website, github } = parseWebsites(col(profile, 'Websites'));
    if (website) contact.website = website;
    if (github) contact.github = github;
    const summary = col(profile, 'Summary') || col(profile, 'Headline');
    if (summary) story.summary = summary;
    const industry = col(profile, 'Industry');
    if (industry) story.targetIndustries = [industry];
  } else if (found.has('profile')) {
    warnings.push('Profile.csv contained no rows.');
  }

  const emailRows = extras.get('emails') || [];
  const primaryEmail =
    emailRows.find((r) => /^yes$/i.test(col(r, 'Primary'))) || emailRows.find((r) => hasText(col(r, 'Email Address')));
  if (primaryEmail) {
    const email = col(primaryEmail, 'Email Address', 'Email');
    if (email) contact.email = email;
  }
  const phoneRows = extras.get('phones') || [];
  const phone = phoneRows.map((r) => col(r, 'Number', 'Phone Number')).find(Boolean);
  if (phone) contact.phone = phone;

  if (Object.keys(contact).length > 0) imp.contact = contact;
  if (Object.keys(story).length > 0) imp.story = story;

  // ---- Positions.csv -----------------------------------------------------
  const experiences: Omit<ProfileExperience, 'id'>[] = [];
  for (const row of found.get('positions') || []) {
    const company = col(row, 'Company Name', 'Company');
    const title = col(row, 'Title');
    if (!company && !title) continue;
    const finished = col(row, 'Finished On');
    const entry: Omit<ProfileExperience, 'id'> = {
      company,
      title,
      bullets: splitIntoBullets(col(row, 'Description')),
      isCurrent: !finished,
    };
    const type = inferExperienceType(title);
    if (type) entry.type = type;
    const startDate = normalizeDate(col(row, 'Started On'));
    if (startDate) entry.startDate = startDate;
    const endDate = normalizeDate(finished);
    if (endDate) entry.endDate = endDate;
    const location = col(row, 'Location');
    if (location) entry.location = location;
    experiences.push(entry);
  }
  if (experiences.length > 0) imp.experiences = experiences;

  // ---- Education.csv -----------------------------------------------------
  const education: Omit<ProfileEducation, 'id'>[] = [];
  for (const row of found.get('education') || []) {
    const institution = col(row, 'School Name', 'School');
    if (!institution) continue;
    const degreeName = col(row, 'Degree Name', 'Degree');
    // LinkedIn often stores "Bachelor of Science - BS, Computer Science".
    let degree = degreeName;
    let fieldOfStudy = col(row, 'Field Of Study');
    if (!fieldOfStudy && degreeName.includes(',')) {
      const idx = degreeName.indexOf(',');
      degree = degreeName.slice(0, idx).trim();
      fieldOfStudy = degreeName.slice(idx + 1).trim();
    }
    const graduationYear = parseYear(col(row, 'End Date'));
    const entry: Omit<ProfileEducation, 'id'> = {
      institution,
      degreeLevel: inferDegreeLevel(degree),
      status: inferEducationStatus(graduationYear, now),
    };
    if (degree) entry.degree = degree;
    if (fieldOfStudy) entry.fieldOfStudy = fieldOfStudy;
    if (graduationYear !== undefined) entry.graduationYear = graduationYear;
    const endDate = normalizeDate(col(row, 'End Date'));
    if (endDate && endDate.length === 7) entry.graduationMonth = parseInt(endDate.slice(5), 10);
    education.push(entry);
    if (graduationYear === undefined) warnings.push(`No end date for ${institution}; check its graduating year.`);
  }
  if (education.length > 0) imp.education = education;

  // ---- Skills.csv --------------------------------------------------------
  const seenSkills = new Set<string>();
  const skills: NonNullable<ProfileImport['skills']> = [];
  for (const row of found.get('skills') || []) {
    const name = col(row, 'Name', 'Skill');
    const key = name.toLowerCase();
    if (!name || seenSkills.has(key)) continue;
    seenSkills.add(key);
    skills.push({ name, rating: 3 });
  }
  if (skills.length > 0) imp.skills = skills;

  // ---- Certifications.csv ------------------------------------------------
  const certifications: Omit<ProfileCertification, 'id'>[] = [];
  for (const row of found.get('certifications') || []) {
    const name = col(row, 'Name');
    if (!name) continue;
    const entry: Omit<ProfileCertification, 'id'> = { name };
    const issuer = col(row, 'Authority', 'Issuer');
    if (issuer) entry.issuer = issuer;
    const url = col(row, 'Url', 'URL');
    if (url) entry.credentialUrl = url;
    const issued = parseYear(col(row, 'Started On'));
    if (issued !== undefined) entry.issuedYear = issued;
    const expires = parseYear(col(row, 'Finished On'));
    if (expires !== undefined) entry.expiresYear = expires;
    certifications.push(entry);
  }
  if (certifications.length > 0) imp.certifications = certifications;

  if (warnings.length > 0) imp.warnings = warnings;
  return imp;
}
