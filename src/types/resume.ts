export interface ContactInfo {
  name?: string;
  email?: string;
  phone?: string;
  location?: string;
  linkedin?: string;
  website?: string;
  github?: string;
}

export interface ExperienceItem {
  id: string;
  company: string;
  title: string;
  startDate?: string;
  endDate?: string;
  isCurrent?: boolean;
  location?: string;
  bullets: string[];
  bulletDiffs?: TailoredBulletDiff[];
}

export interface EducationItem {
  id: string;
  institution: string;
  degree?: string;
  fieldOfStudy?: string;
  graduationYear?: string;
  gpa?: string;
  highlights?: string[];
}

export interface ProjectItem {
  id: string;
  name: string;
  description?: string;
  technologies?: string[];
  link?: string;
  bullets?: string[];
}

export interface ResumeSections {
  contact: ContactInfo;
  summary: string;
  experience: ExperienceItem[];
  education: EducationItem[];
  skills: string[];
  projects: ProjectItem[];
  certifications?: string[];
}

export interface Resume {
  id: string;
  name: string;
  tag: string; // e.g. "Software Eng — Backend", "PM — Growth"
  fileName: string;
  fileType: 'pdf' | 'docx' | 'text';
  uploadedAt: string; // ISO string
  rawText: string;
  sections: ResumeSections;
  isDefault?: boolean;
}

export interface TailoredBulletDiff {
  original: string;
  tailored: string;
  reason: string;
}

export interface TailoredExperienceItem extends ExperienceItem {
  bulletDiffs?: TailoredBulletDiff[];
}

export interface TailoredResume {
  id: string;
  baseResumeId: string;
  jobId: string;
  createdAt: string;
  sections: ResumeSections;
  rawText: string;
  changesSummary: string[];
  unresolvedGaps: string[];
  atsScore?: number;
}
