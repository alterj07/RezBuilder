import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createDomDocument } from './helpers/domUtils';
import { setupMockChrome, SetupMockChromeResult } from './helpers/mockChrome';
import {
  detectLinkedInPageKind,
  isLinkedInProfileUrl,
  scrapeLinkedInPage,
  scrapeLinkedInProfile,
} from '../src/content/linkedinProfile/linkedinProfileScraper';
import {
  isDurationOnlyLine,
  isNoiseLine,
  parseAboutLines,
  parseCertificationLines,
  parseCompanyLine,
  parseCredentialId,
  parseDateRange,
  parseEducationLines,
  parseExperienceLines,
  parseProjectLines,
  parseSkillsLine,
  parseSkillsLines,
  parseTopCardLines,
  parseVolunteeringLines,
  trimSectionLines,
} from '../src/content/linkedinProfile/lineParser';
import { elementLines } from '../src/content/linkedinProfile/domLines';
import { settleLinkedInPage } from '../src/content/linkedinProfile/settle';
import {
  FUTURE_YEAR,
  LEGACY_FULL_PROFILE_HTML,
  LEGACY_PROFILE_URL,
  LEGACY_SPARSE_PROFILE_HTML,
  LINKEDIN_AUTHWALL_BODY,
  LINKEDIN_AUTHWALL_HTML,
  LINKEDIN_AUTHWALL_URL,
  LINKEDIN_CERTIFICATIONS_DETAILS_BODY,
  LINKEDIN_CERTIFICATIONS_DETAILS_HTML,
  LINKEDIN_CERTIFICATIONS_DETAILS_URL,
  LINKEDIN_EDUCATION_DETAILS_BODY,
  LINKEDIN_EDUCATION_DETAILS_HTML,
  LINKEDIN_EDUCATION_DETAILS_URL,
  LINKEDIN_EXPERIENCE_DETAILS_BODY,
  LINKEDIN_EXPERIENCE_DETAILS_HTML,
  LINKEDIN_EXPERIENCE_DETAILS_URL,
  LINKEDIN_EXPERIENCE_SKELETON_BODY,
  LINKEDIN_EXPERIENCE_SKELETON_HTML,
  LINKEDIN_GROUPED_EXPERIENCE_DETAILS_HTML,
  LINKEDIN_LANGUAGES_DETAILS_URL,
  LINKEDIN_LOGIN_URL,
  LINKEDIN_MAIN_RENDERED_BODY,
  LINKEDIN_MAIN_RENDERED_HTML,
  LINKEDIN_MAIN_SKELETON_BODY,
  LINKEDIN_MAIN_SKELETON_HTML,
  LINKEDIN_ME_URL,
  LINKEDIN_NOT_FOUND_BODY,
  LINKEDIN_NOT_FOUND_HTML,
  LINKEDIN_PROFILE_URL,
  LINKEDIN_PROJECTS_DETAILS_BODY,
  LINKEDIN_PROJECTS_DETAILS_HTML,
  LINKEDIN_PROJECTS_DETAILS_URL,
  LINKEDIN_SELF_PROFILE_URL,
  LINKEDIN_SKILLS_DETAILS_BODY,
  LINKEDIN_SKILLS_DETAILS_HTML,
  LINKEDIN_SKILLS_DETAILS_URL,
  LINKEDIN_SKILLS_SKELETON_BODY,
  LINKEDIN_SKILLS_SKELETON_HTML,
  LINKEDIN_VOLUNTEERING_DETAILS_BODY,
  LINKEDIN_VOLUNTEERING_DETAILS_HTML,
  LINKEDIN_VOLUNTEERING_DETAILS_URL,
} from './fixtures/linkedinProfileFixtures';

/** The exact experience lines observed on the live /details/experience/ page. */
const EXPERIENCE_LINES = [
  'Experience',
  'Software Engineer Intern',
  'Date Maroon · Internship',
  'Jul 2026 - Present · 3 mos',
  'Remote',
  'Conducted structured user acceptance testing (UAT) across the product.',
  'Identified usability issues before release.',
  'Applied critical analysis to product requirements.',
  'Software Development, Product Testing and +1 skill',
  'Student Intern',
  'SILVIA Health · Internship',
  'Jun 2025 - Aug 2025 · 3 mos',
  'Remote',
  'Performed UI/UX testing on the companion app.',
  'Translation, User Interface Design and +3 skills',
  'NASA HAS Scholar',
  'NASA - National Aeronautics and Space Administration · Internship',
  'Oct 2024 - Jul 2025 · 10 mos',
  'Remote',
  "Selected for NASA's High School Aerospace Scholars program.",
  'Completed program modules on orbital mechanics.',
  'Engineered a lunar habitat concept with a five-person team.',
  'Computer-Aided Design (CAD), Project Management and +3 skills',
];

const FOOTER_LINES = ['About', 'Accessibility', 'Talent Solutions', 'Professional Community Policies', 'Careers'];

