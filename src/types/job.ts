/** What a block of a posting is about; `unknown` means neither heading regexes nor the model placed it. */
export type JobSectionKind =
  | 'required'
  | 'preferred'
  | 'responsibilities'
  | 'about'
  | 'benefits'
  | 'eeo'
  | 'other'
  | 'unknown';

/** How a section's kind was decided. */
export type JobSectionKindSource = 'heading' | 'model' | 'inline' | 'default';

export interface JobSection {
  /** Heading text; empty for a headingless block. */
  heading: string;
  kind: JobSectionKind;
  kindSource: JobSectionKindSource;
  /** One entry per list item / paragraph / line. */
  items: string[];
  /** Model score when `kindSource === 'model'`. */
  confidence?: number;
}

export interface JobDetectionMeta {
  score: number;
  confidence: 'high' | 'medium' | 'low' | 'none';
}

export type JobLabellingStatus =
  | 'disabled'
  | 'unavailable'
  | 'skipped'
  | 'pending'
  | 'done'
  | 'timeout'
  | 'failed'
  | 'demoted';

export interface JobLabellingMeta {
  status: JobLabellingStatus;
  modelId?: string;
  labelsetVersion?: number;
  ms?: number;
  labelledSegments?: number;
}

export interface JobPosting {
  id: string;
  title: string;
  company: string;
  location?: string;
  remoteStatus?: 'Remote' | 'Hybrid' | 'On-site' | 'Unspecified';
  seniority?: string;
  description: string;
  requiredSkills: string[];
  qualifications?: string[];
  url: string;
  source: 'linkedin' | 'indeed' | 'greenhouse' | 'lever' | 'workday' | 'ashby' | 'taleo' | 'generic' | 'manual';
  scrapedAt: string; // ISO string
  rawHtml?: string;
  /** Structured blocks of the description (heading + items). Absent on manual / legacy jobs. */
  sections?: JobSection[];
  /** Classifier result for the page the job was scraped from. */
  detection?: JobDetectionMeta;
  /** State of the optional on-device section labelling. */
  labelling?: JobLabellingMeta;
}
