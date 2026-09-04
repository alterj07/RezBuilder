/**
 * Realistic LinkedIn profile DOM fixtures.
 *
 * Mirrors the structure of linkedin.com/in/<slug>: obfuscated/utility class
 * names, a `<div id="...">` anchor at the top of each section, entries as `li`
 * elements, and every visible string duplicated in an `aria-hidden="true"`
 * span plus a `.visually-hidden` span for screen readers.
 */

/** The year after the current one, so "in progress" education stays in progress. */
export const FUTURE_YEAR = new Date().getFullYear() + 1;

/** Renders LinkedIn's duplicated visible/screen-reader text pair. */
export function dup(text: string, className = ''): string {
  return `<span aria-hidden="true"${className ? ` class="${className}"` : ''}>${text}</span><span class="visually-hidden">${text}</span>`;
}

function sectionHeading(text: string): string {
  return `<div class="pvs-header__container"><div class="pvs-header__top-container--no-stack"><div class="pvs-header__left-container--stack"><div class="pvs-header__title-container"><h2 class="pvs-header__title text-heading-large"><span aria-hidden="true">${text}</span><span class="visually-hidden">${text}</span></h2></div></div></div></div>`;
}

export const LINKEDIN_PROFILE_URL = 'https://www.linkedin.com/in/jane-doe-123/';
export const LINKEDIN_SKILLS_DETAILS_URL = 'https://www.linkedin.com/in/jane-doe-123/details/skills/';

export const LINKEDIN_FULL_PROFILE_HEAD = `<link rel="canonical" href="https://www.linkedin.com/in/jane-doe-123/">`;

