/**
 * LinkedIn profile DOM fixtures reproducing the 2026 layout as observed live
 * on the owner's own profile (see scratchpad LINKEDIN_2026.md):
 *
 *   - `<main id="workspace">` is the only scroll container;
 *   - the main page holds `[data-testid="lazy-column"]` whose children are
 *     cards: the top card first (name is the first `h2`), then section cards
 *     that stay skeleton placeholders until the user physically scrolls;
 *   - rendered section cards are `<section>` elements with an `h2` heading and
 *     entries made of `<p>` blocks (no lists, no `aria-hidden` duplication);
 *   - `/details/*` pages render one main `<section>` whose heading is a bold
 *     `<p>`, plus sidebar sections and the site footer;
 *   - truncated text shows a `… more` `[data-testid="expandable-text-button"]`.
 *
 * One pre-2026 fixture is kept at the bottom to prove the legacy fallback.
 */

export const LINKEDIN_SLUG = 'jayden-chun';
export const LINKEDIN_PROFILE_URL = `https://www.linkedin.com/in/${LINKEDIN_SLUG}/`;
export const LINKEDIN_SELF_PROFILE_URL = `https://www.linkedin.com/in/${LINKEDIN_SLUG}/?isSelfProfile=true`;
export const LINKEDIN_ME_URL = 'https://www.linkedin.com/in/me/';
export const LINKEDIN_EXPERIENCE_DETAILS_URL = `https://www.linkedin.com/in/${LINKEDIN_SLUG}/details/experience/`;
export const LINKEDIN_EDUCATION_DETAILS_URL = `https://www.linkedin.com/in/${LINKEDIN_SLUG}/details/education/`;
export const LINKEDIN_CERTIFICATIONS_DETAILS_URL = `https://www.linkedin.com/in/${LINKEDIN_SLUG}/details/certifications/`;
export const LINKEDIN_PROJECTS_DETAILS_URL = `https://www.linkedin.com/in/${LINKEDIN_SLUG}/details/projects/`;
export const LINKEDIN_VOLUNTEERING_DETAILS_URL = `https://www.linkedin.com/in/${LINKEDIN_SLUG}/details/volunteering-experiences/`;
export const LINKEDIN_SKILLS_DETAILS_URL = `https://www.linkedin.com/in/${LINKEDIN_SLUG}/details/skills/`;
export const LINKEDIN_LANGUAGES_DETAILS_URL = `https://www.linkedin.com/in/${LINKEDIN_SLUG}/details/languages/`;

/** LinkedIn's sign-in wall, where `/in/me/` lands when the user is signed out. */
export const LINKEDIN_AUTHWALL_URL =
  'https://www.linkedin.com/authwall?trk=bf&trkInfo=AQE&original_referer=&sessionRedirect=https%3A%2F%2Fwww.linkedin.com%2Fin%2Fme%2F';
export const LINKEDIN_LOGIN_URL = 'https://www.linkedin.com/login?fromSignIn=true&trk=guest_homepage-basic_nav-header-signin';

function page(body: string, head = ''): string {
  return `<!DOCTYPE html><html><head>${head}</head><body>${body}</body></html>`;
}

const SKELETON_CARD = `<div class="card"><div class="skeleton" aria-busy="true"><div class="skeleton-line"></div><div class="skeleton-line"></div></div></div>`;

const FOOTER = `
<footer>
  <ul>
    <li><a href="/about">About</a></li>
    <li><a href="/accessibility">Accessibility</a></li>
    <li><a href="/talent">Talent Solutions</a></li>
    <li><a href="/policies">Professional Community Policies</a></li>
    <li><a href="/careers">Careers</a></li>
    <li><a href="/legal">Privacy &amp; Terms</a></li>
    <li><a href="/ads">Ad Choices</a></li>
    <li><a href="/advertising">Advertising</a></li>
    <li><a href="/business">Business Services</a></li>
    <li><a href="/app">Get the LinkedIn app</a></li>
    <li><button>More</button></li>
  </ul>
  <p>LinkedIn Corporation © 2026</p>
</footer>`;

const DETAILS_SIDEBAR = `
<section class="sidebar"><p>Profile language</p><p>English</p></section>
<section class="sidebar"><p>Public profile &amp; URL</p><p>www.linkedin.com/in/${LINKEDIN_SLUG}</p></section>
<section class="sidebar">
  <p>Who your viewers also viewed</p>
  <div><p>Alex Rivera</p><p>Software Engineer at Startup Inc</p><button>Connect</button></div>
  <div><p>Priya Natarajan</p><p>Student at Texas A&amp;M University</p><button>Connect</button></div>
</section>
<section class="sidebar"><p>Ad Options</p><p>Promoted</p><p>Learn Kubernetes in 30 days</p></section>`;

