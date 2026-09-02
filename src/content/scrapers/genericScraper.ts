import { JobScraper } from './scraperInterface';
import { JobPosting } from '../../types/job';
import { cleanText, extractSkillsFromText } from './keywordExtractor';
import { extractJobPostingSchema, jobClassifier } from '../detection/jobClassifier';
import { SchemaJobPosting } from '../../types/detection';

export class GenericScraper implements JobScraper {
  name = 'Generic Job Scraper';

  canHandle(url: string, document: Document): boolean {
    // 1. Fail fast on negative veto (educational, docs, courses, blogs, code repos)
    const vetoResult = jobClassifier.evaluateNegativeVeto(url, document);
    if (vetoResult.vetoed) {
      return false;
    }

    // 2. Accept if valid Schema.org JobPosting structured data is present
    const schema = extractJobPostingSchema(document);
    if (schema && schema.title && schema.description && schema.description.length >= 50) {
      return true;
    }

    // 3. Reject articles marked with og:type="article"
    const ogType = document.querySelector('meta[property="og:type"]')?.getAttribute('content');
    if (ogType === 'article') {
      return false;
    }

    // 4. Positive structural requirement: Must have an application affordance or job description container
    const hasApplyAffordance = !!(
      document.querySelector('a[href*="apply" i]') ||
      document.querySelector('button[id*="apply" i]') ||
      document.querySelector('button[class*="apply" i]') ||
      document.querySelector('[data-testid*="apply" i]') ||
      document.querySelector('input[type="file"][accept*="pdf" i]') ||
      document.querySelector('input[name*="resume" i]') ||
      document.querySelector('form[action*="apply" i]') ||
      document.querySelector('form#application_form') ||
      document.querySelector('#submit_app')
    );

    const hasJobContainer = !!(
      document.querySelector('[class*="job-description" i]') ||
      document.querySelector('[class*="jobDescription" i]') ||
      document.querySelector('[id*="job-description" i]') ||
      document.querySelector('[id*="jobDescription" i]') ||
      document.querySelector('[class*="posting-body" i]') ||
      document.querySelector('[class*="posting-sections" i]') ||
      document.querySelector('[itemprop="description"]')
    );

    if (!hasApplyAffordance && !hasJobContainer) {
      return false;
    }

    // 5. Contextual keyword requirement
    const text = (document.body?.innerText || document.body?.textContent || '').toLowerCase();
    const hasRoleKeywords =
      text.includes('requirements') ||
      text.includes('qualifications') ||
      text.includes('responsibilities') ||
      text.includes('about the role') ||
      text.includes('what you will do') ||
      text.includes("what you'll do");

    const hasApplyKeywords =
      text.includes('apply') ||
      text.includes('submit application') ||
      text.includes('job description') ||
      text.includes('employment type') ||
      text.includes('compensation') ||
      text.includes('full-time');

    return hasRoleKeywords && hasApplyKeywords;
  }

  scrape(url: string, document: Document, schemaOverride?: SchemaJobPosting): JobPosting | null {
    try {
      // 1. Try extracting from Schema.org JSON-LD structured data first
      const schemaData = schemaOverride || extractJobPostingSchema(document);
      if (schemaData && schemaData.title && schemaData.description && schemaData.description.length >= 50) {
        const title = schemaData.title;
        const description = schemaData.description;
        const company =
          schemaData.hiringOrganization ||
          document.title.split(/[-|–—]/)[0]?.trim() ||
          'Company';

        let location: string | undefined = undefined;
        if (schemaData.jobLocation) {
          const loc = schemaData.jobLocation;
          location = [loc.addressLocality, loc.addressRegion, loc.addressCountry]
            .filter(Boolean)
            .join(', ');
        }

        let remoteStatus: JobPosting['remoteStatus'] = 'Unspecified';
        const combinedText = (title + ' ' + description).toLowerCase();
        if (combinedText.includes('remote')) {
          remoteStatus = 'Remote';
        } else if (combinedText.includes('hybrid')) {
          remoteStatus = 'Hybrid';
        } else if (combinedText.includes('on-site') || combinedText.includes('onsite')) {
          remoteStatus = 'On-site';
        }

        const skills = extractSkillsFromText(title + ' ' + description);

        return {
          id: 'gen_' + Math.random().toString(36).substring(2, 9),
          title,
          company,
          location: location || undefined,
          remoteStatus,
          description,
          requiredSkills: skills,
          url,
          source: 'generic',
          scrapedAt: new Date().toISOString(),
        };
      }

      // 2. DOM extraction fallback
      const titleSelectors = [
        '[class*="job-title" i]',
        '[class*="jobTitle" i]',
        '[class*="posting-title" i]',
        '[class*="role-title" i]',
        '[id*="job-title" i]',
        'h1',
        'h2',
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
        title = document.title.split(/[-|–—]/)[0]?.trim() || 'Job Posting';
      }

      // 3. Company Name
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

      // 4. Job Description Container
      const descSelectors = [
        '[class*="job-description" i]',
        '[class*="jobDescription" i]',
        '[class*="posting-body" i]',
        '[id*="job-description" i]',
        '[id*="jobDescription" i]',
        '[itemprop="description"]',
        'article',
        'main',
        '.content',
        '#content',
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
        description = cleanText(document.body?.innerText || document.body?.textContent || '');
        if (description.length > 5000) {
          description = description.substring(0, 5000);
        }
      }

      if (!description || description.length < 100) {
        return null;
      }

      // 5. Remote Status
      let remoteStatus: JobPosting['remoteStatus'] = 'Unspecified';
      const textLower = (title + ' ' + description).toLowerCase();
      if (textLower.includes('remote')) {
        remoteStatus = 'Remote';
      } else if (textLower.includes('hybrid')) {
        remoteStatus = 'Hybrid';
      } else if (textLower.includes('on-site') || textLower.includes('onsite')) {
        remoteStatus = 'On-site';
      }

      // 6. Skills extraction
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
