import { JobScraper } from './scraperInterface';
import { LinkedInScraper } from './linkedinScraper';
import { IndeedScraper } from './indeedScraper';
import { GreenhouseScraper } from './greenhouseScraper';
import { LeverScraper } from './leverScraper';
import { GenericScraper } from './genericScraper';
import { JobPosting } from '../../types/job';

export class ScraperRegistry {
  private scrapers: JobScraper[] = [
    new LinkedInScraper(),
    new IndeedScraper(),
    new GreenhouseScraper(),
    new LeverScraper(),
    new GenericScraper(),
  ];

  public detectAndScrape(url: string, document: Document): JobPosting | null {
    for (const scraper of this.scrapers) {
      if (scraper.canHandle(url, document)) {
        const job = scraper.scrape(url, document);
        if (job) {
          console.log(`[RezBuilder] Successfully scraped job via ${scraper.name}:`, job.title);
          return job;
        }
      }
    }
    return null;
  }
}

export const scraperRegistry = new ScraperRegistry();