const BACK_BUTTON = `<button aria-label="Back to the main profile page"><svg aria-hidden="true"></svg></button>`;

const TOP_CARD = `
<div class="card top-card">
  <div><img alt="" src="data:," /><h2>Jayden Chun</h2></div>
  <p>Computer Engineering + Engineering Honors Student @ TAMU</p>
  <div><p>Round Rock, Texas, United States</p><span>·</span><a href="#contact">Contact info</a></div>
  <div><p>Date Maroon</p><p>Texas A&amp;M University</p></div>
  <p>206 connections</p>
  <div><button>Open to</button><button>Add section</button><button>Enhance profile</button><button>Resources</button></div>
</div>`;

/** Main page straight after load: the top card is real, every section card is a skeleton. */
export const LINKEDIN_MAIN_SKELETON_BODY = `
<main id="workspace">
  <div data-testid="lazy-column">
    ${TOP_CARD}
    ${SKELETON_CARD}
    ${SKELETON_CARD}
    ${SKELETON_CARD}
    ${SKELETON_CARD}
    ${SKELETON_CARD}
    ${SKELETON_CARD}
  </div>
  ${FOOTER}
</main>`;
export const LINKEDIN_MAIN_SKELETON_HTML = page(LINKEDIN_MAIN_SKELETON_BODY);

/** Main page after the user scrolled: About, Experience, Education and Skills rendered; the rest still skeletons. */
export const LINKEDIN_MAIN_RENDERED_BODY = `
<main id="workspace">
  <div data-testid="lazy-column">
    ${TOP_CARD}
    <div class="card"><section>
      <h2>About</h2>
      <div>
        <span>Computer Engineering student at Texas A&amp;M building tools for developers and small teams.</span>
        <span>Currently a software engineering intern at Date Maroon, working on product testing and release quality.</span>
        <button data-testid="expandable-text-button">… more</button>
      </div>
      <p>Top skills</p>
      <p>Git • Java • Machine Learning • React.js • Node.js</p>
    </section></div>
    <div class="card"><section>
      <h2>Experience</h2>
      <div>
        <a href="/company/date-maroon/"><p>Software Engineer Intern</p><p>Date Maroon · Internship</p><p>Jul 2026 - Present · 3 mos</p><p>Remote</p></a>
        <div><span>Conducted structured user acceptance testing (UAT) across the web and mobile surfaces of the product.</span><button data-testid="expandable-text-button">… more</button></div>
        <a href="#"><span>Software Development, Product Testing and +1 skill</span></a>
        <hr />
        <a href="/company/silvia-health/"><p>Student Intern</p><p>SILVIA Health · Internship</p><p>Jun 2025 - Aug 2025 · 3 mos</p><p>Remote</p></a>
        <div><span>Performed UI/UX testing on the dementia-care companion app and translated the interface into Korean.</span></div>
        <a href="#"><span>Translation, User Interface Design and +3 skills</span></a>
      </div>
      <a href="/in/${LINKEDIN_SLUG}/details/experience/"><span>Show all 3 experiences</span></a>
    </section></div>
    <div class="card"><section>
      <h2>Education</h2>
      <div>
        <a href="/school/tamu/"><p>Texas A&amp;M University</p><p>Bachelor of Engineering, ENGINEERING</p><p>2026 – May 2030</p></a>
        <div><span>Grade: 3.9</span></div>
      </div>
    </section></div>
    ${SKELETON_CARD}
    ${SKELETON_CARD}
    <div class="card"><section>
      <h2>Skills (50)</h2>
      <div>
        <div><a href="#"><p>Git</p></a><p>Software Engineer Intern at Date Maroon</p></div>
        <div><a href="#"><p>Java</p></a><p>12 endorsements</p></div>
      </div>
      <a href="/in/${LINKEDIN_SLUG}/details/skills/"><span>Show all 50 skills</span></a>
    </section></div>
    ${SKELETON_CARD}
  </div>
  ${FOOTER}
</main>`;
export const LINKEDIN_MAIN_RENDERED_HTML = page(
  LINKEDIN_MAIN_RENDERED_BODY,
  `<link rel="canonical" href="${LINKEDIN_PROFILE_URL}">`
);

