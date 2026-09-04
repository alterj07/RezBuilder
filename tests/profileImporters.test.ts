import { describe, it, expect } from 'vitest';
import { resumeToProfileImport, rateSkillFromBullets } from '../src/services/profile/resumeToProfile';
import { parseCsv, parseLinkedInExportFiles } from '../src/services/profile/linkedinExportImporter';
import { inferDegreeLevel, inferExperienceType, normalizeDate, inferEducationStatus } from '../src/services/profile/inference';
import { MOCK_SENIOR_FULLSTACK_RESUME, MOCK_MINIMAL_RESUME, MOCK_DEGENERATE_RESUME } from './fixtures/mockResumes';

const NOW = new Date('2026-09-03T00:00:00.000Z');

describe('inference helpers', () => {
  it('infers degree levels from free-form degree text', () => {
    const cases: [string, string][] = [
      ['Ph.D. in Computer Science', 'phd'],
      ['Doctor of Philosophy', 'phd'],
      ['Master of Science - MS', 'master'],
      ['M.S. Computer Science', 'master'],
      ['MEng', 'master'],
      ['MBA', 'master'],
      ['Bachelor of Science', 'bachelor'],
      ['B.S.', 'bachelor'],
      ['BA in Economics', 'bachelor'],
      ['B.A.', 'bachelor'],
      ['BEng Software', 'bachelor'],
      ['B.B.A. in Management Information Systems', 'bachelor'],
      ['Associate Degree in Web Development', 'associate'],
      ['Full-Stack Bootcamp', 'bootcamp'],
      ['High School Diploma', 'high_school'],
      ['Certificate of Completion', 'other'],
      ['', 'other'],
    ];
    for (const [text, expected] of cases) {
      expect(inferDegreeLevel(text), text).toBe(expected);
    }
    expect(inferDegreeLevel(undefined)).toBe('other');
  });

  it('normalizes human dates to YYYY-MM or YYYY', () => {
    expect(normalizeDate('Jan 2023')).toBe('2023-01');
    expect(normalizeDate('September 2019')).toBe('2019-09');
    expect(normalizeDate('2023')).toBe('2023');
    expect(normalizeDate('05/2021')).toBe('2021-05');
    expect(normalizeDate('2021-05')).toBe('2021-05');
    expect(normalizeDate('Present')).toBeUndefined();
    expect(normalizeDate('')).toBeUndefined();
    expect(normalizeDate('n/a')).toBeUndefined();
  });

  it('infers internship and other reliable experience types from titles', () => {
    expect(inferExperienceType('Software Engineer Intern')).toBe('internship');
    expect(inferExperienceType('Summer Internship, Platform')).toBe('internship');
    expect(inferExperienceType('Contract Designer')).toBe('contract');
    expect(inferExperienceType('Research Assistant')).toBe('research');
    expect(inferExperienceType('Senior Software Engineer')).toBeUndefined();
  });

  it('marks past graduating classes as graduated and current/future as in progress', () => {
    expect(inferEducationStatus(2016, NOW)).toBe('graduated');
    expect(inferEducationStatus(2026, NOW)).toBe('in_progress');
    expect(inferEducationStatus(2028, NOW)).toBe('in_progress');
    expect(inferEducationStatus(undefined, NOW)).toBe('graduated');
  });
});

