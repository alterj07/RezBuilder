import {
  ClassificationResult,
  ConfidenceTier,
  SchemaJobPosting,
  SignalDetail,
} from '../../types/detection';
import { cleanText } from '../scrapers/keywordExtractor';

export const NEGATIVE_URL_PATTERNS: { id: string; pattern: RegExp; reason: string }[] = [
  // 1. Educational, Course & Learning Platforms
  {
    id: 'VETO_URL_LEARNING_DOMAIN',
    pattern: /(?:^|\.)(?:algomaster\.io|leetcode\.com\/(?:problems|explore|contest)|coursera\.org|udemy\.com|edx\.org|pluralsight\.com|freecodecamp\.org|codecademy\.com|khanacademy\.org|educative\.io|frontendmentor\.io|hackerrank\.com\/challenges|geeksforgeeks\.org)/i,
    reason: 'Educational, competitive programming, or course platform domain',
  },
  {
    id: 'VETO_URL_LEARNING_PATH',
    pattern: /\/(?:learn|course|courses|tutorial|tutorials|lesson|lessons|syllabus|curriculum|classrooms?|exercises?|problem-sets?)\b/i,
    reason: 'Course, tutorial, or learning path URL segment',
  },
  {
    id: 'VETO_URL_SYSTEM_DESIGN_PREP',
    pattern: /\/(?:system-design|interview-prep|coding-interview|algo-patterns|cheat-sheet|solutions?)\b/i,
    reason: 'Interview prep, system design guide, or solution URL segment',
  },

  // 2. Documentation, Encyclopedias & Reference
  {
    id: 'VETO_URL_DOCS_DOMAIN',
    pattern: /(?:^|\.)(?:developer\.mozilla\.org|w3schools\.com|wikipedia\.org|wikimedia\.org|devdocs\.io|readthedocs\.io|gitbook\.io|pkg\.go\.dev|caniuse\.com)/i,
    reason: 'Technical documentation, reference, or encyclopedia domain',
  },
  {
    id: 'VETO_URL_DOCS_PATH',
    pattern: /\/(?:docs|documentation|reference|manual|api-reference|api-docs|guides?|cheatsheets?|rfc|spec|specification)\b/i,
    reason: 'Documentation or API reference path',
  },

  // 3. Code Repositories, Issue Trackers & Developer Q&A
  {
    id: 'VETO_URL_CODE_REPO',
    pattern: /(?:github\.com|gitlab\.com|bitbucket\.org)\/[^/]+\/[^/]+\/(?:issues|pull|pulls|commit|commits|blob|tree|releases|wiki|actions|projects|branches|tags)/i,
    reason: 'Code repository issue, PR, commit, or file view',
  },
  {
    id: 'VETO_URL_QA_COMMUNITY',
    pattern: /(?:stackoverflow\.com\/questions|stackexchange\.com\/questions|serverfault\.com\/questions|superuser\.com\/questions|reddit\.com\/r\/[^/]+\/comments)/i,
    reason: 'Q&A forum question or discussion thread',
  },

  // 4. Blogs, News, Media & Articles
  {
    id: 'VETO_URL_BLOG_DOMAIN',
    pattern: /(?:medium\.com|dev\.to|hashnode\.dev|substack\.com|news\.ycombinator\.com\/item|nytimes\.com|theverge\.com|techcrunch\.com)/i,
    reason: 'Blog, newsletter, social news aggregator, or media publication domain',
  },
  {
    id: 'VETO_URL_BLOG_PATH',
    pattern: /\/(?:blog|blogs|articles?|posts?|news|press|stories|story|opinion|insights)\b/i,
    reason: 'Blog post, news article, or press release path',
  },

  // 5. Commerce, Search, Legal & Account Portals
  {
    id: 'VETO_URL_COMMERCE_LEGAL',
    pattern: /\/(?:cart|checkout|pricing|billing|subscription|privacy-policy|terms-of-service|terms-and-conditions|cookie-policy|search\?|explore\?|tags?\/|categories?\/)\b/i,
    reason: 'Checkout, pricing, legal terms, or generic search query',
  },
];