describe('LinkedIn line parser', () => {
  describe('parseDateRange', () => {
    it.each([
      ['Jul 2026 - Present · 3 mos', { start: '2026-07', end: undefined, isCurrent: true, durationText: '3 mos' }],
      ['Jun 2025 - Aug 2025 · 3 mos', { start: '2025-06', end: '2025-08', isCurrent: false, durationText: '3 mos' }],
      ['2026 – May 2030', { start: '2026', end: '2030-05', isCurrent: false, durationText: undefined }],
      ['Jun 2026 – Present', { start: '2026-06', end: undefined, isCurrent: true, durationText: undefined }],
      ['Oct 2024 - Jul 2025 · 10 mos', { start: '2024-10', end: '2025-07', isCurrent: false, durationText: '10 mos' }],
      ['Issued Jun 2026', { start: '2026-06', end: undefined, isCurrent: false, durationText: undefined }],
      ['Issued Jun 2026 · Expires Jun 2028', { start: '2026-06', end: '2028-06', isCurrent: false, durationText: undefined }],
      ['Expires Jun 2028', { start: undefined, end: '2028-06', isCurrent: false, durationText: undefined }],
      ['Jan 2023 — Now · 1 yr 8 mos', { start: '2023-01', end: undefined, isCurrent: true, durationText: '1 yr 8 mos' }],
      ['2017 - 2019', { start: '2017', end: '2019', isCurrent: false, durationText: undefined }],
      ['May 2019', { start: '2019-05', end: '2019-05', isCurrent: false, durationText: undefined }],
    ])('parses %s', (line, expected) => {
      expect(parseDateRange(line)).toEqual(expected);
    });

    it.each(['Full-time · 2 yrs 3 mos', 'Date Maroon · Internship', 'Remote', 'Round Rock, Texas, United States', '', 'Software Engineer Intern'])(
      'rejects non-date line %s',
      (line) => {
        expect(parseDateRange(line)).toBeNull();
      }
    );
  });

  it('recognises duration-only and company lines', () => {
    expect(isDurationOnlyLine('Full-time · 2 yrs 3 mos')).toBe(true);
    expect(isDurationOnlyLine('3 yrs 2 mos')).toBe(true);
    expect(isDurationOnlyLine('Jul 2026 - Present · 3 mos')).toBe(false);
    expect(isDurationOnlyLine('Date Maroon · Internship')).toBe(false);

    expect(parseCompanyLine('NASA - National Aeronautics and Space Administration · Internship')).toEqual({
      company: 'NASA - National Aeronautics and Space Administration',
      employmentType: 'Internship',
      experienceType: 'internship',
    });
    expect(parseCompanyLine('Acme Corp · Full-time')).toMatchObject({ company: 'Acme Corp', experienceType: 'full_time' });
    expect(parseCompanyLine('State University · Part-time')).toMatchObject({ experienceType: 'part_time' });
    expect(parseCompanyLine('Studio · Self-employed')).toMatchObject({ experienceType: 'freelance' });
    expect(parseCompanyLine('AUSTIN KOREAN PRESBYTERIAN CHURCH')).toEqual({ company: 'AUSTIN KOREAN PRESBYTERIAN CHURCH' });
  });

  it('parses every skills line format and returns only the named skills', () => {
    expect(parseSkillsLine('Software Development, Product Testing and +1 skill')).toEqual(['Software Development', 'Product Testing']);
    expect(parseSkillsLine('Computer-Aided Design (CAD), Project Management and +3 skills')).toEqual([
      'Computer-Aided Design (CAD)',
      'Project Management',
    ]);
    expect(parseSkillsLine('Skills: Anthropic Claude, Claude Skills')).toEqual(['Anthropic Claude', 'Claude Skills']);
    expect(parseSkillsLine('Skills: Model Context Protocol (MCP)')).toEqual(['Model Context Protocol (MCP)']);
    expect(parseSkillsLine('Skills: Go · Kubernetes · PostgreSQL')).toEqual(['Go', 'Kubernetes', 'PostgreSQL']);
    expect(parseSkillsLine('React.js and Next.js')).toEqual(['React.js', 'Next.js']);
    expect(parseSkillsLine('Led the team and shipped the feature.')).toBeNull();
    expect(parseSkillsLine('Remote')).toBeNull();
  });

  it('identifies noise lines and credential ids', () => {
    for (const line of ['… more', '…more', 'See more', 'Show credential', 'Show all 50 skills', 'Credential ID 2dkmzqtqkr3i', '·', 'Contact info']) {
      expect(isNoiseLine(line), line).toBe(true);
    }
    expect(isNoiseLine('Software Engineer Intern')).toBe(false);
    expect(parseCredentialId('Credential ID 2dkmzqtqkr3i')).toBe('2dkmzqtqkr3i');
    expect(parseCredentialId('Anthropic')).toBeNull();
  });

  it('cuts sections at the footer and at sidebar cards without confusing the About heading', () => {
    expect(trimSectionLines(['Experience', 'Title', 'Company · Internship', ...FOOTER_LINES])).toEqual(['Experience', 'Title', 'Company · Internship']);
    expect(trimSectionLines(['Skills', 'Git', 'Who your viewers also viewed', 'Alex Rivera'])).toEqual(['Skills', 'Git']);
    expect(trimSectionLines(['About', 'I build things.', 'Top skills', 'Git • Java'])).toEqual(['About', 'I build things.', 'Top skills', 'Git • Java']);
  });

  describe('parseExperienceLines', () => {
    it('segments the live experience lines into three entries', () => {
      const experiences = parseExperienceLines(EXPERIENCE_LINES);

      expect(experiences).toHaveLength(3);
      expect(experiences[0]).toMatchObject({
        title: 'Software Engineer Intern',
        company: 'Date Maroon',
        type: 'internship',
        startDate: '2026-07',
        isCurrent: true,
        location: 'Remote',
        skillsUsed: ['Software Development', 'Product Testing'],
      });
      expect(experiences[0].endDate).toBeUndefined();
      expect(experiences[0].bullets).toHaveLength(3);
      expect(experiences[1]).toMatchObject({
        title: 'Student Intern',
        company: 'SILVIA Health',
        startDate: '2025-06',
        endDate: '2025-08',
        bullets: ['Performed UI/UX testing on the companion app.'],
        skillsUsed: ['Translation', 'User Interface Design'],
      });
      expect(experiences[2]).toMatchObject({
        title: 'NASA HAS Scholar',
        company: 'NASA - National Aeronautics and Space Administration',
        type: 'internship',
        startDate: '2024-10',
        endDate: '2025-07',
        isCurrent: false,
        location: 'Remote',
      });
      expect(experiences[2].bullets).toHaveLength(3);
      expect(experiences[2].skillsUsed).toContain('Computer-Aided Design (CAD)');
    });

    it('carries a grouped company header onto its roles and resets on the next flat entry', () => {
      const experiences = parseExperienceLines([
        'Experience',
        'Globex Corporation',
        'Full-time · 3 yrs 2 mos',
        'Austin, Texas, United States',
        'Software Engineer II',
        'Jul 2021 - Dec 2022 · 1 yr 6 mos',
        'Austin, Texas, United States',
        'Built the internal feature-flag service used by 40 teams.',
        'Python, Django and +1 skill',
        'Software Engineer Intern',
        'Internship',
        'Jun 2019 - Aug 2019 · 3 mos',
        'Prototyped a log search tool in Python.',
        'Research Assistant',
        'State University · Part-time',
        '2017 - 2019',
      ]);

      expect(experiences.map((e) => e.title)).toEqual(['Software Engineer II', 'Software Engineer Intern', 'Research Assistant']);
      expect(experiences[0]).toMatchObject({
        company: 'Globex Corporation',
        type: 'full_time',
        startDate: '2021-07',
        endDate: '2022-12',
        location: 'Austin, Texas, United States',
        bullets: ['Built the internal feature-flag service used by 40 teams.'],
        skillsUsed: ['Python', 'Django'],
      });
      expect(experiences[1]).toMatchObject({
        company: 'Globex Corporation',
        type: 'internship',
        startDate: '2019-06',
        endDate: '2019-08',
        bullets: ['Prototyped a log search tool in Python.'],
      });
      expect(experiences[2]).toMatchObject({ company: 'State University', type: 'part_time', startDate: '2017', endDate: '2019' });
      expect(experiences.find((e) => e.title === 'Globex Corporation')).toBeUndefined();
    });

    it('ignores the footer, sidebar cards and chrome lines', () => {
      const experiences = parseExperienceLines([
        ...EXPERIENCE_LINES.slice(0, 9),
        '… more',
        'Show all 3 experiences',
        'Profile language',
        'English',
        'Who your viewers also viewed',
        'Alex Rivera',
        'Software Engineer at Startup Inc',
        ...FOOTER_LINES,
      ]);

      expect(experiences).toHaveLength(1);
      expect(experiences[0].title).toBe('Software Engineer Intern');
      expect(experiences[0].bullets).toHaveLength(3);
    });

    it('still builds an entry from title + company line when no date is present, and never throws on garbage', () => {
      expect(parseExperienceLines(['Experience', 'Barista', 'Corner Cafe · Part-time'])).toEqual([
        expect.objectContaining({ title: 'Barista', company: 'Corner Cafe', type: 'part_time', bullets: [] }),
      ]);
      expect(parseExperienceLines([])).toEqual([]);
      expect(parseExperienceLines(['·', '… more', 'Jul 2026 - Present'])).toEqual([]);
      expect(() => parseExperienceLines(null as unknown as string[])).not.toThrow();
      expect(() => parseExperienceLines([undefined as unknown as string, 42 as unknown as string])).not.toThrow();
    });
  });

  it('parses education lines with degree/field split, grade and graduation status', () => {
    const education = parseEducationLines([
      'Education',
      'Texas A&M University',
      'Bachelor of Engineering, ENGINEERING',
      '2026 – May 2030',
      'Grade: 3.9',
      'Activities and societies: Engineering Honors',
      'Old Tech Institute',
      'Master of Science - MS, Data Science',
      'Sep 2015 - May 2017',
    ]);

    expect(education).toHaveLength(2);
    expect(education[0]).toEqual({
      institution: 'Texas A&M University',
      degreeLevel: 'bachelor',
      degree: 'Bachelor of Engineering',
      fieldOfStudy: 'ENGINEERING',
      status: 'in_progress',
      graduationYear: 2030,
      graduationMonth: 5,
      gpa: '3.9',
    });
    expect(education[1]).toMatchObject({
      institution: 'Old Tech Institute',
      degreeLevel: 'master',
      degree: 'Master of Science - MS',
      fieldOfStudy: 'Data Science',
      status: 'graduated',
      graduationYear: 2017,
      graduationMonth: 5,
    });
    expect(education[1].gpa).toBeUndefined();
  });

  it('parses certification lines with issuer, years and Skills: lines', () => {
    const parsed = parseCertificationLines([
      'Licenses & certifications',
      'Introduction to Model Context Protocol',
      'Anthropic',
      'Issued Jun 2026',
      'Credential ID 2dkmzqtqkr3i',
      'Show credential',
      'Skills: Model Context Protocol (MCP)',
      'Certificate of Completion: AI Fluency Framework & Foundations',
      'Anthropic',
      'Issued Jun 2026',
      'Credential ID bad7sx27ajet',
      'Show credential',
      'Skills: Anthropic Claude, Claude Skills',
      'AWS Certified Cloud Practitioner',
      'Amazon Web Services (AWS)',
      'Issued Jan 2025 · Expires Jan 2028',
      ...FOOTER_LINES,
    ]);

    expect(parsed.certifications).toEqual([
      { name: 'Introduction to Model Context Protocol', issuer: 'Anthropic', issuedYear: 2026 },
      { name: 'Certificate of Completion: AI Fluency Framework & Foundations', issuer: 'Anthropic', issuedYear: 2026 },
      { name: 'AWS Certified Cloud Practitioner', issuer: 'Amazon Web Services (AWS)', issuedYear: 2025, expiresYear: 2028 },
    ]);
    expect(parsed.skills).toEqual(['Model Context Protocol (MCP)', 'Anthropic Claude', 'Claude Skills']);
  });

  it('parses project lines into project experiences', () => {
    const projects = parseProjectLines([
      'Projects',
      'Savor',
      'Jun 2026 – Present',
      'Savor turns a photo of any restaurant menu into a personalised ordering guide.',
      'Menu photos run through an OCR + LLM inference pipeline: Google Cloud Vision extracts the text.',
      '… more',
      'Google Cloud Vision, Mobile Application Development and +7 skills',
      'Portfolio',
      'May 2025 – Present',
      'This minimalistic website showcases my projects and experience.',
      'React.js, Next.js and +3 skills',
    ]);

    expect(projects).toHaveLength(2);
    expect(projects[0]).toMatchObject({
      title: 'Savor',
      company: 'Personal project',
      type: 'project',
      startDate: '2026-06',
      isCurrent: true,
      skillsUsed: ['Google Cloud Vision', 'Mobile Application Development'],
    });
    expect(projects[0].bullets).toHaveLength(2);
    expect(projects[1]).toMatchObject({ title: 'Portfolio', type: 'project', startDate: '2025-05', skillsUsed: ['React.js', 'Next.js'] });
  });

  it('parses volunteering lines into volunteer experiences and drops the cause line', () => {
    const volunteering = parseVolunteeringLines([
      'Volunteering',
      'Care Team Leader',
      'AUSTIN KOREAN PRESBYTERIAN CHURCH',
      'Jun 2022 - May 2026 · 4 yrs',
      'Social Services',
      'Led a youth group of 100+ students, organising weekly programs.',
      '… more',
    ]);

    expect(volunteering).toEqual([
      {
        title: 'Care Team Leader',
        company: 'AUSTIN KOREAN PRESBYTERIAN CHURCH',
        type: 'volunteer',
        startDate: '2022-06',
        endDate: '2026-05',
        isCurrent: false,
        bullets: ['Led a youth group of 100+ students, organising weekly programs.'],
      },
    ]);
  });

  it('parses the skills page, skipping pills and context lines', () => {
    const lines = [
      'Skills',
      'All',
      'Industry Knowledge',
      'Tools & Technologies',
      'Interpersonal Skills',
      'Languages',
      'Other Skills',
      'Software Development',
      'Software Engineer Intern at Maroon',
      'Communication',
      'Software Engineer Intern at Maroon',
      '3 endorsements',
      'Model Context Protocol (MCP)',
      'Introduction to Model Context Protocol',
      'Python (Programming Language)',
      'Passed LinkedIn Skill Assessment',
      'Machine Learning',
      'PostgreSQL',
      ...FOOTER_LINES,
    ];

    expect(parseSkillsLines(lines, ['introduction to model context protocol'])).toEqual([
      'Software Development',
      'Communication',
      'Model Context Protocol (MCP)',
      'Python (Programming Language)',
      'Machine Learning',
      'PostgreSQL',
    ]);
    expect(parseSkillsLines(lines)).toContain('Introduction to Model Context Protocol');
  });

  it('parses the top card and About lines', () => {
    expect(
      parseTopCardLines([
        'Jayden Chun',
        'Computer Engineering + Engineering Honors Student @ TAMU',
        'Round Rock, Texas, United States',
        '·',
        'Contact info',
        'Date Maroon',
        'Texas A&M University',
        '206 connections',
        'Open to',
        'Add section',
      ])
    ).toEqual({
      name: 'Jayden Chun',
      headline: 'Computer Engineering + Engineering Honors Student @ TAMU',
      location: 'Round Rock, Texas, United States',
    });
    expect(parseTopCardLines(['Experience', 'Software Engineer Intern'])).toEqual({});

    expect(parseAboutLines(['About', 'I build tools.', 'Currently interning.', 'Top skills', 'Git • Java • Machine Learning'])).toEqual({
      summary: 'I build tools.\nCurrently interning.',
      topSkills: ['Git', 'Java', 'Machine Learning'],
    });
  });
});