describe('resumeToProfileImport', () => {
  const imp = resumeToProfileImport(MOCK_SENIOR_FULLSTACK_RESUME, NOW);

  it('maps contact info including the linkedin URL rename', () => {
    expect(imp.source).toBe('resume');
    expect(imp.contact).toEqual({
      name: 'Alex Rivera',
      email: 'alex.rivera@example.com',
      phone: '(555) 234-5678',
      location: 'San Francisco, CA',
      linkedinUrl: 'https://linkedin.com/in/alexrivera-dev',
      website: 'https://alexrivera.dev',
      github: 'https://github.com/alexrivera',
    });
  });

  it('maps experiences with normalized dates, current flag, bullets and skills used', () => {
    const jobs = (imp.experiences || []).filter((x) => x.type !== 'project');
    expect(jobs).toHaveLength(3);
    expect(jobs[0]).toMatchObject({
      company: 'CloudScale Inc',
      title: 'Lead Infrastructure & Backend Engineer',
      startDate: '2021-01',
      isCurrent: true,
      location: 'San Francisco, CA',
    });
    expect(jobs[0].endDate).toBeUndefined();
    expect(jobs[0].bullets).toHaveLength(4);
    expect(jobs[0].skillsUsed).toEqual(expect.arrayContaining(['kubernetes', 'terraform', 'postgresql', 'kafka']));
    expect(jobs[1]).toMatchObject({ startDate: '2018-06', endDate: '2020-12', isCurrent: false });
    expect(jobs[1].type).toBeUndefined();
  });

  it('turns resume projects into experiences of type project', () => {
    const projects = (imp.experiences || []).filter((x) => x.type === 'project');
    expect(projects).toHaveLength(1);
    expect(projects[0]).toMatchObject({ company: 'Distributed KV Store', title: 'Project' });
    expect(projects[0].bullets).toEqual([
      'Fault-tolerant distributed key-value store implementing Raft consensus.',
      'Implemented leader election and log replication with sub-5ms latency.',
    ]);
    expect(projects[0].skillsUsed).toEqual(expect.arrayContaining(['Go', 'Raft', 'Docker', 'gRPC']));
  });

  it('maps education with inferred degree level, status and numeric graduation year', () => {
    expect(imp.education).toEqual([
      {
        institution: 'University of California, Berkeley',
        degreeLevel: 'bachelor',
        degree: 'Bachelor of Science',
        fieldOfStudy: 'Computer Science',
        status: 'graduated',
        graduationYear: 2016,
        gpa: '3.8',
      },
    ]);
  });

  it('marks a future graduating class as in progress', () => {
    const resume = {
      ...MOCK_SENIOR_FULLSTACK_RESUME,
      sections: {
        ...MOCK_SENIOR_FULLSTACK_RESUME.sections,
        education: [{ id: 'e', institution: 'MIT', degree: 'MEng', graduationYear: 'Expected 2027' }],
      },
    };
    const result = resumeToProfileImport(resume, NOW);
    expect(result.education?.[0]).toMatchObject({ degreeLevel: 'master', status: 'in_progress', graduationYear: 2027 });
  });

  it('unions section skills with dictionary hits from the raw text, deduped case-insensitively', () => {
    const names = (imp.skills || []).map((s) => s.name);
    expect(names).toContain('React');
    expect(names.filter((n) => n.toLowerCase() === 'react')).toHaveLength(1);
    // From raw text only (not in the skills section)
    expect(names).toContain('microservices');
    expect(names).toContain('prometheus');
    // Display casing from the skills section is preserved.
    expect(names).toContain('Next.js');
    expect(names).not.toContain('next.js');
  });

  it('rates skills by how many experience bullets mention them', () => {
    const rating = (name: string) => imp.skills?.find((s) => s.name.toLowerCase() === name.toLowerCase())?.rating;
    expect(rating('React')).toBe(4); // two bullets
    expect(rating('Kafka')).toBe(3); // one bullet
    expect(rating('Python')).toBe(2); // skills section only
    expect(rating('Kubernetes')).toBe(3);
  });

  it('rateSkillFromBullets caps at 4 and honours synonyms', () => {
    expect(rateSkillFromBullets('React', ['Used React', 'More React', 'Even more React'])).toBe(4);
    expect(rateSkillFromBullets('Kubernetes', ['Ran k8s clusters'])).toBe(3);
    expect(rateSkillFromBullets('Rust', ['Wrote Go'])).toBe(2);
  });

  it('maps certifications and the summary', () => {
    expect(imp.certifications).toEqual([
      { name: 'AWS Certified Solutions Architect – Professional' },
      { name: 'Certified Kubernetes Administrator (CKA)' },
    ]);
    expect(imp.story).toEqual({ summary: MOCK_SENIOR_FULLSTACK_RESUME.sections.summary });
    expect(imp.warnings).toBeUndefined();
  });

  it('infers internship type from the title', () => {
    const resume = {
      ...MOCK_MINIMAL_RESUME,
      sections: {
        ...MOCK_MINIMAL_RESUME.sections,
        experience: [{ id: 'x', company: 'Acme', title: 'Software Engineering Intern', startDate: 'Jun 2025', endDate: 'Aug 2025', bullets: [] }],
      },
    };
    const result = resumeToProfileImport(resume, NOW);
    expect(result.experiences?.[0]).toMatchObject({ type: 'internship', startDate: '2025-06', endDate: '2025-08', isCurrent: false });
  });

  it('handles the minimal "Cher" resume: contact + skills only, with warnings for the rest', () => {
    const result = resumeToProfileImport(MOCK_MINIMAL_RESUME, NOW);
    expect(result.contact).toEqual({ name: 'Cher', email: 'cher@example.com' });
    expect(result.skills?.map((s) => [s.name, s.rating])).toEqual([
      ['html', 2],
      ['css', 2],
    ]);
    expect(result.experiences).toBeUndefined();
    expect(result.education).toBeUndefined();
    expect(result.certifications).toBeUndefined();
    expect(result.story).toBeUndefined();
    expect(result.warnings).toEqual(['No work experience was found in the resume.', 'No education was found in the resume.']);
  });

  it('handles a degenerate empty resume without throwing', () => {
    const result = resumeToProfileImport(MOCK_DEGENERATE_RESUME, NOW);
    expect(result).toMatchObject({ source: 'resume' });
    expect(result.contact).toBeUndefined();
    expect(result.skills).toBeUndefined();
    expect(result.warnings).toEqual([
      'Could not find your name in the resume.',
      'No work experience was found in the resume.',
      'No education was found in the resume.',
      'No skills were found in the resume.',
    ]);
  });
});

