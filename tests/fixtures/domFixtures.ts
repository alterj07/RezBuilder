/**
 * Realistic DOM HTML fixtures for RezBuilder E2E testing track.
 * Covers major ATS platforms (Greenhouse, Lever, Workday, Ashby),
 * Schema.org JSON-LD pages, negative veto pages (Algomaster, MDN, LeetCode, GitHub, Medium),
 * and boundary/corner case DOMs.
 */

export const GREENHOUSE_DOM_FIXTURE = `
<!DOCTYPE html>
<html>
  <head>
    <title>Stripe - Lead DevOps Engineer</title>
    <meta property="og:site_name" content="Greenhouse" />
  </head>
  <body>
    <div id="wrapper">
      <div id="header">
        <h1 class="app-title">Lead DevOps Engineer</h1>
        <span class="company-name">Stripe</span>
        <div class="location">San Francisco, CA (Hybrid)</div>
      </div>
      <div id="content" class="app-body">
        <div class="job-description">
          <p>We are looking for a Lead DevOps Engineer to manage our mission-critical payments cloud infrastructure.</p>
          <h3>Responsibilities</h3>
          <ul>
            <li>Manage Kubernetes clusters and automate infrastructure with Terraform and GCP.</li>
            <li>Scale distributed microservices with Go, Docker, and PostgreSQL.</li>
            <li>Implement CI/CD pipelines, Prometheus monitoring, and zero-downtime deployments.</li>
          </ul>
          <h3>Requirements</h3>
          <ul>
            <li>6+ years of production DevOps and Cloud Infrastructure experience.</li>
            <li>Deep expertise with Kubernetes, Terraform, Docker, and GCP or AWS.</li>
            <li>Strong programming ability in Go, Python, or TypeScript.</li>
            <li>Experience with PostgreSQL, Kafka, and CI/CD automation.</li>
          </ul>
        </div>
      </div>
      <div id="application">
        <h2>Apply for this Job</h2>
        <form id="application_form" action="https://boards.greenhouse.io/stripe/jobs/987654" method="POST" enctype="multipart/form-data">
          <div class="field">
            <label for="first_name">First Name <span class="required">*</span></label>
            <input type="text" id="first_name" name="job_application[first_name]" autocomplete="given-name" required />
          </div>
          <div class="field">
            <label for="last_name">Last Name <span class="required">*</span></label>
            <input type="text" id="last_name" name="job_application[last_name]" autocomplete="family-name" required />
          </div>
          <div class="field">
            <label for="email">Email <span class="required">*</span></label>
            <input type="email" id="email" name="job_application[email]" autocomplete="email" required />
          </div>
          <div class="field">
            <label for="phone">Phone</label>
            <input type="tel" id="phone" name="job_application[phone]" autocomplete="tel" />
          </div>
          <div class="field">
            <label for="job_application_location">Location (City)</label>
            <input type="text" id="job_application_location" name="job_application[location]" placeholder="e.g. San Francisco, CA" />
          </div>
          <div class="field">
            <label for="linkedin">LinkedIn Profile</label>
            <input type="text" id="linkedin" name="job_application[answers_attributes][0][text_value]" placeholder="https://linkedin.com/in/..." />
          </div>
          <div class="field">
            <label for="resume">Resume/CV <span class="required">*</span></label>
            <input type="file" id="resume_file" name="resume" accept=".pdf,.doc,.docx" />
          </div>
          <div class="field">
            <button type="submit" id="submit_app" class="button">Submit Application</button>
          </div>
        </form>
      </div>
    </div>
  </body>
</html>
`;