export const NEGATIVE_DOM_SELECTORS: { id: string; selector: string; reason: string }[] = [
  // 1. Article & Editorial Metadata
  {
    id: 'VETO_DOM_ARTICLE_META',
    selector: 'meta[property="article:published_time"], .author-bio, .byline, .post-date, .reading-time, [class*="reading-time"], [class*="min-read"], [class*="lesson-meta"], .lesson-meta',
    reason: 'Blog article or publication author/reading-time metadata',
  },
  // 2. Course Syllabus & Educational Navigation
  {
    id: 'VETO_DOM_COURSE_NAV',
    selector: '.course-syllabus, .syllabus, .curriculum, .table-of-contents, #table-of-contents, .toc-wrapper, nav.toc, nav[aria-label*="Table of contents" i], .curriculum-sidebar, .lecture-list, .chapter-list, .module-list, #toc',
    reason: 'Course syllabus, table of contents, or lecture list',
  },
  // 3. Code Runners & Competitive Problem Statement
  {
    id: 'VETO_DOM_CODE_RUNNER',
    selector: '.monaco-editor, .ace_editor, .code-runner, .problem-statement, .testcase-container, [data-cy="question-title"], #question-header, .repohead',
    reason: 'Interactive code editor, playground, or coding problem statement',
  },
  // 4. Discussion & Comment Threads
  {
    id: 'VETO_DOM_COMMENTS',
    selector: '#disqus_thread, .comment-thread, .post-comments, .comments-area, #comments-list, .comments-section, .answers',
    reason: 'Public discussion/comment section',
  },
  // 5. E-Commerce & Course Enrollment
  {
    id: 'VETO_DOM_ECOMMERCE',
    selector: 'button[name="add-to-cart"], .add-to-cart, .product-price, .shopping-cart, form.cart, .enroll-btn',
    reason: 'E-commerce shopping cart, product purchase form, or course enrollment button',
  },
];

const KNOWN_ATS_HOSTS = [
  'boards.greenhouse.io',
  'jobs.lever.co',
  'myworkdayjobs.com',
  'jobs.ashbyhq.com',
  'ashbyhq.com',
  'smartrecruiters.com',
  'linkedin.com',
  'indeed.com',
  'ziprecruiter.com',
  'wellfound.com',
  'bamboohr.com',
  'taleo.net',
  'icims.com',
  'jobvite.com',
  'workable.com',
  'rippling.com',
];

/**
 * Extracts and normalizes Schema.org JobPosting structured data from <script type="application/ld+json"> tags.
 */
export function extractJobPostingSchema(document: Document): SchemaJobPosting | null {
  const scripts = document.querySelectorAll('script[type="application/ld+json"]');
  if (!scripts || scripts.length === 0) return null;

  for (const script of Array.from(scripts)) {
    const raw = script.textContent?.trim();
    if (!raw) continue;

    try {
      const data = JSON.parse(raw);
      const posting = findJobPostingNode(data);
      if (posting) {
        return sanitizeSchemaPosting(posting);
      }
    } catch {
      // Ignore malformed JSON-LD scripts
    }
  }

  return null;
}

function findJobPostingNode(node: any): any | null {
  if (!node || typeof node !== 'object') return null;

  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findJobPostingNode(item);
      if (found) return found;
    }
    return null;
  }

  const type = node['@type'];
  if (
    type === 'JobPosting' ||
    (Array.isArray(type) && type.includes('JobPosting')) ||
    (typeof type === 'string' && type.toLowerCase().endsWith('jobposting'))
  ) {
    return node;
  }

  if (node['@graph'] && Array.isArray(node['@graph'])) {
    return findJobPostingNode(node['@graph']);
  }

  return null;
}

function sanitizeSchemaPosting(node: any): SchemaJobPosting {
  let hiringOrg = '';
  if (typeof node.hiringOrganization === 'string') {
    hiringOrg = node.hiringOrganization;
  } else if (node.hiringOrganization && typeof node.hiringOrganization === 'object') {
    hiringOrg = node.hiringOrganization.name || '';
  }

  let description = '';
  if (typeof node.description === 'string') {
    description = node.description.replace(/<[^>]*>/g, ' ');
  }

  let jobLocation: SchemaJobPosting['jobLocation'] = undefined;
  if (node.jobLocation) {
    if (typeof node.jobLocation === 'string') {
      jobLocation = { addressLocality: node.jobLocation };
    } else if (node.jobLocation.address) {
      const addr = node.jobLocation.address;
      if (typeof addr === 'string') {
        jobLocation = { addressLocality: addr };
      } else {
        jobLocation = {
          addressLocality: addr.addressLocality,
          addressRegion: addr.addressRegion,
          addressCountry: addr.addressCountry,
          streetAddress: addr.streetAddress,
        };
      }
    }
  }

  let baseSalary: SchemaJobPosting['baseSalary'] = undefined;
  if (node.baseSalary && typeof node.baseSalary === 'object') {
    const s = node.baseSalary;
    const val = s.value && typeof s.value === 'object' ? s.value : s;
    baseSalary = {
      currency: s.currency,
      minValue: val.minValue,
      maxValue: val.maxValue,
      unitText: val.unitText,
      value: typeof val.value === 'number' ? val.value : undefined,
    };
  }

  return {
    title: typeof node.title === 'string' ? cleanText(node.title) : undefined,
    hiringOrganization: hiringOrg ? cleanText(hiringOrg) : undefined,
    description: description ? cleanText(description) : undefined,
    datePosted: typeof node.datePosted === 'string' ? node.datePosted : undefined,
    validThrough: typeof node.validThrough === 'string' ? node.validThrough : undefined,
    employmentType: node.employmentType,
    jobLocation,
    baseSalary,
    directApply: node.directApply === true || node.directApply === 'true',
  };
}