describe('LinkedIn page kind detection', () => {
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
    LINKEDIN_LOGIN_URL,
    'https://example.com/in/jane-doe',
    '',
  ])('rejects non-profile url %s', (url) => {
    expect(isLinkedInProfileUrl(url)).toBe(false);
  });

  it.each([
    [LINKEDIN_PROFILE_URL, 'profile'],
    [LINKEDIN_SELF_PROFILE_URL, 'profile'],
    [LINKEDIN_ME_URL, 'profile'],
    [LINKEDIN_EXPERIENCE_DETAILS_URL, 'experience'],
    [LINKEDIN_EDUCATION_DETAILS_URL, 'education'],
    [LINKEDIN_CERTIFICATIONS_DETAILS_URL, 'certifications'],
    [LINKEDIN_PROJECTS_DETAILS_URL, 'projects'],
    [LINKEDIN_VOLUNTEERING_DETAILS_URL, 'volunteering'],
    [LINKEDIN_SKILLS_DETAILS_URL + '?skill=go', 'skills'],
    [LINKEDIN_LANGUAGES_DETAILS_URL, 'languages'],
    ['https://www.linkedin.com/in/jayden-chun/details/about/', 'unknown'],
    ['https://www.linkedin.com/feed/', 'unknown'],
    [LINKEDIN_AUTHWALL_URL, 'unknown'],
  ])('classifies %s as %s', (url, kind) => {
    expect(detectLinkedInPageKind(url)).toBe(kind);
  });
});

