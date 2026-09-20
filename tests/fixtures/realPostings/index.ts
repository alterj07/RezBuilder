/**
 * Production-shaped job posting HTML. Unlike `domFixtures.ts`, bullets carry
 * no trailing periods and headings are the real markup each platform emits
 * (h3, <p><strong>, ALL CAPS divs, <br>-separated runs), which is exactly the
 * shape that used to collapse into a single line and lose the
 * required-vs-preferred split. Swap in saved pages here as you collect them.
 */

export interface RealPostingFixture {
  name: string;
  url: string;
  html: string;
  /** Skills that must land in `requiredSkills`. */
  expectRequired: string[];
  /** Skills that must land in `niceToHaveSkills`. */
  expectNice: string[];
  /** Section kinds expected in order (only those the heading regexes handle). */
  expectKinds?: string[];
  expectDegreeRequired?: boolean;
  expectYears?: number;
}

export const GREENHOUSE_REAL: RealPostingFixture = {
  name: 'greenhouse',
  url: 'https://boards.greenhouse.io/ledgerly/jobs/4412345',
  expectRequired: ['typescript', 'node.js', 'postgresql', 'kubernetes'],
  expectNice: ['kafka', 'graphql', 'terraform', 'rust'],
  expectKinds: ['about', 'responsibilities', 'required', 'preferred', 'benefits', 'eeo'],
  expectDegreeRequired: true,
  expectYears: 5,
  html: `<!DOCTYPE html><html><head><title>Job Application for Senior Backend Engineer at Ledgerly</title>
<meta property="og:site_name" content="Greenhouse"></head><body>
<div id="wrapper"><div id="header"><h1 class="app-title">Senior Backend Engineer</h1><span class="company-name">Ledgerly</span><div class="location">Remote - US</div></div>
<div id="content" class="app-body">
<h3>About Ledgerly</h3>
<p>Ledgerly builds payment infrastructure at scale for millions of users. We are a remote-first team that values ownership</p>
<h3>What you'll do</h3>
<ul>
<li>Design and operate high-throughput services that process billions of transactions</li>
<li>Own services end-to-end, from design to production reliability</li>
<li>Mentor engineers and lead technical design reviews</li>
</ul>
<h3>Requirements</h3>
<ul>
<li>5+ years of experience building backend systems</li>
<li>Strong proficiency in TypeScript and Node.js</li>
<li>Production experience with PostgreSQL and Kubernetes</li>
<li>Bachelor's degree in Computer Science or a related field</li>
</ul>
<h3>Preferred Qualifications</h3>
<ul>
<li>Experience with Kafka or other streaming systems</li>
<li>Familiarity with GraphQL</li>
<li>Terraform or other infrastructure-as-code tooling</li>
<li>Experience with Rust</li>
</ul>
<h3>Benefits</h3>
<ul><li>Competitive salary and equity</li><li>Health, dental and vision</li></ul>
<h3>Equal Opportunity</h3>
<p>Ledgerly is an equal opportunity employer. All qualified applicants will receive consideration without regard to race, color, religion, sex, national origin, disability or protected veteran status</p>
</div>
<div id="application"><form id="application_form" action="/apply"><input type="file" name="resume" accept=".pdf"><button id="submit_app">Submit Application</button></form></div>
</div></body></html>`,
};

export const LEVER_REAL: RealPostingFixture = {
  name: 'lever',
  url: 'https://jobs.lever.co/northwind/9f1c2d3e',
  expectRequired: ['python', 'django', 'aws'],
  expectNice: ['react', 'redis'],
  expectDegreeRequired: false,
  expectYears: 3,
  html: `<!DOCTYPE html><html><head><title>Northwind - Full Stack Engineer</title></head><body>
<div class="content"><div class="posting-headline"><h2>Full Stack Engineer</h2><div class="posting-categories"><div class="location">Austin, TX</div><div class="workplaceTypes">Hybrid</div></div></div>
<div class="section-wrapper page-full-width"><div class="section page-centered" data-qa="job-description">
<div>Northwind is building the operating system for independent retailers</div>
</div></div>
<div class="section-wrapper page-full-width"><div class="section page-centered">
<h3>What you'll do</h3>
<ul class="posting-requirements plain-list"><li>Ship features across our Django backend and React storefront</li><li>Partner with design and product on weekly releases</li></ul>
</div></div>
<div class="section-wrapper page-full-width"><div class="section page-centered">
<h3>What we're looking for</h3>
<ul class="posting-requirements plain-list"><li>3+ years of professional software development experience</li><li>Deep experience with Python and Django</li><li>Comfortable deploying and operating services on AWS</li><li>Bachelor's degree or equivalent experience</li></ul>
</div></div>
<div class="section-wrapper page-full-width"><div class="section page-centered">
<h3>Bonus points</h3>
<ul class="posting-requirements plain-list"><li>Experience with React</li><li>You have used Redis at scale</li></ul>
</div></div>
<div class="section-wrapper page-full-width"><div class="section page-centered"><h3>Perks</h3><ul><li>Flexible PTO</li></ul></div></div>
<div class="postings-btn-wrapper"><a class="postings-btn" href="/northwind/9f1c2d3e/apply">Apply for this job</a></div>
</div></body></html>`,
};

