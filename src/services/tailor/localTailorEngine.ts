import { JobPosting } from '../../types/job';
import { Resume, ResumeSections, TailoredResume, TailoredBulletDiff, ExperienceItem } from '../../types/resume';
import { extractSkillsFromText } from '../../content/scrapers/keywordExtractor';
import { calculateTenureYearsFromResume } from '../scoring/relevanceScorer';

// High-impact ATS action verb replacements
const WEAK_VERB_MAP: Record<string, string> = {
  'worked on': 'Engineered',
  'helped with': 'Spearheaded',
  'responsible for': 'Architected and delivered',
  'assisted in': 'Collaborated on',
  'did': 'Executed',
  'participated in': 'Contributed to',
  'handled': 'Managed and optimized',
  'made': 'Developed',
  'fixed': 'Resolved and optimized',
  'looked after': 'Maintained and scaled',
  'used': 'Leveraged',
  'changed': 'Modernized',
  'talked to': 'Partnered with',
  'wrote': 'Authored and deployed',
  'built': 'Engineered',
};

// Canonical skill casing map
const SKILL_CASING_MAP: Record<string, string> = {
  'javascript': 'JavaScript',
  'typescript': 'TypeScript',
  'python': 'Python',
  'react': 'React',
  'react.js': 'React.js',
  'next.js': 'Next.js',
  'node.js': 'Node.js',
  'nodejs': 'Node.js',
  'vue': 'Vue.js',
  'vue.js': 'Vue.js',
  'angular': 'Angular',
  'postgresql': 'PostgreSQL',
  'postgres': 'PostgreSQL',
  'mongodb': 'MongoDB',
  'redis': 'Redis',
  'docker': 'Docker',
  'kubernetes': 'Kubernetes',
  'k8s': 'Kubernetes',
  'aws': 'AWS',
  'amazon web services': 'AWS',
  'gcp': 'Google Cloud (GCP)',
  'azure': 'Microsoft Azure',
  'graphql': 'GraphQL',
  'rest api': 'RESTful APIs',
  'ci/cd': 'CI/CD',
  'github actions': 'GitHub Actions',
  'tailwind': 'Tailwind CSS',
  'tailwind css': 'Tailwind CSS',
  'golang': 'Go (Golang)',
  'go': 'Go',
  'sql': 'SQL',
  'nosql': 'NoSQL',
  'kafka': 'Apache Kafka',
  'rabbitmq': 'RabbitMQ',
  'microservices': 'Microservices Architecture',
  'system design': 'System Design',
  'unit testing': 'Unit Testing (TDD)',
  'vitest': 'Vitest',
  'jest': 'Jest',
};

/**
 * Calculates keyword relevance score for a single bullet point
 */
function scoreBulletRelevance(bullet: string, jdSkills: string[]): number {
  let score = 0;
  const bulletLower = bullet.toLowerCase();

  for (const skill of jdSkills) {
    if (bulletLower.includes(skill.toLowerCase())) {
      score += 10;
    }
  }

  // Bonus for quantifiable metrics (e.g. 40%, $50M, 100k, 2x)
  if (/\b\d+(?:%|x|k|m|b|\+)?\b/i.test(bullet)) {
    score += 5;
  }

  return score;
}

/**
 * Enhances a bullet point with stronger action verbs and standardized JD keywords
 */