export class JobClassifier {
  /**
   * Evaluates whether a given URL and document represent a genuine job posting.
   * Returns a complete ClassificationResult with score, confidence tier, and signal details.
   */
  public classify(url: string, document: Document): ClassificationResult {
    const details: SignalDetail[] = [];
    const positiveSignals: string[] = [];

    // Step 1: Negative Veto Evaluation (O(1) fast-reject for educational/docs/courses)
    const vetoResult = this.evaluateNegativeVeto(url, document);
    if (vetoResult.vetoed) {
      return {
        isJobPage: false,
        score: 0,
        confidence: 'none',
        positiveSignals: [],
        negativeSignals: vetoResult.reasons,
        details: [],
      };
    }

    // Step 2: Schema.org Structured Data Parsing
    const schema = extractJobPostingSchema(document);
    let matchedPlatform: string | undefined = undefined;

    if (schema && schema.title && schema.description && schema.description.length >= 50) {
      details.push({
        id: 'SIG_SCHEMA_ORG',
        name: 'Schema.org JobPosting Structured Data',
        weight: 70,
        matched: true,
        evidence: `Title: ${schema.title}, Org: ${schema.hiringOrganization || 'N/A'}`,
      });
      positiveSignals.push('SCHEMA_ORG_JOB_POSTING');
    }

    // Step 3: Positive DOM Structural Signals
    const domSignals = this.extractDOMSignals(url, document);
    for (const sig of domSignals.signals) {
      if (sig.matched) {
        details.push(sig);
        positiveSignals.push(sig.id);
      }
    }
    if (domSignals.matchedPlatform) {
      matchedPlatform = domSignals.matchedPlatform;
    }

    // Step 4: Calculate Normalized Score & Confidence Tier
    const rawScore = details.reduce((acc, sig) => acc + (sig.matched ? sig.weight : 0), 0);
    const score = Math.min(100, rawScore);

    let confidence: ConfidenceTier = 'none';
    if (score >= 80) confidence = 'high';
    else if (score >= 65) confidence = 'medium';
    else if (score >= 35) confidence = 'low';

    const isJobPage = score >= 65;

    return {
      isJobPage,
      score,
      confidence,
      positiveSignals,
      negativeSignals: [],
      matchedPlatform,
      schemaJobPosting: schema || undefined,
      details,
    };
  }

  public evaluateNegativeVeto(
    url: string,
    document: Document
  ): { vetoed: boolean; reasons: string[] } {
    const reasons: string[] = [];

    // URL Veto Patterns
    for (const rule of NEGATIVE_URL_PATTERNS) {
      if (rule.pattern.test(url)) {
        reasons.push(`${rule.id}: ${rule.reason}`);
      }
    }

    // DOM Veto Selectors
    for (const rule of NEGATIVE_DOM_SELECTORS) {
      if (document.querySelector(rule.selector)) {
        reasons.push(`${rule.id}: ${rule.reason}`);
      }
    }

    return {
      vetoed: reasons.length > 0,
      reasons,
    };
  }

