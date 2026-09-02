import { JobPosting } from '../../types/job';
import { Resume } from '../../types/resume';
import { KeywordMatchDetail } from '../../types/scoring';
import { extractSkillsFromText, normalizeForMatching } from '../../content/scrapers/keywordExtractor';

// Common technical synonyms
const SYNONYM_MAP: Record<string, string[]> = {
  'react': ['react.js', 'reactjs', 'react js'],
  'node.js': ['node', 'nodejs', 'node js'],
  'typescript': ['ts'],
  'javascript': ['js'],
  'postgresql': ['postgres', 'psql'],
  'kubernetes': ['k8s'],
  'amazon web services': ['aws'],
  'google cloud': ['gcp', 'google cloud platform'],
  'ci/cd': ['continuous integration', 'continuous deployment', 'cicd'],
  'golang': ['go'],
  'vue': ['vue.js', 'vuejs'],
  'next.js': ['nextjs', 'next'],
  'c#': ['csharp', '.net'],
};

/**
 * Checks if a target keyword or any of its synonyms is contained in the text
 */
export function isKeywordPresent(keyword: string, text: string): boolean {
  const normText = ` ${normalizeForMatching(text)} `;
  const normKw = keyword.toLowerCase();

  // Direct check
  const escaped = normKw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(?:^|[^a-zA-Z0-9#+.])${escaped}(?:$|[^a-zA-Z0-9#+.])`, 'i');
  if (regex.test(normText)) return true;

  // Synonyms check
  const synonyms = SYNONYM_MAP[normKw] || [];
  for (const syn of synonyms) {
    const synEscaped = syn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const synRegex = new RegExp(`(?:^|[^a-zA-Z0-9#+.])${synEscaped}(?:$|[^a-zA-Z0-9#+.])`, 'i');
    if (synRegex.test(normText)) return true;
  }

  // Reverse synonyms check
  for (const [canonical, syns] of Object.entries(SYNONYM_MAP)) {
    if (syns.includes(normKw)) {
      const canEscaped = canonical.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const canRegex = new RegExp(`(?:^|[^a-zA-Z0-9#+.])${canEscaped}(?:$|[^a-zA-Z0-9#+.])`, 'i');
      if (canRegex.test(normText)) return true;
    }
  }

  return false;
}

/**
 * Calculates keyword match details and score (0-100)
 */
export function calculateKeywordMatch(job: JobPosting, resume: Resume): {
  score: number;
  totalKeywords: number;
  matchedKeywords: number;
  missingKeywords: number;
  items: KeywordMatchDetail[];
} {
  // Extract all target keywords from Job Posting
  let jobKeywords = Array.from(new Set([...(job.requiredSkills || []), ...extractSkillsFromText((job.title || '') + ' ' + (job.description || ''))]));

  if (jobKeywords.length === 0) {
    // Fallback: extract prominent capitalized words/technical terms
    const words = (job.description || '').match(/\b[A-Z][a-zA-Z0-9+#.]{2,}\b/g) || [];
    jobKeywords = Array.from(new Set(words.slice(0, 10).map((w) => w.toLowerCase())));
  }

  if (jobKeywords.length === 0) {
    return {
      score: 100,
      totalKeywords: 0,
      matchedKeywords: 0,
      missingKeywords: 0,
      items: [],
    };
  }

  const items: KeywordMatchDetail[] = [];
  let matchCount = 0;

  // Prepare section texts for placement checking
  const titleText = (resume.sections?.experience || []).map((e) => e.title).join(' ');
  const experienceText = (resume.sections?.experience || []).map((e) => (e.bullets || []).join(' ')).join(' ');
  const summaryText = resume.sections?.summary || '';
  const skillsText = (resume.sections?.skills || []).join(' ');
  const allResumeText = `${resume.rawText || ''} ${skillsText}`;

  for (const kw of jobKeywords) {
    const found = isKeywordPresent(kw, allResumeText);
    const placements: ('title' | 'experience' | 'summary' | 'skills')[] = [];

    if (isKeywordPresent(kw, titleText)) placements.push('title');
    if (isKeywordPresent(kw, experienceText)) placements.push('experience');
    if (isKeywordPresent(kw, summaryText)) placements.push('summary');
    if (isKeywordPresent(kw, skillsText)) placements.push('skills');

    if (found) {
      matchCount++;
    }

    const kwEscaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    items.push({
      keyword: kw,
      foundInResume: found,
      frequencyInJob: ((job.description || '').match(new RegExp(kwEscaped, 'gi')) || []).length || 1,
      frequencyInResume: (allResumeText.match(new RegExp(kwEscaped, 'gi')) || []).length || (found ? 1 : 0),
      placements,
    });
  }

  // Calculate score (0-100) with slight non-linear curve for rewarding high coverage
  const ratio = matchCount / jobKeywords.length;
  const score = Math.min(100, Math.round(ratio * 100));

  return {
    score,
    totalKeywords: jobKeywords.length,
    matchedKeywords: matchCount,
    missingKeywords: jobKeywords.length - matchCount,
    items,
  };
}
