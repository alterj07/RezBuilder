import { JobScraper } from './scraperInterface';
import { JobPosting } from '../../types/job';
import { cleanText, extractSkillsFromText } from './keywordExtractor';

export class WorkdayScraper implements JobScraper {
  name = 'Workday';

  canHandle(url: string, document: Document): boolean {
    if (url.includes('myworkdayjobs.com')) return true;
    return !!(
      document.querySelector('[data-automation-id="jobPostingHeader"]') ||
      document.querySelector('[data-automation-id="jobPostingPage"]') ||
      document.querySelector('[data-automation-id="jobPostingDescription"]') ||
      document.querySelector('[data-automation-id="job-posting-details"]') ||
      document.querySelector('meta[name="workday-site"]')
    );
  }

  scrape(url: string, document: Document): JobPosting | null {
    try {
      // 1. Job Title
      const titleEl =
        document.querySelector('[data-automation-id="jobPostingHeader"]') ||
        document.querySelector('h2[data-automation-id="jobPostingTitle"]') ||
        document.querySelector('[data-automation-id="jobPostingTitle"]') ||
        document.querySelector('h1[data-automation-id="jobPostingHeader"]') ||
        document.querySelector('h1');

      let title = cleanText(titleEl?.textContent) || '';
      if (!title || title.length < 2) {
        title = document.title.split(/[-|–—]/)[0]?.trim() || 'Workday Job Posting';
      }

      // 2. Company Name
      let company = '';
      try {
        const parsedUrl = new URL(url);
        const hostParts = parsedUrl.hostname.split('.');
        if (parsedUrl.hostname.includes('myworkdayjobs.com')) {
          // Check if subdomain structure like [company].wd5.myworkdayjobs.com or [company].myworkdayjobs.com
          if (hostParts.length >= 3) {
            const first = hostParts[0];
            if (/^wd\d+$/i.test(first) && hostParts.length >= 4) {
              // rare case wd5.company.myworkdayjobs.com
              company = hostParts[1];
            } else {
              company = first;
            }
          }
        }
      } catch {
        // ignore url parse errors
      }

      const companyEl =
        document.querySelector('[data-automation-id="companyName"]') ||
        document.querySelector('img[data-automation-id="clientLogo"]') ||
        document.querySelector('meta[property="og:site_name"]');

      if (companyEl) {
        if (companyEl.tagName.toLowerCase() === 'img') {
          const alt = companyEl.getAttribute('alt') || '';
          if (alt) company = alt.replace(/logo/i, '').trim();
        } else if (companyEl.tagName.toLowerCase() === 'meta') {
          company = companyEl.getAttribute('content') || company;
        } else {
          company = cleanText(companyEl.textContent) || company;
        }
      }

      if (!company || company.length < 2) {
        const titleParts = document.title.split(/[-|–—]/);
        if (titleParts.length > 1) {
          for (let i = 1; i < titleParts.length; i++) {
            const candidate = titleParts[i].trim();
            const lower = candidate.toLowerCase();
            if (!lower.includes('workday') && !lower.includes('careers') && !lower.includes('job') && candidate.length > 1) {
              company = candidate;
              break;
            }
          }
          if (!company && titleParts.length > 1) {
            company = titleParts[titleParts.length - 1].replace(/careers/i, '').trim();
          }
        }
      }

      if (company) {
        company = company
          .replace(/[-_]/g, ' ')
          .replace(/\b\w/g, (c) => c.toUpperCase())
          .replace(/\s+Careers$/i, '')
          .trim();
      }
      company = company || 'Unknown Company';

      // 3. Location
      const locationEl =
        document.querySelector('[data-automation-id="locations"]') ||
        document.querySelector('[data-automation-id="jobPostingLocation"]') ||
        document.querySelector('dd[data-automation-id="jobPostingLocation"]') ||
        document.querySelector('[data-automation-id="workLocation"]') ||
        document.querySelector('[data-automation-id="location"]');

      const locationRaw = cleanText(locationEl?.textContent) || '';

      // 4. Remote Status
      let remoteStatus: JobPosting['remoteStatus'] = 'Unspecified';
      const bodyText = (document.body?.innerText || document.body?.textContent || '').toLowerCase();
      const combinedText = (locationRaw + ' ' + bodyText).toLowerCase();
      if (combinedText.includes('remote') || combinedText.includes('home-based') || combinedText.includes('virtual')) {
        remoteStatus = 'Remote';
      } else if (combinedText.includes('hybrid')) {
        remoteStatus = 'Hybrid';
      } else if (combinedText.includes('on-site') || combinedText.includes('onsite') || combinedText.includes('in-office')) {
        remoteStatus = 'On-site';
      }

      // 5. Job Description
      const descEl =
        document.querySelector('[data-automation-id="jobPostingDescription"]') ||
        document.querySelector('[data-automation-id="job-posting-details"]') ||
        document.querySelector('[data-automation-id="jobPostingInformation"]') ||
        document.querySelector('#job-description');

      const description = cleanText(descEl?.textContent || (descEl as HTMLElement)?.innerText) || '';

      if (!description || description.length < 50) {
        return null;
      }

      // 6. Qualifications / Requisition Metadata
      const qualifications: string[] = [];
      const reqIdEl =
        document.querySelector('[data-automation-id="jobPostingId"]') ||
        document.querySelector('[data-automation-id="requisitionId"]') ||
        document.querySelector('dd[data-automation-id="jobPostingId"]');
      if (reqIdEl && reqIdEl.textContent) {
        qualifications.push(`Requisition ID: ${cleanText(reqIdEl.textContent)}`);
      }

      const postedDateEl =
        document.querySelector('[data-automation-id="postedOn"]') ||
        document.querySelector('[data-automation-id="jobPostingDate"]') ||
        document.querySelector('dd[data-automation-id="postedOn"]');
      if (postedDateEl && postedDateEl.textContent) {
        qualifications.push(`Posted: ${cleanText(postedDateEl.textContent)}`);
      }

      // 7. Skills extraction
      const skills = extractSkillsFromText(title + ' ' + description);

      return {
        id: 'wd_' + Math.random().toString(36).substring(2, 9),
        title,
        company,
        location: locationRaw || undefined,
        remoteStatus,
        description,
        requiredSkills: skills,
        qualifications: qualifications.length > 0 ? qualifications : undefined,
        url,
        source: 'workday',
        scrapedAt: new Date().toISOString(),
      };
    } catch (err) {
      console.error('[RezBuilder] Error scraping Workday:', err);
      return null;
    }
  }
}
