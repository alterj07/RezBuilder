import { describe, it, expect } from 'vitest';
import { TaleoScraper } from '../src/content/scrapers/taleoScraper';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('TaleoScraper', () => {
  it('should handle Taleo job detail URLs', () => {
    const scraper = new TaleoScraper();
    const url = 'https://hdr.taleo.net/careersection/ex/jobdetail.ftl?job=195805&lang=en&src=SNS-10025';

    expect(scraper.canHandle(url)).toBe(true);
  });

  it('should not handle non-Taleo URLs', () => {
    const scraper = new TaleoScraper();
    const url = 'https://boards.greenhouse.io/company/jobs/12345';

    expect(scraper.canHandle(url)).toBe(false);
  });

  it('should extract job details from Taleo page', () => {
    const scraper = new TaleoScraper();
    const url = 'https://hdr.taleo.net/careersection/ex/jobdetail.ftl?job=195805&lang=en&src=SNS-10025';
    const html = readFileSync(join(__dirname, 'fixtures/realPostings/taleoPosting.html'), 'utf-8');
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const job = scraper.scrape(url, doc);

    expect(job).not.toBeNull();
    expect(job?.title).toBe('Senior Software Engineer');
    expect(job?.company).toBe('HDR');
    expect(job?.location).toBe('Omaha, NE');
    expect(job?.description).toContain('Senior Software Engineer');
    expect(job?.description).toContain('TypeScript');
    expect(job?.source).toBe('taleo');
    expect(job?.sections).toBeDefined();
    expect(job?.sections?.length).toBeGreaterThan(0);
  });

  it('should extract structured sections with correct kinds', () => {
    const scraper = new TaleoScraper();
    const url = 'https://hdr.taleo.net/careersection/ex/jobdetail.ftl?job=195805&lang=en&src=SNS-10025';
    const html = readFileSync(join(__dirname, 'fixtures/realPostings/taleoPosting.html'), 'utf-8');
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const job = scraper.scrape(url, doc);

    expect(job?.sections).toBeDefined();
    const reqSection = job?.sections?.find(s => s.heading.toLowerCase().includes('requirements'));
    const prefSection = job?.sections?.find(s => s.heading.toLowerCase().includes('preferred'));

    expect(reqSection).toBeDefined();
    expect(reqSection?.kind).toBe('required');
    expect(reqSection?.items).toContain('5+ years of experience with TypeScript');

    expect(prefSection).toBeDefined();
    expect(prefSection?.kind).toBe('preferred');
    expect(prefSection?.items).toContain('Experience with cloud platforms (AWS, Azure)');
  });

  it('should extract job ID and posted date as qualifications', () => {
    const scraper = new TaleoScraper();
    const url = 'https://hdr.taleo.net/careersection/ex/jobdetail.ftl?job=195805&lang=en&src=SNS-10025';
    const html = readFileSync(join(__dirname, 'fixtures/realPostings/taleoPosting.html'), 'utf-8');
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const job = scraper.scrape(url, doc);

    expect(job?.qualifications).toBeDefined();
    expect(job?.qualifications).toContain('Job ID: REQ-12345');
    expect(job?.qualifications).toContain('Posted: January 15, 2024');
  });

  it('should handle Taleo search URLs', () => {
    const scraper = new TaleoScraper();
    const url = 'https://hdr.taleo.net/careersection/ex/jobsearch.ftl';

    expect(scraper.canHandle(url)).toBe(true);
  });
});
