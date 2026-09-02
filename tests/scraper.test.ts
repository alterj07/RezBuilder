import { describe, it, expect } from 'vitest';
import { extractSkillsFromText, cleanText } from '../src/content/scrapers/keywordExtractor';
import { LinkedInScraper } from '../src/content/scrapers/linkedinScraper';
import { IndeedScraper } from '../src/content/scrapers/indeedScraper';
import { GreenhouseScraper } from '../src/content/scrapers/greenhouseScraper';
import { LeverScraper } from '../src/content/scrapers/leverScraper';
import { GenericScraper } from '../src/content/scrapers/genericScraper';
import { scraperRegistry } from '../src/content/scrapers/scraperRegistry';

describe('Keyword Extractor', () => {
  it('should extract hard skills and technologies accurately', () => {
    const text = `
      We are looking for a Senior Full Stack Engineer proficient in TypeScript, React, Node.js,
      and PostgreSQL. Experience with Docker, Kubernetes, AWS, and GraphQL is required.
      Must be comfortable with Jest or Vitest for unit testing and CI/CD pipelines.
    `;
    const skills = extractSkillsFromText(text);
    expect(skills).toContain('typescript');
    expect(skills).toContain('react');
    expect(skills).toContain('node.js');
    expect(skills).toContain('postgresql');
    expect(skills).toContain('docker');
    expect(skills).toContain('kubernetes');
    expect(skills).toContain('aws');
    expect(skills).toContain('graphql');
    expect(skills).toContain('vitest');
    expect(skills).toContain('ci/cd');
  });

  it('should clean excess whitespace from text', () => {
    const raw = '   Senior    Frontend   Engineer \n\n  \t Remote   ';
    expect(cleanText(raw)).toBe('Senior Frontend Engineer Remote');
  });
});

