import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  convertInchesToTwip,
} from 'docx';
import { ResumeSections } from '../../types/resume';

/**
 * Generates an ATS-compliant, single-column DOCX resume file
 */
export async function generateDocxResume(
  sections: ResumeSections,
  candidateName: string = 'Resume'
): Promise<Blob> {
  const children: Paragraph[] = [];

  // 1. Candidate Name (Header)
  const name = sections.contact.name || candidateName;
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [
        new TextRun({
          text: name,
          bold: true,
          size: 32, // 16pt
          font: 'Calibri',
        }),
      ],
    })
  );

  // 2. Contact Line
  const contactParts: string[] = [];
  if (sections.contact.email) contactParts.push(sections.contact.email);
  if (sections.contact.phone) contactParts.push(sections.contact.phone);
  if (sections.contact.location) contactParts.push(sections.contact.location);
  if (sections.contact.linkedin) contactParts.push(sections.contact.linkedin);
  if (sections.contact.github) contactParts.push(sections.contact.github);

  if (contactParts.length > 0) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 240 },
        children: [
          new TextRun({
            text: contactParts.join('  |  '),
            size: 20, // 10pt
            font: 'Calibri',
            color: '444444',
          }),
        ],
      })
    );
  }

  const createSectionHeader = (title: string): Paragraph => {
    return new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 240, after: 120 },
      border: {
        bottom: {
          color: '333333',
          space: 1,
          style: BorderStyle.SINGLE,
          size: 6,
        },
      },
      children: [
        new TextRun({
          text: title.toUpperCase(),
          bold: true,
          size: 22, // 11pt
          font: 'Calibri',
          color: '111111',
        }),
      ],
    });
  };

  // 3. Summary
  if (sections.summary) {
    children.push(createSectionHeader('Professional Summary'));
    children.push(
      new Paragraph({
        spacing: { after: 180 },
        children: [
          new TextRun({
            text: sections.summary,
            size: 21, // 10.5pt
            font: 'Calibri',
          }),
        ],
      })
    );
  }

  // 4. Work Experience
  if (sections.experience && sections.experience.length > 0) {
    children.push(createSectionHeader('Work Experience'));

    for (const exp of sections.experience) {
      // Role Title & Company line
      const dateStr = [exp.startDate, exp.endDate || (exp.isCurrent ? 'Present' : '')].filter(Boolean).join(' – ');

      children.push(
        new Paragraph({
          spacing: { before: 120, after: 60 },
          children: [
            new TextRun({
              text: exp.title,
              bold: true,
              size: 21,
              font: 'Calibri',
            }),
            new TextRun({
              text: `  |  ${exp.company}`,
              bold: true,
              size: 21,
              font: 'Calibri',
              color: '222222',
            }),
            new TextRun({
              text: dateStr ? `  (${dateStr})` : '',
              italics: true,
              size: 20,
              font: 'Calibri',
              color: '555555',
            }),
          ],
        })
      );

      // Bullets
      for (const bullet of exp.bullets) {
        children.push(
          new Paragraph({
            bullet: { level: 0 },
            spacing: { after: 40 },
            children: [
              new TextRun({
                text: bullet,
                size: 20, // 10pt
                font: 'Calibri',
              }),
            ],
          })
        );
      }
    }
  }

  // 5. Skills
  if (sections.skills && sections.skills.length > 0) {
    children.push(createSectionHeader('Technical Skills'));
    children.push(
      new Paragraph({
        spacing: { after: 180 },
        children: [
          new TextRun({
            text: sections.skills.join(', '),
            size: 21,
            font: 'Calibri',
          }),
        ],
      })
    );
  }

  // 6. Education
  if (sections.education && sections.education.length > 0) {
    children.push(createSectionHeader('Education'));

    for (const edu of sections.education) {
      const eduDetails = [edu.degree, edu.fieldOfStudy, edu.graduationYear].filter(Boolean).join(' • ');

      children.push(
        new Paragraph({
          spacing: { before: 80, after: 60 },
          children: [
            new TextRun({
              text: edu.institution,
              bold: true,
              size: 21,
              font: 'Calibri',
            }),
            new TextRun({
              text: eduDetails ? ` — ${eduDetails}` : '',
              size: 20,
              font: 'Calibri',
              color: '444444',
            }),
          ],
        })
      );
    }
  }

  // Create document with standard 0.75" margins
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(0.75),
              bottom: convertInchesToTwip(0.75),
              left: convertInchesToTwip(0.75),
              right: convertInchesToTwip(0.75),
            },
          },
        },
        children,
      },
    ],
  });

  return await Packer.toBlob(doc);
}
