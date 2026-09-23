import { JobScraper } from './scraperInterface';
import { JobPosting } from '../../types/job';
import { cleanText, extractSkillsFromText } from './keywordExtractor';
import { extractStructuredDescription } from './structuredDescription';

export class TaleoScraper implements JobScraper {
  name = 'Taleo';

  canHandle(url: string): boolean {
    // Match Taleo career section URLs
    return (
      url.includes('taleo.net') &&
      (url.includes('jobdetail.ftl') || url.includes('jobsearch.ftl'))
    );
  }

  scrape(url: string, document: Document): JobPosting | null {
    try {
      // 1. Job Title - Taleo uses various selectors
      const titleSelectors = [
        'h1',
        '[class*="job-title" i]',
        '[class*="jobTitle" i]',
        '[class*="title" i]',
        '[id*="job-title" i]',
        '.mastercontentpanel3 h1',
        '.title',
        'td.taleo-title',
      ];

      let title = '';
      for (const sel of titleSelectors) {
        const el = document.querySelector(sel);
        if (el && el.textContent && el.textContent.trim().length > 3 && el.textContent.trim().length < 120) {
          title = cleanText(el.textContent);
          break;
        }
      }
      if (!title) {
        title = document.title.split(/[-|–—]/)[0]?.trim() || 'Taleo Job Posting';
      }

      // 2. Company Name - extract from URL or page title
      let company = '';
      try {
        const parsedUrl = new URL(url);
        const hostParts = parsedUrl.hostname.split('.');
        if (hostParts.length >= 2) {
          // Extract subdomain (e.g., hdr from hdr.taleo.net)
          const subdomain = hostParts[0];
          if (subdomain !== 'www' && subdomain !== 'taleo') {
            company = subdomain.charAt(0).toUpperCase() + subdomain.slice(1);
          }
        }
      } catch {
        // ignore URL parse errors
      }

      // Try to get company from meta tags or page elements
      const companyEl =
        document.querySelector('meta[property="og:site_name"]') ||
        document.querySelector('meta[name="author"]') ||
        document.querySelector('[class*="company" i]');

      if (companyEl) {
        if (companyEl.tagName.toLowerCase() === 'meta') {
          const content = companyEl.getAttribute('content');
          if (content) company = content;
        } else {
          const text = cleanText(companyEl.textContent);
          if (text && text.length > 1) company = text;
        }
      }

      // Fallback to title parsing
      if (!company || company.length < 2) {
        const titleParts = document.title.split(/[-|–—]/);
        if (titleParts.length > 1) {
          for (let i = 1; i < titleParts.length; i++) {
            const candidate = titleParts[i].trim();
            const lower = candidate.toLowerCase();
            if (
              !lower.includes('taleo') &&
              !lower.includes('careers') &&
              !lower.includes('job') &&
              !lower.includes('career') &&
              candidate.length > 1
            ) {
              company = candidate;
              break;
            }
          }
        }
      }

      company = company || 'Unknown Company';

      // 3. Location - Taleo uses various location patterns
      const locationSelectors = [
        '[class*="location" i]',
        '[id*="location" i]',
        'td.location',
        '.location-field',
        '[data-field="location"]',
      ];

      let location = '';
      for (const sel of locationSelectors) {
        const el = document.querySelector(sel);
        if (el && el.textContent && el.textContent.trim().length > 2) {
          location = cleanText(el.textContent);
          break;
        }
      }

      // 4. Remote Status
      let remoteStatus: JobPosting['remoteStatus'] = 'Unspecified';
      const bodyText = (document.body?.innerText || document.body?.textContent || '').toLowerCase();
      const combinedText = (title + ' ' + location + ' ' + bodyText).toLowerCase();
      if (combinedText.includes('remote') || combinedText.includes('home-based') || combinedText.includes('virtual')) {
        remoteStatus = 'Remote';
      } else if (combinedText.includes('hybrid')) {
        remoteStatus = 'Hybrid';
      } else if (combinedText.includes('on-site') || combinedText.includes('onsite') || combinedText.includes('in-office')) {
        remoteStatus = 'On-site';
      }

      // 5. Job Description - Taleo description is often in specific containers
      const descSelectors = [
        '[class*="job-description" i]',
        '[class*="jobDescription" i]',
        '[id*="job-description" i]',
        '[id*="jobDescription" i]',
        '.mastercontentpanel3',
        '.jobdescription',
        '#jobdescription',
        '[class*="description" i]',
        '[class*="job-detail" i]',
        'td.description',
        '.description-field',
      ];

      let description = '';
      let sections: JobPosting['sections'] = undefined;

      for (const sel of descSelectors) {
        const el = document.querySelector(sel);
        if (el) {
          const structured = extractStructuredDescription(el);
          if (structured.text.length > 50) {
            description = structured.text;
            sections = structured.sections;
            break;
          }
        }
      }

      // Fallback: try to extract from hidden initialHistory field (some Taleo instances)
      if (!description || description.length < 50) {
        const historyInput = document.querySelector('input[name="initialHistory"]');
        if (historyInput) {
          const historyValue = historyInput.getAttribute('value') || '';
          // Taleo sometimes stores HTML description after !*! marker
          const markerIndex = historyValue.indexOf('!*!');
          if (markerIndex !== -1) {
            const encodedDesc = historyValue.substring(markerIndex + 3);
            // Try to decode URL-encoded content
            try {
              const decoded = decodeURIComponent(encodedDesc);
              const parser = new DOMParser();
              const doc = parser.parseFromString(decoded, 'text/html');
              const structured = extractStructuredDescription(doc.body);
              if (structured.text.length > 50) {
                description = structured.text;
                sections = structured.sections;
              }
            } catch {
              // If decoding fails, use as-is
              if (encodedDesc.length > 50) {
                description = encodedDesc;
              }
            }
          }
        }
      }

      // Final fallback: use the whole body
      if (!description || description.length < 50) {
        const structured = extractStructuredDescription(document.body);
        description = structured.text;
        sections = structured.sections;
      }

      if (!description || description.length < 50) {
        console.warn('[RezBuilder] Taleo scraper could not extract sufficient description');
        return null;
      }

      // 6. Extract metadata (job ID, posted date, etc.)
      const qualifications: string[] = [];

      // Try to find job ID
      const jobIdSelectors = [
        '[class*="job-id" i]',
        '[id*="job-id" i]',
        '[class*="requisition" i]',
        '[id*="requisition" i]',
        'td.job-id',
        '.job-number',
      ];

      for (const sel of jobIdSelectors) {
        const el = document.querySelector(sel);
        if (el && el.textContent && el.textContent.trim().length > 0) {
          const jobId = cleanText(el.textContent);
          if (jobId && !jobId.toLowerCase().includes('job')) {
            qualifications.push(`Job ID: ${jobId}`);
            break;
          }
        }
      }

      // Try to find posted date
      const dateSelectors = [
        '[class*="posted" i]',
        '[id*="posted" i]',
        '[class*="date" i]',
        'td.posted-date',
        '.posting-date',
      ];

      for (const sel of dateSelectors) {
        const el = document.querySelector(sel);
        if (el && el.textContent && el.textContent.trim().length > 0) {
          const dateText = cleanText(el.textContent);
          if (dateText && dateText.length > 5) {
            qualifications.push(`Posted: ${dateText}`);
            break;
          }
        }
      }

      // 7. Skills extraction
      const skills = extractSkillsFromText(title + ' ' + description);

      return {
        id: 'taleo_' + Math.random().toString(36).substring(2, 9),
        title,
        company,
        location: location || undefined,
        remoteStatus,
        description,
        sections,
        requiredSkills: skills,
        qualifications: qualifications.length > 0 ? qualifications : undefined,
        url,
        source: 'taleo',
        scrapedAt: new Date().toISOString(),
      };
    } catch (err) {
      console.error('[RezBuilder] Error scraping Taleo:', err);
      return null;
    }
  }
}