  private extractDOMSignals(
    url: string,
    document: Document
  ): { signals: SignalDetail[]; matchedPlatform?: string } {
    const signals: SignalDetail[] = [];
    let matchedPlatform: string | undefined = undefined;

    // 1. SIG_KNOWN_ATS_URL (+25)
    let isKnownAts = false;
    let detectedAtsName: string | undefined = undefined;

    for (const host of KNOWN_ATS_HOSTS) {
      if (url.includes(host)) {
        if (host === 'linkedin.com' && !url.includes('/jobs/view/') && !url.includes('/jobs/collections/')) {
          continue; // general LinkedIn feed/profile is not ATS
        }
        if (host === 'indeed.com' && !url.includes('/viewjob') && !url.includes('/rc/clk')) {
          continue; // general Indeed search is not specific job
        }
        isKnownAts = true;
        detectedAtsName = host;
        break;
      }
    }

    if (!isKnownAts) {
      const careerPathRegex = /\/(?:careers?|jobs?)\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+/i;
      if (careerPathRegex.test(url)) {
        isKnownAts = true;
        detectedAtsName = 'CareerPortal';
      }
    }

    if (isKnownAts) {
      matchedPlatform = detectedAtsName;
      signals.push({
        id: 'SIG_KNOWN_ATS_URL',
        name: 'Known ATS Domain / Pattern',
        weight: 25,
        matched: true,
        evidence: `Matched host/pattern: ${detectedAtsName}`,
      });
    }

    // 2. SIG_APPLY_CTA (+25)
    const applyCtaSelectors = [
      'a[href*="apply" i]',
      'button[id*="apply" i]',
      'button[class*="apply" i]',
      '[data-automation-id*="apply" i]',
      '[data-testid*="apply" i]',
      '.jobs-apply-button',
      '#indeedApplyButton',
      '.postings-btn',
      '[class*="applyButton" i]',
      '[class*="apply-button" i]',
    ];
    let hasApplyCta = false;
    let applyCtaEvidence = '';

    for (const sel of applyCtaSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        hasApplyCta = true;
        applyCtaEvidence = `Selector: ${sel}`;
        break;
      }
    }

    if (!hasApplyCta) {
      // Check buttons or links for exact apply text
      const clickableElements = document.querySelectorAll('button, a, [role="button"]');
      const applyTextRegex = /^\s*(?:apply(?:\s+(?:now|for\s+(?:this\s+)?(?:job|role)|online|with\s+linkedin|with\s+resume|today))?|easy\s+apply|submit\s+application|start\s+application)\s*$/i;
      for (const el of Array.from(clickableElements)) {
        const text = el.textContent?.trim() || '';
        if (applyTextRegex.test(text)) {
          hasApplyCta = true;
          applyCtaEvidence = `Text: "${text}"`;
          break;
        }
      }
    }

    if (hasApplyCta) {
      signals.push({
        id: 'SIG_APPLY_CTA',
        name: 'Apply Button / CTA Link',
        weight: 25,
        matched: true,
        evidence: applyCtaEvidence,
      });
    }

    // 3. SIG_APP_FORM_RESUME (+25)
    const formResumeSelectors = [
      'input[type="file"][name*="resume" i]',
      'input[type="file"][id*="resume" i]',
      'input[type="file"][accept*=".pdf" i]',
      'input[type="file"][name*="cv" i]',
      '[data-automation-id*="file-upload"]',
      'form#application_form',
      'form[id*="application" i]',
      'form[action*="apply" i]',
    ];
    let hasFormResume = false;
    let formEvidence = '';