function detailsPage(section: string): string {
  return `
<main id="workspace">
  <section class="details">
    <div>${BACK_BUTTON}${section}</div>
  </section>
  ${DETAILS_SIDEBAR}
  ${FOOTER}
</main>`;
}

/** `/details/experience/`: three flat entries, the third with ` - ` inside the company name. */
export const LINKEDIN_EXPERIENCE_DETAILS_BODY = detailsPage(`
    <p class="heading">Experience</p>
    <div>
      <a href="/company/date-maroon/"><p>Software Engineer Intern</p><p>Date Maroon · Internship</p><p>Jul 2026 - Present · 3 mos</p><p>Remote</p></a>
      <div>
        <span>Conducted structured user acceptance testing (UAT) across the web and mobile surfaces of the product.</span>
        <span>Identified usability issues and regressions before release and documented them for the engineering team.</span>
        <span>Applied critical analysis to product requirements to propose testable acceptance criteria.</span>
      </div>
      <a href="#"><span>Software Development, Product Testing and +1 skill</span></a>
      <hr />
      <a href="/company/silvia-health/"><p>Student Intern</p><p>SILVIA Health · Internship</p><p>Jun 2025 - Aug 2025 · 3 mos</p><p>Remote</p></a>
      <div><span>Performed UI/UX testing on the dementia-care companion app and translated the interface into Korean.</span></div>
      <a href="#"><span>Translation, User Interface Design and +3 skills</span></a>
      <hr />
      <a href="/company/nasa/"><p>NASA HAS Scholar</p><p>NASA - National Aeronautics and Space Administration · Internship</p><p>Oct 2024 - Jul 2025 · 10 mos</p><p>Remote</p></a>
      <div>
        <span>Selected for NASA's High School Aerospace Scholars program from a competitive statewide applicant pool.</span>
        <span>Completed program modules on orbital mechanics, mission design and systems engineering.</span>
        <span>Engineered a lunar habitat concept with a five-person team and presented it to NASA engineers.</span>
      </div>
      <a href="#"><span>Computer-Aided Design (CAD), Project Management and +3 skills</span></a>
    </div>`);
export const LINKEDIN_EXPERIENCE_DETAILS_HTML = page(LINKEDIN_EXPERIENCE_DETAILS_BODY);

/** `/details/experience/` with a grouped company (two roles under one header) followed by a flat entry. */
export const LINKEDIN_GROUPED_EXPERIENCE_DETAILS_BODY = detailsPage(`
    <p class="heading">Experience</p>
    <div>
      <a href="/company/globex/"><p>Globex Corporation</p><p>Full-time · 3 yrs 2 mos</p><p>Austin, Texas, United States</p></a>
      <div>
        <a href="#"><p>Software Engineer II</p><p>Jul 2021 - Dec 2022 · 1 yr 6 mos</p><p>Austin, Texas, United States</p></a>
        <div><span>Built the internal feature-flag service used by 40 teams.</span></div>
        <a href="#"><span>Python, Django and +1 skill</span></a>
        <a href="#"><p>Software Engineer Intern</p><p>Internship</p><p>Jun 2019 - Aug 2019 · 3 mos</p></a>
        <div><span>Prototyped a log search tool in Python.</span></div>
      </div>
      <hr />
      <a href="/company/state-university/"><p>Research Assistant</p><p>State University · Part-time</p><p>2017 - 2019</p></a>
    </div>`);
export const LINKEDIN_GROUPED_EXPERIENCE_DETAILS_HTML = page(LINKEDIN_GROUPED_EXPERIENCE_DETAILS_BODY);

/** `/details/experience/` before the entries arrive: heading only. */
export const LINKEDIN_EXPERIENCE_SKELETON_BODY = `
<main id="workspace">
  <section class="details"><div>${BACK_BUTTON}<p class="heading">Experience</p></div><div class="skeleton" aria-busy="true"></div></section>
  ${FOOTER}
</main>`;
export const LINKEDIN_EXPERIENCE_SKELETON_HTML = page(LINKEDIN_EXPERIENCE_SKELETON_BODY);

