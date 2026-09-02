import { JobScraper } from './scraperInterface';
import { JobPosting } from '../../types/job';
import { cleanText, extractSkillsFromText } from './keywordExtractor';

export class AshbyScraper implements JobScraper {
  name = 'Ashby';

  canHandle(url: string, document: Document): boolean {
    if (url.includes('jobs.ashbyhq.com') || url.includes('ashbyhq.com')) return true;
    return !!(
      document.querySelector('[class*="JobPostingHeader"]') ||
      document.querySelector('[class*="JobPostingDescription"]') ||
      document.querySelector('[data-testid="job-description"]') ||
      document.querySelector('[data-testid="job-posting-title"]') ||
      document.querySelector('.ashby-job-posting-description') ||
      document.querySelector('meta[name="ashby-job-id"]') ||
      document.querySelector('form[action*="ashbyhq.com"]')
    );
  }

  scrape(url: string, document: Document): JobPosting | null {
    try {
      // 1. Job Title
      const titleEl =
        document.querySelector('[data-testid="job-posting-title"]') ||
        document.querySelector('[class*="JobPostingHeader_title"]') ||
        document.querySelector('[class*="JobPostingHeader"] h1') ||
        document.querySelector('[class*="_titleContainer_"] h1') ||
        document.querySelector('h1[class*="title"]') ||
        document.querySelector('h1');

      let title = cleanText(titleEl?.textContent) || '';
      if (!title || title.length < 2) {
        title = document.title.split(/[-|–—]/)[0]?.trim() || 'Ashby Job Posting';
      }

      // 2. Company Name
      let company = '';
      const match = url.match(/jobs\.ashbyhq\.com\/([^/?#]+)/i) || url.match(/ashbyhq\.com\/([^/?#]+)/i);
      if (match && match[1]) {
        const rawSlug = match[1].replace(/[-_]/g, ' ');
        company = rawSlug.replace(/\b\w/g, (c) => c.toUpperCase());
        if (company.toLowerCase() === 'openai') company = 'OpenAI';
      }

      const companyEl =
        document.querySelector('[class*="JobPostingHeader_company"]') ||
        document.querySelector('[data-testid="job-posting-company"]') ||
        document.querySelector('img[alt*="logo" i]') ||
        document.querySelector('meta[property="og:site_name"]');

      if (companyEl) {
        if (companyEl.tagName.toLowerCase() === 'img') {
          const alt = companyEl.getAttribute('alt') || '';
          const cleanedAlt = alt.replace(/logo/i, '').trim();
          if (cleanedAlt) company = cleanedAlt;
        } else if (companyEl.tagName.toLowerCase() === 'meta') {
          company = companyEl.getAttribute('content') || company;
        } else {
          company = cleanText(companyEl.textContent) || company;
        }
      }

      if (!company || company.length < 2) {
        const titleParts = document.title.split(/ at |[-|–—]/i);
        if (titleParts.length > 1) {
          const candidate = titleParts[titleParts.length - 1].trim();
          if (!candidate.toLowerCase().includes('ashby')) {
            company = candidate;
          }
        }
      }
      company = company || 'Unknown Company';

      // 3. Location & Workplace Type
      const locationEl =
        document.querySelector('[data-testid="job-location"]') ||
        document.querySelector('[class*="JobPostingHeader_location"]') ||
        document.querySelector('[class*="_locationContainer_"]') ||
        document.querySelector('div[class*="location"]') ||
        document.querySelector('span[class*="location"]');

      let locationRaw = cleanText(locationEl?.textContent) || '';

      // If location wasn't in specific selector, check details container
      if (!locationRaw) {
        const detailsEl = document.querySelector('[class*="_details_"]');
        if (detailsEl) {
          const spans = detailsEl.querySelectorAll('span');
          if (spans.length > 0) {
            locationRaw = cleanText(spans[0]?.textContent) || '';
          }
        }
      }

      // 4. Remote Status
      let remoteStatus: JobPosting['remoteStatus'] = 'Unspecified';
      const bodyText = (document.body?.innerText || document.body?.textContent || '').toLowerCase();
      const combinedText = (locationRaw + ' ' + bodyText).toLowerCase();
      if (combinedText.includes('remote')) {
        remoteStatus = 'Remote';
      } else if (combinedText.includes('hybrid')) {
        remoteStatus = 'Hybrid';
      } else if (combinedText.includes('on-site') || combinedText.includes('onsite') || combinedText.includes('in-person')) {
        remoteStatus = 'On-site';
      }

      // 5. Department / Employment Type Metadata
      const qualifications: string[] = [];
      const deptEl =
        document.querySelector('[data-testid="job-department"]') ||
        document.querySelector('[class*="JobPostingHeader_department"]') ||
        document.querySelector('[class*="JobPostingHeader_team"]');
      if (deptEl && deptEl.textContent) {
        qualifications.push(`Department: ${cleanText(deptEl.textContent)}`);
      }

      const employmentTypeEl =
        document.querySelector('[data-testid="job-employment-type"]') ||
        document.querySelector('[class*="JobPostingHeader_employmentType"]');
      if (employmentTypeEl && employmentTypeEl.textContent) {
        qualifications.push(`Employment Type: ${cleanText(employmentTypeEl.textContent)}`);
      }

      // 6. Job Description
      const descEl =
        document.querySelector('[data-testid="job-description"]') ||
        document.querySelector('[class*="JobPostingDescription"]') ||
        document.querySelector('[class*="_description_"]') ||
        document.querySelector('[class*="JobPosting_description"]') ||
        document.querySelector('.ashby-job-posting-description') ||
        document.querySelector('#job-description');

      const description = cleanText(descEl?.textContent || (descEl as HTMLElement)?.innerText) || '';

      if (!description || description.length < 50) {
        return null;
      }

      // 7. Skills extraction
      const skills = extractSkillsFromText(title + ' ' + description);

      return {
        id: 'ashby_' + Math.random().toString(36).substring(2, 9),
        title,
        company,
        location: locationRaw || undefined,
        remoteStatus,
        description,
        requiredSkills: skills,
        qualifications: qualifications.length > 0 ? qualifications : undefined,
        url,
        source: 'ashby',
        scrapedAt: new Date().toISOString(),
      };
    } catch (err) {
      console.error('[RezBuilder] Error scraping Ashby:', err);
      return null;
    }
  }
}
