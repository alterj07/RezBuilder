import { JobPosting } from '../../types/job';

export interface JobScraper {
  name: string;
  canHandle(url: string, document: Document): boolean;
  scrape(url: string, document: Document): JobPosting | null;
}