describe('scrapeLinkedInPage', () => {
  it('reads the top card from a skeleton-only main page and warns about every unrendered section', () => {
    const result = scrapeLinkedInPage(createDomDocument(LINKEDIN_MAIN_SKELETON_HTML), LINKEDIN_SELF_PROFILE_URL);

    expect(result.page).toBe('profile');
    expect(result.rendered).toEqual(['topCard']);
    expect(result.profile.source).toBe('linkedin_page');
    expect(result.profile.contact).toEqual({
      linkedinUrl: LINKEDIN_PROFILE_URL,
      name: 'Jayden Chun',
      location: 'Round Rock, Texas, United States',
    });
    expect(result.profile.story?.summary).toBe('Computer Engineering + Engineering Honors Student @ TAMU');
    expect(result.profile.experiences).toBeUndefined();
    expect(result.profile.warnings).toEqual(
      expect.arrayContaining([
        'Experience section has not loaded on the main page',
        'Education section has not loaded on the main page',
        'Skills section has not loaded on the main page',
        expect.stringMatching(/certifications section has not loaded/),
      ])
    );
  });

  it('parses the rendered cards on the main page', () => {
    const { profile, rendered } = scrapeLinkedInPage(createDomDocument(LINKEDIN_MAIN_RENDERED_HTML), LINKEDIN_PROFILE_URL);

    expect(rendered).toEqual(['topCard', 'about', 'experience', 'education', 'skills']);
    expect(profile.contact?.name).toBe('Jayden Chun');
    expect(profile.story?.summary).toMatch(/^Computer Engineering student at Texas A&M/);
    expect(profile.story?.summary).not.toContain('more');
    expect(profile.experiences?.map((e) => e.title)).toEqual(['Software Engineer Intern', 'Student Intern']);
    expect(profile.experiences?.[0]).toMatchObject({ company: 'Date Maroon', type: 'internship', startDate: '2026-07', isCurrent: true });
    expect(profile.education?.[0]).toMatchObject({ institution: 'Texas A&M University', graduationYear: 2030, gpa: '3.9' });
    expect(profile.warnings).toContain('Projects section has not loaded on the main page');
  });

  it('merges top skills, entry skills and card skills into one rated list', () => {
    const { profile } = scrapeLinkedInPage(createDomDocument(LINKEDIN_MAIN_RENDERED_HTML), LINKEDIN_PROFILE_URL);
    const names = (profile.skills || []).map((s) => s.name);

    expect(names).toEqual(expect.arrayContaining(['Git', 'Java', 'Machine Learning', 'Software Development', 'Product Testing', 'Translation']));
    expect(names.filter((n) => n === 'Git')).toHaveLength(1);
    expect(names).not.toContain('Software Engineer Intern at Date Maroon');
    expect(names).not.toContain('12 endorsements');
    expect(profile.skills?.every((s) => s.rating === 3)).toBe(true);
  });

  it('parses the /details/experience/ page exactly', () => {
    const { profile, rendered, page } = scrapeLinkedInPage(createDomDocument(LINKEDIN_EXPERIENCE_DETAILS_HTML), LINKEDIN_EXPERIENCE_DETAILS_URL);

    expect(page).toBe('experience');
    expect(rendered).toEqual(['experience']);
    expect(profile.contact?.name).toBeUndefined();
    expect(profile.experiences).toHaveLength(3);
    const nasa = profile.experiences![2];
    expect(nasa.company).toBe('NASA - National Aeronautics and Space Administration');
    expect(nasa.title).toBe('NASA HAS Scholar');
    expect(nasa.type).toBe('internship');
    expect(nasa.startDate).toBe('2024-10');
    expect(nasa.endDate).toBe('2025-07');
    expect(nasa.isCurrent).toBe(false);
    expect(nasa.location).toBe('Remote');
    expect(nasa.bullets).toHaveLength(3);
    expect(nasa.bullets[0]).toMatch(/^Selected for NASA's/);
    expect(nasa.skillsUsed).toContain('Computer-Aided Design (CAD)');
  });

  it('keeps sidebar people and footer links out of the experience entries', () => {
    const { profile } = scrapeLinkedInPage(createDomDocument(LINKEDIN_EXPERIENCE_DETAILS_HTML), LINKEDIN_EXPERIENCE_DETAILS_URL);
    const text = JSON.stringify(profile);

    expect(text).not.toContain('Alex Rivera');
    expect(text).not.toContain('Talent Solutions');
    expect(text).not.toContain('Promoted');
    expect(profile.experiences![0].bullets).toHaveLength(3);
    expect(profile.experiences![0].skillsUsed).toEqual(['Software Development', 'Product Testing']);
  });

  it('expands a grouped company on the details page into one experience per role', () => {
    const { profile } = scrapeLinkedInPage(createDomDocument(LINKEDIN_GROUPED_EXPERIENCE_DETAILS_HTML), LINKEDIN_EXPERIENCE_DETAILS_URL);
    const globex = (profile.experiences || []).filter((e) => e.company === 'Globex Corporation');

    expect(globex.map((e) => e.title)).toEqual(['Software Engineer II', 'Software Engineer Intern']);
    expect(globex[0]).toMatchObject({ type: 'full_time', startDate: '2021-07', endDate: '2022-12', location: 'Austin, Texas, United States' });
    expect(globex[1]).toMatchObject({ type: 'internship', startDate: '2019-06', endDate: '2019-08' });
    expect(profile.experiences?.find((e) => e.title === 'Globex Corporation')).toBeUndefined();
    expect(profile.experiences?.find((e) => e.title === 'Research Assistant')).toMatchObject({ company: 'State University', type: 'part_time' });
  });

  it('parses the /details/education/ page', () => {
    const { profile, rendered } = scrapeLinkedInPage(createDomDocument(LINKEDIN_EDUCATION_DETAILS_HTML), LINKEDIN_EDUCATION_DETAILS_URL);

    expect(rendered).toEqual(['education']);
    expect(profile.education).toHaveLength(2);
    expect(profile.education![0]).toMatchObject({
      institution: 'Texas A&M University',
      degreeLevel: 'bachelor',
      degree: 'Bachelor of Engineering',
      fieldOfStudy: 'ENGINEERING',
      graduationYear: 2030,
      graduationMonth: 5,
      status: 'in_progress',
      gpa: '3.9',
    });
    expect(profile.education![1]).toMatchObject({ institution: 'Round Rock High School', degreeLevel: 'high_school', graduationYear: 2026 });
  });

  it('parses the /details/certifications/ page and merges Skills: lines', () => {
    const { profile, rendered } = scrapeLinkedInPage(createDomDocument(LINKEDIN_CERTIFICATIONS_DETAILS_HTML), LINKEDIN_CERTIFICATIONS_DETAILS_URL);

    expect(rendered).toEqual(['certifications']);
    expect(profile.certifications).toHaveLength(3);
    expect(profile.certifications![0]).toEqual({ name: 'Introduction to Model Context Protocol', issuer: 'Anthropic', issuedYear: 2026 });
    expect(profile.certifications![0].credentialUrl).toBeUndefined();
    expect(profile.certifications![2]).toMatchObject({ name: 'AWS Certified Cloud Practitioner', issuedYear: 2025, expiresYear: 2028 });
    expect(profile.skills).toEqual([
      { name: 'Model Context Protocol (MCP)', rating: 3 },
      { name: 'Anthropic Claude', rating: 3 },
      { name: 'Claude Skills', rating: 3 },
    ]);
  });

  it('parses the /details/projects/ page into project experiences', () => {
    const { profile, rendered } = scrapeLinkedInPage(createDomDocument(LINKEDIN_PROJECTS_DETAILS_HTML), LINKEDIN_PROJECTS_DETAILS_URL);

    expect(rendered).toEqual(['projects']);
    expect(profile.experiences).toHaveLength(2);
    expect(profile.experiences![0]).toMatchObject({
      title: 'Savor',
      company: 'Personal project',
      type: 'project',
      startDate: '2026-06',
      isCurrent: true,
      skillsUsed: ['Google Cloud Vision', 'Mobile Application Development'],
    });
    expect(profile.experiences![0].bullets).toHaveLength(2);
    expect(profile.experiences![0].bullets.join(' ')).not.toContain('more');
    expect(profile.experiences![1]).toMatchObject({ title: 'Portfolio', type: 'project', skillsUsed: ['React.js', 'Next.js'] });
  });

  it('parses the /details/volunteering-experiences/ page into volunteer experiences', () => {
    const { profile, rendered } = scrapeLinkedInPage(createDomDocument(LINKEDIN_VOLUNTEERING_DETAILS_HTML), LINKEDIN_VOLUNTEERING_DETAILS_URL);

    expect(rendered).toEqual(['volunteering']);
    expect(profile.experiences).toHaveLength(2);
    expect(profile.experiences![0]).toMatchObject({
      title: 'Care Team Leader',
      company: 'AUSTIN KOREAN PRESBYTERIAN CHURCH',
      type: 'volunteer',
      startDate: '2022-06',
      endDate: '2026-05',
      bullets: ['Led a youth group of 100+ students, organising weekly programs and mentoring student volunteers.'],
    });
    expect(profile.experiences![1]).toMatchObject({ title: 'Coding Mentor', company: 'Code2College', type: 'volunteer', isCurrent: true });
  });

  it('parses the /details/skills/ page, honouring known context names', () => {
    const doc = createDomDocument(LINKEDIN_SKILLS_DETAILS_HTML);
    const { profile, rendered } = scrapeLinkedInPage(doc, LINKEDIN_SKILLS_DETAILS_URL, {
      knownContextNames: ['Introduction to Model Context Protocol'],
    });
    const names = (profile.skills || []).map((s) => s.name);

    expect(rendered).toEqual(['skills']);
    expect(names).toEqual([
      'Software Development',
      'Product Testing',
      'Communication',
      'Model Context Protocol (MCP)',
      'User Interface Design',
      'Python (Programming Language)',
      'Machine Learning',
      'PostgreSQL',
      'Computer Engineering',
      'Dementia',
    ]);
    expect(names).not.toContain('Introduction to Model Context Protocol');
    expect(names).not.toContain('All');
    expect(names).not.toContain('Software Engineer Intern at Maroon');

    const unaware = scrapeLinkedInPage(doc, LINKEDIN_SKILLS_DETAILS_URL).profile.skills!.map((s) => s.name);
    expect(unaware).toContain('Introduction to Model Context Protocol');
  });

  it('reports nothing rendered for skeleton-only detail pages', () => {
    const skills = scrapeLinkedInPage(createDomDocument(LINKEDIN_SKILLS_SKELETON_HTML), LINKEDIN_SKILLS_DETAILS_URL);
    expect(skills.rendered).toEqual([]);
    expect(skills.profile.skills).toBeUndefined();

    const experience = scrapeLinkedInPage(createDomDocument(LINKEDIN_EXPERIENCE_SKELETON_HTML), LINKEDIN_EXPERIENCE_DETAILS_URL);
    expect(experience.rendered).toEqual([]);
    expect(experience.profile.experiences).toBeUndefined();
    expect(experience.profile.warnings).toContainEqual(expect.stringMatching(/not rendered its entries/));
  });

  it('recognises the 404 page and the authwall as nothing rendered', () => {
    const missing = scrapeLinkedInPage(createDomDocument(LINKEDIN_NOT_FOUND_HTML), LINKEDIN_EXPERIENCE_DETAILS_URL);
    expect(missing.rendered).toEqual([]);
    expect(missing.profile.warnings).toContain('LinkedIn says this page does not exist.');

    const authwall = scrapeLinkedInPage(createDomDocument(LINKEDIN_AUTHWALL_HTML), LINKEDIN_AUTHWALL_URL);
    expect(authwall.page).toBe('unknown');
    expect(authwall.rendered).toEqual([]);
  });

  it('never throws on an empty, null or unrelated document', () => {
    expect(() => scrapeLinkedInPage(createDomDocument(''), LINKEDIN_PROFILE_URL)).not.toThrow();
    expect(() => scrapeLinkedInPage(null as unknown as Document, LINKEDIN_PROFILE_URL)).not.toThrow();
    expect(() => scrapeLinkedInProfile(createDomDocument('<p>hello</p>'), 'not a url')).not.toThrow();

    const empty = scrapeLinkedInPage(createDomDocument(''), LINKEDIN_PROFILE_URL);
    expect(empty.rendered).toEqual([]);
    expect(empty.profile.source).toBe('linkedin_page');
    expect(empty.profile.warnings?.length).toBeGreaterThan(0);
  });

  it('still parses the pre-2026 layout (name, About, entries, skills)', () => {
    const { profile, rendered } = scrapeLinkedInPage(createDomDocument(LEGACY_FULL_PROFILE_HTML), LEGACY_PROFILE_URL);

    expect(rendered).toEqual(expect.arrayContaining(['topCard', 'about', 'experience', 'education', 'skills']));
    expect(profile.contact).toMatchObject({ name: 'Jane Doe', location: 'San Francisco, California, United States', linkedinUrl: LEGACY_PROFILE_URL });
    expect(profile.story?.summary).toMatch(/^Backend engineer with six years/);
    expect(profile.experiences?.find((e) => e.title === 'Senior Software Engineer')).toMatchObject({
      company: 'Acme Corp',
      type: 'full_time',
      startDate: '2023-01',
      isCurrent: true,
      location: 'San Francisco, CA',
      skillsUsed: ['Go', 'Kubernetes', 'PostgreSQL'],
    });
    expect(profile.experiences?.find((e) => e.title === 'Research Assistant')).toMatchObject({ company: 'State University', startDate: '2017', endDate: '2019' });
    expect(profile.education?.[0]).toMatchObject({ institution: 'State University', degreeLevel: 'bachelor', status: 'in_progress', graduationYear: FUTURE_YEAR, gpa: '3.8' });
    const names = profile.skills!.map((s) => s.name);
    expect(names).toEqual(expect.arrayContaining(['Go', 'Kubernetes']));
    expect(names).not.toContain('12 endorsements');
  });

  it('falls back to the legacy scraper when the 2026 selectors find nothing', () => {
    const { profile, rendered } = scrapeLinkedInPage(createDomDocument(LEGACY_SPARSE_PROFILE_HTML), 'https://www.linkedin.com/in/sam-solo/');

    expect(rendered).toContain('topCard');
    expect(profile.contact?.name).toBe('Sam Solo');
    expect(profile.contact?.location).toBe('Denver, Colorado, United States');
    expect(profile.warnings).toContain('Parsed with the legacy LinkedIn layout scraper.');
    expect(scrapeLinkedInProfile(createDomDocument(LEGACY_SPARSE_PROFILE_HTML), 'https://www.linkedin.com/in/sam-solo/').contact?.name).toBe('Sam Solo');
  });

  it('turns block and span children into one line each (elementLines)', () => {
    const doc = createDomDocument(
      '<div><p>One</p><span>Two</span><a href="#">Three</a><div>Skills: <span>A, B</span></div><span>Four\nFive</span><p class="visually-hidden">hidden</p></div>'
    );
    expect(elementLines(doc.body)).toEqual(['One', 'Two', 'Three', 'Skills: A, B', 'Four', 'Five']);
    expect(elementLines(null)).toEqual([]);
  });
});

describe('settleLinkedInPage', () => {
  beforeEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('resolves quickly on a rendered page and clicks every expandable-text button', async () => {
    document.body.innerHTML = LINKEDIN_PROJECTS_DETAILS_BODY;
    const button = document.querySelector('[data-testid="expandable-text-button"]') as HTMLElement;
    let clicks = 0;
    button.addEventListener('click', () => {
      clicks += 1;
      button.remove();
    });

    const started = Date.now();
    await settleLinkedInPage(document, 'projects');

    expect(clicks).toBe(1);
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it('gives up at the timeout when the section never renders, without throwing', async () => {
    document.body.innerHTML = LINKEDIN_EXPERIENCE_SKELETON_BODY;

    const started = Date.now();
    await expect(settleLinkedInPage(document, 'experience', { timeoutMs: 600 })).resolves.toBeUndefined();

    expect(Date.now() - started).toBeGreaterThanOrEqual(500);
    expect(Date.now() - started).toBeLessThan(2500);
  });

  it('returns immediately for a 404 page and for an unknown page kind', async () => {
    document.body.innerHTML = LINKEDIN_NOT_FOUND_BODY;
    const started = Date.now();
    await settleLinkedInPage(document, 'experience');
    await settleLinkedInPage(document, 'unknown');
    await settleLinkedInPage(null as unknown as Document, 'profile');
    expect(Date.now() - started).toBeLessThan(500);
  });
});

describe('Content script SCRAPE_LINKEDIN_PROFILE contract', () => {
  let harness: SetupMockChromeResult;

  function setUrl(url: string) {
    (window as any).happyDOM.setURL(url);
  }

  /** Delivers a message to the content script's listener and resolves with its async response. */
  function sendToContentScript(message: any): Promise<any> {
    return new Promise((resolve) => {
      for (const listener of harness.messageListeners) {
        listener(message, { id: 'rezbuilder-sender' }, resolve);
      }
    });
  }

  async function scrape(message: any = { type: 'SCRAPE_LINKEDIN_PROFILE' }): Promise<any> {
    const pending = sendToContentScript(message);
    await vi.advanceTimersByTimeAsync(10_000);
    return pending;
  }

  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    harness = setupMockChrome();
    document.head.innerHTML = '';
    document.body.innerHTML = '';
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    ['main page (skeleton)', LINKEDIN_SELF_PROFILE_URL, LINKEDIN_MAIN_SKELETON_BODY],
    ['main page (rendered)', LINKEDIN_PROFILE_URL, LINKEDIN_MAIN_RENDERED_BODY],
    ['experience details', LINKEDIN_EXPERIENCE_DETAILS_URL, LINKEDIN_EXPERIENCE_DETAILS_BODY],
    ['education details', LINKEDIN_EDUCATION_DETAILS_URL, LINKEDIN_EDUCATION_DETAILS_BODY],
    ['certifications details', LINKEDIN_CERTIFICATIONS_DETAILS_URL, LINKEDIN_CERTIFICATIONS_DETAILS_BODY],
    ['projects details', LINKEDIN_PROJECTS_DETAILS_URL, LINKEDIN_PROJECTS_DETAILS_BODY],
    ['volunteering details', LINKEDIN_VOLUNTEERING_DETAILS_URL, LINKEDIN_VOLUNTEERING_DETAILS_BODY],
    ['skills details', LINKEDIN_SKILLS_DETAILS_URL, LINKEDIN_SKILLS_DETAILS_BODY],
    ['skills skeleton', LINKEDIN_SKILLS_DETAILS_URL, LINKEDIN_SKILLS_SKELETON_BODY],
    ['404', LINKEDIN_EXPERIENCE_DETAILS_URL, LINKEDIN_NOT_FOUND_BODY],
    ['authwall', LINKEDIN_AUTHWALL_URL, LINKEDIN_AUTHWALL_BODY],
  ])('does not treat the %s page as a job posting', async (_name, url, body) => {
    setUrl(url);
    document.body.innerHTML = body;

    const content = await import('../src/content/index');

    expect(content.parseCurrentPage()).toBeNull();
  });

  it('responds with the profile, page kind and rendered sections on a rendered main page', async () => {
    setUrl(LINKEDIN_PROFILE_URL);
    document.body.innerHTML = LINKEDIN_MAIN_RENDERED_BODY;
    await import('../src/content/index');

    const response = await scrape();

    expect(response.success).toBe(true);
    expect(response.page).toBe('profile');
    expect(response.rendered).toEqual(['topCard', 'about', 'experience', 'education', 'skills']);
    expect(response.profile.source).toBe('linkedin_page');
    expect(response.profile.contact.name).toBe('Jayden Chun');
    expect(response.profile.experiences).toHaveLength(2);
    expect(response.error).toBeUndefined();
  });

  it('passes knownContextNames through to the skills page and honours settle:false', async () => {
    setUrl(LINKEDIN_SKILLS_DETAILS_URL);
    document.body.innerHTML = LINKEDIN_SKILLS_DETAILS_BODY;
    await import('../src/content/index');

    const response = await scrape({
      type: 'SCRAPE_LINKEDIN_PROFILE',
      options: { knownContextNames: ['Introduction to Model Context Protocol'], settle: false },
    });

    expect(response).toMatchObject({ success: true, page: 'skills', rendered: ['skills'] });
    const names = response.profile.skills.map((s: { name: string }) => s.name);
    expect(names).toContain('Machine Learning');
    expect(names).not.toContain('Introduction to Model Context Protocol');
  });

  it('refuses to scrape when the tab is not on a profile url', async () => {
    setUrl(LINKEDIN_AUTHWALL_URL);
    document.body.innerHTML = LINKEDIN_AUTHWALL_BODY;
    await import('../src/content/index');

    const response = await scrape();

    expect(response).toEqual({ success: false, error: 'This tab is not a LinkedIn profile page.', page: 'unknown', rendered: [] });
  });

  it('reports the exact not-rendered error after settling on a skeleton-only detail page', async () => {
    setUrl(LINKEDIN_EXPERIENCE_DETAILS_URL);
    document.body.innerHTML = LINKEDIN_EXPERIENCE_SKELETON_BODY;
    await import('../src/content/index');

    const response = await scrape();

    expect(response).toEqual({
      success: false,
      error: 'LinkedIn profile has not finished rendering yet.',
      page: 'experience',
      rendered: [],
    });
  });

  it('returns true from the listener so the async response is kept alive', async () => {
    setUrl(LINKEDIN_PROFILE_URL);
    document.body.innerHTML = LINKEDIN_MAIN_SKELETON_BODY;
    await import('../src/content/index');

    const results = harness.messageListeners.map((listener) =>
      listener({ type: 'SCRAPE_LINKEDIN_PROFILE' }, { id: 'rezbuilder-sender' }, () => {})
    );
    expect(results).toContain(true);
    await vi.advanceTimersByTimeAsync(10_000);
  });
});