export const LINKEDIN_EDUCATION_DETAILS_BODY = detailsPage(`
    <p class="heading">Education</p>
    <div>
      <a href="/school/tamu/"><p>Texas A&amp;M University</p><p>Bachelor of Engineering, ENGINEERING</p><p>2026 – May 2030</p></a>
      <div><span>Grade: 3.9</span><span>Activities and societies: Engineering Honors, Aggie Coding Club</span></div>
      <hr />
      <a href="/school/rrhs/"><p>Round Rock High School</p><p>High School Diploma</p><p>2022 - 2026</p></a>
    </div>`);
export const LINKEDIN_EDUCATION_DETAILS_HTML = page(LINKEDIN_EDUCATION_DETAILS_BODY);

export const LINKEDIN_CERTIFICATIONS_DETAILS_BODY = detailsPage(`
    <p class="heading">Licenses &amp; certifications</p>
    <div>
      <a href="/company/anthropic/"><p>Introduction to Model Context Protocol</p><p>Anthropic</p><p>Issued Jun 2026</p><p>Credential ID 2dkmzqtqkr3i</p></a>
      <a href="https://verify.skilljar.com/c/2dkmzqtqkr3i" target="_blank"><span>Show credential</span></a>
      <p>Skills: Model Context Protocol (MCP)</p>
      <hr />
      <a href="/company/anthropic/"><p>Certificate of Completion: AI Fluency Framework &amp; Foundations</p><p>Anthropic</p><p>Issued Jun 2026</p><p>Credential ID bad7sx27ajet</p></a>
      <a href="https://verify.skilljar.com/c/bad7sx27ajet" target="_blank"><span>Show credential</span></a>
      <p>Skills: Anthropic Claude, Claude Skills</p>
      <hr />
      <a href="/company/aws/"><p>AWS Certified Cloud Practitioner</p><p>Amazon Web Services (AWS)</p><p>Issued Jan 2025 · Expires Jan 2028</p></a>
      <a href="https://www.credly.com/badges/abc-123" target="_blank"><span>Show credential</span></a>
    </div>`);
export const LINKEDIN_CERTIFICATIONS_DETAILS_HTML = page(LINKEDIN_CERTIFICATIONS_DETAILS_BODY);

/** `/details/projects/` before expanding: the first description is cut with a `… more` button. */
export const LINKEDIN_PROJECTS_DETAILS_BODY = detailsPage(`
    <p class="heading">Projects</p>
    <div>
      <a href="#"><p>Savor</p><p>Jun 2026 – Present</p></a>
      <div>
        <span>Savor turns a photo of any restaurant menu into a personalised, dietary-aware ordering guide.</span>
        <span>Menu photos run through an OCR + LLM inference pipeline: Google Cloud Vision extracts the text and a language model structures it into dishes.</span>
        <button data-testid="expandable-text-button">… more</button>
      </div>
      <a href="#"><span>Google Cloud Vision, Mobile Application Development and +7 skills</span></a>
      <hr />
      <a href="#"><p>Portfolio</p><p>May 2025 – Present</p></a>
      <div><span>This minimalistic website showcases my projects, experience and writing.</span></div>
      <a href="#"><span>React.js, Next.js and +3 skills</span></a>
    </div>`);
export const LINKEDIN_PROJECTS_DETAILS_HTML = page(LINKEDIN_PROJECTS_DETAILS_BODY);

export const LINKEDIN_VOLUNTEERING_DETAILS_BODY = detailsPage(`
    <p class="heading">Volunteering</p>
    <div>
      <a href="#"><p>Care Team Leader</p><p>AUSTIN KOREAN PRESBYTERIAN CHURCH</p><p>Jun 2022 - May 2026 · 4 yrs</p><p>Social Services</p></a>
      <div><span>Led a youth group of 100+ students, organising weekly programs and mentoring student volunteers.</span><button data-testid="expandable-text-button">… more</button></div>
      <hr />
      <a href="#"><p>Coding Mentor</p><p>Code2College · Volunteer</p><p>Sep 2025 - Present · 1 yr 1 mo</p><p>Education</p></a>
      <div><span>Taught weekly Python lessons to high-school students preparing for their first internships.</span></div>
    </div>`);
export const LINKEDIN_VOLUNTEERING_DETAILS_HTML = page(LINKEDIN_VOLUNTEERING_DETAILS_BODY);

const SKILL_PILLS = `
    <div role="tablist">
      <button role="tab">All</button>
      <button role="tab">Industry Knowledge</button>
      <button role="tab">Tools &amp; Technologies</button>
      <button role="tab">Interpersonal Skills</button>
      <button role="tab">Languages</button>
      <button role="tab">Other Skills</button>
    </div>`;

