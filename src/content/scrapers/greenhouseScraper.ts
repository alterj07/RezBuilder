import { JobScraper } from './scraperInterface';
import { JobPosting } from '../../types/job';
import { cleanText, extractSkillsFromText } from './keywordExtractor';

export class GreenhouseScraper implements JobScraper {
  name = 'Greenhouse';

  canHandle(url: string, document: Document): boolean {
    if (url.includes('boards.greenhouse.io') || url.includes('greenhouse.io')) return true;
    return !!(
      document.querySelector('#app_body') ||
      document.querySelector('.app-title') ||
      document.querySelector('meta[property="og:site_name"][content="Greenhouse"]')
    );
  }

  scrape(url: string, document: Document): JobPosting | null {
    try {
      // 1. Job Title
      const titleEl =
        document.querySelector('.app-title') ||
        document.querySelector('h1.job-title') ||
        document.querySelector('h1');
      const title = cleanText(titleEl?.textContent) || 'Unknown Role';

      // 2. Company Name
      const companyEl =
        document.querySelector('.company-name') ||
        document.querySelector('span.company') ||
        document.querySelector('.company');
      let company = cleanText(companyEl?.textContent);
      if (!company) {
        // Try extracting from title tag
        const docTitle = document.title || '';
        const parts = docTitle.split(' at ');
        if (parts.length > 1) {
          company = cleanText(parts[1]);
        }
      }
      company = company || 'Unknown Company';

      // 3. Location
      const locationEl = document.querySelector('.location') || document.querySelector('.job-location');
      const locationRaw = cleanText(locationEl?.textContent) || '';

      let remoteStatus: JobPosting['remoteStatus'] = 'Unspecified';
      const pageText = (locationRaw + ' ' + (document.body.innerText || '')).toLowerCase();
      if (pageText.includes('remote')) {
        remoteStatus = 'Remote';
      } else if (pageText.includes('hybrid')) {
        remoteStatus = 'Hybrid';
      } else if (pageText.includes('on-site') || pageText.includes('onsite')) {
        remoteStatus = 'On-site';
      }

      // 4. Job Description
      const descEl =
        document.querySelector('#content') ||
        document.querySelector('#app_body') ||
        document.querySelector('.job-description') ||
        document.querySelector('#job-description');

      const description = cleanText(descEl?.textContent || (descEl as HTMLElement)?.innerText) || '';

      if (!description || description.length < 50) {
        return null;
      }

      // 5. Skills
      const skills = extractSkillsFromText(title + ' ' + description);

      return {
        id: 'gh_' + Math.random().toString(36).substring(2, 9),
        title,
        company,
        location: locationRaw || undefined,
        remoteStatus,
        description,
        requiredSkills: skills,
        url,
        source: 'greenhouse',
        scrapedAt: new Date().toISOString(),
      };
    } catch (err) {
      console.error('[RezBuilder] Error scraping Greenhouse:', err);
      return null;
    }
  }
}
