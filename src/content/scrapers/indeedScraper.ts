import { JobScraper } from './scraperInterface';
import { JobPosting } from '../../types/job';
import { cleanText, extractSkillsFromText } from './keywordExtractor';

export class IndeedScraper implements JobScraper {
  name = 'Indeed';

  canHandle(url: string, document: Document): boolean {
    if (!url.includes('indeed.com')) return false;
    return !!(
      document.querySelector('#jobDescriptionText') ||
      document.querySelector('[data-testid="jobsearch-JobInfoHeader-title"]') ||
      document.querySelector('.jobsearch-JobInfoHeader-title') ||
      document.querySelector('.jobsearch-JobComponent')
    );
  }

  scrape(url: string, document: Document): JobPosting | null {
    try {
      // 1. Job Title
      const titleEl =
        document.querySelector('[data-testid="jobsearch-JobInfoHeader-title"]') ||
        document.querySelector('.jobsearch-JobInfoHeader-title') ||
        document.querySelector('h1.jobsearch-JobInfoHeader-title') ||
        document.querySelector('h1');
      const title = cleanText(titleEl?.textContent) || 'Unknown Role';

      // 2. Company Name
      const companyEl =
        document.querySelector('[data-testid="inlineHeader-companyName"]') ||
        document.querySelector('.jobsearch-JobInfoHeader-companyName') ||
        document.querySelector('[data-company-name="true"]');
      const company = cleanText(companyEl?.textContent) || 'Unknown Company';

      // 3. Location & Workplace Type
      const locationEl =
        document.querySelector('[data-testid="inlineHeader-companyLocation"]') ||
        document.querySelector('.jobsearch-JobInfoHeader-companyLocation');
      const locationRaw = cleanText(locationEl?.textContent) || '';

      let remoteStatus: JobPosting['remoteStatus'] = 'Unspecified';
      const pageText = (locationRaw + ' ' + (document.body.innerText || '')).toLowerCase();
      if (pageText.includes('remote')) {
        remoteStatus = 'Remote';
      } else if (pageText.includes('hybrid')) {
        remoteStatus = 'Hybrid';
      } else if (pageText.includes('on-site') || pageText.includes('in-person')) {
        remoteStatus = 'On-site';
      }

      // 4. Job Description
      const descEl =
        document.querySelector('#jobDescriptionText') ||
        document.querySelector('.jobsearch-jobDescriptionText') ||
        document.querySelector('.jobsearch-JobComponent-description');
      
      const description = cleanText(descEl?.textContent || (descEl as HTMLElement)?.innerText) || '';

      if (!description || description.length < 50) {
        return null;
      }

      // 5. Skills extraction
      const skills = extractSkillsFromText(title + ' ' + description);

      return {
        id: 'indeed_' + Math.random().toString(36).substring(2, 9),
        title,
        company,
        location: locationRaw || undefined,
        remoteStatus,
        description,
        requiredSkills: skills,
        url,
        source: 'indeed',
        scrapedAt: new Date().toISOString(),
      };
    } catch (err) {
      console.error('[RezBuilder] Error scraping Indeed:', err);
      return null;
    }
  }
}