export const LINKEDIN_REAL: RealPostingFixture = {
  name: 'linkedin',
  url: 'https://www.linkedin.com/jobs/view/3912345678/',
  expectRequired: ['java', 'spring boot', 'sql'],
  expectNice: ['kubernetes', 'kafka'],
  expectYears: 4,
  html: `<!DOCTYPE html><html><head><title>Backend Engineer II | Meridian Health | LinkedIn</title></head><body>
<div class="job-details-jobs-unified-top-card__container">
<h1 class="job-details-jobs-unified-top-card__job-title">Backend Engineer II</h1>
<div class="job-details-jobs-unified-top-card__company-name">Meridian Health</div>
<div class="job-details-jobs-unified-top-card__primary-description-container"><span>Boston, MA (Hybrid)</span></div>
</div>
<div class="jobs-description__content"><div id="job-details" class="jobs-box__html-content">
<span><p><strong>About the role</strong></p><p>Meridian Health is modernizing the claims platform used by thousands of clinics</p>
<p><strong>Responsibilities</strong></p>
<ul><li>Build and maintain Spring Boot microservices</li><li>Design relational schemas and tune SQL queries</li><li>Participate in on-call rotation</li></ul>
<p><strong>Basic Qualifications</strong></p>
<ul><li>4+ years of experience developing production software in Java</li><li>Hands-on experience with Spring Boot</li><li>Strong SQL skills</li></ul>
<p><strong>Preferred Qualifications</strong></p>
<ul><li>Experience running workloads on Kubernetes</li><li>Exposure to Kafka</li></ul>
<p><strong>Pay range</strong></p><p>$140,000 - $170,000 base</p></span>
</div></div>
<div class="jobs-apply-button--top-card"><button class="jobs-apply-button">Easy Apply</button></div>
</body></html>`,
};

export const WORKDAY_REAL: RealPostingFixture = {
  name: 'workday',
  url: 'https://acme.wd5.myworkdayjobs.com/en-US/Careers/job/Software-Engineer_R123456',
  expectRequired: ['c++', 'linux'],
  expectNice: ['python', 'docker'],
  expectDegreeRequired: true,
  expectYears: 2,
  html: `<!DOCTYPE html><html><head><title>Software Engineer - Embedded</title></head><body>
<div data-automation-id="jobPostingPage">
<h2 data-automation-id="jobPostingHeader">Software Engineer - Embedded</h2>
<div data-automation-id="companyName">Acme Robotics</div>
<div data-automation-id="locations"><dl><dd>Pittsburgh, PA</dd></dl></div>
<div data-automation-id="jobPostingDescription">
<p><b>Job Description</b></p>
<p>Acme Robotics designs autonomous warehouse robots</p>
<p><b>Responsibilities:</b></p>
<p>Develop firmware for motor control boards<br>Debug hardware/software integration issues<br>Write unit and integration tests</p>
<p><b>Minimum Qualifications:</b></p>
<p>Bachelor's degree in Computer Engineering or Electrical Engineering<br>2+ years of experience with C++<br>Experience developing on Linux</p>
<p><b>Preferred Qualifications:</b></p>
<p>Scripting in Python<br>Familiarity with Docker</p>
<p><b>Additional Information</b></p>
<p>Acme Robotics is an Equal Opportunity Employer</p>
</div>
<div data-automation-id="jobPostingButtons"><a data-automation-id="adventureButton" href="/apply">Apply</a></div>
</div></body></html>`,
};

export const ASHBY_REAL: RealPostingFixture = {
  name: 'ashby',
  url: 'https://jobs.ashbyhq.com/lumen/0a1b2c3d',
  expectRequired: ['pytorch', 'python'],
  expectNice: ['cuda', 'rust'],
  html: `<!DOCTYPE html><html><head><title>Lumen - Research Engineer</title></head><body>
<div class="ashby-job-posting-root">
<div class="_container_JobPostingHeader"><h1 class="_title_JobPostingHeader_title">Research Engineer</h1><div class="_company_JobPostingHeader_company">Lumen</div></div>
<div class="_description_JobPostingDescription">
<h2>ABOUT LUMEN</h2>
<p>We train frontier models for scientific discovery</p>
<h2>WHAT YOU WILL DO</h2>
<ul><li>Run large-scale training experiments</li><li>Build evaluation harnesses</li></ul>
<h2>YOU MIGHT BE A FIT IF</h2>
<ul><li>You have shipped research code in PyTorch</li><li>You write clean, well-tested Python</li></ul>
<h2>NICE TO HAVE</h2>
<ul><li>Experience writing CUDA kernels</li><li>Rust for high-performance data loaders</li></ul>
</div>
<div class="ashby-application-form-container"><form action="https://jobs.ashbyhq.com/lumen/0a1b2c3d/application"><input type="file" name="resume"><button type="submit">Submit Application</button></form></div>
</div></body></html>`,
};