/** `/details/skills/` when it loads: context lines include a certification name. */
export const LINKEDIN_SKILLS_DETAILS_BODY = detailsPage(`
    <p class="heading">Skills</p>
    ${SKILL_PILLS}
    <div>
      <div><a href="#"><p>Software Development</p></a><p>Software Engineer Intern at Maroon</p></div>
      <div><a href="#"><p>Product Testing</p></a><p>Software Engineer Intern at Maroon</p></div>
      <div><a href="#"><p>Communication</p></a><p>Software Engineer Intern at Maroon</p><p>3 endorsements</p></div>
      <div><a href="#"><p>Model Context Protocol (MCP)</p></a><p>Introduction to Model Context Protocol</p></div>
      <div><a href="#"><p>User Interface Design</p></a><p>Student Intern at SILVIA Health</p></div>
      <div><a href="#"><p>Python (Programming Language)</p></a><p>Passed LinkedIn Skill Assessment</p></div>
      <div><a href="#"><p>Machine Learning</p></a></div>
      <div><a href="#"><p>PostgreSQL</p></a></div>
      <div><a href="#"><p>Computer Engineering</p></a></div>
      <div><a href="#"><p>Dementia</p></a></div>
    </div>`);
export const LINKEDIN_SKILLS_DETAILS_HTML = page(LINKEDIN_SKILLS_DETAILS_BODY);

/** `/details/skills/` when LinkedIn throttles: heading and category pills only. */
export const LINKEDIN_SKILLS_SKELETON_BODY = `
<main id="workspace">
  <section class="details"><div>${BACK_BUTTON}<p class="heading">Skills</p></div>${SKILL_PILLS}<div class="skeleton" aria-busy="true"></div></section>
  ${FOOTER}
</main>`;
export const LINKEDIN_SKILLS_SKELETON_HTML = page(LINKEDIN_SKILLS_SKELETON_BODY);

/** LinkedIn's 404 (e.g. `/details/about/`, or a profile that no longer exists). */
export const LINKEDIN_NOT_FOUND_BODY = `
<main id="workspace">
  <section>
    <h1>This page doesn’t exist</h1>
    <p>Please check your URL or return to LinkedIn home.</p>
    <a href="/feed/">Go to your feed</a>
  </section>
  ${FOOTER}
</main>`;
export const LINKEDIN_NOT_FOUND_HTML = page(LINKEDIN_NOT_FOUND_BODY);

export const LINKEDIN_AUTHWALL_BODY = `
<main class="authwall">
  <h1 class="authwall-join-form__title">Sign in to view Jayden's profile</h1>
  <form class="authwall-join-form" action="/checkpoint/lg/login-submit" method="post">
    <input name="session_key" type="email" placeholder="Email or phone" />
    <input name="session_password" type="password" placeholder="Password" />
    <button type="submit">Sign in</button>
  </form>
</main>`;
export const LINKEDIN_AUTHWALL_HTML = page(LINKEDIN_AUTHWALL_BODY);

// ---------------------------------------------------------------------------
// Pre-2026 (legacy) layout, kept to prove the fallback path still works.
// ---------------------------------------------------------------------------

/** The year after the current one, so "in progress" education stays in progress. */
export const FUTURE_YEAR = new Date().getFullYear() + 1;

/** Renders LinkedIn's old duplicated visible/screen-reader text pair. */
function dup(text: string): string {
  return `<span aria-hidden="true">${text}</span><span class="visually-hidden">${text}</span>`;
}

function legacyHeading(text: string): string {
  return `<div class="pvs-header__container"><h2 class="pvs-header__title">${dup(text)}</h2></div>`;
}

export const LEGACY_PROFILE_URL = 'https://www.linkedin.com/in/jane-doe-123/';

