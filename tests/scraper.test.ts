import { describe, it, expect } from 'vitest';
import { extractSkillsFromText, cleanText } from '../src/content/scrapers/keywordExtractor';
import { LinkedInScraper } from '../src/content/scrapers/linkedinScraper';
import { IndeedScraper } from '../src/content/scrapers/indeedScraper';
import { GreenhouseScraper } from '../src/content/scrapers/greenhouseScraper';
import { LeverScraper } from '../src/content/scrapers/leverScraper';
import { GenericScraper } from '../src/content/scrapers/genericScraper';

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

describe('Scrapers', () => {
  it('LinkedInScraper should parse DOM correctly', () => {
    const scraper = new LinkedInScraper();
    const parser = new DOMParser();
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
    expect(result?.requiredSkills).toContain('go');
    expect(result?.requiredSkills).toContain('kubernetes');
    expect(result?.requiredSkills).toContain('postgresql');
  });

  it('IndeedScraper should parse DOM correctly', () => {
    const scraper = new IndeedScraper();
    const parser = new DOMParser();
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
    expect(result?.requiredSkills).toContain('python');
    expect(result?.requiredSkills).toContain('django');
    expect(result?.requiredSkills).toContain('redis');
  });

  it('GreenhouseScraper should parse DOM correctly', () => {
    const scraper = new GreenhouseScraper();
    const parser = new DOMParser();
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
    expect(result?.requiredSkills).toContain('kubernetes');
    expect(result?.requiredSkills).toContain('terraform');
    expect(result?.requiredSkills).toContain('gcp');
  });

  it('LeverScraper should parse DOM correctly', () => {
    const scraper = new LeverScraper();
    const parser = new DOMParser();
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
    expect(result?.requiredSkills).toContain('agile');
    expect(result?.requiredSkills).toContain('jira');
    expect(result?.requiredSkills).toContain('sql');
  });

  it('GenericScraper should parse arbitrary job descriptions', () => {
    const scraper = new GenericScraper();
    const parser = new DOMParser();
    const html = `
      <html>
        <head><title>Senior React Engineer at StartupXYZ</title></head>
        <body>
          <header>Company Navigation</header>
          <main>
            <h1 class="job-title">Senior React Engineer</h1>
            <div class="job-description">
              <h3>About the Role</h3>
              <p>We are seeking a talented React developer. You will build user interfaces with Next.js, Tailwind CSS, and TypeScript.</p>
              <h3>Qualifications</h3>
              <p>5+ years building production web applications. Experience with REST API design and Agile development. Full-time position. Apply now.</p>
            </div>
          </main>
        </body>
      </html>
    `;
    const doc = parser.parseFromString(html, 'text/html');
    const url = 'https://startupxyz.com/careers/senior-react-engineer';

    expect(scraper.canHandle(url, doc)).toBe(true);
    const result = scraper.scrape(url, doc);
    expect(result).not.toBeNull();
    expect(result?.title).toBe('Senior React Engineer');
    expect(result?.requiredSkills).toContain('react');
    expect(result?.requiredSkills).toContain('next.js');
    expect(result?.requiredSkills).toContain('tailwind');
  });
});
