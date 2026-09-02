import { JobScraper } from './scraperInterface';
import { LinkedInScraper } from './linkedinScraper';
import { IndeedScraper } from './indeedScraper';
import { GreenhouseScraper } from './greenhouseScraper';
import { LeverScraper } from './leverScraper';
import { WorkdayScraper } from './workdayScraper';
import { AshbyScraper } from './ashbyScraper';
import { GenericScraper } from './genericScraper';
import { JobPosting } from '../../types/job';
import { ClassificationResult, SchemaJobPosting } from '../../types/detection';
import { jobClassifier } from '../detection/jobClassifier';

export class ScraperRegistry {
  private scrapers: JobScraper[] = [
    new LinkedInScraper(),
    new IndeedScraper(),
    new GreenhouseScraper(),
    new LeverScraper(),
    new WorkdayScraper(),
    new AshbyScraper(),
    new GenericScraper(),
  ];

  public getAllScrapers(): JobScraper[] {
    return this.scrapers;
  }

  public getScraper(url: string, document: Document): JobScraper | null {
    for (const scraper of this.scrapers) {
      if (scraper.canHandle(url, document)) {
        return scraper;
      }
    }
    return null;
  }

  public getScraperByName(name: string): JobScraper | null {
    return this.scrapers.find((s) => s.name.toLowerCase() === name.toLowerCase()) || null;
  }

  public classify(url: string, document: Document): ClassificationResult {
    return jobClassifier.classify(url, document);
  }

  public detectAndScrape(
    url: string,
    document: Document,
    schemaJobPosting?: SchemaJobPosting
  ): JobPosting | null {
    for (const scraper of this.scrapers) {
      if (scraper.canHandle(url, document)) {
        try {
          let job: JobPosting | null = null;
          if (scraper instanceof GenericScraper && schemaJobPosting) {
            job = (scraper as any).scrape(url, document, schemaJobPosting);
          } else {
            job = scraper.scrape(url, document);
          }

          if (job) {
            console.log(`[RezBuilder] Successfully scraped job via ${scraper.name}:`, job.title);
            return job;
          }
        } catch (err) {
          console.error(`[RezBuilder] Error scraping via ${scraper.name}:`, err);
        }
      }
    }
    return null;
  }
}

export const scraperRegistry = new ScraperRegistry();