describe('Platform Scrapers', () => {
  const parser = new DOMParser();

  it('LinkedInScraper should parse DOM correctly', () => {
    const scraper = new LinkedInScraper();
    const html = `
      <html>
        <body>
          <h1 class="job-details-jobs-unified-top-card__job-title">Staff Software Engineer</h1>
          <div class="job-details-jobs-unified-top-card__company-name">Acme Corp</div>
          <div class="job-details-jobs-unified-top-card__primary-description-container">San Francisco, CA (Hybrid)</div>
          <div id="job-details">
            We are hiring a Staff Engineer. You will design distributed systems using Go, Kubernetes, and PostgreSQL.
            Requirements: 5+ years of experience with cloud architectures and microservices.
          </div>
        </body>
      </html>
    `;
    const doc = parser.parseFromString(html, 'text/html');
    const url = 'https://www.linkedin.com/jobs/view/1234567890';

    expect(scraper.canHandle(url, doc)).toBe(true);
    const result = scraper.scrape(url, doc);
    expect(result).not.toBeNull();
    expect(result?.title).toBe('Staff Software Engineer');
    expect(result?.company).toBe('Acme Corp');
    expect(result?.remoteStatus).toBe('Hybrid');
    expect(result?.source).toBe('linkedin');
    expect(result?.requiredSkills).toContain('go');
    expect(result?.requiredSkills).toContain('kubernetes');
    expect(result?.requiredSkills).toContain('postgresql');
  });

  it('IndeedScraper should parse DOM correctly', () => {
    const scraper = new IndeedScraper();
    const html = `
      <html>
        <body>
          <h1 data-testid="jobsearch-JobInfoHeader-title">Backend Developer</h1>
          <div data-testid="inlineHeader-companyName">Tech Innovations</div>
          <div data-testid="inlineHeader-companyLocation">Remote, USA</div>
          <div id="jobDescriptionText">
            Looking for a Python and Django expert. Must have experience with Redis, Celery, and AWS deployments.
          </div>
        </body>
      </html>
    `;
    const doc = parser.parseFromString(html, 'text/html');
    const url = 'https://www.indeed.com/viewjob?jk=abcdef123456';

    expect(scraper.canHandle(url, doc)).toBe(true);
    const result = scraper.scrape(url, doc);
    expect(result).not.toBeNull();
    expect(result?.title).toBe('Backend Developer');
    expect(result?.company).toBe('Tech Innovations');
    expect(result?.remoteStatus).toBe('Remote');
    expect(result?.source).toBe('indeed');
    expect(result?.requiredSkills).toContain('python');
    expect(result?.requiredSkills).toContain('django');
    expect(result?.requiredSkills).toContain('redis');
  });

  it('GreenhouseScraper should parse DOM correctly', () => {
    const scraper = new GreenhouseScraper();
    const html = `
      <html>
        <body>
          <h1 class="app-title">Lead DevOps Engineer</h1>
          <span class="company-name">Stripe</span>
          <div class="location">New York, NY</div>
          <div id="content">
            Manage Kubernetes clusters, Terraform infrastructure, and Prometheus monitoring on GCP.
          </div>
        </body>
      </html>
    `;
    const doc = parser.parseFromString(html, 'text/html');
    const url = 'https://boards.greenhouse.io/stripe/jobs/987654';

    expect(scraper.canHandle(url, doc)).toBe(true);
    const result = scraper.scrape(url, doc);
    expect(result).not.toBeNull();
    expect(result?.title).toBe('Lead DevOps Engineer');
    expect(result?.company).toBe('Stripe');
    expect(result?.source).toBe('greenhouse');
    expect(result?.requiredSkills).toContain('kubernetes');
    expect(result?.requiredSkills).toContain('terraform');
    expect(result?.requiredSkills).toContain('gcp');
  });

  it('LeverScraper should parse DOM correctly', () => {
    const scraper = new LeverScraper();
    const html = `
      <html>
        <body>
          <div class="posting-headline">
            <h2>Product Manager</h2>
          </div>
          <div class="posting-categories">
            <span class="location">Austin, TX</span>
            <span class="workplaceTypes">On-site</span>
          </div>
          <div class="section-wrapper">
            Work with engineering to deliver agile sprints using Jira, SQL queries, and user research.
          </div>
        </body>
      </html>
    `;
    const doc = parser.parseFromString(html, 'text/html');
    const url = 'https://jobs.lever.co/examplecorp/12345-abcde';

    expect(scraper.canHandle(url, doc)).toBe(true);
    const result = scraper.scrape(url, doc);
    expect(result).not.toBeNull();
    expect(result?.title).toBe('Product Manager');
    expect(result?.remoteStatus).toBe('On-site');
    expect(result?.source).toBe('lever');
    expect(result?.requiredSkills).toContain('agile');
    expect(result?.requiredSkills).toContain('jira');
    expect(result?.requiredSkills).toContain('sql');
  });

  it('GenericScraper should parse Schema.org JSON-LD structured data', () => {
    const scraper = new GenericScraper();
    const html = `
      <html>
        <head>
          <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "JobPosting",
            "title": "Principal Architect",
            "description": "Architect mission-critical cloud infrastructure with Kubernetes, Golang, and AWS.",
            "hiringOrganization": {
              "@type": "Organization",
              "name": "CloudScale Inc"
            }
          }
          </script>
        </head>
        <body>
          <h1>Careers</h1>
        </body>
      </html>
    `;
    const doc = parser.parseFromString(html, 'text/html');
    const url = 'https://careers.cloudscale.io/jobs/123';

    expect(scraper.canHandle(url, doc)).toBe(true);
    const result = scraper.scrape(url, doc);
    expect(result).not.toBeNull();
    expect(result?.title).toBe('Principal Architect');
    expect(result?.company).toBe('CloudScale Inc');
    expect(result?.source).toBe('generic');
    expect(result?.requiredSkills).toContain('kubernetes');
    expect(result?.requiredSkills).toContain('golang');
    expect(result?.requiredSkills).toContain('aws');
  });

  it('GenericScraper should reject negative veto URLs such as algomaster.io and technical blogs', () => {
    const scraper = new GenericScraper();
    const algoDoc = parser.parseFromString(
      '<html><body><h1>Course</h1><p>Functional requirements and 5 years experience.</p></body></html>',
      'text/html'
    );
    expect(scraper.canHandle('https://algomaster.io/learn/system-design/course-introduction', algoDoc)).toBe(false);

    const blogDoc = parser.parseFromString(
      '<html><head><meta property="og:type" content="article" /></head><body><p>Job requirements and apply tips.</p></body></html>',
      'text/html'
    );
    expect(scraper.canHandle('https://medium.com/@dev/how-to-prepare-for-interviews', blogDoc)).toBe(false);
  });
});

