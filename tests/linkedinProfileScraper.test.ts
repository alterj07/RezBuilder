import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createDomDocument } from './helpers/domUtils';
import { setupMockChrome } from './helpers/mockChrome';
import {
  isLinkedInProfileUrl,
  scrapeLinkedInProfile,
  inferDegreeLevel,
} from '../src/content/linkedinProfile/linkedinProfileScraper';
import {
  FUTURE_YEAR,
  LINKEDIN_PROFILE_URL,
  LINKEDIN_SKILLS_DETAILS_URL,
  LINKEDIN_FULL_PROFILE_HTML,
  LINKEDIN_FULL_PROFILE_HEAD,
  LINKEDIN_FULL_PROFILE_BODY,
  LINKEDIN_SKILLS_DETAILS_HTML,
  LINKEDIN_SPARSE_PROFILE_HTML,
  LINKEDIN_HEADLINE_ONLY_PROFILE_HTML,
  LINKEDIN_HEADING_ONLY_PROFILE_HTML,
  LINKEDIN_AUTHWALL_HTML,
  LINKEDIN_AUTHWALL_URL,
} from './fixtures/linkedinProfileFixtures';

function scrapeFull() {
  return scrapeLinkedInProfile(createDomDocument(LINKEDIN_FULL_PROFILE_HTML), LINKEDIN_PROFILE_URL);
}