describe('parseCsv', () => {
  it('parses quoted fields with embedded commas, newlines, escaped quotes, CRLF and a BOM', () => {
    const csv =
      '﻿Name,Description,Note\r\n' +
      '"Acme, Inc.","Line one\r\nLine two ""quoted""",plain\r\n' +
      'Beta,simple,\r\n' +
      ',,\r\n';
    const rows = parseCsv(csv);
    expect(rows).toEqual([
      { Name: 'Acme, Inc.', Description: 'Line one\r\nLine two "quoted"', Note: 'plain' },
      { Name: 'Beta', Description: 'simple', Note: '' },
    ]);
  });

  it('returns an empty list for empty or header-only input and pads short rows', () => {
    expect(parseCsv('')).toEqual([]);
    expect(parseCsv('A,B\n')).toEqual([]);
    expect(parseCsv('A,B\nonly')).toEqual([{ A: 'only', B: '' }]);
  });
});

const PROFILE_CSV =
  '﻿First Name,Last Name,Maiden Name,Address,Birth Date,Headline,Summary,Industry,Zip Code,Geo Location,Twitter Handles,Websites,Instant Messengers\n' +
  'Alex,Rivera,,,,Senior Engineer at CloudScale,"Results-driven engineer.\nI like distributed systems, a lot.",Software Development,,"San Francisco, California, United States",,"[PERSONAL:https://alexrivera.dev,OTHER:https://github.com/alexrivera]",\n';

const POSITIONS_CSV =
  'Company Name,Title,Description,Location,Started On,Finished On\r\n' +
  '"CloudScale, Inc.",Lead Engineer,"• Architected microservices in Go.\r\n• Ran Kubernetes clusters, multi-region.","San Francisco, CA",Jan 2021,\r\n' +
  'Platform Dynamics,Software Engineer Intern,Built React apps.,San Jose,Jun 2018,Aug 2018\r\n';

const EDUCATION_CSV =
  'School Name,Start Date,End Date,Notes,Degree Name,Activities\n' +
  '"University of California, Berkeley",2012,May 2016,,"Bachelor of Science - BS, Computer Science",Robotics club\n' +
  'Stanford University,Sep 2025,2027,,Master of Science - MS,\n' +
  'Some Academy,,,,Bootcamp,\n';

const SKILLS_CSV = 'Name\nReact\nTypeScript\nreact\nKubernetes\n';

const CERTIFICATIONS_CSV =
  'Name,Url,Authority,Started On,Finished On\n' +
  'Certified Kubernetes Administrator,https://example.com/cka,The Linux Foundation,Mar 2023,Mar 2026\n' +
  'AWS Solutions Architect,,Amazon Web Services,2022,\n';