export const INDEED_REAL: RealPostingFixture = {
  name: 'indeed',
  url: 'https://www.indeed.com/viewjob?jk=abc123def456',
  expectRequired: ['react', 'javascript'],
  expectNice: ['typescript', 'graphql'],
  expectYears: 2,
  html: `<!DOCTYPE html><html><head><title>Front End Developer - Cedar Point Media - Indeed.com</title></head><body>
<div class="jobsearch-JobComponent">
<h1 class="jobsearch-JobInfoHeader-title" data-testid="jobsearch-JobInfoHeader-title">Front End Developer</h1>
<div data-testid="inlineHeader-companyName">Cedar Point Media</div>
<div data-testid="inlineHeader-companyLocation">Denver, CO</div>
<div id="jobDescriptionText" class="jobsearch-jobDescriptionText">
<p>Cedar Point Media publishes regional news sites read by two million people a month</p>
<p><b>Duties</b></p>
<ul><li>Implement responsive layouts from Figma designs</li><li>Maintain our React component library</li></ul>
<p><b>Requirements</b></p>
<ul><li>2+ years of front end development experience</li><li>Strong JavaScript fundamentals</li><li>Experience with React</li></ul>
<p><b>Nice to have</b></p>
<ul><li>TypeScript</li><li>GraphQL</li></ul>
<p>Job Type: Full-time</p>
</div>
<div id="applyButtonLinkContainer"><button id="indeedApplyButton">Apply now</button></div>
</div></body></html>`,
};

export const SCHEMA_ORG_REAL: RealPostingFixture = {
  name: 'schemaOrgOnly',
  url: 'https://careers.orbitalsystems.example/positions/data-engineer',
  expectRequired: ['python', 'spark', 'airflow'],
  expectNice: ['snowflake'],
  expectYears: 3,
  html: `<!DOCTYPE html><html><head><title>Data Engineer - Orbital Systems</title>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"JobPosting","title":"Data Engineer","hiringOrganization":{"@type":"Organization","name":"Orbital Systems"},"jobLocation":{"@type":"Place","address":{"addressLocality":"Seattle","addressRegion":"WA","addressCountry":"US"}},"datePosted":"2026-09-01","employmentType":"FULL_TIME","description":"<p>Orbital Systems builds telemetry pipelines for satellite operators.</p><h3>What you'll do</h3><ul><li>Own batch and streaming pipelines end to end</li><li>Model data for analysts</li></ul><h3>Requirements</h3><ul><li>3+ years of data engineering experience</li><li>Expert Python</li><li>Production experience with Spark and Airflow</li></ul><h3>Nice to have</h3><ul><li>Snowflake</li><li>dbt</li></ul>"}</script>
</head><body><main><h1>Data Engineer</h1><a href="/positions/data-engineer/apply">Apply now</a></main></body></html>`,
};

/** No headings at all: everything is `unknown` and only the on-device labeller can place it. */
export const HEADINGLESS_REAL: RealPostingFixture = {
  name: 'headingless',
  url: 'https://boards.greenhouse.io/tinyco/jobs/1',
  expectRequired: [],
  expectNice: [],
  html: `<!DOCTYPE html><html><head><title>Job Application for Platform Engineer at TinyCo</title></head><body>
<div id="header"><h1 class="app-title">Platform Engineer</h1><span class="company-name">TinyCo</span></div>
<div id="content" class="app-body">
<p>TinyCo is a five-person team building developer tooling for small businesses</p>
<p>You will design and run our Kubernetes clusters on GCP, own our Terraform modules, and keep our CI pipelines fast</p>
<p>You have several years of experience operating production infrastructure and are fluent in Go</p>
<p>It would be great if you have used Pulumi or written Helm charts</p>
<p>We offer remote work, a generous equipment budget and quarterly offsites</p>
</div>
<form id="application_form" action="/apply"><input type="file" name="resume"><button id="submit_app">Submit</button></form>
</body></html>`,
};

export const REAL_POSTINGS: RealPostingFixture[] = [
  GREENHOUSE_REAL,
  LEVER_REAL,
  LINKEDIN_REAL,
  WORKDAY_REAL,
  ASHBY_REAL,
  INDEED_REAL,
  SCHEMA_ORG_REAL,
];
