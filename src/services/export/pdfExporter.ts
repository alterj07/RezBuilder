import { ResumeSections } from '../../types/resume';

/**
 * Generates clean, ATS-compliant HTML for PDF printing
 */
export function generateResumeHtml(sections: ResumeSections, candidateName: string = 'Resume'): string {
  const name = sections.contact.name || candidateName;
  const contactParts: string[] = [];
  if (sections.contact.email) contactParts.push(sections.contact.email);
  if (sections.contact.phone) contactParts.push(sections.contact.phone);
  if (sections.contact.location) contactParts.push(sections.contact.location);
  if (sections.contact.linkedin) contactParts.push(sections.contact.linkedin);
  if (sections.contact.github) contactParts.push(sections.contact.github);

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${name} - Tailored Resume</title>
  <style>
    @page {
      margin: 0.6in 0.7in;
      size: letter portrait;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #111827;
      line-height: 1.45;
      font-size: 10.5pt;
      margin: 0;
      padding: 24px;
      background: #ffffff;
    }
    .header {
      text-align: center;
      margin-bottom: 16px;
    }
    .name {
      font-size: 18pt;
      font-weight: 700;
      letter-spacing: -0.02em;
      margin-bottom: 4px;
      color: #000000;
    }
    .contact-line {
      font-size: 9.5pt;
      color: #4b5563;
    }
    .section-title {
      font-size: 10.5pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border-bottom: 1px solid #111827;
      padding-bottom: 2px;
      margin-top: 14px;
      margin-bottom: 8px;
      color: #111827;
    }
    .exp-item {
      margin-bottom: 10px;
    }
    .exp-header {
      display: flex;
      justify-content: space-between;
      font-weight: 600;
      font-size: 10.5pt;
    }
    .exp-sub {
      display: flex;
      justify-content: space-between;
      font-size: 9.5pt;
      color: #374151;
      font-style: italic;
      margin-bottom: 4px;
    }
    ul {
      margin: 4px 0 6px 18px;
      padding: 0;
    }
    li {
      margin-bottom: 3px;
      font-size: 10pt;
    }
    .skills-text {
      font-size: 10pt;
    }
    @media print {
      body { padding: 0; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="name">${name}</div>
    <div class="contact-line">${contactParts.join(' &nbsp;|&nbsp; ')}</div>
  </div>

  ${
    sections.summary
      ? `
    <div class="section-title">Professional Summary</div>
    <div>${sections.summary}</div>
  `
      : ''
  }

  ${
    sections.experience && sections.experience.length > 0
      ? `
    <div class="section-title">Work Experience</div>
    ${sections.experience
      .map(
        (exp) => `
      <div class="exp-item">
        <div class="exp-header">
          <span>${exp.title}</span>
          <span>${[exp.startDate, exp.endDate || (exp.isCurrent ? 'Present' : '')].filter(Boolean).join(' – ')}</span>
        </div>
        <div class="exp-sub">
          <span>${exp.company}</span>
          <span>${exp.location || ''}</span>
        </div>
        <ul>
          ${exp.bullets.map((b) => `<li>${b}</li>`).join('')}
        </ul>
      </div>
    `
      )
      .join('')}
  `
      : ''
  }

  ${
    sections.skills && sections.skills.length > 0
      ? `
    <div class="section-title">Technical Skills</div>
    <div class="skills-text">${sections.skills.join(', ')}</div>
  `
      : ''
  }

  ${
    sections.education && sections.education.length > 0
      ? `
    <div class="section-title">Education</div>
    ${sections.education
      .map(
        (edu) => `
      <div class="exp-item">
        <div class="exp-header">
          <span>${edu.institution}</span>
          <span>${edu.graduationYear || ''}</span>
        </div>
        <div class="exp-sub">
          <span>${[edu.degree, edu.fieldOfStudy].filter(Boolean).join(', ')}</span>
        </div>
      </div>
    `
      )
      .join('')}
  `
      : ''
  }
</body>
</html>
  `;
}

/**
 * Triggers browser print dialog for saving ATS-compliant PDF
 */
export function printResumeToPdf(sections: ResumeSections, candidateName: string = 'Resume') {
  const html = generateResumeHtml(sections, candidateName);
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  }
}
