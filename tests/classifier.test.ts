import { describe, it, expect } from 'vitest';
import { jobClassifier, extractJobPostingSchema } from '../src/content/detection/jobClassifier';

describe('JobClassifier Negative Veto Engine', () => {
  const parser = new DOMParser();

  it('must veto algomaster.io course introduction URL and curriculum DOM', () => {
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
    const doc = parser.parseFromString(html, 'text/html');
    const result = jobClassifier.classify(url, doc);

    expect(result.isJobPage).toBe(false);
    expect(result.score).toBe(0);
    expect(result.confidence).toBe('none');
    expect(result.negativeSignals.length).toBeGreaterThan(0);
    expect(result.negativeSignals.some((s) => s.includes('VETO_URL') || s.includes('VETO_DOM'))).toBe(true);
  });

  it('must strictly veto naked domain URLs on educational and documentation platforms with score 0', () => {
    const nakedUrls = [
      'https://algomaster.io/about',
      'https://devdocs.io/javascript/',
      'https://coursera.org/specializations/',
      'https://w3schools.com/tags/',
      'https://udemy.com/topic/python/',
      'https://edx.org/masters',
      'https://freecodecamp.org/news/',
      'https://leetcode.com/problems/random-problem',
      'https://pkg.go.dev/net/http',
      'https://caniuse.com/flexbox',
    ];

    const html = `
      <!DOCTYPE html>
      <html>
        <head><title>Documentation & Course Overview</title></head>
        <body>
          <h1>Overview</h1>
          <p>Requirements: 5+ years experience in distributed systems. Apply these principles.</p>
        </body>
      </html>
    `;
    const doc = parser.parseFromString(html, 'text/html');

    for (const nakedUrl of nakedUrls) {
      const result = jobClassifier.classify(nakedUrl, doc);
      expect(result.isJobPage).toBe(false);
      expect(result.score).toBe(0);
      expect(result.confidence).toBe('none');
      expect(result.negativeSignals.length).toBeGreaterThan(0);
    }
  });

  it('must veto MDN documentation pages', () => {
    const url = 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/map';
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Array.prototype.map() - JavaScript | MDN</title>
        </head>
        <body>
          <nav class="toc"><h2>In this article</h2><ul><li>Syntax</li><li>Specifications</li></ul></nav>
          <main>
            <h1>Array.prototype.map()</h1>
            <p>The map() method of Array instances creates a new array populated with the results of calling a provided function.</p>
            <h2>Specifications</h2>
            <p>ECMAScript standard requirements and browser compatibility table.</p>
          </main>
        </body>
      </html>
    `;
    const doc = parser.parseFromString(html, 'text/html');
    const result = jobClassifier.classify(url, doc);

    expect(result.isJobPage).toBe(false);
    expect(result.score).toBe(0);
    expect(result.confidence).toBe('none');
  });

  it('must veto GitHub repositories and issues', () => {
    const urlRepo = 'https://github.com/facebook/react';
    const htmlRepo = `
      <!DOCTYPE html>
      <html>
        <head><title>facebook/react: The library for web and native user interfaces</title></head>
        <body>
          <div class="repohead"><h1><a href="/facebook">facebook</a>/<a href="/facebook/react">react</a></h1></div>
          <div id="readme">
            <article class="markdown-body">
              <h2>Installation Requirements</h2>
              <p>Requires Node.js 18.0.0 or higher. Experience with NPM or Yarn recommended.</p>
              <p>To apply this package to your application, run <code>npm install react</code>.</p>
            </article>
          </div>
        </body>
      </html>
    `;
    const docRepo = parser.parseFromString(htmlRepo, 'text/html');
    const resultRepo = jobClassifier.classify(urlRepo, docRepo);
    expect(resultRepo.isJobPage).toBe(false);

    const urlIssue = 'https://github.com/facebook/react/issues/12345';
    const resultIssue = jobClassifier.classify(urlIssue, docRepo);
    expect(resultIssue.isJobPage).toBe(false);
  });

  it('must veto Medium and blog technical articles', () => {
    const url = 'https://medium.com/@techlead/how-to-crack-the-system-design-interview-7a8b9c0d';
    const html = `
      <!DOCTYPE html>
      <html>
        <head><title>How to Crack the System Design Interview | Tech Blog</title></head>
        <body>
          <header><div class="author-bio">By Tech Lead · <span class="reading-time">8 min read</span></div></header>
          <article>
            <h1>How to Crack the System Design Interview</h1>
            <p>When reviewing the job description for Senior Engineer roles, companies look for qualifications like microservices, caching, and database sharding. Having 5+ years of experience is essential. Apply these interview strategies.</p>
            <div class="comments-section"><h3>Comments (14)</h3></div>
          </article>
        </body>
      </html>
    `;
    const doc = parser.parseFromString(html, 'text/html');
    const result = jobClassifier.classify(url, doc);

    expect(result.isJobPage).toBe(false);
    expect(result.score).toBe(0);
  });

  it('must veto Wikipedia articles', () => {
    const url = 'https://en.wikipedia.org/wiki/Software_engineer';
    const html = `
      <!DOCTYPE html>
      <html>
        <head><title>Software engineer - Wikipedia</title></head>
        <body>
          <h1 id="firstHeading">Software engineer</h1>
          <div id="toc"><h2>Contents</h2><ul><li>1 Education and qualifications</li><li>2 Job responsibilities</li></ul></div>
          <div id="mw-content-text">
            <p>A software engineer is a person who applies the principles of software engineering to design, develop, and maintain computer software.</p>
          </div>
        </body>
      </html>
    `;
    const doc = parser.parseFromString(html, 'text/html');
    const result = jobClassifier.classify(url, doc);

    expect(result.isJobPage).toBe(false);
  });

  it('must veto StackOverflow Q&A questions', () => {
    const url = 'https://stackoverflow.com/questions/11227809/why-is-processing-a-sorted-array-faster';
    const html = `
      <!DOCTYPE html>
      <html>
        <head><title>Why is processing a sorted array faster than processing an unsorted array? - Stack Overflow</title></head>
        <body>
          <div id="question-header"><h1>Why is processing a sorted array faster than processing an unsorted array?</h1></div>
          <div class="question">
            <p>Here is a piece of C++ code that shows strange performance behavior. What are the CPU branch prediction requirements?</p>
          </div>
          <div class="answers"><h2>3 Answers</h2></div>
        </body>
      </html>
    `;
    const doc = parser.parseFromString(html, 'text/html');
    const result = jobClassifier.classify(url, doc);

    expect(result.isJobPage).toBe(false);
  });

  it('must veto LeetCode problems and explore pages', () => {
    const url = 'https://leetcode.com/problems/two-sum/';
    const html = `
      <!DOCTYPE html>
      <html>
        <head><title>Two Sum - LeetCode</title></head>
        <body>
          <div data-cy="question-title">1. Two Sum</div>
          <div class="problem-statement">
            <p>Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.</p>
          </div>
          <div class="monaco-editor"></div>
        </body>
      </html>
    `;
    const doc = parser.parseFromString(html, 'text/html');
    const result = jobClassifier.classify(url, doc);

    expect(result.isJobPage).toBe(false);
    expect(result.score).toBe(0);
  });
});

describe('JobClassifier Positive Page Classification & Schema.org Extraction', () => {
  const parser = new DOMParser();

  it('should classify Greenhouse job posting with high confidence', () => {
    const url = 'https://boards.greenhouse.io/stripe/jobs/4567890';
    const html = `
      <!DOCTYPE html>
      <html>
        <head><title>Stripe - Lead Infrastructure Engineer</title></head>
        <body>
          <h1 class="app-title">Lead Infrastructure Engineer</h1>
          <span class="company-name">Stripe</span>
          <div class="location">San Francisco, CA (Hybrid)</div>
          <div id="content">
            <p>We are looking for a Lead Infrastructure Engineer to scale our global financial network.</p>
            <h3>Responsibilities</h3>
            <p>Manage Kubernetes clusters, Terraform infrastructure, and Prometheus monitoring on AWS.</p>
            <h3>Requirements</h3>
            <p>7+ years experience with distributed systems, Go, Kubernetes, and PostgreSQL.</p>
          </div>
          <form id="application_form">
            <input type="file" name="resume" accept=".pdf,.doc,.docx" />
            <button type="submit" id="submit_app">Submit Application</button>
          </form>
        </body>
      </html>
    `;
    const doc = parser.parseFromString(html, 'text/html');
    const result = jobClassifier.classify(url, doc);

    expect(result.isJobPage).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.confidence).toBe('high');
    expect(result.positiveSignals).toContain('SIG_KNOWN_ATS_URL');
    expect(result.positiveSignals).toContain('SIG_APP_FORM_RESUME');
  });

  it('should classify Lever job posting with high confidence', () => {
    const url = 'https://jobs.lever.co/figma/8f7e6d5c-4b3a-2109-8765-abcdef123456';
    const html = `
      <!DOCTYPE html>
      <html>
        <head><title>Figma - Senior Staff Product Designer</title></head>
        <body>
          <div class="main-header-logo"><img alt="Figma" src="/logo.png" /></div>
          <div class="posting-headline"><h2>Senior Staff Product Designer</h2></div>
          <div class="posting-categories">
            <span class="location">New York, NY</span>
            <span class="workplaceTypes">Remote</span>
            <span class="commitment">Full-time</span>
          </div>
          <div class="section-wrapper">
            <h3>About the Role</h3>
            <p>Join Figma to design collaborative creative tools for millions of designers and developers.</p>
            <h3>Requirements</h3>
            <p>Expertise in Figma, UI/UX prototyping, design systems, and user research. 6+ years experience.</p>
          </div>
          <a class="postings-btn template-btn-submit" href="https://jobs.lever.co/figma/8f7e6d5c/apply">Apply for this job</a>
        </body>
      </html>
    `;
    const doc = parser.parseFromString(html, 'text/html');
    const result = jobClassifier.classify(url, doc);

    expect(result.isJobPage).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(65);
    expect(result.positiveSignals).toContain('SIG_KNOWN_ATS_URL');
    expect(result.positiveSignals).toContain('SIG_APPLY_CTA');
  });

  it('should classify Workday job posting with high confidence', () => {
    const url = 'https://nvidia.wd5.myworkdayjobs.com/en-US/NVIDIAExternalCareerSite/job/US-CA-Santa-Clara/Senior-Deep-Learning-Software-Engineer_JR1987654';
    const html = `
      <!DOCTYPE html>
      <html>
        <head><title>Senior Deep Learning Software Engineer - NVIDIA Careers</title></head>
        <body>
          <div data-automation-id="jobPostingHeader">
            <h2>Senior Deep Learning Software Engineer</h2>
          </div>
          <div data-automation-id="jobPostingLocation">US, CA, Santa Clara (On-site)</div>
          <div data-automation-id="timeType">Full time</div>
          <div data-automation-id="jobPostingId">JR1987654</div>
          <div data-automation-id="jobPostingDescription">
            <p>We are seeking a Senior Deep Learning Engineer to optimize CUDA, PyTorch, and TensorRT neural networks.</p>
            <h3>What you will be doing:</h3>
            <p>Develop high-performance GPU kernels in C++ and CUDA.</p>
            <h3>What we need to see:</h3>
            <p>MS/PhD in CS, 5+ years experience in C++, Python, PyTorch, and CUDA.</p>
          </div>
          <a data-automation-id="applyButton" href="#apply">Apply</a>
        </body>
      </html>
    `;
    const doc = parser.parseFromString(html, 'text/html');
    const result = jobClassifier.classify(url, doc);

    expect(result.isJobPage).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.confidence).toBe('high');
    expect(result.positiveSignals).toContain('SIG_KNOWN_ATS_URL');
    expect(result.positiveSignals).toContain('SIG_JOB_DESC_CONTAINER');
  });

  it('should classify Ashby job posting with high confidence', () => {
    const url = 'https://jobs.ashbyhq.com/openai/12345678-abcd-ef01-2345-6789abcdef01';
    const html = `
      <!DOCTYPE html>
      <html>
        <head><title>Research Scientist - AI Alignment - OpenAI</title></head>
        <body>
          <div class="_container_1abc2">
            <div class="_header_1abc2">
              <h1 data-testid="job-posting-title">Research Scientist - AI Alignment</h1>
              <div class="_details_1abc2">
                <span data-testid="job-location">San Francisco, CA</span> · <span>Hybrid</span> · <span>Full Time</span> · <span>$245,000 - $385,000</span>
              </div>
            </div>
            <div data-testid="job-description">
              <h3>About the Role</h3>
              <p>Conduct foundational research in reinforcement learning from human feedback (RLHF) and scalable oversight.</p>
              <h3>Qualifications</h3>
              <p>Track record in machine learning, PyTorch, Python, and distributed LLM training.</p>
            </div>
            <a href="#application-form" class="_applyButton_1abc2">Apply for this role</a>
          </div>
        </body>
      </html>
    `;
    const doc = parser.parseFromString(html, 'text/html');
    const result = jobClassifier.classify(url, doc);

    expect(result.isJobPage).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.confidence).toBe('high');
    expect(result.positiveSignals).toContain('SIG_KNOWN_ATS_URL');
  });

  it('should classify custom site with Schema.org JobPosting JSON-LD', () => {
    const url = 'https://careers.customcorp.com/openings/123';
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Lead Full Stack Developer - CustomCorp</title>
          <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "JobPosting",
            "title": "Lead Full Stack Developer",
            "description": "<p>We are seeking a Lead Full Stack Developer to build modern cloud applications.</p><h3>Requirements</h3><ul><li>React, TypeScript, Node.js, and PostgreSQL</li><li>AWS and Docker deployment pipelines</li></ul>",
            "hiringOrganization": {
              "@type": "Organization",
              "name": "CustomCorp Technologies"
            },
            "jobLocation": {
              "@type": "Place",
              "address": {
                "@type": "PostalAddress",
                "addressLocality": "Austin",
                "addressRegion": "TX",
                "addressCountry": "US"
              }
            },
            "employmentType": "FULL_TIME",
            "baseSalary": {
              "@type": "MonetaryAmount",
              "currency": "USD",
              "value": {
                "@type": "QuantitativeValue",
                "minValue": 160000,
                "maxValue": 210000,
                "unitText": "YEAR"
              }
            }
          }
          </script>
        </head>
        <body>
          <main>
            <h1>Careers at CustomCorp</h1>
            <div>Loading dynamic application view...</div>
          </main>
        </body>
      </html>
    `;
    const doc = parser.parseFromString(html, 'text/html');
    const schema = extractJobPostingSchema(doc);
    expect(schema).not.toBeNull();
    expect(schema?.title).toBe('Lead Full Stack Developer');
    expect(schema?.hiringOrganization).toBe('CustomCorp Technologies');
    expect(schema?.jobLocation?.addressLocality).toBe('Austin');

    const result = jobClassifier.classify(url, doc);
    expect(result.isJobPage).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(result.schemaJobPosting).toBeDefined();
    expect(result.schemaJobPosting?.title).toBe('Lead Full Stack Developer');
  });

  it('should handle Schema.org @graph arrays', () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "WebSite",
                "name": "Tech Corp"
              },
              {
                "@type": "JobPosting",
                "title": "DevOps Engineer",
                "description": "Join our infrastructure engineering team. Build Terraform, Kubernetes, and AWS automation pipelines.",
                "hiringOrganization": "Tech Corp"
              }
            ]
          }
          </script>
        </head>
        <body><h1>Careers</h1></body>
      </html>
    `;
    const doc = parser.parseFromString(html, 'text/html');
    const schema = extractJobPostingSchema(doc);
    expect(schema).not.toBeNull();
    expect(schema?.title).toBe('DevOps Engineer');
    expect(schema?.hiringOrganization).toBe('Tech Corp');
  });
});