export const LINKEDIN_FULL_PROFILE_BODY = `
<main class="scaffold-layout__main" aria-label="Main Content">
  <section class="artdeco-card pv-top-card">
    <div class="ph5 pb5">
      <div class="mt2 relative">
        <div class="display-flex">
          <div>
            <h1 class="text-heading-xlarge inline t-24 v-align-middle break-words">Jane Doe</h1>
            <span class="text-body-small v-align-middle break-words t-black--light">${dup('She/Her')}</span>
          </div>
        </div>
        <div class="text-body-medium break-words">Software Engineer at Acme Corp | Distributed systems &amp; developer tooling</div>
        <div class="mt2">
          <span class="text-body-small inline t-black--light break-words">San Francisco, California, United States</span>
          <span class="text-body-small">Contact info</span>
        </div>
        <ul class="pv-top-card--list-bullet">
          <li class="text-body-small"><span class="t-bold">500+ connections</span></li>
        </ul>
      </div>
    </div>
  </section>

  <section class="artdeco-card pv-profile-card break-words mt2">
    <div id="about" class="pv-profile-card__anchor"></div>
    ${sectionHeading('About')}
    <div class="display-flex ph5 pv3">
      <div class="display-flex full-width">
        <div class="inline-show-more-text inline-show-more-text--is-collapsed full-width">
          <span aria-hidden="true">Backend engineer with six years of experience building distributed systems and developer tooling. I care about reliability, mentorship, and shipping things people actually use.</span>
          <span class="visually-hidden">Backend engineer with six years of experience building distributed systems and developer tooling. I care about reliability, mentorship, and shipping things people actually use.</span>
          <button class="inline-show-more-text__button" aria-expanded="false">…see more</button>
        </div>
      </div>
    </div>
  </section>

  <section class="artdeco-card pv-profile-card break-words mt2">
    <div id="experience" class="pv-profile-card__anchor"></div>
    ${sectionHeading('Experience')}
    <div class="pvs-list__outer-container">
      <ul class="pvs-list">
        <li class="artdeco-list__item pvs-list__item--line-separated">
          <div class="display-flex flex-column full-width">
            <div class="display-flex flex-row justify-space-between">
              <a class="optional-action-target-wrapper display-flex flex-column full-width" href="https://www.linkedin.com/company/acme-corp/">
                <div class="display-flex align-items-center mr1 t-bold">${dup('Senior Software Engineer')}</div>
                <span class="t-14 t-normal">${dup('Acme Corp · Full-time')}</span>
                <span class="t-14 t-normal t-black--light">${dup('Jan 2023 - Present · 1 yr 8 mos', 'pvs-entity__caption-wrapper')}</span>
                <span class="t-14 t-normal t-black--light">${dup('San Francisco, CA · Hybrid')}</span>
              </a>
            </div>
            <div class="pvs-entity__sub-components">
              <ul>
                <li class="pvs-list__item--with-top-padding">
                  <div class="inline-show-more-text">
                    <span aria-hidden="true">Led the migration of the billing platform from a monolith to Go microservices on Kubernetes.
Mentored four junior engineers and ran the on-call rotation for the payments team.</span>
                    <span class="visually-hidden">Led the migration of the billing platform from a monolith to Go microservices on Kubernetes.
Mentored four junior engineers and ran the on-call rotation for the payments team.</span>
                  </div>
                </li>
                <li class="pvs-list__item--with-top-padding">
                  <div class="display-flex align-items-center t-14 t-normal t-black">
                    <strong>${dup('Skills: Go · Kubernetes · PostgreSQL')}</strong>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </li>

        <li class="artdeco-list__item pvs-list__item--line-separated">
          <div class="display-flex flex-column full-width">
            <div class="display-flex flex-row justify-space-between">
              <a class="optional-action-target-wrapper display-flex flex-column full-width" href="https://www.linkedin.com/company/globex/">
                <div class="display-flex align-items-center mr1 hoverable-link-text t-bold">${dup('Globex Corporation')}</div>
                <span class="t-14 t-normal">${dup('Full-time · 3 yrs 2 mos')}</span>
                <span class="t-14 t-normal t-black--light">${dup('Austin, Texas, United States')}</span>
              </a>
            </div>
            <div class="pvs-entity__sub-components">
              <ul>
                <li class="pvs-list__paged-list-item">
                  <div class="display-flex flex-column full-width">
                    <a class="optional-action-target-wrapper display-flex flex-column full-width" href="https://www.linkedin.com/company/globex/">
                      <div class="display-flex align-items-center mr1 hoverable-link-text t-bold">${dup('Software Engineer II')}</div>
                      <span class="t-14 t-normal t-black--light">${dup('Jul 2021 - Dec 2022 · 1 yr 6 mos', 'pvs-entity__caption-wrapper')}</span>
                      <span class="t-14 t-normal t-black--light">${dup('Austin, Texas, United States')}</span>
                    </a>
                    <div class="pvs-entity__sub-components">
                      <ul>
                        <li>
                          <div class="inline-show-more-text">
                            <span aria-hidden="true">Built the internal feature-flag service used by 40 teams.</span>
                            <span class="visually-hidden">Built the internal feature-flag service used by 40 teams.</span>
                          </div>
                        </li>
                        <li>
                          <div class="t-14 t-normal t-black"><strong>${dup('Skills: Python · Django · AWS')}</strong></div>
                        </li>
                      </ul>
                    </div>
                  </div>
                </li>
                <li class="pvs-list__paged-list-item">
                  <div class="display-flex flex-column full-width">
                    <a class="optional-action-target-wrapper display-flex flex-column full-width" href="https://www.linkedin.com/company/globex/">
                      <div class="display-flex align-items-center mr1 hoverable-link-text t-bold">${dup('Software Engineer Intern')}</div>
                      <span class="t-14 t-normal">${dup('Internship')}</span>
                      <span class="t-14 t-normal t-black--light">${dup('Jun 2019 - Aug 2019 · 3 mos', 'pvs-entity__caption-wrapper')}</span>
                    </a>
                    <div class="pvs-entity__sub-components">
                      <ul>
                        <li>
                          <div class="inline-show-more-text">
                            <span aria-hidden="true">Prototyped a log search tool in Python.</span>
                            <span class="visually-hidden">Prototyped a log search tool in Python.</span>
                          </div>
                        </li>
                      </ul>
                    </div>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </li>

        <li class="artdeco-list__item pvs-list__item--line-separated">
          <div class="display-flex flex-column full-width">
            <a class="optional-action-target-wrapper display-flex flex-column full-width" href="https://www.linkedin.com/company/initech/">
              <div class="display-flex align-items-center mr1 t-bold">${dup('Research Assistant')}</div>
              <span class="t-14 t-normal">${dup('State University · Part-time')}</span>
              <span class="t-14 t-normal t-black--light">${dup('2017 - 2019', 'pvs-entity__caption-wrapper')}</span>
            </a>
          </div>
        </li>
      </ul>
    </div>
  </section>

  <section class="artdeco-card pv-profile-card break-words mt2">
    <div id="education" class="pv-profile-card__anchor"></div>
    ${sectionHeading('Education')}
    <div class="pvs-list__outer-container">
      <ul class="pvs-list">
        <li class="artdeco-list__item">
          <a class="optional-action-target-wrapper display-flex flex-column full-width" href="https://www.linkedin.com/school/state-university/">
            <div class="display-flex align-items-center mr1 hoverable-link-text t-bold">${dup('State University')}</div>
            <span class="t-14 t-normal">${dup('Bachelor of Science - BS, Computer Science')}</span>
            <span class="t-14 t-normal t-black--light">${dup(`2023 - ${FUTURE_YEAR}`, 'pvs-entity__caption-wrapper')}</span>
          </a>
          <div class="pvs-entity__sub-components">
            <ul>
              <li><div class="t-14 t-normal t-black">${dup('Grade: 3.8')}</div></li>
              <li><div class="t-14 t-normal t-black">${dup('Activities and societies: ACM chapter, hackathon organizer')}</div></li>
            </ul>
          </div>
        </li>
        <li class="artdeco-list__item">
          <a class="optional-action-target-wrapper display-flex flex-column full-width" href="https://www.linkedin.com/school/old-tech/">
            <div class="display-flex align-items-center mr1 hoverable-link-text t-bold">${dup('Old Tech Institute')}</div>
            <span class="t-14 t-normal">${dup('Master of Science - MS, Data Science')}</span>
            <span class="t-14 t-normal t-black--light">${dup('Sep 2015 - May 2017', 'pvs-entity__caption-wrapper')}</span>
          </a>
        </li>
      </ul>
    </div>
  </section>

  <section class="artdeco-card pv-profile-card break-words mt2">
    <div id="licenses_and_certifications" class="pv-profile-card__anchor"></div>
    ${sectionHeading('Licenses &amp; certifications')}
    <div class="pvs-list__outer-container">
      <ul class="pvs-list">
        <li class="artdeco-list__item">
          <div class="display-flex flex-column full-width">
            <a class="optional-action-target-wrapper display-flex flex-column full-width" href="https://www.linkedin.com/company/amazon-web-services/">
              <div class="display-flex align-items-center mr1 t-bold">${dup('AWS Certified Solutions Architect – Associate')}</div>
              <span class="t-14 t-normal">${dup('Amazon Web Services (AWS)')}</span>
              <span class="t-14 t-normal t-black--light">${dup('Issued Mar 2024 · Expires Mar 2027', 'pvs-entity__caption-wrapper')}</span>
              <span class="t-14 t-normal t-black--light">${dup('Credential ID ABC-123-XYZ')}</span>
            </a>
            <div class="pvs-entity__sub-components">
              <ul>
                <li>
                  <a class="optional-action-target-wrapper artdeco-button artdeco-button--secondary" href="https://www.credly.com/badges/abc-123" target="_blank">
                    <span aria-hidden="true">Show credential</span><span class="visually-hidden">Show credential for AWS Certified Solutions Architect</span>
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </li>
        <li class="artdeco-list__item">
          <a class="optional-action-target-wrapper display-flex flex-column full-width" href="https://www.linkedin.com/company/cncf/">
            <div class="display-flex align-items-center mr1 t-bold">${dup('Certified Kubernetes Administrator (CKA)')}</div>
            <span class="t-14 t-normal">${dup('The Linux Foundation')}</span>
            <span class="t-14 t-normal t-black--light">${dup('Issued Jan 2023', 'pvs-entity__caption-wrapper')}</span>
          </a>
        </li>
      </ul>
    </div>
  </section>

  <section class="artdeco-card pv-profile-card break-words mt2">
    <div id="skills" class="pv-profile-card__anchor"></div>
    ${sectionHeading('Skills')}
    <div class="pvs-list__outer-container">
      <ul class="pvs-list">
        <li class="artdeco-list__item">
          <div class="display-flex flex-column full-width">
            <a class="optional-action-target-wrapper display-flex flex-column full-width" href="https://www.linkedin.com/in/jane-doe-123/details/skills/?skill=go">
              <div class="display-flex align-items-center mr1 hoverable-link-text t-bold">${dup('Go')}</div>
            </a>
            <div class="pvs-entity__sub-components">
              <ul>
                <li><div class="t-14 t-normal t-black">${dup('Senior Software Engineer at Acme Corp')}</div></li>
                <li><div class="t-14 t-normal t-black">${dup('12 endorsements')}</div></li>
              </ul>
            </div>
          </div>
        </li>
        <li class="artdeco-list__item">
          <a class="optional-action-target-wrapper display-flex flex-column full-width" href="#">
            <div class="display-flex align-items-center mr1 hoverable-link-text t-bold">${dup('Kubernetes')}</div>
          </a>
        </li>
        <li class="artdeco-list__item">
          <a class="optional-action-target-wrapper display-flex flex-column full-width" href="#">
            <div class="display-flex align-items-center mr1 hoverable-link-text t-bold">${dup('Distributed Systems')}</div>
          </a>
        </li>
        <li class="artdeco-list__item">
          <a class="optional-action-target-wrapper display-flex flex-column full-width" href="#">
            <div class="display-flex align-items-center mr1 hoverable-link-text t-bold">${dup('TypeScript')}</div>
          </a>
        </li>
        <li class="artdeco-list__item">
          <a class="optional-action-target-wrapper display-flex flex-column full-width" href="#">
            <div class="display-flex align-items-center mr1 hoverable-link-text t-bold">${dup('Mentoring')}</div>
          </a>
        </li>
      </ul>
    </div>
    <div class="pvs-list__footer-wrapper">
      <div class="pvs-list__footer-action">
        <a class="optional-action-target-wrapper artdeco-button artdeco-button--tertiary" id="navigation-index-see-all-skills" href="https://www.linkedin.com/in/jane-doe-123/details/skills/">
          <span class="pvs-navigation__text">Show all 24 skills</span>
        </a>
      </div>
    </div>
  </section>
</main>
`;

