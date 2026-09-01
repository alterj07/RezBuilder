import { ContactInfo, ExperienceItem, EducationItem, ProjectItem, ResumeSections } from '../../types/resume';
import { extractSkillsFromText } from '../../content/scrapers/keywordExtractor';

// Common section header patterns
const SECTION_PATTERNS = {
  summary: /^(?:professional\s+summary|summary|profile|about\s+me|executive\s+summary|overview)$/i,
  experience: /^(?:work\s+experience|professional\s+experience|experience|employment\s+history|career\s+history)$/i,
  education: /^(?:education|academic\s+background|academic\s+history|qualifications)$/i,
  skills: /^(?:skills|technical\s+skills|core\s+competencies|technologies|tools\s+&\s+technologies|skills\s+&\s+tools)$/i,
  projects: /^(?:projects|personal\s+projects|key\s+projects|selected\s+projects)$/i,
  certifications: /^(?:certifications|licenses\s+&\s+certifications|certificates)$/i,
};

type SectionKey = keyof typeof SECTION_PATTERNS;

/**
 * Extracts structured contact info from text
 */
export function extractContactInfo(text: string): ContactInfo {
  const contact: ContactInfo = {};

  // Email
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (emailMatch) {
    contact.email = emailMatch[0];
  }

  // Phone
  const phoneMatch = text.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
  if (phoneMatch) {
    contact.phone = phoneMatch[0].trim();
  }

  // LinkedIn
  const linkedinMatch = text.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/([a-zA-Z0-9_-]+)/i);
  if (linkedinMatch) {
    contact.linkedin = linkedinMatch[0];
  }

  // GitHub
  const githubMatch = text.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/([a-zA-Z0-9_-]+)/i);
  if (githubMatch) {
    contact.github = githubMatch[0];
  }

  // Location heuristic (e.g., "San Francisco, CA" or "Austin, TX")
  const locationMatch = text.match(/([A-Z][a-zA-Z\s.-]+,\s*[A-Z]{2}(?:\s+\d{5})?)/);
  if (locationMatch && !locationMatch[0].includes('University') && !locationMatch[0].includes('College')) {
    contact.location = locationMatch[0].trim();
  }

  // Name (heuristic: first non-empty line with letters that doesn't look like contact details or a heading)
  const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
  for (const line of lines.slice(0, 5)) {
    if (
      !line.includes('@') &&
      !line.includes('http') &&
      !line.includes('linkedin.com') &&
      !phoneMatch?.[0]?.includes(line) &&
      line.length < 50 &&
      /^[A-Za-z\s.'-]+$/.test(line)
    ) {
      contact.name = line;
      break;
    }
  }

  return contact;
}

/**
 * Splits resume lines into major section buckets
 */
function splitIntoSectionBlocks(rawText: string): Record<string, string[]> {
  const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);
  const blocks: Record<string, string[]> = {
    header: [],
    summary: [],
    experience: [],
    education: [],
    skills: [],
    projects: [],
    certifications: [],
    other: [],
  };

  let currentSection: string = 'header';

  for (const line of lines) {
    let matchedSection: SectionKey | null = null;
    const cleanHeader = line.replace(/[:_=-]/g, '').trim();

    for (const [key, pattern] of Object.entries(SECTION_PATTERNS)) {
      if (pattern.test(cleanHeader)) {
        matchedSection = key as SectionKey;
        break;
      }
    }

    if (matchedSection) {
      currentSection = matchedSection;
    } else {
      if (!blocks[currentSection]) {
        blocks[currentSection] = [];
      }
      blocks[currentSection].push(line);
    }
  }

  return blocks;
}

/**
 * Helper to split a composite role/company string like "Senior Engineer at Stripe" or "Airbnb - Software Engineer"
 */
function splitTitleAndCompany(raw: string): { title: string; company: string } {
  let title = raw;
  let company = 'Company';

  if (raw.includes(' at ')) {
    const parts = raw.split(' at ');
    title = parts[0].trim();
    company = parts[1].trim();
  } else if (raw.includes(' @ ')) {
    const parts = raw.split(' @ ');
    title = parts[0].trim();
    company = parts[1].trim();
  } else if (raw.includes(' | ')) {
    const parts = raw.split(' | ');
    title = parts[0].trim();
    company = parts[1].trim();
  } else if (raw.includes(' - ')) {
    const parts = raw.split(' - ');
    title = parts[0].trim();
    company = parts[1].trim();
  }

  return { title, company };
}

/**
 * Parses experience section lines into structured items
 */
