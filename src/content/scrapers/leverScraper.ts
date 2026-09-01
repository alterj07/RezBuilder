import { JobScraper } from './scraperInterface';
import { JobPosting } from '../../types/job';
import { cleanText, extractSkillsFromText } from './keywordExtractor';

export class LeverScraper implements JobScraper {
  name = 'Lever';

  canHandle(url: string, document: Document): boolean {
    if (url.includes('jobs.lever.co')) return true;
    return !!(
      document.querySelector('.posting-headline') ||
      document.querySelector('.posting-categories')
    );
  }

  scrape(url: string, document: Document): JobPosting | null {
    try {
      // 1. Job Title
      const titleEl =
        document.querySelector('.posting-headline h2') ||
        document.querySelector('.posting-headline') ||
        document.querySelector('h2');
      const title = cleanText(titleEl?.textContent) || 'Unknown Role';

      // 2. Company Name
      const companyEl =
        document.querySelector('.main-header-logo img') ||
        document.querySelector('.posting-header-logo img') ||
        document.querySelector('.main-header a');
      let company = companyEl?.getAttribute('alt') || cleanText(companyEl?.textContent);
      if (!company) {
        const urlMatch = url.match(/jobs\.lever\.co\/([^/]+)/);
        if (urlMatch && urlMatch[1]) {
          company = urlMatch[1].replace(/[-_]/g, ' ');
          company = company.charAt(0).toUpperCase() + company.slice(1);
        }
      }
      company = company || 'Unknown Company';

      // 3. Location & Workplace Type
      const locationEl = document.querySelector('.posting-categories .location') || document.querySelector('.sort-by-time');
      const locationRaw = cleanText(locationEl?.textContent) || '';

      const workplaceTypeEl = document.querySelector('.posting-categories .workplaceTypes');
      const workplaceType = cleanText(workplaceTypeEl?.textContent) || '';

      let remoteStatus: JobPosting['remoteStatus'] = 'Unspecified';
      const combined = (locationRaw + ' ' + workplaceType + ' ' + (document.body.innerText || '')).toLowerCase();
      if (combined.includes('remote')) {
        remoteStatus = 'Remote';
      } else if (combined.includes('hybrid')) {
        remoteStatus = 'Hybrid';
      } else if (combined.includes('on-site') || combined.includes('onsite')) {
        remoteStatus = 'On-site';
      }

      // 4. Job Description
      const descContainers = document.querySelectorAll('.section-wrapper, .section.page-centered');
      let description = '';
      if (descContainers.length > 0) {
        descContainers.forEach((container) => {
          description += ' ' + cleanText((container as HTMLElement).innerText || container.textContent);
        });
      } else {
        const mainEl = document.querySelector('.content') || document.querySelector('#content');
        description = cleanText((mainEl as HTMLElement)?.innerText || mainEl?.textContent);
      }

      if (!description || description.length < 50) {
        return null;
      }

      // 5. Skills
      const skills = extractSkillsFromText(title + ' ' + description);

      return {
        id: 'lever_' + Math.random().toString(36).substring(2, 9),
        title,
        company,
        location: locationRaw || undefined,
        remoteStatus,
        description,
        requiredSkills: skills,
        url,
        source: 'lever',
        scrapedAt: new Date().toISOString(),
      };
    } catch (err) {
      console.error('[RezBuilder] Error scraping Lever:', err);
      return null;
    }
  }
}