    for (const sel of formResumeSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        hasFormResume = true;
        formEvidence = `Selector: ${sel}`;
        break;
      }
    }

    if (!hasFormResume) {
      const hasFirstName = document.querySelector('input[name*="first_name" i], input[autocomplete="given-name"]');
      const hasLastName = document.querySelector('input[name*="last_name" i], input[autocomplete="family-name"]');
      const hasSubmit = document.querySelector('button[type="submit"], input[type="submit"]');
      if (hasFirstName && hasLastName && hasSubmit) {
        hasFormResume = true;
        formEvidence = 'Candidate name inputs and submit button';
      }
    }

    if (hasFormResume) {
      signals.push({
        id: 'SIG_APP_FORM_RESUME',
        name: 'Application Form / Resume Input',
        weight: 25,
        matched: true,
        evidence: formEvidence,
      });
    }

    // 4. SIG_JOB_DESC_CONTAINER (+20)
    const descContainerSelectors = [
      '#job-details',
      '#jobDescriptionText',
      '.jobs-description__content',
      '[data-automation-id="jobPostingDescription"]',
      '.posting-sections',
      '#content.app-body',
      '.job-description',
      '[class*="job-description" i]',
      '[class*="jobDescription" i]',
      '[id*="job-description" i]',
      '[id*="jobDescription" i]',
      '[class*="JobPostingDescription" i]',
      '[class*="_description_" i]',
      '[data-testid="job-description"]',
      '[itemprop="description"]',
    ];

    let hasDescContainer = false;
    let descEvidence = '';

    for (const sel of descContainerSelectors) {
      const el = document.querySelector(sel);
      if (el && ((el as HTMLElement).innerText || el.textContent || '').trim().length > 50) {
        hasDescContainer = true;
        descEvidence = `Container: ${sel}`;
        break;
      }
    }

    if (!hasDescContainer) {
      const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6, strong, b');
      const jobHeadingRegex = /(?:about\s+the\s+(?:role|job)|responsibilities|what\s+you(?:'ll|\s+will)\s+do|what\s+you\s+will\s+be\s+doing|qualifications|requirements|what\s+we(?:'re|\s+are)\s+looking\s+for|what\s+we\s+need\s+to\s+see|benefits|compensation)/i;
      for (const h of Array.from(headings)) {
        if (jobHeadingRegex.test(h.textContent || '')) {
          hasDescContainer = true;
          descEvidence = `Heading: "${h.textContent?.trim()}"`;
          break;
        }
      }
    }

    if (hasDescContainer) {
      signals.push({
        id: 'SIG_JOB_DESC_CONTAINER',
        name: 'Structured Job Description Container',
        weight: 20,
        matched: true,
        evidence: descEvidence,
      });
    }

    // 5. SIG_JOB_METADATA_CHIPS (+15)
    const chipSelectors = [
      '[data-automation-id="jobPostingLocation"]',
      '[data-automation-id="timeType"]',
      '[data-testid="job-location"]',
      '[data-testid="job-employment-type"]',
      '.posting-categories',
      '.job-details-jobs-unified-top-card__job-insight',
      '.job-details-jobs-unified-top-card__primary-description-container',
      '[data-testid="inlineHeader-companyLocation"]',
      '[class*="_details_" i]',
    ];

    let hasMetadataChips = false;
    let chipEvidence = '';

    for (const sel of chipSelectors) {
      const el = document.querySelector(sel);
      if (el && (el.textContent || '').trim().length > 0) {
        hasMetadataChips = true;
        chipEvidence = `Selector: ${sel}`;
        break;
      }
    }

    if (!hasMetadataChips) {
      const text = (document.body?.innerText || document.body?.textContent || '').substring(0, 3000);
      const chipPattern = /\b(Remote|Hybrid|On-site|Full-time|Full time|Part-time|Part time|Contract|Internship)\b/i;
      const salaryPattern = /\$[0-9]{2,3}(?:,[0-9]{3}|k)\b/i;
      if (chipPattern.test(text) || salaryPattern.test(text)) {
        hasMetadataChips = true;
        chipEvidence = 'Found workplace or compensation chips in header text';
      }
    }

    if (hasMetadataChips) {
      signals.push({
        id: 'SIG_JOB_METADATA_CHIPS',
        name: 'Employment / Compensation / Workplace Chips',
        weight: 15,
        matched: true,
        evidence: chipEvidence,
      });
    }

    // 6. SIG_TITLE_HEURISTIC (+10)
    const titleSelectors = [
      'h1',
      'h2',
      '[class*="job-title" i]',
      '[class*="jobTitle" i]',
      '[class*="posting-title" i]',
      '[class*="posting-headline" i]',
      '[data-automation-id="jobPostingHeader"]',
      '[data-testid="job-posting-title"]',
      '.app-title',
    ];

    const roleRegex = /(?:software|frontend|backend|fullstack|devops|data|ai|cloud|product|engineer|developer|designer|architect|lead|manager|scientist|specialist|analyst|administrator|consultant|director|coordinator)\b/i;
    const learningTitleRegex = /(?:tutorial|course|intro|guide|syllabus|documentation|chapter|lesson|problem\s+statement)/i;

    let hasTitleHeuristic = false;
    let titleEvidence = '';

    for (const sel of titleSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        const titleText = cleanText(el.textContent);
        if (titleText && roleRegex.test(titleText) && !learningTitleRegex.test(titleText)) {
          hasTitleHeuristic = true;
          titleEvidence = `Title: "${titleText}"`;
          break;
        }
      }
    }

    if (hasTitleHeuristic) {
      signals.push({
        id: 'SIG_TITLE_HEURISTIC',
        name: 'Job Title Semantic Pattern',
        weight: 10,
        matched: true,
        evidence: titleEvidence,
      });
    }

    return { signals, matchedPlatform };
  }
}

export const jobClassifier = new JobClassifier();