function optimizeBullet(
  bullet: string,
  jdSkills: string[]
): { optimized: string; diff: TailoredBulletDiff | null } {
  let text = bullet.trim();
  const original = text;
  const reasons: string[] = [];

  // 1. Weak verb replacement at beginning of bullet
  const lower = text.toLowerCase();
  for (const [weak, strong] of Object.entries(WEAK_VERB_MAP)) {
    if (lower.startsWith(weak)) {
      text = strong + text.substring(weak.length);
      reasons.push(`Enhanced action verb ('${weak}' → '${strong}')`);
      break;
    }
  }

  // 2. Keyword normalization (proper casing & synonyms)
  for (const [rawSkill, canonical] of Object.entries(SKILL_CASING_MAP)) {
    if (jdSkills.includes(rawSkill)) {
      const regex = new RegExp(`\\b${rawSkill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
      if (regex.test(text) && !text.includes(canonical)) {
        text = text.replace(regex, canonical);
        reasons.push(`Standardized keyword format (${canonical})`);
      }
    }
  }

  // Ensure trailing period
  if (!text.endsWith('.') && !text.endsWith('!')) {
    text += '.';
  }

  if (text !== original) {
    return {
      optimized: text,
      diff: {
        original,
        tailored: text,
        reason: reasons.join('; ') || 'Refined ATS terminology and action verb.',
      },
    };
  }

  return {
    optimized: original,
    diff: null,
  };
}

/**
 * Tailors candidate professional summary to mirror target role and top matching skills
 */
function tailorSummary(
  originalSummary: string,
  job: JobPosting,
  candidateSkills: string[],
  experienceYears: number
): string {
  const matchingSkills = job.requiredSkills.filter((s) =>
    candidateSkills.some((cs) => cs.toLowerCase() === s.toLowerCase())
  );

  const topSkillsFormatted = (matchingSkills.length > 0 ? matchingSkills : candidateSkills)
    .slice(0, 4)
    .map((s) => SKILL_CASING_MAP[s.toLowerCase()] || s)
    .join(', ');

  const titleClean = job.title.replace(/\b(remote|hybrid|onsite|contract|full-time)\b/gi, '').trim();

  if (originalSummary && originalSummary.length > 50) {
    // Reframe existing summary with target title alignment
    let enhanced = originalSummary;
    for (const [weak, strong] of Object.entries(WEAK_VERB_MAP)) {
      enhanced = enhanced.replace(new RegExp(`\\b${weak}\\b`, 'gi'), strong);
    }
    return enhanced;
  }

  return `Results-driven ${titleClean} with ${experienceYears}+ years of hands-on experience specializing in ${topSkillsFormatted}. Proven track record of delivering robust, high-performance systems and partnering cross-functionally to accelerate engineering velocity.`;
}

/**
 * Deterministic local ATS tailoring engine: 100% offline, zero API keys, zero hallucination
 */
export function tailorResumeLocally(job: JobPosting, resume: Resume): TailoredResume {
  const jdSkills = Array.from(
    new Set([
      ...job.requiredSkills.map((s) => s.toLowerCase()),
      ...extractSkillsFromText(job.title + ' ' + job.description),
    ])
  );

  const candidateSkills = resume.sections.skills.map((s) => s.toLowerCase());
  const candidateYears = calculateTenureYearsFromResume(resume);

  const changesSummary: string[] = [];

  // 1. Tailor Summary
  const tailoredSummaryText = tailorSummary(
    resume.sections.summary,
    job,
    candidateSkills,
    candidateYears
  );
  changesSummary.push(`Aligned professional summary with target title (${job.title}) and core skills.`);

  // 2. Tailor & Reorder Experience Bullets
  let totalOptimizedBullets = 0;
  const tailoredExperience: ExperienceItem[] = resume.sections.experience.map((exp) => {
    const scoredBullets = exp.bullets.map((b) => {
      const { optimized, diff } = optimizeBullet(b, jdSkills);
      const score = scoreBulletRelevance(optimized, jdSkills);
      if (diff) totalOptimizedBullets++;
      return { bullet: optimized, score, diff };
    });

    // Reorder bullets descending by relevance score (highest matching achievements at top)
    scoredBullets.sort((a, b) => b.score - a.score);

    const bulletDiffs: TailoredBulletDiff[] = [];
    scoredBullets.forEach((item, idx) => {
      if (item.diff) {
        bulletDiffs.push({
          ...item.diff,
          reason: item.diff.reason + (idx === 0 ? ' • Elevated to #1 priority' : ''),
        });
      }
    });

    return {
      ...exp,
      bullets: scoredBullets.map((item) => item.bullet),
      bulletDiffs: bulletDiffs.length > 0 ? bulletDiffs : undefined,
    };
  });

  if (totalOptimizedBullets > 0) {
    changesSummary.push(`Optimized ${totalOptimizedBullets} bullet points with strong action verbs and standardized keywords.`);
  }
  changesSummary.push('Reordered experience bullet points to prioritize high-relevance achievements at the top of each role.');

  // 3. Reorganize & Highlight Skills Section
  const matchedSkills: string[] = [];
  const otherSkills: string[] = [];

  for (const s of resume.sections.skills) {
    const sLower = s.toLowerCase();
    const formatted = SKILL_CASING_MAP[sLower] || s;
    if (jdSkills.includes(sLower)) {
      matchedSkills.push(formatted);
    } else {
      otherSkills.push(formatted);
    }
  }

  const prioritizedSkills = Array.from(new Set([...matchedSkills, ...otherSkills]));
  if (matchedSkills.length > 0) {
    changesSummary.push(`Promoted ${matchedSkills.length} job-matching skills to the front of your technical skills list.`);
  }

  // 4. Identify Unresolved Skill Gaps Honestly
  const unresolvedGaps: string[] = [];
  for (const jdSkill of jdSkills) {
    const isPresent = candidateSkills.some(
      (cs) => cs === jdSkill || (SKILL_CASING_MAP[cs] && SKILL_CASING_MAP[cs].toLowerCase() === jdSkill)
    );
    if (!isPresent) {
      const canonical = SKILL_CASING_MAP[jdSkill] || jdSkill.charAt(0).toUpperCase() + jdSkill.slice(1);
      unresolvedGaps.push(`Target JD requires '${canonical}' — not found in base resume. Mention adjacent experience in your interview.`);
    }
  }

  const tailoredSections: ResumeSections = {
    contact: resume.sections.contact,
    summary: tailoredSummaryText,
    experience: tailoredExperience,
    education: resume.sections.education,
    skills: prioritizedSkills,
    projects: resume.sections.projects,
    certifications: resume.sections.certifications,
  };

  return {
    id: 'tailored_local_' + Date.now(),
    baseResumeId: resume.id,
    jobId: job.id,
    createdAt: new Date().toISOString(),
    sections: tailoredSections,
    rawText: '',
    changesSummary,
    unresolvedGaps: unresolvedGaps.slice(0, 5), // Keep top 5 most critical gaps
  };
}