export function parseExperience(lines: string[]): ExperienceItem[] {
  const items: ExperienceItem[] = [];
  let currentItem: Partial<ExperienceItem> | null = null;

  const dateRegex = /(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}|\d{4})\s*[-–—]\s*(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}|\d{4}|Present|Current)/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isBullet = /^[-•*·▪◦]\s+/.test(line) || /^\d+\.\s+/.test(line);
    const dateMatch = line.match(dateRegex);

    if (dateMatch && !isBullet) {
      // Save previous item
      if (currentItem && (currentItem.company || currentItem.title)) {
        items.push({
          id: 'exp_' + items.length,
          company: currentItem.company || 'Company',
          title: currentItem.title || 'Role',
          startDate: currentItem.startDate,
          endDate: currentItem.endDate,
          isCurrent: currentItem.isCurrent || false,
          bullets: currentItem.bullets || [],
        });
      }

      // Parse date components
      const parts = dateMatch[0].split(/[-–—]/);
      const startDate = parts[0]?.trim();
      const endDate = parts[1]?.trim();
      const isCurrent = /present|current/i.test(endDate || '');

      // Line without date
      const textWithoutDate = line.replace(dateMatch[0], '').replace(/[|•,]/g, ' ').trim();
      
      let rawHeader = textWithoutDate;
      if (!rawHeader && i > 0 && !lines[i - 1].match(dateRegex) && !/^[-•*·▪◦]/.test(lines[i - 1])) {
        rawHeader = lines[i - 1];
      }

      const { title, company } = splitTitleAndCompany(rawHeader || 'Software Engineer');

      currentItem = {
        company,
        title,
        startDate,
        endDate,
        isCurrent,
        bullets: [],
      };
    } else if (isBullet && currentItem) {
      const cleanBullet = line.replace(/^[-•*·▪◦\d.]+\s*/, '').trim();
      if (cleanBullet) {
        currentItem.bullets = currentItem.bullets || [];
        currentItem.bullets.push(cleanBullet);
      }
    } else if (currentItem) {
      if (currentItem.bullets && currentItem.bullets.length > 0) {
        currentItem.bullets[currentItem.bullets.length - 1] += ' ' + line;
      } else {
        if (!currentItem.title || currentItem.title === 'Software Engineer') {
          const split = splitTitleAndCompany(line);
          currentItem.title = split.title;
          if (split.company !== 'Company') {
            currentItem.company = split.company;
          }
        } else {
          currentItem.bullets = [line];
        }
      }
    }
  }

  // Flush last item
  if (currentItem && (currentItem.company || currentItem.title)) {
    items.push({
      id: 'exp_' + items.length,
      company: currentItem.company || 'Company',
      title: currentItem.title || 'Role',
      startDate: currentItem.startDate,
      endDate: currentItem.endDate,
      isCurrent: currentItem.isCurrent || false,
      bullets: currentItem.bullets || [],
    });
  }

  if (items.length === 0 && lines.length > 0) {
    const bullets = lines.filter((l) => /^[-•*·▪◦]/.test(l)).map((l) => l.replace(/^[-•*·▪◦\d.]+\s*/, '').trim());
    items.push({
      id: 'exp_0',
      company: 'Experience Record',
      title: lines[0] || 'Role',
      bullets: bullets.length > 0 ? bullets : lines,
    });
  }

  return items;
}

/**
 * Parses education section lines into structured items
 */
export function parseEducation(lines: string[]): EducationItem[] {
  const items: EducationItem[] = [];
  const degreeRegex = /(?:bachelor(?:\s+of\s+[a-zA-Z\s]+)?|master(?:\s+of\s+[a-zA-Z\s]+)?|b\.?s\.?|m\.?s\.?|b\.?a\.?|ph\.?d\.?|associate|doctorate|degree|b\.?tech)/i;
  const yearRegex = /\b(19\d{2}|20\d{2})\b/;

  let current: Partial<EducationItem> | null = null;

  for (const line of lines) {
    const isInstitution = line.includes('University') || line.includes('College') || line.includes('Institute') || line.includes('School');
    const degMatch = line.match(degreeRegex);
    const yrMatch = line.match(yearRegex);

    if (isInstitution) {
      if (current && current.institution) {
        items.push({
          id: 'edu_' + items.length,
          institution: current.institution,
          degree: current.degree,
          fieldOfStudy: current.fieldOfStudy,
          graduationYear: current.graduationYear,
        });
      }
      current = {
        institution: line.trim(),
        degree: degMatch ? degMatch[0] : undefined,
        graduationYear: yrMatch ? yrMatch[0] : undefined,
      };
    } else if (current) {
      if (degMatch && !current.degree) {
        current.degree = line.trim();
      }
      if (yrMatch && !current.graduationYear) {
        current.graduationYear = yrMatch[0];
      }
    } else {
      current = {
        institution: line.trim(),
        degree: degMatch ? degMatch[0] : undefined,
        graduationYear: yrMatch ? yrMatch[0] : undefined,
      };
    }
  }

  if (current && current.institution) {
    items.push({
      id: 'edu_' + items.length,
      institution: current.institution,
      degree: current.degree,
      fieldOfStudy: current.fieldOfStudy,
      graduationYear: current.graduationYear,
    });
  }

  return items;
}

/**
 * Parses raw text into fully structured ResumeSections
 */
export function extractResumeSections(rawText: string): ResumeSections {
  const blocks = splitIntoSectionBlocks(rawText);

  // Extract contact
  const contact = extractContactInfo(rawText);

  // Extract summary
  const summary = (blocks.summary || []).join(' ').trim();

  // Extract experience
  const experience = parseExperience(blocks.experience || []);

  // Extract education
  const education = parseEducation(blocks.education || []);

  // Extract skills (combine skills section with dictionary search)
  const skillsSectionText = (blocks.skills || []).join(' ');
  const recognizedSkills = extractSkillsFromText(rawText);
  
  const customSkills = skillsSectionText
    .split(/[,•|·/]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1 && s.length < 35 && !s.includes(':'));

  const allSkills = Array.from(new Set([...recognizedSkills, ...customSkills.map((s) => s.toLowerCase())]));

  // Extract projects
  const projects: ProjectItem[] = [];
  if (blocks.projects && blocks.projects.length > 0) {
    projects.push({
      id: 'proj_0',
      name: blocks.projects[0] || 'Key Project',
      description: blocks.projects.slice(1).join(' '),
      technologies: extractSkillsFromText(blocks.projects.join(' ')),
    });
  }

  return {
    contact,
    summary,
    experience,
    education,
    skills: allSkills,
    projects,
    certifications: blocks.certifications || [],
  };
}
