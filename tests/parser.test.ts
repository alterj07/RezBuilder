import { describe, it, expect } from 'vitest';
import { extractContactInfo, extractResumeSections } from '../src/services/parser/sectionExtractor';
import { extractTextFromRawPdfBytes, PasswordRequiredError } from '../src/services/parser/pdfParser';
import { resumeStorage } from '../src/services/storage/resumeStorage';
import { Resume } from '../src/types/resume';

describe('Resume Section Extractor', () => {
  const sampleResumeText = `
Alex Mercer
alex.mercer@example.com | (555) 123-4567 | San Francisco, CA
linkedin.com/in/alexmercer | github.com/alexmercer

Professional Summary
Senior Full Stack Engineer with 7+ years of experience specializing in high-scale distributed systems, React, Node.js, and cloud native architectures on AWS. Proven track record of reducing latency by 40%.

Work Experience
Senior Software Engineer at Stripe
Jan 2021 - Present
• Architected payment processing microservices using Node.js, TypeScript, and PostgreSQL handling $50M+ daily volume.
• Implemented Redis caching layers reducing database load by 35%.
• Led a squad of 6 engineers across sprint planning and technical design reviews.

Software Engineer at Airbnb
Jun 2017 - Dec 2020
• Developed responsive user interfaces with React, Next.js, and Tailwind CSS.
• Built CI/CD automated deployment pipelines with Docker and GitHub Actions.

Education
University of California, Berkeley
Bachelor of Science in Computer Science
Graduated 2017

Technical Skills
Languages: JavaScript, TypeScript, Python, SQL, Go
Frameworks: React, Next.js, Express, NestJS, Tailwind CSS
Databases & Cloud: PostgreSQL, Redis, MongoDB, AWS, Docker, Kubernetes, CI/CD
  `;

  it('should extract contact information accurately', () => {
    const contact = extractContactInfo(sampleResumeText);
    expect(contact.name).toBe('Alex Mercer');
    expect(contact.email).toBe('alex.mercer@example.com');
    expect(contact.phone).toBe('(555) 123-4567');
    expect(contact.linkedin).toBe('linkedin.com/in/alexmercer');
    expect(contact.github).toBe('github.com/alexmercer');
    expect(contact.location).toBe('San Francisco, CA');
  });

  it('should parse professional summary', () => {
    const sections = extractResumeSections(sampleResumeText);
    expect(sections.summary).toContain('Senior Full Stack Engineer with 7+ years');
    expect(sections.summary).toContain('AWS');
  });

  it('should parse experience items with roles, companies, dates and bullets', () => {
    const sections = extractResumeSections(sampleResumeText);
    expect(sections.experience.length).toBe(2);

    const stripeExp = sections.experience[0];
    expect(stripeExp.company).toBe('Stripe');
    expect(stripeExp.title).toContain('Senior Software Engineer');
    expect(stripeExp.isCurrent).toBe(true);
    expect(stripeExp.bullets.length).toBe(3);
    expect(stripeExp.bullets[0]).toContain('payment processing microservices');

    const airbnbExp = sections.experience[1];
    expect(airbnbExp.company).toBe('Airbnb');
    expect(airbnbExp.title).toContain('Software Engineer');
    expect(airbnbExp.bullets.length).toBe(2);
  });

  it('should parse education items', () => {
    const sections = extractResumeSections(sampleResumeText);
    expect(sections.education.length).toBeGreaterThan(0);
    expect(sections.education[0].institution).toContain('University of California, Berkeley');
    expect(sections.education[0].graduationYear).toBe('2017');
  });

  it('should extract technical skills list', () => {
    const sections = extractResumeSections(sampleResumeText);
    expect(sections.skills).toContain('typescript');
    expect(sections.skills).toContain('react');
    expect(sections.skills).toContain('node.js');
    expect(sections.skills).toContain('docker');
    expect(sections.skills).toContain('kubernetes');
    expect(sections.skills).toContain('postgresql');
  });
});

describe('PDF Stream Fallback & Password Handling', () => {
  it('should extract text from raw PDF text objects (BT...ET)', () => {
    const fakePdfContent = `
      %PDF-1.4
      1 0 obj << /Type /Catalog >> endobj
      2 0 obj << /Length 100 >> stream
      BT
      /F1 12 Tf
      (Senior Full Stack Developer) Tj
      [(Proficient in React, Node.js, and PostgreSQL)] TJ
      ET
      endstream endobj
    `;
    const encoder = new TextEncoder();
    const buffer = encoder.encode(fakePdfContent).buffer;

    const extracted = extractTextFromRawPdfBytes(buffer);
    expect(extracted).toContain('Senior Full Stack Developer');
    expect(extracted).toContain('React');
    expect(extracted).toContain('PostgreSQL');
  });

  it('PasswordRequiredError should identify protected PDFs', () => {
    const err = new PasswordRequiredError('Protected file');
    expect(err.isPasswordRequired).toBe(true);
    expect(err.name).toBe('PasswordRequiredError');
  });
});

describe('Resume Storage Service', () => {
  it('should save, retrieve, tag, and delete resumes', async () => {
    await resumeStorage.clearAllResumes();

    const sampleResume: Resume = {
      id: 'res_test_1',
      name: 'Alex Mercer',
      tag: 'Backend Eng',
      fileName: 'alex_mercer_resume.pdf',
      fileType: 'pdf',
      uploadedAt: new Date().toISOString(),
      rawText: 'Test text',
      sections: {
        contact: { name: 'Alex Mercer' },
        summary: 'Summary text',
        experience: [],
        education: [],
        skills: ['typescript', 'go'],
        projects: [],
      },
    };

    await resumeStorage.saveResume(sampleResume);

    const all = await resumeStorage.getAllResumes();
    expect(all.length).toBe(1);
    expect(all[0].name).toBe('Alex Mercer');
    expect(all[0].tag).toBe('Backend Eng');
    expect(all[0].isDefault).toBe(true);

    // Update tag
    await resumeStorage.updateResume('res_test_1', { tag: 'Full Stack' });
    const updated = await resumeStorage.getResumeById('res_test_1');
    expect(updated?.tag).toBe('Full Stack');

    // Delete
    await resumeStorage.deleteResume('res_test_1');
    const afterDelete = await resumeStorage.getAllResumes();
    expect(afterDelete.length).toBe(0);
  });
});
