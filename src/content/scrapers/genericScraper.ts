import { JobScraper } from './scraperInterface';
import { JobPosting } from '../../types/job';
import { cleanText, extractSkillsFromText } from './keywordExtractor';

export class GenericScraper implements JobScraper {
  name = 'Generic Job Scraper';

  canHandle(_url: string, document: Document): boolean {
    // Check if the page has characteristics of a job posting
    const text = (document.body?.innerText || '').toLowerCase();
    const hasJobKeywords =
      (text.includes('requirements') || text.includes('qualifications') || text.includes('responsibilities') || text.includes('about the role') || text.includes('what you will do')) &&
      (text.includes('apply') || text.includes('submit application') || text.includes('job description') || text.includes('full-time') || text.includes('experience'));
    
    return hasJobKeywords;
  }

  scrape(url: string, document: Document): JobPosting | null {
    try {
      // 1. Job Title
      const titleSelectors = [
        '[class*="job-title"]',
        '[class*="jobTitle"]',
        '[class*="posting-title"]',
        '[class*="role-title"]',
        '[id*="job-title"]',
        'h1',
        'h2'
      ];
      let title = '';
      for (const sel of titleSelectors) {
        const el = document.querySelector(sel);
        if (el && el.textContent && el.textContent.trim().length > 3 && el.textContent.trim().length < 100) {
          title = cleanText(el.textContent);
          break;
        }
      }
      if (!title) {
        title = document.title.split(/[-|–—]/)[0]?.trim() || 'Job Posting';
      }

      // 2. Company Name
      const companyMeta =
        document.querySelector('meta[property="og:site_name"]')?.getAttribute('content') ||
        document.querySelector('meta[name="author"]')?.getAttribute('content');
      let company = companyMeta || '';
      if (!company) {
        const titleParts = document.title.split(/[-|–—]/);
        if (titleParts.length > 1) {
          company = titleParts[titleParts.length - 1].trim();
        } else {
          try {
            const parsedUrl = new URL(url);
            company = parsedUrl.hostname.replace('www.', '').split('.')[0];
            company = company.charAt(0).toUpperCase() + company.slice(1);
          } catch {
            company = 'Company';
          }
        }
      }

      // 3. Job Description Container
      const descSelectors = [
        '[class*="job-description"]',
        '[class*="jobDescription"]',
        '[class*="posting-body"]',
        '[id*="job-description"]',
        '[id*="jobDescription"]',
        'article',
        'main',
        '.content',
        '#content'
      ];

      let description = '';
      for (const sel of descSelectors) {
        const el = document.querySelector(sel);
        if (el) {
          const txt = cleanText((el as HTMLElement).innerText || el.textContent);
          if (txt.length > 150) {
            description = txt;
            break;
          }
        }
      }

      if (!description || description.length < 100) {
        // Fallback to body text with basic cleanup
        description = cleanText(document.body.innerText || '');
        if (description.length > 5000) {
          description = description.substring(0, 5000);
        }
      }

      if (!description || description.length < 100) {
        return null;
      }

      // 4. Remote Status
      let remoteStatus: JobPosting['remoteStatus'] = 'Unspecified';
      const textLower = (title + ' ' + description).toLowerCase();
      if (textLower.includes('remote')) {
        remoteStatus = 'Remote';
      } else if (textLower.includes('hybrid')) {
        remoteStatus = 'Hybrid';
      } else if (textLower.includes('on-site') || textLower.includes('onsite')) {
        remoteStatus = 'On-site';
      }

      // 5. Skills
      const skills = extractSkillsFromText(title + ' ' + description);

      return {
        id: 'gen_' + Math.random().toString(36).substring(2, 9),
        title,
        company,
        remoteStatus,
        description,
        requiredSkills: skills,
        url,
        source: 'generic',
        scrapedAt: new Date().toISOString(),
      };
    } catch (err) {
      console.error('[RezBuilder] Error in generic scraper:', err);
      return null;
    }
  }
}