describe('ScraperRegistry Integration', () => {
  const parser = new DOMParser();

  it('should register all 7 scrapers in correct priority order', () => {
    const scrapers = scraperRegistry.getAllScrapers();
    expect(scrapers.length).toBe(7);
    expect(scrapers[0].name).toBe('LinkedIn');
    expect(scrapers[1].name).toBe('Indeed');
    expect(scrapers[2].name).toBe('Greenhouse');
    expect(scrapers[3].name).toBe('Lever');
    expect(scrapers[4].name).toBe('Workday');
    expect(scrapers[5].name).toBe('Ashby');
    expect(scrapers[6].name).toBe('Generic Job Scraper');
  });

  it('should detect and scrape Workday postings via registry', () => {
    const url = 'https://adobe.wd5.myworkdayjobs.com/en-US/external/job/San-Jose/Engineer_123';
    const html = `
      <html>
        <body>
          <h1 data-automation-id="jobPostingHeader">Site Reliability Engineer</h1>
          <div data-automation-id="jobPostingLocation">San Jose, CA (Remote)</div>
          <div data-automation-id="jobPostingDescription">
            Manage AWS infrastructure using Terraform, Kubernetes, and Python automation scripts.
          </div>
          <a data-automation-id="applyButton" href="#apply">Apply</a>
        </body>
      </html>
    `;
    const doc = parser.parseFromString(html, 'text/html');
    const job = scraperRegistry.detectAndScrape(url, doc);

    expect(job).not.toBeNull();
    expect(job?.title).toBe('Site Reliability Engineer');
    expect(job?.company).toBe('Adobe');
    expect(job?.remoteStatus).toBe('Remote');
    expect(job?.source).toBe('workday');
    expect(job?.requiredSkills).toContain('aws');
    expect(job?.requiredSkills).toContain('terraform');
    expect(job?.requiredSkills).toContain('kubernetes');
    expect(job?.requiredSkills).toContain('python');
  });

  it('should detect and scrape Ashby postings via registry', () => {
    const url = 'https://jobs.ashbyhq.com/anthropic/5678-efgh';
    const html = `
      <html>
        <body>
          <h1 data-testid="job-posting-title">Alignment Research Engineer</h1>
          <div data-testid="job-location">San Francisco, CA (Hybrid)</div>
          <div data-testid="job-description">
            Research LLM safety using Python, PyTorch, and distributed training systems on Kubernetes.
          </div>
          <a href="#apply">Apply</a>
        </body>
      </html>
    `;
    const doc = parser.parseFromString(html, 'text/html');
    const job = scraperRegistry.detectAndScrape(url, doc);

    expect(job).not.toBeNull();
    expect(job?.title).toBe('Alignment Research Engineer');
    expect(job?.company).toBe('Anthropic');
    expect(job?.remoteStatus).toBe('Hybrid');
    expect(job?.source).toBe('ashby');
    expect(job?.requiredSkills).toContain('python');
    expect(job?.requiredSkills).toContain('pytorch');
    expect(job?.requiredSkills).toContain('kubernetes');
  });

  it('registry classify should return isJobPage: false on educational URLs', () => {
    const url = 'https://algomaster.io/learn/system-design/course-introduction';
    const doc = parser.parseFromString('<html><body><h1>Course</h1></body></html>', 'text/html');
    const classification = scraperRegistry.classify(url, doc);

    expect(classification.isJobPage).toBe(false);
    expect(classification.confidence).toBe('none');
    expect(classification.score).toBe(0);
  });
});
