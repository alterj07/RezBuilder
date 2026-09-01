import { JobScraper } from './scraperInterface';
import { JobPosting } from '../../types/job';
import { cleanText, extractSkillsFromText } from './keywordExtractor';

export class LinkedInScraper implements JobScraper {
  name = 'LinkedIn';

  canHandle(url: string, document: Document): boolean {
    if (!url.includes('linkedin.com/jobs')) return false;
    return !!(
      document.querySelector('.job-details-jobs-unified-top-card__job-title') ||
      document.querySelector('.jobs-unified-top-card__job-title') ||
      document.querySelector('.topcard__title') ||
      document.querySelector('.jobs-description__content') ||
      document.querySelector('#job-details')
    );
  }

  scrape(url: string, document: Document): JobPosting | null {
    try {
      // 1. Job Title
      const titleEl =
        document.querySelector('.job-details-jobs-unified-top-card__job-title') ||
        document.querySelector('.jobs-unified-top-card__job-title') ||
        document.querySelector('.topcard__title') ||
        document.querySelector('h1.t-24') ||
        document.querySelector('h1');
      const title = cleanText(titleEl?.textContent) || 'Unknown Role';

      // 2. Company Name
      const companyEl =
        document.querySelector('.job-details-jobs-unified-top-card__company-name') ||
        document.querySelector('.jobs-unified-top-card__company-name') ||
        document.querySelector('.topcard__flavor--black-link') ||
        document.querySelector('.topcard__flavor') ||
        document.querySelector('a.ember-view.inline-block');
      const company = cleanText(companyEl?.textContent) || 'Unknown Company';

      // 3. Location & Workplace Type
      const locationEl =
        document.querySelector('.job-details-jobs-unified-top-card__primary-description-container') ||
        document.querySelector('.jobs-unified-top-card__bullet') ||
        document.querySelector('.topcard__flavor--bullet');
      const locationRaw = cleanText(locationEl?.textContent) || '';

      let remoteStatus: JobPosting['remoteStatus'] = 'Unspecified';
      const combinedMeta = (locationRaw + ' ' + (document.body.innerText || '')).toLowerCase();
      if (combinedMeta.includes('remote')) {
        remoteStatus = 'Remote';
      } else if (combinedMeta.includes('hybrid')) {
        remoteStatus = 'Hybrid';
      } else if (combinedMeta.includes('on-site') || combinedMeta.includes('onsite')) {
        remoteStatus = 'On-site';
      }

      // 4. Job Description
      const descEl =
        document.querySelector('#job-details') ||
        document.querySelector('.jobs-description__content') ||
        document.querySelector('.jobs-box__html-content') ||
        document.querySelector('.show-more-less-html__markup');
      
      const description = cleanText(descEl?.textContent || (descEl as HTMLElement)?.innerText) || '';

      if (!description || description.length < 50) {
        return null;
      }

      // 5. Seniority
      let seniority: string | undefined = undefined;
      const criteriaList = document.querySelectorAll('.description__job-criteria-item, .job-details-jobs-unified-top-card__job-insight');
      criteriaList.forEach((el) => {
        const text = el.textContent?.toLowerCase() || '';
        if (text.includes('senior') || text.includes('entry level') || text.includes('mid-senior') || text.includes('director') || text.includes('lead')) {
          seniority = cleanText(el.textContent);
        }
      });

      // 6. Skills extraction
      const skills = extractSkillsFromText(title + ' ' + description);

      return {
        id: 'li_' + Math.random().toString(36).substring(2, 9),
        title,
        company,
        location: locationRaw || undefined,
        remoteStatus,
        seniority,
        description,
        requiredSkills: skills,
        url,
        source: 'linkedin',
        scrapedAt: new Date().toISOString(),
      };
    } catch (err) {
      console.error('[RezBuilder] Error scraping LinkedIn:', err);
      return null;
    }
  }
}