export const LEVER_DOM_FIXTURE = `
<!DOCTYPE html>
<html>
  <head>
    <title>ExampleCorp - Senior Product Manager</title>
  </head>
  <body>
    <div class="application-page">
      <div class="main-header-logo">
        <a href="https://jobs.lever.co/examplecorp"><img alt="ExampleCorp" src="https://jobs.lever.co/logo.png" /></a>
      </div>
      <div class="posting-header">
        <div class="posting-headline">
          <h2>Senior Product Manager</h2>
        </div>
        <div class="posting-categories">
          <span class="location">Austin, TX</span>
          <span class="workplaceTypes">Remote</span>
          <span class="commitment">Full-time</span>
          <span class="department">Product Management</span>
        </div>
      </div>
      <div class="section-wrapper page-full-width">
        <div class="section page-centered">
          <h3>The Role</h3>
          <p>Join ExampleCorp as a Senior Product Manager to drive technical roadmap execution.</p>
          <h3>Responsibilities</h3>
          <p>Lead sprint planning, user interviews, SQL metric analysis, and Jira backlogs. Partner with engineering to deliver agile sprints.</p>
          <h3>Qualifications & Experience</h3>
          <p>5+ years of software product management experience. Proficiency in Agile, Jira, SQL, Product Strategy, and User Research.</p>
        </div>
      </div>
      <div class="postings-btn-wrapper">
        <a class="postings-btn template-btn-submit" href="#apply">Apply for this job</a>
      </div>
      <div class="section-wrapper application-form-wrapper" id="apply">
        <form class="application-form" action="https://jobs.lever.co/examplecorp/12345-abcde/apply" method="POST">
          <div class="application-field">
            <label>Full Name <span class="required">*</span></label>
            <input type="text" name="name" placeholder="Full Name" required />
          </div>
          <div class="application-field">
            <label>Email <span class="required">*</span></label>
            <input type="email" name="email" placeholder="Email" required />
          </div>
          <div class="application-field">
            <label>Phone</label>
            <input type="tel" name="phone" placeholder="Phone" />
          </div>
          <div class="application-field">
            <label>Current Company</label>
            <input type="text" name="org" placeholder="Current Company" />
          </div>
          <div class="application-field">
            <label>LinkedIn URL</label>
            <input type="text" name="urls[LinkedIn]" placeholder="LinkedIn URL" />
          </div>
          <div class="application-field">
            <label>GitHub URL</label>
            <input type="text" name="urls[GitHub]" placeholder="GitHub URL" />
          </div>
          <div class="application-field">
            <label>Additional Comments</label>
            <textarea name="comments" placeholder="Add any additional notes..."></textarea>
          </div>
          <div class="application-field">
            <button type="submit" class="template-btn-submit">Submit Application</button>
          </div>
        </form>
      </div>
    </div>
  </body>
</html>
`;

export const WORKDAY_DOM_FIXTURE = `
<!DOCTYPE html>
<html>
  <head>
    <title>Staff Software Engineer - Acme Technologies Careers</title>
    <meta name="workday-site" content="acme.wd5.myworkdayjobs.com" />
    <meta property="og:site_name" content="Acme Technologies" />
  </head>
  <body>
    <div id="root">
      <div data-automation-id="jobPostingPage">
        <div data-automation-id="jobPostingHeader">
          <h1 data-automation-id="jobPostingTitle">Staff Software Engineer</h1>
        </div>
        <div class="job-meta">
          <div data-automation-id="companyName">Acme Technologies</div>
          <div data-automation-id="jobPostingLocation">US, CA, San Jose (Hybrid)</div>
          <div data-automation-id="timeType">Full time</div>
          <div data-automation-id="jobPostingId">R10203</div>
          <div data-automation-id="postedOn">Posted 3 Days Ago</div>
        </div>
        <div data-automation-id="jobPostingDescription">
          <p>Acme Technologies is seeking a Staff Software Engineer to build resilient distributed services.</p>
          <h3>Key Responsibilities:</h3>
          <p>Architect large-scale cloud services with Go, Kubernetes, AWS, and PostgreSQL. Mentor senior engineers and lead system design reviews.</p>
          <h3>Basic Qualifications:</h3>
          <p>8+ years of production software engineering experience. Expertise in Go, Kubernetes, AWS, PostgreSQL, Docker, Microservices, and System Design.</p>
        </div>
        <div class="apply-actions">
          <a data-automation-id="applyButton" href="#apply">Apply Now</a>
        </div>
        <div class="workday-application-form" id="apply">
          <form data-automation-id="applicationForm">
            <div>
              <label>First Name</label>
              <input type="text" data-automation-id="legalNameSection_firstName" name="legalNameSection_firstName" />
            </div>
            <div>
              <label>Last Name</label>
              <input type="text" data-automation-id="legalNameSection_lastName" name="legalNameSection_lastName" />
            </div>
            <div>
              <label>Email Address</label>
              <input type="email" data-automation-id="email" name="email" />
            </div>
            <div>
              <label>Phone Number</label>
              <input type="tel" data-automation-id="phone-number" name="phone" />
            </div>
            <div>
              <label>City</label>
              <input type="text" data-automation-id="addressSection_city" name="city" />
            </div>
            <div>
              <label>Resume Upload</label>
              <input type="file" data-automation-id="file-upload" name="resumeFile" />
            </div>
            <button type="submit" data-automation-id="submit-button">Submit</button>
          </form>
        </div>
      </div>
    </div>
  </body>
</html>
`;