describe('parseLinkedInExportFiles', () => {
  const imp = parseLinkedInExportFiles(
    [
      { name: 'Basic_LinkedInDataExport/Profile.csv', text: PROFILE_CSV },
      { name: 'positions.csv', text: POSITIONS_CSV },
      { name: 'Education.CSV', text: EDUCATION_CSV },
      { name: 'Skills.csv', text: SKILLS_CSV },
      { name: 'Certifications.csv', text: CERTIFICATIONS_CSV },
      { name: 'Email Addresses.csv', text: 'Email Address,Confirmed,Primary,Updated On\nold@example.com,Yes,No,2020\nalex@example.com,Yes,Yes,2024\n' },
      { name: 'Connections.csv', text: 'First Name,Last Name\nSomeone,Else\n' },
    ],
    NOW
  );

  it('maps Profile.csv into contact and story, tolerating a BOM and a multi-line summary', () => {
    expect(imp.source).toBe('linkedin_export');
    expect(imp.contact).toEqual({
      name: 'Alex Rivera',
      location: 'San Francisco, California, United States',
      website: 'https://alexrivera.dev',
      github: 'https://github.com/alexrivera',
      email: 'alex@example.com',
    });
    expect(imp.story).toEqual({
      summary: 'Results-driven engineer.\nI like distributed systems, a lot.',
      targetIndustries: ['Software Development'],
    });
  });

  it('maps Positions.csv with bullet splitting, normalized dates, current flag and internship type', () => {
    expect(imp.experiences).toHaveLength(2);
    expect(imp.experiences?.[0]).toEqual({
      company: 'CloudScale, Inc.',
      title: 'Lead Engineer',
      bullets: ['Architected microservices in Go.', 'Ran Kubernetes clusters, multi-region.'],
      isCurrent: true,
      startDate: '2021-01',
      location: 'San Francisco, CA',
    });
    expect(imp.experiences?.[1]).toMatchObject({
      company: 'Platform Dynamics',
      type: 'internship',
      isCurrent: false,
      startDate: '2018-06',
      endDate: '2018-08',
    });
  });

  it('maps Education.csv with degree level, field of study, status and graduating class', () => {
    expect(imp.education).toHaveLength(3);
    expect(imp.education?.[0]).toEqual({
      institution: 'University of California, Berkeley',
      degreeLevel: 'bachelor',
      degree: 'Bachelor of Science - BS',
      fieldOfStudy: 'Computer Science',
      status: 'graduated',
      graduationYear: 2016,
      graduationMonth: 5,
    });
    expect(imp.education?.[1]).toMatchObject({
      institution: 'Stanford University',
      degreeLevel: 'master',
      status: 'in_progress',
      graduationYear: 2027,
    });
    expect(imp.education?.[2]).toMatchObject({ institution: 'Some Academy', degreeLevel: 'bootcamp' });
    expect(imp.education?.[2].graduationYear).toBeUndefined();
    expect(imp.warnings).toContain('No end date for Some Academy; check its graduating year.');
  });

  it('maps Skills.csv with default rating 3 and dedupes case-insensitively', () => {
    expect(imp.skills).toEqual([
      { name: 'React', rating: 3 },
      { name: 'TypeScript', rating: 3 },
      { name: 'Kubernetes', rating: 3 },
    ]);
  });

  it('maps Certifications.csv including issuer, URL and years', () => {
    expect(imp.certifications).toEqual([
      {
        name: 'Certified Kubernetes Administrator',
        issuer: 'The Linux Foundation',
        credentialUrl: 'https://example.com/cka',
        issuedYear: 2023,
        expiresYear: 2026,
      },
      { name: 'AWS Solutions Architect', issuer: 'Amazon Web Services', issuedYear: 2022 },
    ]);
  });

  it('ignores unknown files and does not warn when every expected file is present', () => {
    const warnings = imp.warnings || [];
    expect(warnings.some((w) => /not found/.test(w))).toBe(false);
    expect(warnings.some((w) => /Connections/.test(w))).toBe(false);
  });

  it('warns for each expected file that is missing', () => {
    const partial = parseLinkedInExportFiles([{ name: 'Skills.csv', text: SKILLS_CSV }], NOW);
    expect(partial.skills).toHaveLength(3);
    expect(partial.contact).toBeUndefined();
    expect(partial.warnings).toEqual([
      'Profile.csv was not found in the export.',
      'Positions.csv was not found in the export.',
      'Education.csv was not found in the export.',
      'Certifications.csv was not found in the export.',
    ]);
  });

  it('handles an empty file list', () => {
    const empty = parseLinkedInExportFiles([], NOW);
    expect(empty.source).toBe('linkedin_export');
    expect(empty.warnings).toHaveLength(5);
    expect(empty.skills).toBeUndefined();
  });
});
