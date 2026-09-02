import { describe, it, expect } from 'vitest';
import { jobClassifier } from '../src/content/detection/jobClassifier';
import { createDomDocument } from './helpers/domUtils';

describe('Adversarial False Positive Stress-Testing Suite (Milestone 1)', () => {
  // ==========================================================================
  // Category 1: Educational, Courses & Learning Platforms
  // ==========================================================================
  describe('Category 1: Educational & Course Platforms', () => {
    it('ADV-NEG-01: algomaster.io system-design course introduction (Prompt Acceptance Criteria)', () => {
      const url = 'https://algomaster.io/learn/system-design/course-introduction';
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Course Introduction - System Design Masterclass | AlgoMaster</title>
            <meta property="og:site_name" content="AlgoMaster" />
          </head>
          <body>
            <nav class="curriculum-sidebar">
              <h2>Curriculum Overview</h2>
              <ul><li>Chapter 1: Introduction</li><li>Chapter 2: Scalability</li></ul>
            </nav>
            <main>
              <h1>Course Introduction: System Design</h1>
              <div class="lesson-meta"><span>5 min read</span> <span>Prerequisites: Basic CS</span></div>
              <article>
                <h2>System Requirements</h2>
                <p>In this course, we will analyze functional and non-functional requirements for distributed systems.</p>
                <h2>Prerequisites & Experience</h2>
                <p>Students should have 1+ years of programming experience with Java, Python, or Go.</p>
                <p>Apply these architectural patterns in your daily software engineering work.</p>
                <button class="enroll-btn">Enroll in Course</button>
              </article>
            </main>
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

    it('ADV-NEG-02: Coursera course syllabus with "Apply Financial Aid" button', () => {
      const url = 'https://www.coursera.org/learn/machine-learning';
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Machine Learning Specialization - Coursera</title></head>
          <body>
            <h1>Machine Learning Specialization by Andrew Ng</h1>
            <div class="syllabus">
              <h2>Syllabus & Requirements</h2>
              <p>Learn supervised learning, neural networks, and Python ML pipelines.</p>
            </div>
            <div>
              <a href="/financial-aid/apply">Apply for Financial Aid</a>
              <span>Full-time commitment: 3 months</span>
            </div>
          </body>
        </html>
      `;
      const doc = createDomDocument(html);
      const result = jobClassifier.classify(url, doc);

      expect(result.isJobPage).toBe(false);
      expect(result.score).toBe(0);
      expect(result.confidence).toBe('none');
    });

    it('ADV-NEG-03: Frontend Masters course page with requirements and exercises', () => {
      const url = 'https://frontendmasters.com/courses/complete-react-v8/';
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Complete Intro to React v8 - Frontend Masters</title></head>
          <body>
            <nav class="table-of-contents"><h2>Table of Contents</h2></nav>
            <main>
              <h1>Complete Intro to React v8</h1>
              <h2>Course Requirements</h2>
              <p>Basic knowledge of JavaScript (ES6+), HTML, and CSS.</p>
              <h2>What you will do</h2>
              <p>Build real-world React applications using Vite, TypeScript, and Tailwind.</p>
              <a href="/login?redirect=apply">Apply discount code</a>
            </main>
          </body>
        </html>
      `;
      const doc = createDomDocument(html);
      const result = jobClassifier.classify(url, doc);

      expect(result.isJobPage).toBe(false);
      expect(result.score).toBe(0);
    });

    it('ADV-NEG-04: LeetCode contest problem statement with Monaco code runner', () => {
      const url = 'https://leetcode.com/problems/course-schedule-ii/';
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Course Schedule II - LeetCode</title></head>
          <body>
            <div data-cy="question-title">210. Course Schedule II</div>
            <div class="problem-statement">
              <p>There are a total of numCourses courses you have to take, labeled from 0 to numCourses - 1.</p>
              <h2>Requirements & Constraints</h2>
              <p>1 &lt;= numCourses &lt;= 2000</p>
            </div>
            <div class="monaco-editor"></div>
          </body>
        </html>
      `;
      const doc = createDomDocument(html);
      const result = jobClassifier.classify(url, doc);

      expect(result.isJobPage).toBe(false);
      expect(result.score).toBe(0);
    });
  });

  // ==========================================================================
  // Category 2: Technical Blogs, Tutorials & News Articles
  // ==========================================================================
  describe('Category 2: Technical Blogs & Articles', () => {
    it('ADV-NEG-05: Medium blog post with "Software Engineer" author byline and reading time', () => {
      const url = 'https://medium.com/@devguru/day-in-the-life-of-a-staff-software-engineer-54321';
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Day in the Life of a Staff Software Engineer | Tech Lead Blog</title></head>
          <body>
            <header>
              <div class="byline">By Jane Doe, Staff Software Engineer</div>
              <span class="reading-time">6 min read</span>
            </header>
            <article>
              <h1>Day in the Life of a Staff Software Engineer</h1>
              <h2>Responsibilities</h2>
              <p>Leading system architecture, mentoring engineers, and setting technical strategy.</p>
              <h2>Qualifications</h2>
              <p>Over 8 years of experience building distributed systems in Go and Kubernetes.</p>
              <p>Apply these habits to accelerate your engineering career.</p>
            </article>
            <div class="comments-area"><h3>Reader Comments</h3></div>
          </body>
        </html>
      `;
      const doc = createDomDocument(html);
      const result = jobClassifier.classify(url, doc);

      expect(result.isJobPage).toBe(false);
      expect(result.score).toBe(0);
      expect(result.negativeSignals.length).toBeGreaterThan(0);
    });

    it('ADV-NEG-06: Dev.to tutorial with code snippets and article metadata', () => {
      const url = 'https://dev.to/fullstackdev/how-to-build-a-resilient-microservice-in-go-1234';
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>How to Build a Resilient Microservice in Go - DEV Community</title>
            <meta property="article:published_time" content="2026-04-10T12:00:00Z" />
          </head>
          <body>
            <div class="post-date">Published on Apr 10, 2026</div>
            <main>
              <h1>How to Build a Resilient Microservice in Go</h1>
              <h2>Prerequisites & Requirements</h2>
              <p>Go 1.22+, Docker, and basic knowledge of gRPC.</p>
              <h2>What we will build</h2>
              <p>A full-time worker queue with Redis and PostgreSQL backend.</p>
            </main>
          </body>
        </html>
      `;
      const doc = createDomDocument(html);
      const result = jobClassifier.classify(url, doc);

      expect(result.isJobPage).toBe(false);
      expect(result.score).toBe(0);
    });

    it('ADV-NEG-07: TechCrunch news article about tech compensation and hiring trends', () => {
      const url = 'https://techcrunch.com/2026/02/20/tech-hiring-trends-salary-benchmarks/';
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Tech Hiring Trends in 2026 - TechCrunch</title></head>
          <body>
            <div class="author-bio">By Alex Wilhelm</div>
            <article>
              <h1>Tech Hiring Trends: Remote Salaries Top $250k</h1>
              <p>Full-time Software Engineers and AI Specialists in San Francisco are seeing base compensation reach $220k.</p>
              <h2>Company Requirements</h2>
              <p>Firms demand strong proficiency in PyTorch, CUDA, and distributed training.</p>
            </article>
          </body>
        </html>
      `;
      const doc = createDomDocument(html);
      const result = jobClassifier.classify(url, doc);

      expect(result.isJobPage).toBe(false);
      expect(result.score).toBe(0);
    });
  });

  // ==========================================================================
  // Category 3: API Documentation, Reference Manuals & RFCs
  // ==========================================================================
  describe('Category 3: API Documentation & Reference Manuals', () => {
    it('ADV-NEG-08: Kubernetes Job controller documentation page', () => {
      const url = 'https://kubernetes.io/docs/concepts/workloads/controllers/job/';
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Jobs | Kubernetes Documentation</title></head>
          <body>
            <nav class="toc"><h2>On this page</h2><ul><li>Running a Job</li><li>Writing a Job Spec</li></ul></nav>
            <main>
              <h1>Jobs</h1>
              <p>A Job creates one or more Pods and will continue to retry execution until a specified number of them terminate successfully.</p>
              <h2>Job Spec Requirements</h2>
              <p>As with all other Kubernetes configs, a Job needs <code>apiVersion</code>, <code>kind</code>, and <code>metadata</code> fields.</p>
              <p>Run <code>kubectl apply -f job.yaml</code> to deploy the job.</p>
            </main>
          </body>
        </html>
      `;
      const doc = createDomDocument(html);
      const result = jobClassifier.classify(url, doc);

      expect(result.isJobPage).toBe(false);
      expect(result.score).toBe(0);
    });

    it('ADV-NEG-09: MDN Web Docs API reference for Web Workers', () => {
      const url = 'https://developer.mozilla.org/en-US/docs/Web/API/Worker';
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Worker - Web APIs | MDN</title></head>
          <body>
            <nav aria-label="Table of contents"><h2>Table of contents</h2></nav>
            <main>
              <h1>Worker</h1>
              <p>The Worker interface of the Web Workers API represents a background task that can be easily created and can send messages back to its creator.</p>
              <h2>Constructor Requirements</h2>
              <p>Requires a script URL executing in a separate thread.</p>
            </main>
          </body>
        </html>
      `;
      const doc = createDomDocument(html);
      const result = jobClassifier.classify(url, doc);

      expect(result.isJobPage).toBe(false);
      expect(result.score).toBe(0);
    });

    it('ADV-NEG-10: Go package documentation on pkg.go.dev with "Job" types', () => {
      const url = 'https://pkg.go.dev/github.com/robfig/cron/v3';
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>cron package - github.com/robfig/cron/v3 - pkg.go.dev</title></head>
          <body>
            <div class="Documentation-toc"><nav class="toc"><h2>Contents</h2></nav></div>
            <main>
              <h1>Package cron</h1>
              <h2>type Job interface</h2>
              <p>Job is an interface for submitted cron jobs. It requires a Run() method.</p>
              <h2>Functions & Methods</h2>
              <p>Func (c *Cron) AddJob(spec string, cmd Job) (EntryID, error)</p>
            </main>
          </body>
        </html>
      `;
      const doc = createDomDocument(html);
      const result = jobClassifier.classify(url, doc);

      expect(result.isJobPage).toBe(false);
      expect(result.score).toBe(0);
    });
  });

  // ==========================================================================
  // Category 4: Encyclopedias & Reference (Wikipedia)
  // ==========================================================================
  describe('Category 4: Encyclopedias & Wikipedia', () => {
    it('ADV-NEG-11: Wikipedia article for "Software Engineer"', () => {
      const url = 'https://en.wikipedia.org/wiki/Software_engineer';
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Software engineer - Wikipedia</title></head>
          <body>
            <h1 id="firstHeading">Software engineer</h1>
            <div id="toc"><h2>Contents</h2><ul><li>1 Education</li><li>2 Responsibilities</li><li>3 Compensation</li></ul></div>
            <div id="mw-content-text">
              <p>A software engineer is a professional who applies engineering principles to design, develop, test, and maintain computer software.</p>
              <h2>Education and Qualifications</h2>
              <p>Most software engineers possess a degree in computer science or software engineering.</p>
              <h2>Job Responsibilities and Roles</h2>
              <p>Responsibilities include writing code, designing microservices, and debugging complex distributed systems.</p>
            </div>
          </body>
        </html>
      `;
      const doc = createDomDocument(html);
      const result = jobClassifier.classify(url, doc);

      expect(result.isJobPage).toBe(false);
      expect(result.score).toBe(0);
    });

    it('ADV-NEG-12: Wikipedia article for "Chief Technology Officer"', () => {
      const url = 'https://en.wikipedia.org/wiki/Chief_technology_officer';
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Chief technology officer - Wikipedia</title></head>
          <body>
            <h1>Chief technology officer</h1>
            <div class="toc-wrapper"><nav class="toc"><h2>Contents</h2></nav></div>
            <main>
              <h2>Role and Responsibilities</h2>
              <p>The CTO oversees technology infrastructure, engineering teams, and product roadmap.</p>
            </main>
          </body>
        </html>
      `;
      const doc = createDomDocument(html);
      const result = jobClassifier.classify(url, doc);

      expect(result.isJobPage).toBe(false);
      expect(result.score).toBe(0);
    });
  });

  // ==========================================================================
  // Category 5: Code Repositories, PRs, and Issue Trackers
  // ==========================================================================
  describe('Category 5: Code Repositories & Developer Q&A', () => {
    it('ADV-NEG-13: GitHub issue requesting a new software engineer role/feature', () => {
      const url = 'https://github.com/kubernetes/kubernetes/issues/98765';
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Add Job Controller priority queue · Issue #98765 · kubernetes/kubernetes</title></head>
          <body>
            <div class="repohead"><h1>kubernetes / kubernetes</h1></div>
            <div class="issue-header"><h1>Add Job Controller priority queue</h1></div>
            <div class="markdown-body">
              <h2>Requirements</h2>
              <p>We need to support prioritized scheduling for batch jobs.</p>
              <h2>Proposed Responsibilities</h2>
              <p>The controller manager will reconcile pending jobs based on queue weight.</p>
            </div>
            <div class="comment-thread"><h3>Comments</h3></div>
          </body>
        </html>
      `;
      const doc = createDomDocument(html);
      const result = jobClassifier.classify(url, doc);

      expect(result.isJobPage).toBe(false);
      expect(result.score).toBe(0);
    });

    it('ADV-NEG-14: StackOverflow question about background jobs and threads', () => {
      const url = 'https://stackoverflow.com/questions/9876543/how-to-apply-spring-batch-job-parameters';
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>How to apply Spring Batch Job parameters - Stack Overflow</title></head>
          <body>
            <div id="question-header"><h1>How to apply Spring Batch Job parameters</h1></div>
            <div class="question">
              <p>I am building a Spring Boot application that executes a full-time batch job. What are the parameter requirements?</p>
            </div>
            <div class="answers"><h2>2 Answers</h2></div>
          </body>
        </html>
      `;
      const doc = createDomDocument(html);
      const result = jobClassifier.classify(url, doc);

      expect(result.isJobPage).toBe(false);
      expect(result.score).toBe(0);
    });
  });

  // ==========================================================================
  // Category 6: E-Commerce, Pricing, Checkout & Subscriptions
  // ==========================================================================
  describe('Category 6: E-Commerce & Checkout Pages', () => {
    it('ADV-NEG-15: E-commerce product page with "Add to Cart" button', () => {
      const url = 'https://store.acmehardware.com/products/developer-workstation-pro';
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Developer Workstation Pro - Acme Hardware</title></head>
          <body>
            <h1>Developer Workstation Pro</h1>
            <div class="product-price">$3,499.00</div>
            <h2>System Requirements & Specifications</h2>
            <p>64GB DDR5 RAM, 2TB NVMe SSD, NVIDIA RTX 4090 GPU.</p>
            <p>Designed for Full-time AI Engineers and Data Scientists.</p>
            <button name="add-to-cart" class="add-to-cart">Add to Cart</button>
          </body>
        </html>
      `;
      const doc = createDomDocument(html);
      const result = jobClassifier.classify(url, doc);

      expect(result.isJobPage).toBe(false);
      expect(result.score).toBe(0);
    });

    it('ADV-NEG-16: SaaS pricing and subscription tier comparison page', () => {
      const url = 'https://cloudservice.io/pricing';
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Pricing & Plans - CloudService</title></head>
          <body>
            <h1>Plans for Engineering Teams</h1>
            <div class="pricing-card">
              <h2>Enterprise Plan - $99/mo</h2>
              <p>Full-time support for up to 50 Lead Developers.</p>
              <h3>Requirements & SLA</h3>
              <p>99.99% uptime guarantee.</p>
              <button>Subscribe Now</button>
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

  // ==========================================================================
  // Category 7: Search Aggregators & Job Listing Feeds (Non-individual job pages)
  // ==========================================================================
  describe('Category 7: Search Aggregators & Job Feeds', () => {
    it('ADV-NEG-17: LinkedIn job search results listing (not a single job posting)', () => {
      const url = 'https://www.linkedin.com/jobs/search/?keywords=Software%20Engineer&location=Remote';
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Software Engineer Jobs in Remote - LinkedIn</title></head>
          <body>
            <header><h1>Search results for "Software Engineer"</h1></header>
            <ul class="jobs-search__results-list">
              <li><h3>Senior Frontend Engineer at Stripe</h3><span>San Francisco, CA</span></li>
              <li><h3>Staff Backend Developer at Figma</h3><span>New York, NY</span></li>
            </ul>
          </body>
        </html>
      `;
      const doc = createDomDocument(html);
      const result = jobClassifier.classify(url, doc);

      expect(result.isJobPage).toBe(false);
      expect(result.score).toBeLessThan(65);
    });

    it('ADV-NEG-18: Indeed search query page with multiple snippet links', () => {
      const url = 'https://www.indeed.com/jobs?q=Full+Stack+Developer&l=Austin%2C+TX';
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Full Stack Developer Jobs, Employment in Austin, TX | Indeed.com</title></head>
          <body>
            <div class="search-count">1,240 jobs found</div>
            <div class="job-card">
              <h2>Full Stack Developer</h2>
              <p>Looking for 3+ years experience in React and Node.js.</p>
            </div>
          </body>
        </html>
      `;
      const doc = createDomDocument(html);
      const result = jobClassifier.classify(url, doc);

      expect(result.isJobPage).toBe(false);
      expect(result.score).toBeLessThan(65);
    });
  });

  // ==========================================================================
  // Category 8: Company Corporate Pages (About Us, Contact Us, Team)
  // ==========================================================================
  describe('Category 8: Company About Us & Contact Us Pages', () => {
    it('ADV-NEG-19: Company leadership team page with executive bios', () => {
      const url = 'https://innovatecorp.com/about/leadership';
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Our Leadership Team - InnovateCorp</title></head>
          <body>
            <h1>Executive Leadership</h1>
            <div class="leader">
              <h2>Sarah Chen - VP of Engineering</h2>
              <p>Sarah leads our distributed engineering organization across 5 global hubs.</p>
            </div>
            <div class="leader">
              <h2>David Miller - Principal Cloud Architect</h2>
              <p>David is responsible for AWS cloud governance and Kubernetes infrastructure.</p>
            </div>
          </body>
        </html>
      `;
      const doc = createDomDocument(html);
      const result = jobClassifier.classify(url, doc);

      expect(result.isJobPage).toBe(false);
      expect(result.score).toBeLessThan(65);
    });

    it('ADV-NEG-20: Customer support contact form with name inputs and submit button', () => {
      const url = 'https://saasservice.com/contact-support';
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Contact Support - SaaS Service</title></head>
          <body>
            <h1>Need Help? Contact Support</h1>
            <p>Our support specialists are available Monday through Friday.</p>
            <form id="contact_form">
              <input type="text" name="first_name" placeholder="First Name" />
              <input type="text" name="last_name" placeholder="Last Name" />
              <input type="email" name="email" placeholder="Work Email" />
              <textarea name="message" placeholder="How can we help?"></textarea>
              <button type="submit">Submit Request</button>
            </form>
          </body>
        </html>
      `;
      const doc = createDomDocument(html);
      const result = jobClassifier.classify(url, doc);

      // Even with name inputs and submit button (+25 form resume score),
      // it lacks ATS host, apply CTA, JD container, metadata chips -> Score 25 < 65
      expect(result.isJobPage).toBe(false);
      expect(result.score).toBeLessThan(65);
    });
  });

  // ==========================================================================
  // Category 9: Highly Ambiguous Adversarial Traps
  // ==========================================================================
  describe('Category 9: Highly Ambiguous Adversarial Traps', () => {
    it('ADV-NEG-21: Tech Conference Call-for-Proposals (CFP) page', () => {
      const url = 'https://techconf2026.org/speakers/call-for-speakers';
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Call for Proposals - TechConf 2026</title></head>
          <body>
            <h1>Call for Proposals: Keynote Speaker & AI Specialist</h1>
            <h2>Speaker Requirements</h2>
            <p>Speakers must have practical experience building AI agents and large language models.</p>
            <h2>Submission Guidelines</h2>
            <p>Full-time practitioners and researchers are encouraged to submit talk proposals.</p>
            <a href="https://techconf2026.org/submit" class="submit-talk-btn">Submit Proposal</a>
          </body>
        </html>
      `;
      const doc = createDomDocument(html);
      const result = jobClassifier.classify(url, doc);

      expect(result.isJobPage).toBe(false);
      expect(result.score).toBeLessThan(65);
    });

    it('ADV-NEG-22: University fellowship assignment on educational domain', () => {
      const url = 'https://ai.stanford.edu/courses/cs224n/assignment1';
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>CS224N Assignment 1: Word Vectors | Stanford AI</title></head>
          <body>
            <div class="curriculum">
              <h1>CS224N: Natural Language Processing with Deep Learning</h1>
              <h2>Assignment Requirements</h2>
              <p>Implement word2vec in PyTorch. Due date: Friday at 11:59pm.</p>
              <p>Apply gradient descent to optimize embedding loss.</p>
            </div>
          </body>
        </html>
      `;
      const doc = createDomDocument(html);
      const result = jobClassifier.classify(url, doc);

      expect(result.isJobPage).toBe(false);
      expect(result.score).toBe(0);
      expect(result.confidence).toBe('none');
    });

    it('ADV-NEG-23: Technical Book Table of Contents and Chapter Overview', () => {
      const url = 'https://oreilly.com/library/view/designing-data-intensive-applications/9781491903063/';
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Designing Data-Intensive Applications - O'Reilly</title></head>
          <body>
            <div class="toc-wrapper">
              <nav class="toc">
                <h2>Table of Contents</h2>
                <ul>
                  <li>Chapter 1: Reliable, Scalable, and Maintainable Applications</li>
                  <li>Chapter 2: Data Models and Query Languages</li>
                </ul>
              </nav>
            </div>
            <main>
              <h1>Designing Data-Intensive Applications</h1>
              <h2>What Software Engineers Will Learn</h2>
              <p>Key requirements for consensus, replication, and partitioning in distributed systems.</p>
              <button class="add-to-cart">Buy on Amazon</button>
            </main>
          </body>
        </html>
      `;
      const doc = createDomDocument(html);
      const result = jobClassifier.classify(url, doc);

      expect(result.isJobPage).toBe(false);
      expect(result.score).toBe(0);
    });

    it('ADV-NEG-24: Generic Terms of Service & Privacy Policy with legal requirements', () => {
      const url = 'https://example-saas.com/terms-of-service';
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Terms of Service - Example SaaS</title></head>
          <body>
            <h1>Terms of Service</h1>
            <h2>User Requirements & Qualifications</h2>
            <p>You must be at least 18 years old to apply these services for commercial use.</p>
            <h2>Responsibilities and Liability</h2>
            <p>The user agrees not to reverse engineer the application.</p>
          </body>
        </html>
      `;
      const doc = createDomDocument(html);
      const result = jobClassifier.classify(url, doc);

      expect(result.isJobPage).toBe(false);
      expect(result.score).toBe(0);
    });

    it('ADV-NEG-25: Developer Blog Article on Personal Domain without "/blog/" in URL', () => {
      const url = 'https://danluu.com/microservices-retrospective';
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>A Retrospective on Microservices Architecture | Dan Luu</title></head>
          <body>
            <div class="author-bio">By Dan Luu, Systems Engineer</div>
            <main>
              <h1>A Retrospective on Microservices Architecture</h1>
              <h2>Engineering Requirements & Realities</h2>
              <p>When our team evaluated microservices vs monoliths for Full-time operational reliability, we noticed...</p>
              <h2>Responsibilities of Infrastructure Teams</h2>
              <p>Managing Kubernetes clusters and RPC protocols across hundreds of engineers.</p>
            </main>
          </body>
        </html>
      `;
      const doc = createDomDocument(html);
      const result = jobClassifier.classify(url, doc);

      // Vetoed via DOM .author-bio
      expect(result.isJobPage).toBe(false);
      expect(result.score).toBe(0);
      expect(result.confidence).toBe('none');
    });
  });
});