export const ASHBY_DOM_FIXTURE = `
<!DOCTYPE html>
<html>
  <head>
    <title>Senior Machine Learning Engineer - SuperAI Careers</title>
    <meta name="ashby-job-id" content="67890-ml-engineer" />
  </head>
  <body>
    <div class="_container_1abc2">
      <div class="_header_1abc2">
        <h1 data-testid="job-posting-title">Senior Machine Learning Engineer</h1>
        <div class="_details_1abc2">
          <span data-testid="job-location">San Francisco, CA</span> · <span>Hybrid</span> · <span>Full Time</span>
        </div>
        <div class="_company_1abc2" data-testid="job-posting-company">SuperAI</div>
        <div data-testid="job-department">Applied AI Research</div>
      </div>
      <div data-testid="job-description" class="ashby-job-posting-description">
        <h3>About the Role</h3>
        <p>Join SuperAI to build frontier AI models and LLM agent architectures.</p>
        <h3>Qualifications</h3>
        <p>5+ years experience in Python, PyTorch, CUDA, LLM training, Machine Learning, and distributed GPU clusters.</p>
      </div>
      <a href="#application-form" class="_applyButton_1abc2">Apply for this role</a>
      <div id="application-form">
        <form action="https://jobs.ashbyhq.com/superai/67890-ml-engineer/apply" method="POST">
          <div>
            <label>First Name</label>
            <input type="text" name="firstName" id="ashby-first-name" />
          </div>
          <div>
            <label>Last Name</label>
            <input type="text" name="lastName" id="ashby-last-name" />
          </div>
          <div>
            <label>Email</label>
            <input type="email" name="email" id="ashby-email" />
          </div>
          <div>
            <label>Phone</label>
            <input type="tel" name="phone" id="ashby-phone" />
          </div>
          <div>
            <label>LinkedIn</label>
            <input type="text" name="urls[LinkedIn]" id="ashby-linkedin" />
          </div>
          <button type="submit">Submit Application</button>
        </form>
      </div>
    </div>
  </body>
</html>
`;

export const SCHEMA_ORG_DOM_FIXTURE = `
<!DOCTYPE html>
<html>
  <head>
    <title>Lead Full Stack Developer - InnovateTech</title>
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "JobPosting",
      "title": "Lead Full Stack Developer",
      "description": "<p>We are seeking a Lead Full Stack Developer to architect scalable web apps.</p><h3>Requirements</h3><ul><li>React, TypeScript, Node.js, and PostgreSQL</li><li>AWS and Docker deployment pipelines</li><li>5+ years web application architecture experience</li></ul>",
      "hiringOrganization": {
        "@type": "Organization",
        "name": "InnovateTech Inc"
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
      },
      "directApply": true
    }
    </script>
  </head>
  <body>
    <header><div class="brand">InnovateTech Careers</div></header>
    <main>
      <h1 class="job-title">Lead Full Stack Developer</h1>
      <div class="job-description">
        <h3>About the Role</h3>
        <p>Architect next-generation web applications using React, TypeScript, Node.js, and PostgreSQL on AWS.</p>
        <h3>Qualifications</h3>
        <p>5+ years experience building production React and Node.js applications with Docker and AWS.</p>
      </div>
      <form class="apply-form" action="/apply" method="POST">
        <input type="text" name="first_name" placeholder="First Name" />
        <input type="text" name="last_name" placeholder="Last Name" />
        <input type="email" name="email" placeholder="Email Address" />
        <input type="tel" name="phone" placeholder="Phone Number" />
        <input type="text" name="linkedin" placeholder="LinkedIn Profile" />
        <button type="submit">Apply Now</button>
      </form>
    </main>
  </body>
</html>
`;

export const ALGOMASTER_NEGATIVE_DOM_FIXTURE = `
<!DOCTYPE html>
<html>
  <head>
    <title>Course Introduction - System Design Masterclass | AlgoMaster</title>
    <meta property="og:site_name" content="AlgoMaster" />
  </head>
  <body>
    <nav class="curriculum-sidebar">
      <h2>Curriculum Overview</h2>
      <ul>
        <li><a href="/learn/system-design/course-introduction">Chapter 1: Introduction</a></li>
        <li><a href="/learn/system-design/scalability-fundamentals">Chapter 2: Scalability</a></li>
        <li><a href="/learn/system-design/caching-strategies">Chapter 3: Caching & Redis</a></li>
      </ul>
    </nav>
    <main>
      <div class="lesson-header">
        <h1>Course Introduction: System Design</h1>
        <div class="lesson-meta">
          <span>5 min read</span> · <span>Prerequisites: Basic CS</span> · <span>Updated Sept 2026</span>
        </div>
      </div>
      <article>
        <h2>System Requirements & High-Level Architecture</h2>
        <p>In this course, we will analyze functional and non-functional requirements for distributed systems.</p>
        <h2>Prerequisites & Experience</h2>
        <p>Students should have 1+ years of programming experience with Java, Python, Go, or TypeScript.</p>
        <p>Apply these architectural patterns in your daily software engineering work.</p>
        <div class="cta-box">
          <button class="enroll-btn">Enroll in Full Course ($49)</button>
        </div>
      </article>
      <section class="comments-section">
        <h3>Discussion (28 comments)</h3>
      </section>
    </main>
  </body>
</html>
`;

