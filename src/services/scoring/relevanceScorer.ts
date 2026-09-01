import { JobPosting } from '../../types/job';
import { Resume } from '../../types/resume';
import { RelevanceBreakdown } from '../../types/scoring';

/**
 * Extracts required years of experience from job posting text
 */
export function extractRequiredYearsFromJob(text: string): number | undefined {
  const match = text.match(/(\d+)\+?\s*(?:-\s*\d+)?\s*(?:years?|yrs?)(?:\s+of)?\s+experience/i);
  if (match && match[1]) {
    return parseInt(match[1], 10);
  }
  return undefined;
}

/**
 * Calculates approximate total years of experience from resume
 */
export function calculateTenureYearsFromResume(resume: Resume): number {
  // Check summary first (e.g. "7+ years of experience")
  const summaryMatch = resume.sections.summary?.match(/(\d+)\+?\s*years?/i);
  if (summaryMatch && summaryMatch[1]) {
    return parseInt(summaryMatch[1], 10);
  }

  // Calculate from experience date ranges
  let totalYears = 0;
  const currentYear = new Date().getFullYear();

  for (const exp of resume.sections.experience) {
    const startYearMatch = exp.startDate?.match(/\b(19\d{2}|20\d{2})\b/);
    const endYearMatch = exp.endDate?.match(/\b(19\d{2}|20\d{2})\b/);

    if (startYearMatch) {
      const startYear = parseInt(startYearMatch[1], 10);
      const endYear = exp.isCurrent || !endYearMatch ? currentYear : parseInt(endYearMatch[1], 10);
      const diff = Math.max(1, endYear - startYear);
      totalYears += diff;
    }
  }

  // If no dates, default based on number of experience entries
  if (totalYears === 0 && resume.sections.experience.length > 0) {
    totalYears = resume.sections.experience.length * 2;
  }

  return totalYears || 3;
}

/**
 * Evaluates candidate tenure, title alignment, and education fit
 */
export function calculateRelevance(job: JobPosting, resume: Resume): RelevanceBreakdown {
  const notes: string[] = [];
  const requiredYears = extractRequiredYearsFromJob(job.description);
  const candidateYears = calculateTenureYearsFromResume(resume);

  // 1. Tenure Score (40% of relevance)
  let tenureScore = 85;
  if (requiredYears !== undefined) {
    if (candidateYears >= requiredYears) {
      tenureScore = 100;
      notes.push(`Tenure Match: Candidate has ~${candidateYears} years experience (JD asks for ${requiredYears}+ years).`);
    } else if (candidateYears >= requiredYears - 1) {
      tenureScore = 75;
      notes.push(`Close Tenure: Candidate has ~${candidateYears} years (JD asks for ${requiredYears}+ years).`);
    } else {
      tenureScore = 50;
      notes.push(`Tenure Gap: Candidate has ~${candidateYears} years vs ${requiredYears}+ required.`);
    }
  } else {
    notes.push(`Candidate has ~${candidateYears} years of professional experience.`);
  }

  // 2. Title Seniority & Domain Match (40% of relevance)
  const jobTitleLower = job.title.toLowerCase();
  const resumeTitles = resume.sections.experience.map((e) => e.title.toLowerCase());
  let titleMatchScore = 70;

  const seniorityKeywords = ['senior', 'lead', 'staff', 'principal', 'junior', 'entry', 'director', 'manager', 'head'];
  const matchedSeniority = seniorityKeywords.filter((s) => jobTitleLower.includes(s));
  const resumeHasSeniority = seniorityKeywords.some((s) => resumeTitles.some((t) => t.includes(s) || resume.sections.summary.toLowerCase().includes(s)));

  if (matchedSeniority.length > 0) {
    if (resumeHasSeniority) {
      titleMatchScore = 100;
      notes.push(`Seniority Alignment: Role seniority level (${matchedSeniority.join(', ')}) matches candidate background.`);
    } else {
      titleMatchScore = 60;
      notes.push(`Role is targeted at ${matchedSeniority.join(', ')} level.`);
    }
  } else {
    titleMatchScore = 85;
  }

  // 3. Education Match (20% of relevance)
  let educationMatchScore = 90;
  const requiresDegree = /bachelor|master|phd|degree\s+in/i.test(job.description);
  const hasDegree = resume.sections.education.some((e) => e.degree || e.institution);

  if (requiresDegree && !hasDegree) {
    educationMatchScore = 60;
    notes.push('JD mentions degree requirement, but no formal degree is parsed.');
  } else if (hasDegree) {
    educationMatchScore = 100;
    notes.push('Education requirement fulfilled.');
  }

  const overallRelevance = Math.round(tenureScore * 0.4 + titleMatchScore * 0.4 + educationMatchScore * 0.2);

  return {
    score: Math.min(100, Math.max(0, overallRelevance)),
    tenureYearsInResume: candidateYears,
    tenureYearsRequired: requiredYears,
    titleMatchScore,
    educationMatchScore,
    notes,
  };
}
