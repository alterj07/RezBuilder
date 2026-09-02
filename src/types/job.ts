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
  source: 'linkedin' | 'indeed' | 'greenhouse' | 'lever' | 'workday' | 'ashby' | 'generic' | 'manual';
  scrapedAt: string; // ISO string
  rawHtml?: string;
}
