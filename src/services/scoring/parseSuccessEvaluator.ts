import { Resume } from '../../types/resume';
import { ParseIssue } from '../../types/scoring';

/**
 * Evaluates parse cleanliness, date format consistency, and structural integrity
 */
export function evaluateParseSuccess(resume: Resume): {
  score: number;
  issues: ParseIssue[];
  cleanlinessRating: 'Excellent' | 'Good' | 'Fair' | 'Poor';
} {
  const issues: ParseIssue[] = [];
  let score = 100;

  const rawText = resume?.rawText || '';
  const sections = resume?.sections || ({} as any);

  // 1. Text length check
  if (rawText.length < 200) {
    score -= 40;
    issues.push({
      type: 'unknown_layout',
      severity: 'error',
      message: 'Resume contains very little text (<200 characters). Check for image-only PDF scans.',
    });
  }

  // 2. Section Header Extraction Success
  let detectedCount = 0;
  if (sections.summary) detectedCount++;
  if ((sections.experience || []).length > 0) detectedCount++;
  if ((sections.education || []).length > 0) detectedCount++;
  if ((sections.skills || []).length > 0) detectedCount++;

  if (detectedCount < 2) {
    score -= 30;
    issues.push({
      type: 'missing_header',
      severity: 'error',
      message: 'Standard section headers (Experience, Education, Skills) could not be identified.',
    });
  } else if (detectedCount < 3) {
    score -= 15;
    issues.push({
      type: 'missing_header',
      severity: 'warning',
      message: 'Some standard section headers are missing or use unconventional names.',
    });
  }

  // 3. Date Consistency in Experience
  const expList = sections.experience || [];
  if (expList.length > 0) {
    const dates = expList
      .map((e: any) => `${e?.startDate || ''} - ${e?.endDate || ''}`)
      .filter((d: string) => d.trim() !== '-');

    if (dates.length === 0) {
      score -= 20;
      issues.push({
        type: 'date_inconsistency',
        severity: 'warning',
        message: 'No standardized employment dates (e.g. Month YYYY or YYYY) were parsed in experience section.',
      });
    }
  }

  // 4. Broken characters / encoding artifacts
  const specialArtifacts = (rawText.match(/[\uFFFD\u0000-\u0008\u000B\u000C\u000E-\u001F]/g) || []).length;
  if (specialArtifacts > 5) {
    score -= 15;
    issues.push({
      type: 'special_characters',
      severity: 'warning',
      message: `Detected ${specialArtifacts} non-standard glyph/encoding artifacts. Prefer simple standard fonts.`,
    });
  }

  // 5. Experience bullets structured
  const totalBullets = expList.reduce((acc: number, exp: any) => acc + (exp?.bullets || []).length, 0);
  if (expList.length > 0 && totalBullets === 0) {
    score -= 15;
    issues.push({
      type: 'unstructured_bullet',
      severity: 'warning',
      message: 'Experience entries lack distinct bullet points, which hurts ATS readability.',
    });
  }

  const finalScore = Math.min(100, Math.max(0, Math.round(score)));

  let cleanlinessRating: 'Excellent' | 'Good' | 'Fair' | 'Poor' = 'Excellent';
  if (finalScore < 50) {
    cleanlinessRating = 'Poor';
  } else if (finalScore < 75) {
    cleanlinessRating = 'Fair';
  } else if (finalScore < 90) {
    cleanlinessRating = 'Good';
  }

  return {
    score: finalScore,
    issues,
    cleanlinessRating,
  };
}
