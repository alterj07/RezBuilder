/**
 * Candidate Profile — the single source of truth about the user that every
 * other feature (Best Fit %, tailoring, autofill, future auto-apply) reads from.
 *
 * Everything here is stored locally in `chrome.storage.local` under
 * `rezbuilder_profile`. Nothing leaves the browser.
 */

/** 1 = familiar, 3 = comfortable, 5 = expert. Drives ordering and weighting everywhere. */
export type SkillRating = 1 | 2 | 3 | 4 | 5;

export type SkillCategory = 'technical' | 'tool' | 'language' | 'soft' | 'domain' | 'other';

export interface ProfileSkill {
  id: string;
  name: string;
  rating: SkillRating;
  category?: SkillCategory;
}

export type DegreeLevel =
  | 'high_school'
  | 'associate'
  | 'bachelor'
  | 'master'
  | 'phd'
  | 'bootcamp'
  | 'other';

/** `in_progress` covers current university, grad school, and masters students. */
export type EducationStatus = 'in_progress' | 'graduated';

export interface ProfileEducation {
  id: string;
  institution: string;
  degreeLevel: DegreeLevel;
  /** Free-form label such as "B.S." or "MEng". */
  degree?: string;
  fieldOfStudy?: string;
  status: EducationStatus;
  /** "Graduating class" — expected year when in progress, actual year when graduated. */
  graduationYear?: number;
  /** 1-12, optional refinement of the graduating class. */
  graduationMonth?: number;
  gpa?: string;
}

export type ExperienceType =
  | 'full_time'
  | 'part_time'
  | 'internship'
  | 'contract'
  | 'research'
  | 'volunteer'
  | 'freelance'
  | 'project';

export interface ProfileExperience {
  id: string;
  company: string;
  title: string;
  type?: ExperienceType;
  /** ISO-ish "YYYY-MM" or "YYYY"; free text tolerated by consumers. */
  startDate?: string;
  endDate?: string;
  isCurrent?: boolean;
  location?: string;
  bullets: string[];
  /** Names matching `ProfileSkill.name` where possible. */
  skillsUsed?: string[];
}

export interface ProfileCertification {
  id: string;
  name: string;
  issuer?: string;
  issuedYear?: number;
  expiresYear?: number;
  credentialUrl?: string;
}

export type RemotePreference = 'remote' | 'hybrid' | 'onsite' | 'any';
export type EmploymentPreference = 'full_time' | 'part_time' | 'internship' | 'contract';

/**
 * The narrative half of the profile: what the user cares about and is aiming
 * for. Feeds the "story" and "preferences" factors of Best Fit %.
 */
export interface ProfileStory {
  /** Short "about me" in the user's own words. */
  summary: string;
  /**
   * Motivations / values, e.g. "impact", "mentorship", "fast-paced startup",
   * "research". Free text tags; the fit engine maps them onto known themes.
   */
  drives: string[];
  /** Titles the user is targeting, e.g. "Software Engineer Intern". */
  targetRoles: string[];
  targetIndustries: string[];
  remotePreference: RemotePreference;
  preferredLocations: string[];
  employmentTypes: EmploymentPreference[];
  /** Left undefined when the user has not answered. */
  authorizedToWork?: boolean;
  needsSponsorship?: boolean;
}

export interface ProfileContact {
  name: string;
  email?: string;
  phone?: string;
  location?: string;
  linkedinUrl?: string;
  website?: string;
  github?: string;
}

export type ProfileSourceKind = 'manual' | 'resume' | 'linkedin_page' | 'linkedin_export';

export interface ProfileSource {
  kind: ProfileSourceKind;
  importedAt: string; // ISO
  /** Resume id when kind === 'resume'. */
  resumeId?: string;
}

export interface UserProfile {
  version: 1;
  id: string;
  contact: ProfileContact;
  education: ProfileEducation[];
  skills: ProfileSkill[];
  experiences: ProfileExperience[];
  certifications: ProfileCertification[];
  story: ProfileStory;
  sources: ProfileSource[];
  createdAt: string; // ISO
  updatedAt: string; // ISO
  /** Set the first time the profile passes the completeness gate. */
  completedAt?: string | null;
}

/** Result of the onboarding gate check. */
export interface ProfileCompleteness {
  isComplete: boolean;
  /** 0-100, for the progress bar in onboarding. */
  score: number;
  /** Human-readable requirements still unmet, in display order. */
  missing: string[];
  /** Optional-but-recommended items that improve Best Fit accuracy. */
  suggestions: string[];
}

/**
 * Partial profile produced by an importer (resume parser, LinkedIn page
 * scraper, LinkedIn data export). Merged into the stored profile by
 * `profileStorage.mergeImport`.
 */
export interface ProfileImport {
  source: ProfileSourceKind;
  contact?: Partial<ProfileContact>;
  education?: Omit<ProfileEducation, 'id'>[];
  skills?: { name: string; rating?: SkillRating; category?: SkillCategory }[];
  experiences?: Omit<ProfileExperience, 'id'>[];
  certifications?: Omit<ProfileCertification, 'id'>[];
  story?: Partial<ProfileStory>;
  /** Free-form notes about what could not be parsed, surfaced in the UI. */
  warnings?: string[];
}

export const DEFAULT_PROFILE_STORY: ProfileStory = {
  summary: '',
  drives: [],
  targetRoles: [],
  targetIndustries: [],
  remotePreference: 'any',
  preferredLocations: [],
  employmentTypes: [],
};

export function createEmptyProfile(now: string = new Date().toISOString()): UserProfile {
  return {
    version: 1,
    id: 'profile_' + Date.now().toString(36),
    contact: { name: '' },
    education: [],
    skills: [],
    experiences: [],
    certifications: [],
    story: { ...DEFAULT_PROFILE_STORY },
    sources: [],
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  };
}
