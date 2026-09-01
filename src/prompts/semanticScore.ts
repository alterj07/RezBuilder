import { JobPosting } from '../types/job';
import { Resume } from '../types/resume';

export const SEMANTIC_SCORE_SYSTEM_PROMPT = `
You are an expert AI Talent Acquisition Director and ATS Analyst.
Evaluate the semantic alignment, seniority match, and domain relevance between a candidate's resume and a target job posting.

Scoring Scale: 0 to 100
- 90-100: Exceptional fit across domain, stack, seniority, and scale.
- 75-89: Strong fit with minor skill/domain gaps that are easily learnable.
- 60-74: Moderate fit with several skill gaps or seniority mismatches.
- < 60: Low relevance or substantial domain mismatch.

OUTPUT FORMAT:
Return a JSON object matching this schema:
{
  "semanticScore": 88,
  "seniorityAlignment": "Seniority matches target role (Senior/Staff level)",
  "domainRelevance": "High relevance in distributed systems and backend infrastructure",
  "keyStrengths": [
    "Extensive hands-on experience with Node.js and PostgreSQL",
    "Led technical teams and architecture reviews"
  ],
  "criticalGaps": [
    "Lacks explicit Kubernetes cluster administration in production"
  ],
  "rationale": "Strong alignment with backend architecture requirements. Candidate has relevant years of experience and stack overlap."
}
`;

export function buildSemanticScorePrompt(job: JobPosting, resume: Resume): string {
  return `
TARGET JOB:
Title: ${job.title}
Company: ${job.company}
Description:
${job.description}

---

CANDIDATE RESUME:
Summary: ${resume.sections.summary}
Experience: ${JSON.stringify(resume.sections.experience)}
Skills: ${resume.sections.skills.join(', ')}

Please evaluate semantic fit and return the JSON object.
`;
}