export const MDN_DOCS_NEGATIVE_DOM_FIXTURE = `
<!DOCTYPE html>
<html>
  <head>
    <title>Array.prototype.map() - JavaScript | MDN</title>
  </head>
  <body>
    <nav class="toc" aria-label="Table of contents">
      <h2>In this article</h2>
      <ul>
        <li><a href="#syntax">Syntax</a></li>
        <li><a href="#description">Description</a></li>
        <li><a href="#specifications">Specifications</a></li>
      </ul>
    </nav>
    <main>
      <h1>Array.prototype.map()</h1>
      <p>The map() method of Array instances creates a new array populated with the results of calling a provided function on every element in the calling array.</p>
      <h2>Specifications</h2>
      <p>ECMAScript specification requirements for JavaScript developers.</p>
      <pre><code>const numbers = [1, 4, 9]; const doubles = numbers.map(num => num * 2);</code></pre>
    </main>
  </body>
</html>
`;

export const LEETCODE_NEGATIVE_DOM_FIXTURE = `
<!DOCTYPE html>
<html>
  <head>
    <title>Two Sum - LeetCode</title>
  </head>
  <body>
    <div data-cy="question-title">1. Two Sum</div>
    <div class="problem-statement">
      <p>Given an array of integers <code>nums</code> and an integer <code>target</code>, return indices of the two numbers such that they add up to target.</p>
      <p>You may assume that each input would have exactly one solution.</p>
    </div>
    <div class="monaco-editor" style="height: 400px;"></div>
    <div class="testcase-container">
      <span>Input: nums = [2,7,11,15], target = 9</span>
    </div>
  </body>
</html>
`;

export const GITHUB_ISSUE_NEGATIVE_DOM_FIXTURE = `
<!DOCTYPE html>
<html>
  <head>
    <title>Bug: useEffect firing twice in StrictMode · Issue #12345 · facebook/react</title>
  </head>
  <body>
    <div class="repohead">
      <h1><a href="/facebook">facebook</a> / <a href="/facebook/react">react</a></h1>
    </div>
    <main>
      <h2>Bug: useEffect firing twice in StrictMode #12345</h2>
      <div class="author-bio">Opened by DanAbramov · 42 comments</div>
      <div class="comment-thread">
        <p>In React 18, StrictMode intentionally mounts twice in development to uncover side-effects.</p>
      </div>
    </main>
  </body>
</html>
`;

export const MEDIUM_BLOG_NEGATIVE_DOM_FIXTURE = `
<!DOCTYPE html>
<html>
  <head>
    <title>How to Ace the Senior Software Engineer Interview | Tech Blog</title>
  </head>
  <body>
    <header>
      <div class="author-bio">By Jane TechLead · <span class="reading-time">10 min read</span></div>
    </header>
    <article>
      <h1>How to Ace the Senior Software Engineer Interview</h1>
      <p>Reviewing job descriptions across tech, top requirements include Kubernetes, Go, and System Design with 5+ years of experience. Apply these tips to land the role.</p>
      <div class="comments-section">
        <h3>Responses (15)</h3>
      </div>
    </article>
  </body>
</html>
`;

export const MALFORMED_JSON_LD_DOM_FIXTURE = `
<!DOCTYPE html>
<html>
  <head>
    <title>Corrupted Schema Test</title>
    <script type="application/ld+json">
      { "invalid_json": true, missing_closing_quote: unquoted_val }
    </script>
  </head>
  <body>
    <h1>Corrupted Page</h1>
  </body>
</html>
`;

export const EMPTY_MINIMAL_DOM_FIXTURE = `
<!DOCTYPE html>
<html>
  <head><title>Minimal Blank</title></head>
  <body></body>
</html>
`;

export const NO_INPUTS_FORM_DOM_FIXTURE = `
<!DOCTYPE html>
<html>
  <head><title>Form Without Inputs</title></head>
  <body>
    <form id="empty_form">
      <p>Please contact us directly via email.</p>
    </form>
  </body>
</html>
`;

export const DISABLED_FIELDS_FORM_DOM_FIXTURE = `
<!DOCTYPE html>
<html>
  <head><title>Disabled Fields Test</title></head>
  <body>
    <form id="test_form">
      <input type="text" name="first_name" value="LockedFirst" disabled />
      <input type="text" name="last_name" value="LockedLast" readonly />
      <input type="email" name="email" placeholder="Enter Email" />
      <input type="tel" name="phone" placeholder="Enter Phone" />
    </form>
  </body>
</html>
`;