describe('LinkedIn own-profile scraper', () => {
  describe('isLinkedInProfileUrl', () => {
    it.each([
      'https://www.linkedin.com/in/jane-doe-123/',
      'https://www.linkedin.com/in/jane-doe-123',
      'https://linkedin.com/in/me/',
      'https://www.linkedin.com/in/me',
      'https://www.linkedin.com/in/jane-doe-123/details/skills/',
      'https://www.linkedin.com/in/jane-doe-123/?originalSubdomain=uk',
      'https://uk.linkedin.com/in/jane-doe-123',
    ])('accepts profile url %s', (url) => {
      expect(isLinkedInProfileUrl(url)).toBe(true);
    });

    it.each([
      'https://www.linkedin.com/jobs/view/4123456789/',
      'https://www.linkedin.com/company/acme-corp/',
      'https://www.linkedin.com/feed/',
      'https://www.linkedin.com/in/',
      'https://www.linkedin.com/login',
      LINKEDIN_AUTHWALL_URL,
      'https://example.com/in/jane-doe',
      '',
    ])('rejects non-profile url %s', (url) => {
      expect(isLinkedInProfileUrl(url)).toBe(false);
    });
  });

  describe('top card and summary', () => {
    it('reads name, location and canonical profile url', () => {
      const result = scrapeFull();

      expect(result.source).toBe('linkedin_page');
      expect(result.contact?.name).toBe('Jane Doe');
      expect(result.contact?.location).toBe('San Francisco, California, United States');
      expect(result.contact?.linkedinUrl).toBe('https://www.linkedin.com/in/jane-doe-123/');
    });

    it('uses the About section as the summary, not the headline', () => {
      const result = scrapeFull();

      expect(result.story?.summary).toMatch(/^Backend engineer with six years/);
      expect(result.story?.summary).not.toContain('see more');
      expect(result.story?.summary).not.toContain('Software Engineer at Acme Corp');
    });

    it('falls back to the headline as the summary when there is no About section', () => {
      const result = scrapeLinkedInProfile(
        createDomDocument(LINKEDIN_HEADLINE_ONLY_PROFILE_HTML),
        'https://www.linkedin.com/in/sam-solo/'
      );

      expect(result.contact?.name).toBe('Sam Solo');
      expect(result.contact?.location).toBe('Denver, Colorado, United States');
      expect(result.story?.summary).toBe('Aspiring data analyst');
      expect(result.warnings).toContainEqual(expect.stringMatching(/About/));
    });

    it('derives the profile url from the page url when no canonical link exists', () => {
      const result = scrapeLinkedInProfile(
        createDomDocument(LINKEDIN_SPARSE_PROFILE_HTML),
        'https://www.linkedin.com/in/sam-solo/?trk=public_profile'
      );
      expect(result.contact?.linkedinUrl).toBe('https://www.linkedin.com/in/sam-solo/');
    });
  });

  describe('experience', () => {
    it('parses a flat entry with company, type, dates, location, bullets and skills', () => {
      const senior = scrapeFull().experiences?.find((e) => e.title === 'Senior Software Engineer');

      expect(senior).toBeTruthy();
      expect(senior?.company).toBe('Acme Corp');
      expect(senior?.type).toBe('full_time');
      expect(senior?.startDate).toBe('2023-01');
      expect(senior?.endDate).toBeUndefined();
      expect(senior?.isCurrent).toBe(true);
      expect(senior?.location).toBe('San Francisco, CA');
      expect(senior?.bullets).toEqual([
        'Led the migration of the billing platform from a monolith to Go microservices on Kubernetes.',
        'Mentored four junior engineers and ran the on-call rotation for the payments team.',
      ]);
      expect(senior?.skillsUsed).toEqual(['Go', 'Kubernetes', 'PostgreSQL']);
    });

    it('expands a grouped company entry into one experience per nested role', () => {
      const experiences = scrapeFull().experiences || [];
      const globex = experiences.filter((e) => e.company === 'Globex Corporation');

      expect(globex.map((e) => e.title)).toEqual(['Software Engineer II', 'Software Engineer Intern']);
      expect(globex[0]).toMatchObject({
        type: 'full_time',
        startDate: '2021-07',
        endDate: '2022-12',
        location: 'Austin, Texas, United States',
        bullets: ['Built the internal feature-flag service used by 40 teams.'],
        skillsUsed: ['Python', 'Django', 'AWS'],
      });
      expect(globex[0].isCurrent).toBeFalsy();
      expect(globex[1]).toMatchObject({
        type: 'internship',
        startDate: '2019-06',
        endDate: '2019-08',
        location: 'Austin, Texas, United States',
        bullets: ['Prototyped a log search tool in Python.'],
      });
      // The company header itself must not become an experience.
      expect(experiences.find((e) => e.title === 'Globex Corporation')).toBeUndefined();
    });

    it('parses year-only date ranges', () => {
      const research = scrapeFull().experiences?.find((e) => e.title === 'Research Assistant');

      expect(research).toMatchObject({
        company: 'State University',
        type: 'part_time',
        startDate: '2017',
        endDate: '2019',
      });
    });

    it('reads each visible string once despite the duplicated screen-reader spans', () => {
      const result = scrapeFull();
      expect(result.experiences).toHaveLength(4);
      for (const experience of result.experiences || []) {
        const unique = new Set(experience.bullets);
        expect(unique.size).toBe(experience.bullets.length);
        expect(experience.title).not.toMatch(/^(.+)\1$/);
      }
    });
  });

  describe('education', () => {
    it('marks a future graduation year as in progress with degree, field and gpa', () => {
      const state = scrapeFull().education?.find((e) => e.institution === 'State University');

      expect(state).toMatchObject({
        degreeLevel: 'bachelor',
        degree: 'Bachelor of Science - BS',
        fieldOfStudy: 'Computer Science',
        status: 'in_progress',
        graduationYear: FUTURE_YEAR,
        gpa: '3.8',
      });
    });

    it('marks a past end date as graduated with the graduation month', () => {
      const old = scrapeFull().education?.find((e) => e.institution === 'Old Tech Institute');

      expect(old).toMatchObject({
        degreeLevel: 'master',
        degree: 'Master of Science - MS',
        fieldOfStudy: 'Data Science',
        status: 'graduated',
        graduationYear: 2017,
        graduationMonth: 5,
      });
    });

    it.each([
      ['Doctor of Philosophy - PhD, Physics', 'phd'],
      ['Ph.D. Computer Science', 'phd'],
      ['Master of Business Administration - MBA', 'master'],
      ['MEng, Electrical Engineering', 'master'],
      ['M.S. in Statistics', 'master'],
      ['Bachelor of Arts - BA, Economics', 'bachelor'],
      ['B.Tech, Computer Science', 'bachelor'],
      ['BSc Mathematics', 'bachelor'],
      ['Associate of Applied Science - AAS', 'associate'],
      ['Full-Stack Web Development Bootcamp', 'bootcamp'],
      ['High School Diploma', 'high_school'],
      ['Certificate, Project Management', 'other'],
      ['', 'other'],
    ])('infers degree level for %s as %s', (text, level) => {
      expect(inferDegreeLevel(text)).toBe(level);
    });
  });

  describe('skills and certifications', () => {
    it('collects the visible skills and warns that the list is truncated', () => {
      const result = scrapeFull();
      const names = (result.skills || []).map((s) => s.name);

      expect(names.slice(0, 5)).toEqual(['Go', 'Kubernetes', 'Distributed Systems', 'TypeScript', 'Mentoring']);
      expect(names).not.toContain('12 endorsements');
      expect(names).not.toContain('Show all 24 skills');
      expect(result.warnings).toContain('Only 5 skills visible; open /details/skills/ for the full list');
    });

    it('merges skills listed under experiences without duplicates', () => {
      const names = (scrapeFull().skills || []).map((s) => s.name);

      expect(names.filter((n) => n === 'Go')).toHaveLength(1);
      expect(names).toEqual(expect.arrayContaining(['PostgreSQL', 'Python', 'Django', 'AWS']));
    });

    it('parses certifications with issuer, years and credential url', () => {
      const certs = scrapeFull().certifications || [];

      expect(certs).toHaveLength(2);
      expect(certs[0]).toMatchObject({
        name: 'AWS Certified Solutions Architect – Associate',
        issuer: 'Amazon Web Services (AWS)',
        issuedYear: 2024,
        expiresYear: 2027,
        credentialUrl: 'https://www.credly.com/badges/abc-123',
      });
      expect(certs[1]).toMatchObject({
        name: 'Certified Kubernetes Administrator (CKA)',
        issuer: 'The Linux Foundation',
        issuedYear: 2023,
      });
      expect(certs[1].expiresYear).toBeUndefined();
      expect(certs[1].credentialUrl).toBeUndefined();
    });

    it('reads the full skill list from the /details/skills/ page', () => {
      const result = scrapeLinkedInProfile(createDomDocument(LINKEDIN_SKILLS_DETAILS_HTML), LINKEDIN_SKILLS_DETAILS_URL);
      const names = (result.skills || []).map((s) => s.name);

      expect(names).toEqual(['Go', 'Kubernetes', 'Distributed Systems', 'TypeScript', 'Mentoring', 'PostgreSQL', 'gRPC', 'Terraform']);
      expect(names).not.toContain('All');
      expect(result.contact?.name).toBeUndefined();
      expect(result.warnings).not.toContainEqual(expect.stringMatching(/No Experience section/));
    });
  });

  describe('robustness', () => {
    it('returns the name plus warnings for a sparse profile', () => {
      const result = scrapeLinkedInProfile(createDomDocument(LINKEDIN_SPARSE_PROFILE_HTML), 'https://www.linkedin.com/in/sam-solo/');

      expect(result.contact?.name).toBe('Sam Solo');
      expect(result.experiences).toBeUndefined();
      expect(result.education).toBeUndefined();
      expect(result.skills).toBeUndefined();
      expect(result.warnings).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/Experience/),
          expect.stringMatching(/Education/),
          expect.stringMatching(/Skills/),
          expect.stringMatching(/certifications/i),
        ])
      );
    });

    it('locates sections by heading text when anchor ids are missing', () => {
      const result = scrapeLinkedInProfile(createDomDocument(LINKEDIN_HEADING_ONLY_PROFILE_HTML), 'https://www.linkedin.com/in/heading-only/');

      expect(result.experiences).toEqual([
        expect.objectContaining({
          title: 'Product Manager',
          company: 'Umbrella Corp',
          type: 'contract',
          startDate: '2020-03',
          endDate: '2021-11',
          location: 'Remote',
        }),
      ]);
      expect(result.education?.[0]).toMatchObject({
        institution: 'Community College of Denver',
        degreeLevel: 'associate',
        fieldOfStudy: 'Mathematics',
        status: 'graduated',
        graduationYear: 2018,
      });
    });

    it('never throws on an unrelated or empty document', () => {
      expect(() => scrapeLinkedInProfile(createDomDocument(''), LINKEDIN_PROFILE_URL)).not.toThrow();
      expect(() => scrapeLinkedInProfile(createDomDocument(LINKEDIN_AUTHWALL_HTML), LINKEDIN_AUTHWALL_URL)).not.toThrow();
      expect(() => scrapeLinkedInProfile(null as unknown as Document, LINKEDIN_PROFILE_URL)).not.toThrow();

      const empty = scrapeLinkedInProfile(createDomDocument(''), LINKEDIN_PROFILE_URL);
      expect(empty.source).toBe('linkedin_page');
      expect(empty.experiences).toBeUndefined();
      expect(empty.warnings?.length).toBeGreaterThan(0);
    });
  });
});