export const LINKEDIN_FULL_PROFILE_HTML = `<!DOCTYPE html><html><head>${LINKEDIN_FULL_PROFILE_HEAD}</head><body>${LINKEDIN_FULL_PROFILE_BODY}</body></html>`;

/** `/details/skills/`: the full list, plus the filter tabs LinkedIn renders as another list. */
export const LINKEDIN_SKILLS_DETAILS_HTML = `<!DOCTYPE html><html><head>
<link rel="canonical" href="https://www.linkedin.com/in/jane-doe-123/details/skills/">
</head><body>
<main class="scaffold-layout__main">
  <section class="artdeco-card">
    <div class="pvs-header__container">
      <button class="artdeco-button" aria-label="Back to the main profile page"><svg aria-hidden="true"></svg></button>
      <h1 class="text-heading-large">${dup('Skills')}</h1>
    </div>
    <div class="artdeco-tabs">
      <ul class="artdeco-tablist" role="tablist">
        <li class="artdeco-tab" role="tab"><button>${dup('All')}</button></li>
        <li class="artdeco-tab" role="tab"><button>${dup('Industry Knowledge')}</button></li>
        <li class="artdeco-tab" role="tab"><button>${dup('Tools &amp; Technologies')}</button></li>
      </ul>
    </div>
    <div class="pvs-list__container">
      <ul class="pvs-list">
        ${['Go', 'Kubernetes', 'Distributed Systems', 'TypeScript', 'Mentoring', 'PostgreSQL', 'gRPC', 'Terraform']
          .map(
            (skill) => `<li class="pvs-list__paged-list-item artdeco-list__item">
          <div class="display-flex flex-column full-width">
            <a class="optional-action-target-wrapper display-flex flex-column full-width" href="#">
              <div class="display-flex align-items-center mr1 hoverable-link-text t-bold">${dup(skill)}</div>
            </a>
            <div class="pvs-entity__sub-components">
              <ul><li><div class="t-14 t-normal t-black">${dup('3 endorsements')}</div></li></ul>
            </div>
          </div>
        </li>`
          )
          .join('\n')}
      </ul>
    </div>
  </section>
</main>
</body></html>`;