/** Legacy full profile: `h1` name, anchor ids, `<ul><li>` entries, duplicated spans. */
export const LEGACY_FULL_PROFILE_HTML = page(
  `
<main class="scaffold-layout__main" aria-label="Main Content">
  <section class="artdeco-card pv-top-card">
    <div class="ph5 pb5">
      <h1 class="text-heading-xlarge">Jane Doe</h1>
      <span class="text-body-small">${dup('She/Her')}</span>
      <div class="text-body-medium break-words">Software Engineer at Acme Corp | Distributed systems &amp; developer tooling</div>
      <div class="mt2">
        <span class="text-body-small">San Francisco, California, United States</span>
        <span class="text-body-small">Contact info</span>
      </div>
      <ul class="pv-top-card--list-bullet"><li class="text-body-small"><span class="t-bold">500+ connections</span></li></ul>
    </div>
  </section>

  <section class="artdeco-card pv-profile-card">
    <div id="about" class="pv-profile-card__anchor"></div>
    ${legacyHeading('About')}
    <div class="inline-show-more-text">
      ${dup('Backend engineer with six years of experience building distributed systems and developer tooling.')}
      <button class="inline-show-more-text__button" aria-expanded="false">…see more</button>
    </div>
  </section>

  <section class="artdeco-card pv-profile-card">
    <div id="experience" class="pv-profile-card__anchor"></div>
    ${legacyHeading('Experience')}
    <ul class="pvs-list">
      <li class="artdeco-list__item">
        <a class="optional-action-target-wrapper" href="https://www.linkedin.com/company/acme-corp/">
          <div class="t-bold">${dup('Senior Software Engineer')}</div>
          <span class="t-14 t-normal">${dup('Acme Corp · Full-time')}</span>
          <span class="t-14 t-normal t-black--light">${dup('Jan 2023 - Present · 1 yr 8 mos')}</span>
          <span class="t-14 t-normal t-black--light">${dup('San Francisco, CA · Hybrid')}</span>
        </a>
        <ul>
          <li><div class="inline-show-more-text">${dup('Led the migration of the billing platform from a monolith to Go microservices on Kubernetes.')}</div></li>
          <li><div class="t-14"><strong>${dup('Skills: Go · Kubernetes · PostgreSQL')}</strong></div></li>
        </ul>
      </li>
      <li class="artdeco-list__item">
        <a class="optional-action-target-wrapper" href="https://www.linkedin.com/company/initech/">
          <div class="t-bold">${dup('Research Assistant')}</div>
          <span class="t-14 t-normal">${dup('State University · Part-time')}</span>
          <span class="t-14 t-normal t-black--light">${dup('2017 - 2019')}</span>
        </a>
      </li>
    </ul>
  </section>

  <section class="artdeco-card pv-profile-card">
    <div id="education" class="pv-profile-card__anchor"></div>
    ${legacyHeading('Education')}
    <ul class="pvs-list">
      <li class="artdeco-list__item">
        <a class="optional-action-target-wrapper" href="https://www.linkedin.com/school/state-university/">
          <div class="t-bold">${dup('State University')}</div>
          <span class="t-14 t-normal">${dup('Bachelor of Science - BS, Computer Science')}</span>
          <span class="t-14 t-normal t-black--light">${dup(`2023 - ${FUTURE_YEAR}`)}</span>
        </a>
        <ul><li><div class="t-14">${dup('Grade: 3.8')}</div></li></ul>
      </li>
    </ul>
  </section>

  <section class="artdeco-card pv-profile-card">
    <div id="skills" class="pv-profile-card__anchor"></div>
    ${legacyHeading('Skills')}
    <ul class="pvs-list">
      <li class="artdeco-list__item"><a href="#"><div class="t-bold">${dup('Go')}</div></a><ul><li><div class="t-14">${dup('12 endorsements')}</div></li></ul></li>
      <li class="artdeco-list__item"><a href="#"><div class="t-bold">${dup('Kubernetes')}</div></a></li>
    </ul>
    <div class="pvs-list__footer-wrapper"><a href="https://www.linkedin.com/in/jane-doe-123/details/skills/"><span>Show all 24 skills</span></a></div>
  </section>
</main>`,
  `<link rel="canonical" href="${LEGACY_PROFILE_URL}">`
);

/** Legacy sparse profile: the `h1` name sits outside `main` — nothing the 2026 selectors can find. */
export const LEGACY_SPARSE_PROFILE_HTML = page(`
<header class="scaffold-layout__header">
  <h1 class="text-heading-xlarge">Sam Solo</h1>
</header>
<main class="scaffold-layout__main">
  <section class="artdeco-card pv-top-card">
    <div class="ph5 pb5">
      <div class="text-body-medium break-words">Aspiring data analyst</div>
      <span class="text-body-small inline t-black--light break-words">Denver, Colorado, United States</span>
    </div>
  </section>
</main>`);

/** @deprecated alias kept for callers written against the pre-2026 fixture names. */
export const LINKEDIN_FULL_PROFILE_HTML = LEGACY_FULL_PROFILE_HTML;