describe('Content script SCRAPE_LINKEDIN_PROFILE contract', () => {
  function setUrl(url: string) {
    (window as any).happyDOM.setURL(url);
  }

  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    setupMockChrome();
    document.head.innerHTML = '';
    document.body.innerHTML = '';
  });

  it('does not treat the profile page as a job posting', async () => {
    setUrl(LINKEDIN_PROFILE_URL);
    document.head.innerHTML = LINKEDIN_FULL_PROFILE_HEAD;
    document.body.innerHTML = LINKEDIN_FULL_PROFILE_BODY;

    const content = await import('../src/content/index');

    expect(content.parseCurrentPage()).toBeNull();
  });

  it('responds with the scraped profile on a profile page', async () => {
    setUrl(LINKEDIN_PROFILE_URL);
    document.head.innerHTML = LINKEDIN_FULL_PROFILE_HEAD;
    document.body.innerHTML = LINKEDIN_FULL_PROFILE_BODY;
    await import('../src/content/index');

    const response = await chrome.tabs.sendMessage(1, { type: 'SCRAPE_LINKEDIN_PROFILE' });

    expect(response.success).toBe(true);
    expect(response.profile.source).toBe('linkedin_page');
    expect(response.profile.contact.name).toBe('Jane Doe');
    expect(response.profile.experiences.length).toBe(4);
  });

  it('refuses to scrape when the tab is not on a profile url', async () => {
    setUrl(LINKEDIN_AUTHWALL_URL);
    document.body.innerHTML = LINKEDIN_AUTHWALL_HTML;
    await import('../src/content/index');

    const response = await chrome.tabs.sendMessage(1, { type: 'SCRAPE_LINKEDIN_PROFILE' });

    expect(response.success).toBe(false);
    expect(response.error).toMatch(/not a LinkedIn profile page/i);
    expect(response.profile).toBeUndefined();
  });

  it('reports not-ready while the profile has not rendered', async () => {
    setUrl(LINKEDIN_PROFILE_URL);
    document.body.innerHTML = '<main><div class="loader"></div></main>';
    await import('../src/content/index');

    const response = await chrome.tabs.sendMessage(1, { type: 'SCRAPE_LINKEDIN_PROFILE' });

    expect(response.success).toBe(false);
    expect(response.error).toMatch(/not finished rendering/i);
  });
});