/** A brand-new profile: name only, no sections rendered. */
export const LINKEDIN_SPARSE_PROFILE_HTML = `<!DOCTYPE html><html><head></head><body>
<main class="scaffold-layout__main">
  <section class="artdeco-card pv-top-card">
    <div class="ph5 pb5">
      <h1 class="text-heading-xlarge">Sam Solo</h1>
    </div>
  </section>
</main>
</body></html>`;

/** Name + headline, no About section, so the headline becomes the summary. */
export const LINKEDIN_HEADLINE_ONLY_PROFILE_HTML = `<!DOCTYPE html><html><head></head><body>
<main class="scaffold-layout__main">
  <section class="artdeco-card pv-top-card">
    <div class="ph5 pb5">
      <h1 class="text-heading-xlarge">Sam Solo</h1>
      <div class="text-body-medium break-words">Aspiring data analyst</div>
      <span class="text-body-small inline t-black--light break-words">Denver, Colorado, United States</span>
    </div>
  </section>
</main>
</body></html>`;

/** Sections without anchor ids: only the headings identify them. */
export const LINKEDIN_HEADING_ONLY_PROFILE_HTML = `<!DOCTYPE html><html><head></head><body>
<main>
  <section><h1>Heading Only</h1></section>
  <section>
    <h2>Experience</h2>
    <ul>
      <li>
        <div class="t-bold">${dup('Product Manager')}</div>
        <span>${dup('Umbrella Corp · Contract')}</span>
        <span>${dup('Mar 2020 - Nov 2021 · 1 yr 9 mos')}</span>
        <span>${dup('Remote')}</span>
      </li>
    </ul>
  </section>
  <section>
    <h2>Education</h2>
    <ul>
      <li>
        <div class="t-bold">${dup('Community College of Denver')}</div>
        <span>${dup('Associate of Science - AS, Mathematics')}</span>
        <span>${dup('2016 - 2018')}</span>
      </li>
    </ul>
  </section>
</main>
</body></html>`;

/** LinkedIn's sign-in wall, where `/in/me/` lands when the user is signed out. */
export const LINKEDIN_AUTHWALL_URL = 'https://www.linkedin.com/authwall?trk=bf&trkInfo=AQE&original_referer=&sessionRedirect=https%3A%2F%2Fwww.linkedin.com%2Fin%2Fme%2F';
export const LINKEDIN_LOGIN_URL = 'https://www.linkedin.com/login?fromSignIn=true&trk=guest_homepage-basic_nav-header-signin';

export const LINKEDIN_AUTHWALL_HTML = `<!DOCTYPE html><html><head></head><body>
<main class="authwall">
  <h1 class="authwall-join-form__title">Sign in to view Jane's profile</h1>
  <form class="authwall-join-form" action="/checkpoint/lg/login-submit" method="post">
    <input name="session_key" type="email" placeholder="Email or phone" />
    <input name="session_password" type="password" placeholder="Password" />
    <button type="submit">Sign in</button>
  </form>
</main>
</body></html>`;
