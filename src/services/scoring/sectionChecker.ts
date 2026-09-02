import { Resume } from '../../types/resume';
import { SectionCheckItem } from '../../types/scoring';

/**
 * Checks completeness and structural quality of resume sections
 */
export function checkSectionCompleteness(resume: Resume): {
  score: number;
  items: SectionCheckItem[];
} {
  const items: SectionCheckItem[] = [];
  let totalScore = 0;
  const sections = resume?.sections || ({} as any);

  // 1. Contact Information (25 pts)
  const contact = sections.contact || {};
  let contactPts = 0;
  const contactFeedback: string[] = [];

  if (contact.email) {
    contactPts += 40;
  } else {
    contactFeedback.push('Missing email address');
  }

  if (contact.phone) {
    contactPts += 30;
  } else {
    contactFeedback.push('Missing phone number');
  }

  if (contact.name) {
    contactPts += 20;
  } else {
    contactFeedback.push('Missing candidate name');
  }

  if (contact.linkedin || contact.github || contact.location) {
    contactPts += 10;
  }

  const contactQuality = Math.min(100, contactPts);
  totalScore += contactQuality * 0.25;

  items.push({
    name: 'Contact Information',
    present: !!(contact.email || contact.phone),
    qualityScore: contactQuality,
    feedback: contactFeedback.length > 0 ? contactFeedback.join(', ') : 'Complete contact info (Name, Email, Phone)',
  });

  // 2. Work Experience & Dates (30 pts)
  const exp = sections.experience || [];
  let expQuality = 0;
  let expFeedback = '';

  if (exp.length > 0) {
    let hasDates = 0;
    let hasBullets = 0;
    let hasTitles = 0;

    exp.forEach((e: any) => {
      if (e?.startDate || e?.endDate) hasDates++;
      if (e?.bullets && e.bullets.length > 0) hasBullets++;
      if (e?.title && e.title !== 'Role') hasTitles++;
    });

    const dateRatio = hasDates / exp.length;
    const bulletRatio = hasBullets / exp.length;
    const titleRatio = hasTitles / exp.length;

    expQuality = Math.round((dateRatio * 40 + bulletRatio * 40 + titleRatio * 20));
    expFeedback = `${exp.length} experience position(s) with ${hasDates} date range(s) and bullet points.`;
  } else {
    expQuality = 0;
    expFeedback = 'Missing work experience section.';
  }

  totalScore += expQuality * 0.30;
  items.push({
    name: 'Work Experience',
    present: exp.length > 0,
    qualityScore: expQuality,
    feedback: expFeedback,
  });

  // 3. Education (15 pts)
  const edu = sections.education || [];
  let eduQuality = 0;
  let eduFeedback = '';

  if (edu.length > 0) {
    const hasDegree = edu.some((e: any) => e?.degree);
    const hasYear = edu.some((e: any) => e?.graduationYear);
    eduQuality = hasDegree && hasYear ? 100 : hasDegree || hasYear ? 80 : 60;
    eduFeedback = `${edu.length} education entry(s) detected.`;
  } else {
    eduQuality = 0;
    eduFeedback = 'No education background detected.';
  }

  totalScore += eduQuality * 0.15;
  items.push({
    name: 'Education',
    present: edu.length > 0,
    qualityScore: eduQuality,
    feedback: eduFeedback,
  });

  // 4. Skills List (15 pts)
  const skills = sections.skills || [];
  let skillsQuality = 0;
  let skillsFeedback = '';

  if (skills.length >= 10) {
    skillsQuality = 100;
    skillsFeedback = `${skills.length} technical skills & tools listed.`;
  } else if (skills.length >= 5) {
    skillsQuality = 80;
    skillsFeedback = `${skills.length} skills listed. Adding more relevant tools can improve ATS ranking.`;
  } else if (skills.length > 0) {
    skillsQuality = 50;
    skillsFeedback = `Only ${skills.length} skills found. Recommended to expand your skills section.`;
  } else {
    skillsQuality = 0;
    skillsFeedback = 'Missing dedicated skills section.';
  }

  totalScore += skillsQuality * 0.15;
  items.push({
    name: 'Skills Section',
    present: skills.length > 0,
    qualityScore: skillsQuality,
    feedback: skillsFeedback,
  });

  // 5. Professional Summary (15 pts)
  const summary = sections.summary || '';
  let summaryQuality = 0;
  let summaryFeedback = '';

  if (summary && summary.length > 100) {
    summaryQuality = 100;
    summaryFeedback = 'Well-structured executive/professional summary.';
  } else if (summary && summary.length > 30) {
    summaryQuality = 75;
    summaryFeedback = 'Brief summary. Consider expanding with key metrics and core domain expertise.';
  } else {
    summaryQuality = 30; // Not fatal, but beneficial
    summaryFeedback = 'Consider adding a 2-3 sentence Professional Summary at the top.';
  }

  totalScore += summaryQuality * 0.15;
  items.push({
    name: 'Professional Summary',
    present: !!summary && summary.length > 30,
    qualityScore: summaryQuality,
    feedback: summaryFeedback,
  });

  const finalScore = Math.min(100, Math.max(0, Math.round(totalScore)));

  return {
    score: finalScore,
    items,
  };
}
