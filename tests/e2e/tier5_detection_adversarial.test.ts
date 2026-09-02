import { describe, it, expect } from 'vitest';
import {
  jobClassifier,
  extractJobPostingSchema,
} from '../../src/content/detection/jobClassifier';
import { scraperRegistry } from '../../src/content/scrapers/scraperRegistry';
import { GreenhouseScraper } from '../../src/content/scrapers/greenhouseScraper';
import { LeverScraper } from '../../src/content/scrapers/leverScraper';
import { WorkdayScraper } from '../../src/content/scrapers/workdayScraper';
import { AshbyScraper } from '../../src/content/scrapers/ashbyScraper';
import { LinkedInScraper } from '../../src/content/scrapers/linkedinScraper';
import { IndeedScraper } from '../../src/content/scrapers/indeedScraper';
import { GenericScraper } from '../../src/content/scrapers/genericScraper';
import {
  cleanText,
  extractSkillsFromText,
  normalizeForMatching,
} from '../../src/content/scrapers/keywordExtractor';
import { createDomDocument } from '../helpers/domUtils';

describe('Tier 5: Detection Engine & Platform Scrapers Adversarial Hardening Suite (28 Tests)', () => {


  // =========================================================================
  // Category 1: Schema.org JSON-LD Malformed & Deeply Nested Graph Traversal
  // =========================================================================
  describe('Category 1: Schema.org JSON-LD Malformed & Deeply Nested Graph Traversal', () => {
    it('T5-DET-01: should recover valid JobPosting when preceded by corrupted/invalid JSON-LD script tag', () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <script type="application/ld+json">
              { "malformed": true, "unclosed_bracket": [
            </script>
            <script type="application/ld+json">
              {
                "@context": "https://schema.org",
                "@type": "WebSite",
                "name": "Acme Portal"
              }
            </script>
            <script type="application/ld+json">
              {
                "@context": "https://schema.org",
                "@type": "JobPosting",
                "title": "Principal Distributed Systems Engineer",
                "hiringOrganization": {
                  "@type": "Organization",
                  "name": "Acme Cloud"
                },
                "description": "We are seeking a Principal Engineer to scale our distributed database cluster across multi-region AWS and Kubernetes.",
                "jobLocation": {
                  "@type": "Place",
                  "address": {
                    "addressLocality": "Seattle",
                    "addressRegion": "WA",
                    "addressCountry": "US"
                  }
                },
                "directApply": true
              }
            </script>
          </head>
          <body><h1>Acme Job Posting</h1></body>
        </html>
      `;
      const doc = createDomDocument(html);
      const schema = extractJobPostingSchema(doc);

      expect(schema).not.toBeNull();
      expect(schema?.title).toBe('Principal Distributed Systems Engineer');
      expect(schema?.hiringOrganization).toBe('Acme Cloud');
      expect(schema?.jobLocation?.addressLocality).toBe('Seattle');
      expect(schema?.directApply).toBe(true);

      const classification = jobClassifier.classify('https://jobs.acmecloud.com/openings/1234', doc);
      expect(classification.isJobPage).toBe(true);
      expect(classification.score).toBeGreaterThanOrEqual(70);
      expect(classification.positiveSignals).toContain('SCHEMA_ORG_JOB_POSTING');
    });

    it('T5-DET-02: should traverse deeply nested @graph array containing mixed objects and arrays', () => {
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
                  "itemListElement": [{ "@type": "ListItem", "position": 1, "name": "Careers" }]
                },
                [
                  {
                    "@type": "Organization",
                    "name": "Fintech Global"
                  },
                  {
                    "@graph": [
                      {
                        "@type": "JobPosting",
                        "title": "Senior Rust Backend Developer",
                        "hiringOrganization": "Fintech Global Inc",
                        "description": "Build high-throughput low-latency order execution engines using Rust, Tokio, WebSockets, and Kafka with microsecond SLAs.",
                        "employmentType": "FULL_TIME"
                      }
                    ]
                  }
                ]
              ]
            }
            </script>
          </head>
          <body><h1>Job Board</h1></body>
        </html>
      `;
      const doc = createDomDocument(html);
      const schema = extractJobPostingSchema(doc);

      expect(schema).not.toBeNull();
      expect(schema?.title).toBe('Senior Rust Backend Developer');
      expect(schema?.hiringOrganization).toBe('Fintech Global Inc');
      expect(schema?.description).toContain('high-throughput low-latency');
      expect(schema?.employmentType).toBe('FULL_TIME');
    });

    it('T5-DET-03: should sanitize HTML entities and script tags in Schema.org description and handle type array', () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": ["JobPosting", "https://schema.org/Thing"],
              "title": "Staff Full Stack Engineer &lt;script&gt;alert(1)&lt;/script&gt;",
              "hiringOrganization": { "@type": "Organization", "name": "SecureCorp &amp; Co" },
              "description": "&lt;div&gt;&lt;p&gt;Looking for a Staff Full Stack Engineer with &lt;strong&gt;React &amp; Node.js&lt;/strong&gt; expertise to build secure fintech systems.&lt;/p&gt;&lt;/div&gt;",
              "directApply": "true"
            }
            </script>
          </head>
          <body><h1>Careers</h1></body>
        </html>
      `;
      const doc = createDomDocument(html);
      const schema = extractJobPostingSchema(doc);

      expect(schema).not.toBeNull();
      expect(schema?.title).toBe('Staff Full Stack Engineer &lt;script&gt;alert(1)&lt;/script&gt;');
      expect(schema?.directApply).toBe(true);
      expect(schema?.description).toContain('React');
    });

    it('T5-DET-04: should handle malformed jobLocation and baseSalary variations without throwing', () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "JobPosting",
              "title": "Machine Learning Engineer",
              "description": "Design and train large language models and transformer architectures with PyTorch and CUDA at massive scale.",
              "jobLocation": {
                "@type": "Place",
                "address": "San Francisco, CA, USA"
              },
              "baseSalary": {
                "@type": "MonetaryAmount",
                "currency": "USD",
                "value": {
                  "minValue": 190000,
                  "maxValue": 275000,
                  "unitText": "YEAR"
                }
              }
            }
            </script>
          </head>
          <body><h1>ML Opening</h1></body>
        </html>
      `;
      const doc = createDomDocument(html);
      const schema = extractJobPostingSchema(doc);

      expect(schema).not.toBeNull();
      expect(schema?.jobLocation?.addressLocality).toBe('San Francisco, CA, USA');
      expect(schema?.baseSalary?.currency).toBe('USD');
      expect(schema?.baseSalary?.minValue).toBe(190000);
      expect(schema?.baseSalary?.maxValue).toBe(275000);
    });

    it('T5-DET-05: should ignore non-JobPosting Schema.org types (Course, Article, Product, Event)', () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "Course",
              "name": "Advanced Distributed Systems and Kubernetes",
              "description": "Master microservices, raft consensus, and container orchestration. Requirements: 2+ years of software engineer experience.",
              "provider": { "@type": "Organization", "name": "TechAcademy" }
            }
            </script>
          </head>
          <body><h1>Course</h1></body>
        </html>
      `;
      const doc = createDomDocument(html);
      const schema = extractJobPostingSchema(doc);

      expect(schema).toBeNull();
    });

    it('T5-DET-06: should preserve emojis, unicode symbols, and trademark symbols in Schema.org titles', () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "JobPosting",
              "title": "🚀 Senior AI Research Engineer (LLM & Agents) 🌟",
              "hiringOrganization": "NeuroTech™ Robotics 🤖",
              "description": "Join our AI research team building autonomous agents with PyTorch, LangChain, Transformers, and Python.",
              "jobLocation": "Tokyo, Japan 🇯🇵"
            }
            </script>
          </head>
          <body><h1>Job</h1></body>
        </html>
      `;
      const doc = createDomDocument(html);
      const schema = extractJobPostingSchema(doc);

      expect(schema).not.toBeNull();
      expect(schema?.title).toContain('🚀');
      expect(schema?.title).toContain('🌟');
      expect(schema?.hiringOrganization).toContain('™');
      expect(schema?.hiringOrganization).toContain('🤖');
      expect(schema?.jobLocation?.addressLocality).toContain('🇯🇵');
    });
  });

  // =========================================================================
  // Category 2: Deceptive Non-Job Content & Boundary False Positive Suppression
  // =========================================================================
  describe('Category 2: Deceptive Non-Job Content & Boundary False Positive Suppression', () => {
    it('T5-DET-07: should veto Substack engineering newsletter discussing job compensation and interview prep', () => {
      const url = 'https://pragmaticengineer.substack.com/p/software-engineering-salaries-in-2026';
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Software Engineering Salaries in 2026 - The Pragmatic Engineer</title>
            <meta property="article:published_time" content="2026-03-01T08:00:00Z" />
          </head>
          <body>
            <header>
              <div class="byline">By Gergely Orosz</div>
              <div class="post-date">March 1, 2026</div>
            </header>
            <article>
              <h1>Software Engineering Salaries in 2026</h1>
              <p>Senior Software Engineers and Staff Architects in San Francisco and New York are seeing compensation packages range from $220,000 to $450,000.</p>
              <h2>Key Requirements</h2>
              <p>Top paying tiers require distributed systems, Kubernetes, and Golang expertise.</p>
              <p>Apply these negotiation strategies when receiving an offer.</p>
            </article>
            <div class="comments-section">
              <h3>Comments (142)</h3>
            </div>
          </body>
        </html>
      `;
      const doc = createDomDocument(html);
      const result = jobClassifier.classify(url, doc);

      expect(result.isJobPage).toBe(false);
      expect(result.score).toBe(0);
      expect(result.confidence).toBe('none');
      expect(result.negativeSignals.length).toBeGreaterThan(0);
    });

    it('T5-DET-08: should veto university course catalog and admission syllabus containing "Apply Now"', () => {
      const url = 'https://cs.university.edu/courses/fall2026/advanced-algorithms';
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>CS 4820: Advanced Algorithms & Graph Theory</title></head>
          <body>
            <nav class="course-syllabus">
              <h2>Course Syllabus</h2>
              <ul><li>Week 1: Dynamic Programming</li><li>Week 2: Network Flow</li></ul>
            </nav>
            <main>
              <h1>CS 4820: Advanced Algorithms & Graph Theory</h1>
              <div class="lesson-meta">4 Credit Hours · Prerequisites: CS 2110</div>
              <h2>Course Requirements & Expectations</h2>
              <p>Students must be proficient in Java or Python and discrete mathematics.</p>
              <h2>Responsibilities</h2>
              <p>Complete weekly problem sets and a final capstone project.</p>
              <a href="/admissions/apply" class="enroll-btn">Apply for Fall Semester</a>
            </main>
          </body>
        </html>
      `;
      const doc = createDomDocument(html);
      const result = jobClassifier.classify(url, doc);

      expect(result.isJobPage).toBe(false);
      expect(result.score).toBe(0);
      expect(result.confidence).toBe('none');
    });

    it('T5-DET-09: should veto API documentation with "Job" controller specifications on ReadTheDocs', () => {
      const url = 'https://celery-docs.readthedocs.io/en/stable/userguide/tasks.html';
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Tasks and Background Jobs — Celery Documentation</title></head>
          <body>
            <div class="toc-wrapper">
              <nav class="toc"><h2>Table of contents</h2></nav>
            </div>
            <main>
              <h1>Celery Background Job Execution</h1>
              <h2>Task Requirements</h2>
              <p>Every asynchronous job must be decorated with <code>@app.task</code> and accept serializable JSON parameters.</p>
              <h2>Worker Responsibilities</h2>
              <p>The worker daemon consumes messages from Redis or RabbitMQ queues.</p>
              <p>Apply rate limits with <code>rate_limit="10/m"</code>.</p>
            </main>
          </body>
        </html>
      `;
      const doc = createDomDocument(html);
      const result = jobClassifier.classify(url, doc);

      expect(result.isJobPage).toBe(false);
      expect(result.score).toBe(0);
    });

    it('T5-DET-10: should veto SaaS pricing calculator page with "Full-time support" and checkout cart', () => {
      const url = 'https://devmetrics.io/pricing?tier=enterprise';
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Pricing & Plans — DevMetrics Enterprise</title></head>
          <body>
            <h1>Enterprise Telemetry Plan</h1>
            <div class="product-price">$499 / month</div>
            <h2>What is Included</h2>
            <p>Full-time 24/7 dedicated support from Senior DevOps Engineers and Solutions Architects.</p>
            <h3>Service Requirements</h3>
            <p>Requires Docker agent or Kubernetes daemonset installed on cluster.</p>
            <form class="cart" action="/checkout">
              <button name="add-to-cart" class="add-to-cart">Add to Cart</button>
            </form>
          </body>
        </html>
      `;
      const doc = createDomDocument(html);
      const result = jobClassifier.classify(url, doc);

      expect(result.isJobPage).toBe(false);
      expect(result.score).toBe(0);
    });

    it('T5-DET-11: should veto Reddit developer discussion thread about job interviews', () => {
      const url = 'https://www.reddit.com/r/cscareerquestions/comments/xyz123/how_to_pass_staff_engineer_system_design_interview/';
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>How to pass Staff Engineer System Design Interview : cscareerquestions</title></head>
          <body>
            <h1>How to pass Staff Engineer System Design Interview</h1>
            <div class="post-content">
              <p>I recently interviewed for a Staff Backend Engineer role at Netflix and Stripe. Here are the requirements and architectural responsibilities discussed...</p>
            </div>
            <div id="comments-list" class="comments-area">
              <div class="comment">Great breakdown! What about Kubernetes and Kafka scaling?</div>
            </div>
          </body>
        </html>
      `;
      const doc = createDomDocument(html);
      const result = jobClassifier.classify(url, doc);

      expect(result.isJobPage).toBe(false);
      expect(result.score).toBe(0);
    });

    it('T5-DET-12: should veto interactive competitive programming problem on HackerRank', () => {
      const url = 'https://www.hackerrank.com/challenges/merge-k-sorted-lists/problem';
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Merge k Sorted Lists | HackerRank</title></head>
          <body>
            <div class="problem-statement">
              <h1>Merge k Sorted Lists</h1>
              <h2>Problem Requirements</h2>
              <p>Given an array of k linked-lists lists, each linked-list is sorted in ascending order.</p>
              <h2>Constraints</h2>
              <p>k &gt;= 0 and k &lt;= 10^4</p>
            </div>
            <div class="ace_editor"></div>
            <div class="testcase-container">
              <button class="run-code-btn">Run Code</button>
            </div>
          </body>
        </html>
      `;
      const doc = createDomDocument(html);
      const result = jobClassifier.classify(url, doc);

      expect(result.isJobPage).toBe(false);
      expect(result.score).toBe(0);
    });
  });

  // =========================================================================
  // Category 3: Platform Scraper White-Box Boundary & Edge Case Stress Testing
  // =========================================================================
  describe('Category 3: Platform Scraper White-Box Boundary & Edge Case Stress Testing', () => {
    const greenhouseScraper = new GreenhouseScraper();
    const leverScraper = new LeverScraper();
    const workdayScraper = new WorkdayScraper();
    const ashbyScraper = new AshbyScraper();
    const linkedinScraper = new LinkedInScraper();
    const indeedScraper = new IndeedScraper();
    const genericScraper = new GenericScraper();

    it('T5-DET-13: Greenhouse: should handle missing .company-name by falling back to document title "Role at Company"', () => {
      const url = 'https://boards.greenhouse.io/figma/jobs/77889900';
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Staff Security Engineer at Figma</title></head>
          <body>
            <div id="app_body">
              <h1 class="app-title">Staff Security Engineer</h1>
              <div class="location">San Francisco, CA (Remote)</div>
              <div id="content">
                <p>Figma is looking for a Staff Security Engineer to lead cloud infrastructure security, threat modeling, and zero-trust IAM.</p>
                <h3>Requirements</h3>
                <p>7+ years experience in AWS security, Kubernetes, Go, Python, Terraform, and OAuth/SAML protocols.</p>
              </div>
            </div>
          </body>
        </html>
      `;
      const doc = createDomDocument(html);
      expect(greenhouseScraper.canHandle(url, doc)).toBe(true);

      const job = greenhouseScraper.scrape(url, doc);
      expect(job).not.toBeNull();
      expect(job?.title).toBe('Staff Security Engineer');
      expect(job?.company).toBe('Figma');
      expect(job?.remoteStatus).toBe('Remote');
      expect(job?.requiredSkills).toContain('aws');
      expect(job?.requiredSkills).toContain('kubernetes');
      expect(job?.requiredSkills).toContain('go');
      expect(job?.requiredSkills).toContain('terraform');
    });

    it('T5-DET-14: Lever: should extract company from URL slug when header logo and alt tags are missing', () => {
      const url = 'https://jobs.lever.co/databricks/a1b2c3d4-e5f6';
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Databricks Career Portal</title></head>
          <body>
            <div class="posting-headline">
              <h2>Principal AI Platform Engineer</h2>
            </div>
            <div class="posting-categories">
              <span class="location">Mountain View, CA</span>
              <span class="workplaceTypes">Hybrid</span>
            </div>
            <div class="section-wrapper">
              <h3>Role Overview</h3>
              <p>Scale our distributed ML model training and serving infrastructure using Apache Spark, PyTorch, Ray, and Kubernetes.</p>
              <h3>Qualifications</h3>
              <p>Strong background in distributed computing, Python, Scala, C++, Docker, and CUDA acceleration.</p>
            </div>
          </body>
        </html>
      `;
      const doc = createDomDocument(html);
      expect(leverScraper.canHandle(url, doc)).toBe(true);

      const job = leverScraper.scrape(url, doc);
      expect(job).not.toBeNull();
      expect(job?.title).toBe('Principal AI Platform Engineer');
      expect(job?.company).toBe('Databricks');
      expect(job?.remoteStatus).toBe('Hybrid');
      expect(job?.requiredSkills).toContain('spark');
      expect(job?.requiredSkills).toContain('pytorch');
      expect(job?.requiredSkills).toContain('python');
    });

    it('T5-DET-15: Workday: should parse nested wd-subdomain, requisition metadata, and remote variations', () => {
      const url = 'https://adobe.wd5.myworkdayjobs.com/en-US/external_experienced/job/San-Jose-CA/Lead-Machine-Learning-Architect_24-8844';
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Lead Machine Learning Architect - Adobe Careers</title></head>
          <body>
            <div data-automation-id="jobPostingPage">
              <div data-automation-id="jobPostingHeader">
                <h1>Lead Machine Learning Architect</h1>
              </div>
              <img data-automation-id="clientLogo" alt="Adobe Systems Logo" src="/adobe.svg" />
              <div data-automation-id="jobPostingLocation">San Jose, CA (Virtual / Home-Based)</div>
              <div data-automation-id="jobPostingId">REQ-24-8844</div>
              <div data-automation-id="postedOn">Posted Yesterday</div>
              <div data-automation-id="jobPostingDescription">
                <p>Adobe is seeking a Lead ML Architect to drive generative AI foundation model training for Creative Cloud applications.</p>
                <h3>Requirements</h3>
                <p>8+ years experience in Python, PyTorch, Deep Learning, LLMs, CUDA, Docker, Kubernetes, and AWS infrastructure.</p>
              </div>
            </div>
          </body>
        </html>
      `;
      const doc = createDomDocument(html);
      expect(workdayScraper.canHandle(url, doc)).toBe(true);

      const job = workdayScraper.scrape(url, doc);
      expect(job).not.toBeNull();
      expect(job?.title).toBe('Lead Machine Learning Architect');
      expect(job?.company).toBe('Adobe Systems');
      expect(job?.remoteStatus).toBe('Remote');
      expect(job?.qualifications).toContain('Requisition ID: REQ-24-8844');
      expect(job?.qualifications).toContain('Posted: Posted Yesterday');
      expect(job?.requiredSkills).toContain('pytorch');
      expect(job?.requiredSkills).toContain('deep learning');
      expect(job?.requiredSkills).toContain('python');
      expect(job?.requiredSkills).toContain('cuda');
    });

    it('T5-DET-16: Ashby: should extract job on custom domain with team and employment type metadata', () => {
      const url = 'https://careers.notion.so/jobs/staff-infrastructure-engineer';
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Staff Infrastructure Engineer - Notion</title>
            <meta property="og:site_name" content="Notion" />
            <meta name="ashby-job-id" content="ash_notion_44321" />
          </head>
          <body>
            <div class="_container_abc12">
              <h1 data-testid="job-posting-title">Staff Infrastructure Engineer</h1>
              <div data-testid="job-department">Core Infrastructure</div>
              <div data-testid="job-employment-type">Full-Time</div>
              <div data-testid="job-location">San Francisco, CA (Hybrid)</div>
              <div data-testid="job-description">
                <p>Notion is looking for a Staff Infrastructure Engineer to scale our PostgreSQL sharding, Redis caching, and AWS Kubernetes platform.</p>
                <h3>Requirements</h3>
                <p>Extensive experience with PostgreSQL performance tuning, Terraform, TypeScript, Node.js, and distributed caching systems.</p>
              </div>
            </div>
          </body>
        </html>
      `;
      const doc = createDomDocument(html);
      expect(ashbyScraper.canHandle(url, doc)).toBe(true);

      const job = ashbyScraper.scrape(url, doc);
      expect(job).not.toBeNull();
      expect(job?.title).toBe('Staff Infrastructure Engineer');
      expect(job?.company).toBe('Notion');
      expect(job?.remoteStatus).toBe('Hybrid');
      expect(job?.qualifications).toContain('Department: Core Infrastructure');
      expect(job?.qualifications).toContain('Employment Type: Full-Time');
      expect(job?.requiredSkills).toContain('postgresql');
      expect(job?.requiredSkills).toContain('redis');
      expect(job?.requiredSkills).toContain('terraform');
      expect(job?.requiredSkills).toContain('typescript');
    });

    it('T5-DET-17: LinkedIn: should extract seniority level from insight tags and parse job view URL', () => {
      const url = 'https://www.linkedin.com/jobs/view/4011223344/?trackingId=xyz';
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Principal Software Engineer at Stripe | LinkedIn</title></head>
          <body>
            <h1 class="job-details-jobs-unified-top-card__job-title">Principal Software Engineer</h1>
            <div class="job-details-jobs-unified-top-card__company-name">Stripe</div>
            <div class="job-details-jobs-unified-top-card__primary-description-container">Seattle, WA (On-site)</div>
            <div class="job-details-jobs-unified-top-card__job-insight">Senior Level · Full-time</div>
            <div id="job-details">
              <p>Stripe is building global economic infrastructure. We are hiring a Principal Software Engineer to architect payment rails.</p>
              <h3>Requirements</h3>
              <p>10+ years experience in Ruby, Java, Go, distributed databases, high availability architecture, and PCI compliance.</p>
            </div>
          </body>
        </html>
      `;
      const doc = createDomDocument(html);
      expect(linkedinScraper.canHandle(url, doc)).toBe(true);

      const job = linkedinScraper.scrape(url, doc);
      expect(job).not.toBeNull();
      expect(job?.title).toBe('Principal Software Engineer');
      expect(job?.company).toBe('Stripe');
      expect(job?.location).toBe('Seattle, WA (On-site)');
      expect(job?.remoteStatus).toBe('On-site');
      expect(job?.seniority).toContain('Senior Level');
      expect(job?.requiredSkills).toContain('ruby');
      expect(job?.requiredSkills).toContain('java');
      expect(job?.requiredSkills).toContain('go');
    });

    it('T5-DET-18: Indeed: should extract from Indeed JobComponent description and inline headers', () => {
      const url = 'https://www.indeed.com/viewjob?jk=abcdef0123456789';
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Full Stack Cloud Developer - Austin, TX - Indeed.com</title></head>
          <body>
            <div class="jobsearch-JobComponent">
              <h1 class="jobsearch-JobInfoHeader-title" data-testid="jobsearch-JobInfoHeader-title">Full Stack Cloud Developer</h1>
              <div data-testid="inlineHeader-companyName">CloudWorks Inc</div>
              <div data-testid="inlineHeader-companyLocation">Austin, TX (Remote)</div>
              <div id="jobDescriptionText">
                <p>CloudWorks is looking for a Full Stack Cloud Developer to build enterprise web applications.</p>
                <h3>Qualifications</h3>
                <p>3+ years experience with React, TypeScript, Node.js, AWS Lambda, Docker, and PostgreSQL databases.</p>
              </div>
            </div>
          </body>
        </html>
      `;
      const doc = createDomDocument(html);
      expect(indeedScraper.canHandle(url, doc)).toBe(true);

      const job = indeedScraper.scrape(url, doc);
      expect(job).not.toBeNull();
      expect(job?.title).toBe('Full Stack Cloud Developer');
      expect(job?.company).toBe('CloudWorks Inc');
      expect(job?.remoteStatus).toBe('Remote');
      expect(job?.requiredSkills).toContain('react');
      expect(job?.requiredSkills).toContain('typescript');
      expect(job?.requiredSkills).toContain('node.js');
      expect(job?.requiredSkills).toContain('postgresql');
    });

    it('T5-DET-19: Generic Scraper: should reject pages with description < 100 characters', () => {
      const url = 'https://careers.startup.io/jobs/test-role';
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Frontend Dev</title></head>
          <body>
            <h1 class="job-title">Frontend Dev</h1>
            <div class="job-description">Short text.</div>
            <a href="/apply" class="apply-btn">Apply</a>
          </body>
        </html>
      `;
      const doc = createDomDocument(html);
      const job = genericScraper.scrape(url, doc);
      expect(job).toBeNull();
    });
  });

  // =========================================================================
  // Category 4: Degenerate, Empty, Extreme & Unicode Invariant Stress Tests
  // =========================================================================
  describe('Category 4: Degenerate, Empty, Extreme & Unicode Invariant Stress Tests', () => {
    it('T5-DET-20: should safely return isJobPage: false on zero-byte and empty DOMs without exceptions', () => {
      const emptyDoc = createDomDocument('');
      const emptyResult = jobClassifier.classify('https://example.com', emptyDoc);
      expect(emptyResult.isJobPage).toBe(false);
      expect(emptyResult.score).toBe(0);
      expect(emptyResult.confidence).toBe('none');

      const minimalDoc = createDomDocument('<!DOCTYPE html><html><head></head><body></body></html>');
      const minimalResult = jobClassifier.classify('https://example.com/page', minimalDoc);
      expect(minimalResult.isJobPage).toBe(false);
      expect(minimalResult.score).toBe(0);

      // Scrapers should return null cleanly on empty DOM
      expect(scraperRegistry.detectAndScrape('https://example.com', emptyDoc)).toBeNull();
    });

    it('T5-DET-21: should handle 50-level deeply nested DOM without call stack overflow', () => {
      let nestedHtml = '<h1 class="job-title">Staff Site Reliability Engineer</h1><div class="location">San Francisco, CA (Remote)</div><div class="job-description"><p>We are hiring an SRE with 5+ years of Kubernetes, Terraform, AWS, and Go experience to manage high-availability infrastructure.</p><p>Responsibilities include on-call rotations, incident management, and automated deployments.</p><p>Requirements: Docker, Prometheus, CI/CD pipelines, and Linux internals.</p></div><button class="apply-button">Apply Now</button>';
      for (let i = 0; i < 50; i++) {
        nestedHtml = `<div>${nestedHtml}</div>`;
      }
      const fullHtml = `<!DOCTYPE html><html><head><title>Staff SRE</title></head><body>${nestedHtml}</body></html>`;
      const doc = createDomDocument(fullHtml);

      const classification = jobClassifier.classify('https://careers.scaleplatform.com/careers/infra/staff-sre', doc);
      expect(classification.isJobPage).toBe(true);
      expect(classification.score).toBeGreaterThanOrEqual(65);

      const job = scraperRegistry.detectAndScrape('https://careers.scaleplatform.com/careers/infra/staff-sre', doc);
      expect(job).not.toBeNull();
      expect(job?.title).toBe('Staff Site Reliability Engineer');
      expect(job?.requiredSkills).toContain('kubernetes');
      expect(job?.requiredSkills).toContain('terraform');
      expect(job?.requiredSkills).toContain('aws');
      expect(job?.requiredSkills).toContain('go');
    });

    it('T5-DET-22: should efficiently process large 2MB DOM payload within performance threshold', () => {
      const paragraph = '<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Building scalable microservices with React, TypeScript, Python, and PostgreSQL in cloud environments.</p>';
      const hugeContent = paragraph.repeat(2000); // ~300KB HTML

      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Large Enterprise Job Posting</title></head>
          <body>
            <h1 class="job-title">Enterprise Cloud Solutions Architect</h1>
            <div class="location">New York, NY (Hybrid)</div>
            <div class="job-description">
              <p>We are seeking an Enterprise Cloud Solutions Architect to design distributed architectures.</p>
              <h3>Requirements</h3>
              <p>Proficiency in AWS, Kubernetes, Terraform, Python, Docker, and Java.</p>
              ${hugeContent}
            </div>
            <a href="#apply" class="apply-button">Apply Now</a>
          </body>
        </html>
      `;

      const startTime = performance.now();
      const doc = createDomDocument(html);
      const classification = jobClassifier.classify('https://careers.megacorp.com/jobs/arch-99', doc);
      const endTime = performance.now();

      expect(classification.isJobPage).toBe(true);
      expect(endTime - startTime).toBeLessThan(1000); // executes well within 1s
    });

    it('T5-DET-23: should preserve non-ASCII, international characters, and RTL scripts in title and company', () => {
      const title = 'مهندس برمجيات أول — Lead Architect & Söhne GmbH';
      const cleaned = cleanText(`   ${title}   \n\n\t `);
      expect(cleaned).toBe(title);

      const skills = extractSkillsFromText('Expert in C++, C#, .NET, Node.js, CI/CD, React.js, and WebSockets');
      expect(skills).toContain('c++');
      expect(skills).toContain('c#');
      expect(skills).toContain('.net');
      expect(skills).toContain('node.js');
      expect(skills).toContain('ci/cd');
      expect(skills).toContain('react.js');
      expect(skills).toContain('websockets');
    });

    it('T5-DET-24: ScraperRegistry should safely handle invalid URLs and throw zero unhandled errors', () => {
      const doc = createDomDocument('<div>Random text</div>');
      
      expect(() => scraperRegistry.getScraper('not-a-valid-url', doc)).not.toThrow();
      expect(() => scraperRegistry.detectAndScrape('not-a-valid-url', doc)).not.toThrow();
      expect(scraperRegistry.getScraperByName('NonExistentPlatform')).toBeNull();
    });
  });

  // =========================================================================
  // Category 5: End-to-End Adversarial Detection-to-Scraper Pipeline Integrations
  // =========================================================================
  describe('Category 5: End-to-End Adversarial Detection-to-Scraper Pipeline Integrations', () => {
    it('T5-DET-25: Multi-stage pipeline: Detection -> Scraper Dispatch -> Data Normalization on Ashby ML job', () => {
      const url = 'https://jobs.ashbyhq.com/anthropic/f7a8b9c0-1234-5678-90ab-cdef12345678';
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Research Engineer, Scalable Alignment - Anthropic</title></head>
          <body>
            <div class="_header_xyz123">
              <h1 data-testid="job-posting-title">Research Engineer, Scalable Alignment</h1>
              <div data-testid="job-posting-company">Anthropic</div>
              <div data-testid="job-location">San Francisco, CA</div>
              <div data-testid="job-department">Alignment Science</div>
              <div data-testid="job-employment-type">Full-time</div>
            </div>
            <div data-testid="job-description">
              <h3>Role Overview</h3>
              <p>We are seeking a Research Engineer to work on scalable oversight and reinforcement learning from human feedback (RLHF).</p>
              <h3>Requirements</h3>
              <p>Strong programming skills in Python, PyTorch, JAX, CUDA, distributed training, and transformer architectures.</p>
            </div>
            <a href="#apply" class="apply-btn">Apply for this job</a>
          </body>
        </html>
      `;
      const doc = createDomDocument(html);

      // 1. Classification
      const classification = jobClassifier.classify(url, doc);
      expect(classification.isJobPage).toBe(true);
      expect(classification.score).toBeGreaterThanOrEqual(80);
      expect(classification.matchedPlatform).toBe('jobs.ashbyhq.com');

      // 2. Scraper Dispatch
      const scraper = scraperRegistry.getScraper(url, doc);
      expect(scraper).not.toBeNull();
      expect(scraper?.name).toBe('Ashby');

      // 3. Scraping & Data Extraction
      const job = scraperRegistry.detectAndScrape(url, doc);
      expect(job).not.toBeNull();
      expect(job?.title).toBe('Research Engineer, Scalable Alignment');
      expect(job?.company).toBe('Anthropic');
      expect(job?.location).toBe('San Francisco, CA');
      expect(job?.requiredSkills).toContain('python');
      expect(job?.requiredSkills).toContain('pytorch');
      expect(job?.requiredSkills).toContain('cuda');
      expect(job?.source).toBe('ashby');
    });

    it('T5-DET-26: GenericScraper should prioritize Schema.org structured data over noisy DOM elements', () => {
      const url = 'https://startupcareers.io/positions/lead-fullstack';
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Generic Startup Page</title>
            <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "JobPosting",
              "title": "Lead Full Stack Architect (Official Schema)",
              "hiringOrganization": { "@type": "Organization", "name": "VentureScale AI" },
              "description": "Lead full stack architecture using TypeScript, Next.js, GraphQL, PostgreSQL, and AWS.",
              "jobLocation": { "@type": "Place", "address": "New York, NY" },
              "employmentType": "FULL_TIME"
            }
            </script>
          </head>
          <body>
            <!-- Noisy DOM with conflicting title text -->
            <h1>We are hiring across engineering!</h1>
            <p>Check out our open roles below.</p>
          </body>
        </html>
      `;
      const doc = createDomDocument(html);

      const classification = jobClassifier.classify(url, doc);
      expect(classification.isJobPage).toBe(true);
      expect(classification.schemaJobPosting).toBeDefined();

      const job = scraperRegistry.detectAndScrape(url, doc, classification.schemaJobPosting);
      expect(job).not.toBeNull();
      expect(job?.title).toBe('Lead Full Stack Architect (Official Schema)');
      expect(job?.company).toBe('VentureScale AI');
      expect(job?.location).toBe('New York, NY');
      expect(job?.requiredSkills).toContain('typescript');
      expect(job?.requiredSkills).toContain('next.js');
      expect(job?.requiredSkills).toContain('graphql');
      expect(job?.requiredSkills).toContain('postgresql');
    });

    it('T5-DET-27: Veto override: Negative veto URL takes absolute precedence over positive DOM signals', () => {
      const url = 'https://algomaster.io/learn/system-design/job-queue-architecture';
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Job Queue Architecture — AlgoMaster System Design</title></head>
          <body>
            <!-- High positive signal triggers placed inside course page -->
            <div id="job-details">
              <h1>Job Queue Architecture</h1>
              <div class="posting-categories">
                <span>San Francisco, CA</span>
                <span>Full-time</span>
              </div>
              <div id="content" class="job-description">
                <p>Responsibilities of a background job queue worker in distributed architectures.</p>
                <p>Requirements: Redis, Celery, RabbitMQ, Kafka, Python, Go.</p>
              </div>
              <button class="apply-button">Apply Pattern</button>
            </div>
          </body>
        </html>
      `;
      const doc = createDomDocument(html);
      const result = jobClassifier.classify(url, doc);

      expect(result.isJobPage).toBe(false);
      expect(result.score).toBe(0);
      expect(result.confidence).toBe('none');
      expect(result.positiveSignals).toHaveLength(0);
      expect(result.negativeSignals.length).toBeGreaterThan(0);

      // Verify naked URLs without leading www. or path vetoes are strictly vetoed at domain level
      const nakedVetoUrls = [
        'https://algomaster.io/about',
        'https://devdocs.io/javascript/',
        'https://coursera.org/specializations/',
        'https://w3schools.com/tags/',
      ];
      for (const nakedUrl of nakedVetoUrls) {
        const nakedResult = jobClassifier.classify(nakedUrl, doc);
        expect(nakedResult.isJobPage).toBe(false);
        expect(nakedResult.score).toBe(0);
        expect(nakedResult.confidence).toBe('none');
        expect(nakedResult.negativeSignals.length).toBeGreaterThan(0);
      }
    });

    it('T5-DET-28: Keyword normalizer preserves complex tech names with special punctuation', () => {
      const rawText = 'Requires C++, C#, .NET Core, Node.js, Vue.js, CI/CD, Next.js, REST API, and TCP/IP.';
      const normalized = normalizeForMatching(rawText);
      const extracted = extractSkillsFromText(rawText);

      expect(normalized).toContain('c++');
      expect(normalized).toContain('c#');
      expect(normalized).toContain('.net');
      expect(normalized).toContain('node.js');
      expect(normalized).toContain('ci/cd');

      expect(extracted).toContain('c++');
      expect(extracted).toContain('c#');
      expect(extracted).toContain('.net');
      expect(extracted).toContain('node.js');
      expect(extracted).toContain('vue.js');
      expect(extracted).toContain('ci/cd');
      expect(extracted).toContain('next.js');
      expect(extracted).toContain('rest api');
    });

    it('T5-DET-29: Exhaustive naked URL domain-level veto on learning and documentation platforms', () => {
      const educationalAndDocNakedUrls = [
        'https://algomaster.io/topics/trees',
        'http://algomaster.io/system-design',
        'https://leetcode.com/problems/two-sum',
        'https://coursera.org/specializations/python',
        'https://udemy.com/topic/web-development',
        'https://edx.org/programs/masters',
        'https://pluralsight.com/paths/react',
        'https://freecodecamp.org/news/learn-javascript',
        'https://codecademy.com/catalog/language/python',
        'https://khanacademy.org/computing/computer-science',
        'https://educative.io/courses/grokking-the-system-design-interview',
        'https://frontendmentor.io/challenges',
        'https://hackerrank.com/challenges/simple-array-sum',
        'https://geeksforgeeks.org/binary-search',
        'https://developer.mozilla.org/en-US/docs/Web/JavaScript',
        'https://w3schools.com/tags/default.asp',
        'https://wikipedia.org/wiki/Computer_science',
        'https://wikimedia.org/index.html',
        'https://devdocs.io/javascript/',
        'https://readthedocs.io/en/stable/',
        'https://gitbook.io/spaces/engineering',
        'https://pkg.go.dev/net/http',
        'https://caniuse.com/css-grid',
      ];

      const highSignalAdversarialHtml = `
        <!DOCTYPE html>
        <html>
          <head><title>Senior Architect - Platform & Infrastructure Overview</title></head>
          <body>
            <div id="job-details">
              <h1>Senior Full Stack Software Architect</h1>
              <div class="salary-range">$180,000 - $240,000 / year</div>
              <div class="job-description">
                <h2>Role Overview & Responsibilities</h2>
                <p>Lead core engineering, design microservices, and scale Kubernetes clusters.</p>
                <h2>Qualifications & Requirements</h2>
                <p>5+ years experience with TypeScript, React, Node.js, and Distributed Systems.</p>
              </div>
              <button class="apply-btn" id="apply-button">Apply Now for Position</button>
            </div>
          </body>
        </html>
      `;
      const doc = createDomDocument(highSignalAdversarialHtml);

      for (const url of educationalAndDocNakedUrls) {
        const result = jobClassifier.classify(url, doc);
        expect(result.isJobPage).toBe(false);
        expect(result.score).toBe(0);
        expect(result.confidence).toBe('none');
        expect(result.positiveSignals).toHaveLength(0);
        expect(result.negativeSignals.length).toBeGreaterThan(0);
        expect(result.negativeSignals.some(s => s.includes('VETO_URL'))).toBe(true);
      }
    });
  });
});

