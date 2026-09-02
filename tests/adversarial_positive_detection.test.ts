import { describe, it, expect } from 'vitest';
import { jobClassifier, extractJobPostingSchema } from '../src/content/detection/jobClassifier';
import { scraperRegistry } from '../src/content/scrapers/scraperRegistry';
import { WorkdayScraper } from '../src/content/scrapers/workdayScraper';
import { AshbyScraper } from '../src/content/scrapers/ashbyScraper';
import { GreenhouseScraper } from '../src/content/scrapers/greenhouseScraper';
import { LeverScraper } from '../src/content/scrapers/leverScraper';
import { GenericScraper } from '../src/content/scrapers/genericScraper';

describe('Adversarial Positive Detection & Extraction Robustness Suite (Challenger 2)', () => {
  const parser = new DOMParser();

  // =========================================================================
  // CATEGORY A: WORKDAY VARIATIONS
  // =========================================================================
  describe('Category A: Workday ATS Variations', () => {
    const workdayScraper = new WorkdayScraper();

    it('A1: should classify and scrape multi-subdomain Workday with regional path', () => {
      const url = 'https://salesforce.wd102.myworkdayjobs.com/en-US/Global_Careers/job/Austin-TX/Staff-Infrastructure-Architect_R-883742';
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Staff Infrastructure Architect - Salesforce Careers</title></head>
          <body>
            <div data-automation-id="jobPostingHeader">
              <h1>Staff Infrastructure Architect</h1>
            </div>
            <img data-automation-id="clientLogo" alt="Salesforce Logo" src="/sf_logo.png" />
            <div data-automation-id="jobPostingLocation">Austin, TX (Hybrid)</div>
            <div data-automation-id="timeType">Full time</div>
            <div data-automation-id="jobPostingId">R-883742</div>
            <div data-automation-id="postedOn">Posted 2 Days Ago</div>
            <div data-automation-id="jobPostingDescription">
              <p>We are seeking a Staff Infrastructure Architect to lead our global public cloud foundation.</p>
              <h3>About the Role</h3>
              <p>Design multi-region AWS and GCP distributed infrastructure with Terraform, Kubernetes, and Golang.</p>
              <h3>Requirements</h3>
              <p>8+ years experience in distributed systems, Docker, Kubernetes, Linux kernel tuning, and PostgreSQL.</p>
            </div>
            <a data-automation-id="applyButton" href="#apply">Apply</a>
          </body>
        </html>
      `;
      const doc = parser.parseFromString(html, 'text/html');

      // Classification Check
      const classification = jobClassifier.classify(url, doc);
      expect(classification.isJobPage).toBe(true);
      expect(classification.score).toBeGreaterThanOrEqual(65);
      expect(classification.confidence).toMatch(/high|medium/);
      expect(classification.positiveSignals).toContain('SIG_KNOWN_ATS_URL');

      // Extraction Check
      expect(workdayScraper.canHandle(url, doc)).toBe(true);
      const job = workdayScraper.scrape(url, doc);
      expect(job).not.toBeNull();
      expect(job?.title).toBe('Staff Infrastructure Architect');
      expect(job?.company).toBe('Salesforce');
      expect(job?.location).toContain('Austin, TX');
      expect(job?.remoteStatus).toBe('Hybrid');
      expect(job?.qualifications).toContain('Requisition ID: R-883742');
      expect(job?.qualifications).toContain('Posted: Posted 2 Days Ago');
      expect(job?.description.length).toBeGreaterThan(100);
      expect(job?.requiredSkills).toContain('aws');
      expect(job?.requiredSkills).toContain('terraform');
      expect(job?.requiredSkills).toContain('kubernetes');
      expect(job?.requiredSkills).toContain('golang');
    });

    it('A2: should classify and scrape Workday with dynamic/nested DOM and alternate selector tags', () => {
      const url = 'https://target.wd5.myworkdayjobs.com/en-US/Target_Careers/job/Remote-USA/Principal-Cloud-Security-Engineer_R000998877';
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Target Careers - Principal Cloud Security Engineer</title></head>
          <body>
            <div data-automation-id="jobPostingPage">
              <h2 data-automation-id="jobPostingTitle">Principal Cloud Security Engineer</h2>
              <dl>
                <dt>Location</dt>
                <dd data-automation-id="jobPostingLocation">Remote - USA</dd>
                <dt>Worker Sub-Type</dt>
                <dd data-automation-id="timeType">Regular, Virtual / Home-Based</dd>
                <dt>Job Requisition ID</dt>
                <dd data-automation-id="jobPostingId">R000998877</dd>
              </dl>
              <div data-automation-id="job-posting-details">
                <p>Target is looking for a Principal Cloud Security Engineer to secure our multi-cloud retail architecture.</p>
                <h3>What you will do:</h3>
                <p>Architect IAM policies, zero-trust security controls, and Kubernetes pod security admission in AWS and Azure.</p>
                <h3>What we need to see:</h3>
                <p>7+ years experience in Python, AWS security, Docker, Terraform, and SIEM monitoring.</p>
              </div>
              <button data-automation-id="applyButton">Apply Now</button>
            </div>
          </body>
        </html>
      `;
      const doc = parser.parseFromString(html, 'text/html');

      const classification = jobClassifier.classify(url, doc);
      expect(classification.isJobPage).toBe(true);
      expect(classification.score).toBeGreaterThanOrEqual(65);

      const job = workdayScraper.scrape(url, doc);
      expect(job).not.toBeNull();
      expect(job?.title).toBe('Principal Cloud Security Engineer');
      expect(job?.company).toBe('Target');
      expect(job?.location).toContain('Remote - USA');
      expect(job?.remoteStatus).toBe('Remote');
      expect(job?.requiredSkills).toContain('python');
      expect(job?.requiredSkills).toContain('aws');
      expect(job?.requiredSkills).toContain('terraform');
    });

    it('A3: should detect and scrape Workday on custom subdomain via meta tag and ScraperRegistry', () => {
      const url = 'https://careers.walmart.com/jobs/R-998822-senior-cloud-engineer';
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Senior Cloud Engineer - Walmart Careers</title>
            <meta name="workday-site" content="walmart" />
            <meta property="og:site_name" content="Walmart" />
          </head>
          <body>
            <div data-automation-id="jobPostingHeader">
              <h1>Senior Cloud Engineer</h1>
            </div>
            <div data-automation-id="jobPostingLocation">Bentonville, AR (On-site)</div>
            <div data-automation-id="jobPostingDescription">
              <p>Join Walmart Global Tech as a Senior Cloud Engineer building high-scale distributed systems with Java, Spring Boot, and Azure.</p>
              <h3>Qualifications</h3>
              <p>5+ years experience in Java, Microservices, Azure, Docker, and Kafka.</p>
            </div>
            <a data-automation-id="applyButton" href="#apply">Apply</a>
          </body>
        </html>
      `;
      const doc = parser.parseFromString(html, 'text/html');

      const classification = scraperRegistry.classify(url, doc);
      expect(classification.isJobPage).toBe(true);

      const job = scraperRegistry.detectAndScrape(url, doc);
      expect(job).not.toBeNull();
      expect(job?.title).toBe('Senior Cloud Engineer');
      expect(job?.company).toBe('Walmart');
      expect(job?.remoteStatus).toBe('On-site');
      expect(job?.source).toBe('workday');
      expect(job?.requiredSkills).toContain('java');
      expect(job?.requiredSkills).toContain('azure');
      expect(job?.requiredSkills).toContain('kafka');
    });
  });

  // =========================================================================
  // CATEGORY B: ASHBY VARIATIONS
  // =========================================================================
  describe('Category B: Ashby ATS Variations', () => {
    const ashbyScraper = new AshbyScraper();

    it('B1: should classify and scrape Ashby with React hashed CSS classes and salary chip', () => {
      const url = 'https://jobs.ashbyhq.com/scale-ai/a1b2c3d4-e5f6-7890-abcd-1234567890ab';
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Staff AI Engineer - Scale AI</title></head>
          <body>
            <div class="_container_9x8y7">
              <div class="_header_9x8y7">
                <h1 data-testid="job-posting-title">Staff AI Engineer - LLM Evaluation</h1>
                <div class="_details_9x8y7">
                  <span data-testid="job-location">San Francisco, CA</span> · <span>Remote</span> · <span>$210,000 - $300,000</span>
                </div>
                <div data-testid="job-department">Generative AI</div>
                <div data-testid="job-employment-type">Full-time</div>
              </div>
              <div data-testid="job-description">
                <h3>About the Role</h3>
                <p>Build enterprise benchmark evaluation frameworks for frontier Large Language Models.</p>
                <h3>Requirements</h3>
                <p>Deep expertise in Python, PyTorch, HuggingFace, distributed training, and TypeScript.</p>
              </div>
              <a href="#apply" class="_applyButton_9x8y7">Apply for this role</a>
            </div>
          </body>
        </html>
      `;
      const doc = parser.parseFromString(html, 'text/html');

      const classification = jobClassifier.classify(url, doc);
      expect(classification.isJobPage).toBe(true);
      expect(classification.score).toBeGreaterThanOrEqual(80);
      expect(classification.positiveSignals).toContain('SIG_KNOWN_ATS_URL');

      const job = ashbyScraper.scrape(url, doc);
      expect(job).not.toBeNull();
      expect(job?.title).toBe('Staff AI Engineer - LLM Evaluation');
      expect(job?.company).toBe('Scale Ai');
      expect(job?.location).toBe('San Francisco, CA');
      expect(job?.remoteStatus).toBe('Remote');
      expect(job?.qualifications).toContain('Department: Generative AI');
      expect(job?.qualifications).toContain('Employment Type: Full-time');
      expect(job?.requiredSkills).toContain('python');
      expect(job?.requiredSkills).toContain('pytorch');
      expect(job?.requiredSkills).toContain('typescript');
    });

    it('B2: should classify and scrape Ashby on custom career domain with form action embed', () => {
      const url = 'https://careers.linear.app/engineering/lead-frontend-engineer';
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Lead Frontend Engineer - Linear</title>
            <meta property="og:site_name" content="Linear" />
            <meta name="ashby-job-id" content="lin_987654" />
          </head>
          <body>
            <div class="JobPostingHeader">
              <h1 class="JobPostingHeader_title">Lead Frontend Engineer</h1>
              <div class="JobPostingHeader_location">San Francisco, CA / Remote</div>
            </div>
            <div class="JobPostingDescription">
              <h3>About the Role</h3>
              <p>Lead the frontend architecture of Linear's desktop and web clients using React, TypeScript, and WebSockets.</p>
              <h3>Qualifications</h3>
              <p>7+ years experience with modern React, TypeScript, GraphQL, SQLite, and WebAssembly.</p>
            </div>
            <form action="https://jobs.ashbyhq.com/linear/apply" method="POST">
              <input type="text" name="first_name" />
              <input type="text" name="last_name" />
              <input type="file" name="resume" accept=".pdf" />
              <button type="submit">Submit Application</button>
            </form>
          </body>
        </html>
      `;
      const doc = parser.parseFromString(html, 'text/html');

      const classification = scraperRegistry.classify(url, doc);
      expect(classification.isJobPage).toBe(true);
      expect(classification.score).toBeGreaterThanOrEqual(65);

      const job = scraperRegistry.detectAndScrape(url, doc);
      expect(job).not.toBeNull();
      expect(job?.title).toBe('Lead Frontend Engineer');
      expect(job?.company).toBe('Linear');
      expect(job?.remoteStatus).toBe('Remote');
      expect(job?.requiredSkills).toContain('react');
      expect(job?.requiredSkills).toContain('typescript');
      expect(job?.requiredSkills).toContain('graphql');
      expect(job?.requiredSkills).toContain('websockets');
    });
  });

  // =========================================================================
  // CATEGORY C: GREENHOUSE VARIATIONS
  // =========================================================================
  describe('Category C: Greenhouse ATS Variations', () => {
    const greenhouseScraper = new GreenhouseScraper();

    it('C1: should classify and scrape job-boards.greenhouse.io subdomain', () => {
      const url = 'https://job-boards.greenhouse.io/figma/jobs/44556677';
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Staff Systems Engineer at Figma</title></head>
          <body>
            <div id="app_body">
              <h1 class="app-title">Staff Systems Engineer</h1>
              <span class="company-name">Figma</span>
              <div class="location">San Francisco, CA (Hybrid)</div>
              <div id="content">
                <p>We are looking for a Staff Systems Engineer to scale our WebAssembly and C++ rendering engine.</p>
                <h3>Responsibilities</h3>
                <p>Build real-time multiplayer document synchronization with Rust, C++, and WebSockets.</p>
                <h3>Requirements</h3>
                <p>6+ years experience in Rust, C++, WebAssembly, Linux systems, and distributed databases.</p>
              </div>
              <form id="application_form">
                <input type="file" name="resume" accept=".pdf" />
                <button type="submit" id="submit_app">Apply</button>
              </form>
            </div>
          </body>
        </html>
      `;
      const doc = parser.parseFromString(html, 'text/html');

      const classification = jobClassifier.classify(url, doc);
      expect(classification.isJobPage).toBe(true);
      expect(classification.score).toBeGreaterThanOrEqual(80);

      const job = greenhouseScraper.scrape(url, doc);
      expect(job).not.toBeNull();
      expect(job?.title).toBe('Staff Systems Engineer');
      expect(job?.company).toBe('Figma');
      expect(job?.location).toContain('San Francisco, CA');
      expect(job?.remoteStatus).toBe('Hybrid');
      expect(job?.source).toBe('greenhouse');
      expect(job?.requiredSkills).toContain('rust');
      expect(job?.requiredSkills).toContain('c++');
      expect(job?.requiredSkills).toContain('websockets');
    });

    it('C2: should extract company name from document title when span.company-name is absent', () => {
      const url = 'https://boards.greenhouse.io/datadog/jobs/11223344';
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Senior Site Reliability Engineer at Datadog</title></head>
          <body>
            <div id="app_body">
              <h1 class="app-title">Senior Site Reliability Engineer</h1>
              <div class="location">New York, NY (On-site)</div>
              <div id="content">
                <p>Datadog is hiring a Senior SRE to support our high-throughput telemetry pipelines.</p>
                <h3>Requirements</h3>
                <p>Experience with Go, Kubernetes, Terraform, Cassandra, and Kafka in large AWS environments.</p>
              </div>
            </div>
          </body>
        </html>
      `;
      const doc = parser.parseFromString(html, 'text/html');

      const job = greenhouseScraper.scrape(url, doc);
      expect(job).not.toBeNull();
      expect(job?.title).toBe('Senior Site Reliability Engineer');
      expect(job?.company).toBe('Datadog');
      expect(job?.location).toBe('New York, NY (On-site)');
      expect(job?.remoteStatus).toBe('On-site');
      expect(job?.requiredSkills).toContain('go');
      expect(job?.requiredSkills).toContain('kubernetes');
      expect(job?.requiredSkills).toContain('terraform');
      expect(job?.requiredSkills).toContain('kafka');
    });
  });

  // =========================================================================
  // CATEGORY D: LEVER VARIATIONS
  // =========================================================================
  describe('Category D: Lever ATS Variations', () => {
    const leverScraper = new LeverScraper();

    it('D1: should classify and scrape Lever direct application page (/apply)', () => {
      const url = 'https://jobs.lever.co/netflix/5544-3322-1100/apply';
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Netflix - Senior Security Software Engineer</title></head>
          <body>
            <div class="posting-header-logo"><img alt="Netflix" src="/logo.png" /></div>
            <div class="posting-headline">
              <h2>Senior Security Software Engineer</h2>
            </div>
            <div class="posting-categories">
              <span class="location">Los Gatos, CA</span>
              <span class="workplaceTypes">Remote</span>
              <span class="commitment">Full-time</span>
            </div>
            <div class="section-wrapper">
              <h3>About the Role</h3>
              <p>Secure cloud infrastructure and CI/CD pipelines across AWS and Spinnaker.</p>
              <h3>Requirements</h3>
              <p>Proficiency in Python, Go, AWS security, cryptography, and Docker container security.</p>
            </div>
            <form class="application-form">
              <input type="text" name="name" />
              <input type="email" name="email" />
              <input type="file" name="resume" accept=".pdf" />
              <button type="submit">Submit Application</button>
            </form>
          </body>
        </html>
      `;
      const doc = parser.parseFromString(html, 'text/html');

      const classification = jobClassifier.classify(url, doc);
      expect(classification.isJobPage).toBe(true);
      expect(classification.score).toBeGreaterThanOrEqual(80);

      const job = leverScraper.scrape(url, doc);
      expect(job).not.toBeNull();
      expect(job?.title).toBe('Senior Security Software Engineer');
      expect(job?.company).toBe('Netflix');
      expect(job?.location).toBe('Los Gatos, CA');
      expect(job?.remoteStatus).toBe('Remote');
      expect(job?.source).toBe('lever');
      expect(job?.requiredSkills).toContain('python');
      expect(job?.requiredSkills).toContain('go');
      expect(job?.requiredSkills).toContain('aws');
      expect(job?.requiredSkills).toContain('docker');
    });

    it('D2: should aggregate multiple section-wrapper blocks into full description', () => {
      const url = 'https://jobs.lever.co/spotify/abcdef-12345';
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Spotify - Backend Engineer - Music Recommendations</title></head>
          <body>
            <div class="main-header"><a href="#">Spotify</a></div>
            <div class="posting-headline"><h2>Backend Engineer - Music Recommendations</h2></div>
            <div class="posting-categories">
              <span class="location">Stockholm, Sweden</span>
              <span class="workplaceTypes">Hybrid</span>
            </div>
            <div class="section-wrapper">
              <h3>What you will do</h3>
              <p>Scale machine learning inference pipelines using Java, Scala, and Google Cloud BigQuery.</p>
            </div>
            <div class="section-wrapper">
              <h3>Who you are</h3>
              <p>5+ years experience building distributed backend systems with Java, Python, and PostgreSQL.</p>
            </div>
            <div class="section-wrapper">
              <h3>Where you will be</h3>
              <p>Our Stockholm headquarters with flexible hybrid work options.</p>
            </div>
          </body>
        </html>
      `;
      const doc = parser.parseFromString(html, 'text/html');

      const job = leverScraper.scrape(url, doc);
      expect(job).not.toBeNull();
      expect(job?.title).toBe('Backend Engineer - Music Recommendations');
      expect(job?.company).toBe('Spotify');
      expect(job?.remoteStatus).toBe('Hybrid');
      expect(job?.description).toContain('What you will do');
      expect(job?.description).toContain('Who you are');
      expect(job?.description).toContain('Where you will be');
      expect(job?.requiredSkills).toContain('java');
      expect(job?.requiredSkills).toContain('scala');
      expect(job?.requiredSkills).toContain('python');
      expect(job?.requiredSkills).toContain('postgresql');
    });
  });

  // =========================================================================
  // CATEGORY E: SCHEMA.ORG JOBPOSTING VARIATIONS
  // =========================================================================
  describe('Category E: Complex Schema.org JobPosting Structures', () => {
    const genericScraper = new GenericScraper();

    it('E1: should extract Schema.org JobPosting nested within @graph array alongside WebSite and Organization', () => {
      const url = 'https://careers.atlassian.com/job/senior-devops-engineer';
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Senior DevOps Engineer - Atlassian Careers</title>
            <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "WebSite",
                  "name": "Atlassian Careers",
                  "url": "https://careers.atlassian.com"
                },
                {
                  "@type": "Organization",
                  "name": "Atlassian",
                  "url": "https://atlassian.com"
                },
                {
                  "@type": "JobPosting",
                  "title": "Senior DevOps Engineer",
                  "description": "<p>Atlassian is looking for a Senior DevOps Engineer to scale Jira and Confluence cloud infrastructure.</p><h3>Skills</h3><ul><li>Terraform and AWS CloudFormation</li><li>Kubernetes and Docker</li><li>Python and Go automation</li></ul>",
                  "hiringOrganization": {
                    "@type": "Organization",
                    "name": "Atlassian"
                  },
                  "jobLocation": {
                    "@type": "Place",
                    "address": {
                      "@type": "PostalAddress",
                      "addressLocality": "Sydney",
                      "addressRegion": "NSW",
                      "addressCountry": "Australia"
                    }
                  },
                  "employmentType": "FULL_TIME",
                  "directApply": true
                }
              ]
            }
            </script>
          </head>
          <body>
            <h1>Careers at Atlassian</h1>
            <button id="apply-btn">Apply Now</button>
          </body>
        </html>
      `;
      const doc = parser.parseFromString(html, 'text/html');

      const schema = extractJobPostingSchema(doc);
      expect(schema).not.toBeNull();
      expect(schema?.title).toBe('Senior DevOps Engineer');
      expect(schema?.hiringOrganization).toBe('Atlassian');
      expect(schema?.jobLocation?.addressLocality).toBe('Sydney');
      expect(schema?.directApply).toBe(true);

      const classification = jobClassifier.classify(url, doc);
      expect(classification.isJobPage).toBe(true);
      expect(classification.score).toBeGreaterThanOrEqual(70);
      expect(classification.positiveSignals).toContain('SCHEMA_ORG_JOB_POSTING');

      const job = genericScraper.scrape(url, doc, schema || undefined);
      expect(job).not.toBeNull();
      expect(job?.title).toBe('Senior DevOps Engineer');
      expect(job?.company).toBe('Atlassian');
      expect(job?.location).toBe('Sydney, NSW, Australia');
      expect(job?.source).toBe('generic');
      expect(job?.requiredSkills).toContain('terraform');
      expect(job?.requiredSkills).toContain('aws');
      expect(job?.requiredSkills).toContain('kubernetes');
      expect(job?.requiredSkills).toContain('python');
    });

    it('E2: should handle string jobLocation and strip HTML tags cleanly from description', () => {
      const url = 'https://jobs.remotecompany.com/openings/fullstack-architect';
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "JobPosting",
              "title": "Principal Fullstack Architect",
              "description": "<div><h2>Role Overview</h2><p>We are hiring a <strong>Principal Fullstack Architect</strong>.</p><p>Must know React, Next.js, Node.js, GraphQL, and Redis.</p></div>",
              "hiringOrganization": "RemoteCorp Inc",
              "jobLocation": "Remote - Global",
              "employmentType": "CONTRACTOR"
            }
            </script>
          </head>
          <body>
            <h1>Join Us</h1>
          </body>
        </html>
      `;
      const doc = parser.parseFromString(html, 'text/html');

      const schema = extractJobPostingSchema(doc);
      expect(schema).not.toBeNull();
      expect(schema?.title).toBe('Principal Fullstack Architect');
      expect(schema?.hiringOrganization).toBe('RemoteCorp Inc');
      expect(schema?.jobLocation?.addressLocality).toBe('Remote - Global');
      expect(schema?.description).not.toContain('<p>');
      expect(schema?.description).not.toContain('<strong>');

      const job = genericScraper.scrape(url, doc, schema || undefined);
      expect(job).not.toBeNull();
      expect(job?.title).toBe('Principal Fullstack Architect');
      expect(job?.company).toBe('RemoteCorp Inc');
      expect(job?.location).toBe('Remote - Global');
      expect(job?.requiredSkills).toContain('react');
      expect(job?.requiredSkills).toContain('next.js');
      expect(job?.requiredSkills).toContain('graphql');
      expect(job?.requiredSkills).toContain('redis');
    });
  });

  // =========================================================================
  // CATEGORY F: MINIMAL HTML / CUSTOM CAREER SITES (GENERIC SCRAPER)
  // =========================================================================
  describe('Category F: Minimal HTML / Custom Career Sites', () => {
    it('F1: should classify and scrape modern startup career page without JSON-LD or standard ATS', () => {
      const url = 'https://careers.acme.ai/roles/senior-founding-engineer';
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Senior Founding Engineer - Acme AI</title>
            <meta property="og:site_name" content="Acme AI" />
          </head>
          <body>
            <header>
              <nav><a href="/">Home</a></nav>
            </header>
            <main class="job-description">
              <h1 class="job-title">Senior Founding Engineer</h1>
              <div class="job-meta">
                <span>San Francisco, CA (Hybrid)</span> · <span>Full-Time</span> · <span>$180k - $240k + Equity</span>
              </div>
              <section>
                <h2>About the Role</h2>
                <p>Join as one of the first 5 engineers building our core autonomous agent orchestration platform.</p>
                <h2>Responsibilities</h2>
                <p>Architect real-time streaming LLM services in Python, TypeScript, Fastify, and Redis.</p>
                <h2>Qualifications & Requirements</h2>
                <p>5+ years experience building production web applications with TypeScript, React, Python, PostgreSQL, and Docker.</p>
              </section>
              <div class="application-section">
                <a href="mailto:careers@acme.ai?subject=Application" class="apply-button">Apply for this job</a>
              </div>
            </main>
          </body>
        </html>
      `;
      const doc = parser.parseFromString(html, 'text/html');

      const classification = scraperRegistry.classify(url, doc);
      expect(classification.isJobPage).toBe(true);
      expect(classification.score).toBeGreaterThanOrEqual(65);

      const job = scraperRegistry.detectAndScrape(url, doc);
      expect(job).not.toBeNull();
      expect(job?.title).toBe('Senior Founding Engineer');
      expect(job?.company).toBe('Acme AI');
      expect(job?.remoteStatus).toBe('Hybrid');
      expect(job?.requiredSkills).toContain('typescript');
      expect(job?.requiredSkills).toContain('react');
      expect(job?.requiredSkills).toContain('python');
      expect(job?.requiredSkills).toContain('postgresql');
      expect(job?.requiredSkills).toContain('docker');
    });

    it('F2: should classify and scrape custom application form page with name and file inputs', () => {
      const url = 'https://jobs.techcorp.com/apply/security-architect';
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Security Architect - TechCorp</title></head>
          <body>
            <div class="posting-body">
              <h1 class="role-title">Security Architect</h1>
              <p>Location: Seattle, WA (Remote)</p>
              <h3>About the Role</h3>
              <p>Lead application security reviews, threat modeling, and penetration testing.</p>
              <h3>Requirements</h3>
              <p>Experience in AWS security, OAuth2, SAML, Python, and penetration testing tools.</p>
            </div>
            <form id="application_form" action="/api/apply" method="POST">
              <input type="text" name="first_name" placeholder="First Name" />
              <input type="text" name="last_name" placeholder="Last Name" />
              <input type="email" name="email" placeholder="Email" />
              <input type="file" name="resume" accept=".pdf,.docx" />
              <button type="submit" id="submit_app">Submit Application</button>
            </form>
          </body>
        </html>
      `;
      const doc = parser.parseFromString(html, 'text/html');

      const classification = jobClassifier.classify(url, doc);
      expect(classification.isJobPage).toBe(true);
      expect(classification.score).toBeGreaterThanOrEqual(65);

      const job = scraperRegistry.detectAndScrape(url, doc);
      expect(job).not.toBeNull();
      expect(job?.title).toBe('Security Architect');
      expect(job?.company).toBe('TechCorp');
      expect(job?.remoteStatus).toBe('Remote');
      expect(job?.requiredSkills).toContain('aws');
      expect(job?.requiredSkills).toContain('security');
      expect(job?.requiredSkills).toContain('python');
    });
  });

  // =========================================================================
  // CATEGORY G: ADVERSARIAL EDGE CASES (PREVENT FALSE NEGATIVES)
  // =========================================================================
  describe('Category G: Adversarial Edge Cases (Prevent False Negatives)', () => {
    it('G1: should NOT veto edtech company job posting on ATS domain (e.g. Duolingo French Course Creator)', () => {
      const url = 'https://jobs.lever.co/duolingo/french-curriculum-developer-123';
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Duolingo - Curriculum Developer - French</title></head>
          <body>
            <div class="posting-headline"><h2>Curriculum Developer - French</h2></div>
            <div class="posting-categories">
              <span class="location">Pittsburgh, PA</span>
              <span class="workplaceTypes">Hybrid</span>
            </div>
            <div class="section-wrapper">
              <h3>About Duolingo</h3>
              <p>Duolingo is the world's most popular language-learning platform.</p>
              <h3>Requirements</h3>
              <p>MA in Applied Linguistics or French. 3+ years curriculum design experience. Experience with pedagogical course design.</p>
            </div>
            <a class="postings-btn" href="#apply">Apply for this job</a>
          </body>
        </html>
      `;
      const doc = parser.parseFromString(html, 'text/html');

      const classification = jobClassifier.classify(url, doc);
      expect(classification.isJobPage).toBe(true);
      expect(classification.score).toBeGreaterThanOrEqual(65);
      expect(classification.negativeSignals.length).toBe(0);
    });

    it('G2: should NOT veto technical documentation writer job posting on Greenhouse', () => {
      const url = 'https://boards.greenhouse.io/stripe/jobs/4567891';
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Stripe - Senior Technical Writer, Developer Documentation</title></head>
          <body>
            <h1 class="app-title">Senior Technical Writer, Developer Documentation</h1>
            <span class="company-name">Stripe</span>
            <div class="location">Seattle, WA (Remote)</div>
            <div id="content">
              <p>Stripe is looking for a Technical Writer to write world-class API documentation and developer guides.</p>
              <h3>Responsibilities</h3>
              <p>Document REST APIs, SDKs, and webhook architectures for global developers.</p>
              <h3>Requirements</h3>
              <p>5+ years writing API documentation, knowledge of JavaScript, Python, and OpenAPI/Swagger specifications.</p>
            </div>
            <form id="application_form">
              <input type="file" name="resume" accept=".pdf" />
              <button type="submit">Submit Application</button>
            </form>
          </body>
        </html>
      `;
      const doc = parser.parseFromString(html, 'text/html');
      const classification = jobClassifier.classify(url, doc);
      expect(classification.isJobPage).toBe(true);
      expect(classification.score).toBeGreaterThanOrEqual(80);
      expect(classification.negativeSignals.length).toBe(0);
    });

    it('G3: should correctly classify LinkedIn job collection URL with query parameters', () => {
      const url = 'https://www.linkedin.com/jobs/collections/recommended/?currentJobId=3900123456';
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Staff Software Engineer at Acme | LinkedIn</title></head>
          <body>
            <h1 class="job-details-jobs-unified-top-card__job-title">Staff Software Engineer</h1>
            <div class="job-details-jobs-unified-top-card__company-name">Acme Corp</div>
            <div class="job-details-jobs-unified-top-card__primary-description-container">San Francisco, CA (Hybrid)</div>
            <div id="job-details">
              <p>We are looking for a Staff Software Engineer to build scalable microservices using Go, Kubernetes, and PostgreSQL.</p>
              <h3>Requirements</h3>
              <p>7+ years experience with distributed systems, AWS, and Docker.</p>
            </div>
            <button class="jobs-apply-button">Apply</button>
          </body>
        </html>
      `;
      const doc = parser.parseFromString(html, 'text/html');

      const classification = jobClassifier.classify(url, doc);
      expect(classification.isJobPage).toBe(true);
      expect(classification.score).toBeGreaterThanOrEqual(65);
      expect(classification.positiveSignals).toContain('SIG_KNOWN_ATS_URL');
      expect(classification.positiveSignals).toContain('SIG_APPLY_CTA');
    });

    it('G4: should correctly classify Indeed redirect job URL (/rc/clk) with standard Indeed DOM', () => {
      const url = 'https://www.indeed.com/rc/clk?jk=789abc1234567890&from=vj&pos=top';
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Senior Data Engineer - TechCorp - New York, NY | Indeed</title></head>
          <body>
            <h1 data-testid="jobsearch-JobInfoHeader-title">Senior Data Engineer</h1>
            <div data-testid="inlineHeader-companyName">TechCorp</div>
            <div data-testid="inlineHeader-companyLocation">New York, NY (Remote)</div>
            <div id="jobDescriptionText">
              <p>TechCorp is seeking a Senior Data Engineer to design high-throughput ETL pipelines with Python, Spark, and Snowflake.</p>
              <h3>Qualifications</h3>
              <p>5+ years experience in Python, Apache Spark, Snowflake, Airflow, and AWS.</p>
            </div>
            <button id="indeedApplyButton">Apply now</button>
          </body>
        </html>
      `;
      const doc = parser.parseFromString(html, 'text/html');

      const classification = jobClassifier.classify(url, doc);
      expect(classification.isJobPage).toBe(true);
      expect(classification.score).toBeGreaterThanOrEqual(65);
      expect(classification.positiveSignals).toContain('SIG_KNOWN_ATS_URL');
    });

    it('G5: should classify media company job posting on ATS domain with news in title (nested path)', () => {
      const url = 'https://jobs.lever.co/mediahub/senior-editorial-systems-engineer';
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Senior Editorial Systems Engineer - MediaHub</title></head>
          <body>
            <div class="posting-headline"><h2>Senior Editorial Systems Engineer</h2></div>
            <div class="posting-categories">
              <span class="location">New York, NY</span>
              <span class="workplaceTypes">Hybrid</span>
            </div>
            <div class="section-wrapper">
              <h3>Role Overview</h3>
              <p>Lead our core publishing workflows and content distribution systems.</p>
              <h3>Requirements</h3>
              <p>5+ years experience with React, TypeScript, Node.js, GraphQL, and AWS.</p>
            </div>
            <a href="#apply" class="postings-btn">Apply for this job</a>
          </body>
        </html>
      `;
      const doc = parser.parseFromString(html, 'text/html');

      const classification = jobClassifier.classify(url, doc);
      expect(classification.isJobPage).toBe(true);
      expect(classification.score).toBeGreaterThanOrEqual(65);
      expect(classification.negativeSignals.length).toBe(0);
    });

    it('G6: should handle deeply nested @graph JSON-LD structures with 3+ array levels', () => {
      const url = 'https://jobs.enterprise.com/openings/principal-cloud-architect';
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "BreadcrumbList",
                  "itemListElement": [{ "@type": "ListItem", "position": 1, "name": "Jobs" }]
                },
                [
                  {
                    "@type": "WebSite",
                    "name": "Enterprise Careers"
                  },
                  {
                    "@type": "JobPosting",
                    "title": "Principal Cloud Architect",
                    "description": "Architect enterprise cloud migration strategies using AWS, Terraform, and Kubernetes.",
                    "hiringOrganization": {
                      "@type": "Organization",
                      "name": "Enterprise Cloud Systems"
                    },
                    "jobLocation": {
                      "@type": "Place",
                      "address": {
                        "@type": "PostalAddress",
                        "addressLocality": "Chicago",
                        "addressRegion": "IL",
                        "addressCountry": "US"
                      }
                    }
                  }
                ]
              ]
            }
            </script>
          </head>
          <body>
            <h1>Principal Cloud Architect</h1>
          </body>
        </html>
      `;
      const doc = parser.parseFromString(html, 'text/html');

      const schema = extractJobPostingSchema(doc);
      expect(schema).not.toBeNull();
      expect(schema?.title).toBe('Principal Cloud Architect');
      expect(schema?.hiringOrganization).toBe('Enterprise Cloud Systems');
      expect(schema?.jobLocation?.addressLocality).toBe('Chicago');

      const classification = jobClassifier.classify(url, doc);
      expect(classification.isJobPage).toBe(true);
      expect(classification.score).toBeGreaterThanOrEqual(70);
    });

    it('G7: should classify and scrape job posting with standard apply button selector', () => {
      const url = 'https://engineering.bootstrapped.co/positions/senior-rust-engineer';
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Senior Rust Engineer - Bootstrapped</title></head>
          <body>
            <h2 class="job-title">Senior Rust Engineer</h2>
            <p>Location: Remote</p>
            <div class="job-description">
              <h3>Responsibilities</h3>
              <p>Develop low-latency networking protocols, memory-safe embedded daemons, and distributed key-value storage.</p>
              <h3>Requirements</h3>
              <p>5+ years experience in Rust, C++, Linux systems programming, Docker, and WebSockets.</p>
            </div>
            <button class="apply-btn">Apply for this role</button>
          </body>
        </html>
      `;
      const doc = parser.parseFromString(html, 'text/html');

      const classification = scraperRegistry.classify(url, doc);
      expect(classification.isJobPage).toBe(true);
      expect(classification.score).toBeGreaterThanOrEqual(65);

      const job = scraperRegistry.detectAndScrape(url, doc);
      expect(job).not.toBeNull();
      expect(job?.title).toBe('Senior Rust Engineer');
      expect(job?.company).toBe('Bootstrapped');
      // Note: GenericScraper only checks (title + description) for remoteStatus (not whole body)
      expect(job?.requiredSkills).toContain('rust');
      expect(job?.requiredSkills).toContain('c++');
      expect(job?.requiredSkills).toContain('docker');
    });

    it('G8: should document DOM veto sensitivity when .post-date is present in non-job articles', () => {
      const blogUrl = 'https://engineering-blog.techcorp.com/articles/scaling-backend';
      const blogHtml = `
        <!DOCTYPE html>
        <html>
          <head><title>Scaling Backend Systems - Tech Blog</title></head>
          <body>
            <h1>Scaling Backend Systems</h1>
            <div class="post-date">Published on March 15, 2026</div>
            <p>Here are the system design requirements for microservices architectures.</p>
          </body>
        </html>
      `;
      const blogDoc = parser.parseFromString(blogHtml, 'text/html');
      const vetoResult = jobClassifier.evaluateNegativeVeto(blogUrl, blogDoc);
      expect(vetoResult.vetoed).toBe(true);
      expect(vetoResult.reasons.some((r) => r.includes('VETO_DOM_ARTICLE_META'))).toBe(true);
    });
  });
});

