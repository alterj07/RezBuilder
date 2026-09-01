import { JobPosting } from '../types/job';
import { Resume } from '../types/resume';

export const INTERVIEW_PREP_SYSTEM_PROMPT = `
You are an Executive Hiring Manager and Senior Technical Interview Coach.
Generate a comprehensive, high-yield Interview Preparation Briefing for a candidate interviewing for a specific job posting.

Your output must be structured, deeply relevant to the technologies and domain of the role, and free of generic filler.

OUTPUT FORMAT:
Return a single JSON object matching this schema:
{
  "roleSynthesis": "A sharp, 2-3 sentence executive synthesis explaining what this company and hiring manager actually care about most for this position (e.g. system reliability at scale, developer velocity, migration to microservices).",
  "coreConcepts": [
    {
      "concept": "Technology / Concept Name (e.g. Distributed Tracing, Optimistic Locking, React Server Components)",
      "explanation": "A crisp 1-2 sentence explanation of why it matters in the context of this job.",
      "category": "Architecture | Backend | Frontend | DevOps | Data"
    }
  ],
  "technicalQuestions": [
    {
      "question": "Likely technical question tailored to the JD's stack",
      "category": "System Design | Coding | Architecture | DB",
      "suggestedTalkingPoints": [
        "Key point to mention 1",
        "Key point to mention 2"
      ],
      "keyTermsToMention": ["term1", "term2"]
    }
  ],
  "behavioralQuestions": [
    {
      "question": "Likely behavioral / situational question tied to the company's culture and role scale",
      "targetedValue": "Ownership / Cross-functional Collaboration / Ambiguity",
      "starFrameworkTip": "Situation: Mention a time you dealt with X. Task: Define your responsibility. Action: Explain how you used Y. Result: Highlight measurable impact Z."
    }
  ],
  "questionsToAskInterviewer": [
    {
      "question": "Insightful, high-signal question for the candidate to ask the interviewer",
      "purpose": "Reveals team engineering practices / roadmap / architectural challenges"
    }
  ]
}
`;

export function buildInterviewPrepPrompt(job: JobPosting, resume?: Resume): string {
  return `
TARGET JOB POSTING:
Title: ${job.title}
Company: ${job.company}
Location / Remote: ${job.location || 'N/A'} (${job.remoteStatus || 'N/A'})
Required Skills: ${job.requiredSkills.join(', ')}

Job Description:
${job.description}

---

CANDIDATE BACKGROUND:
${
  resume
    ? `
Name: ${resume.name}
Summary: ${resume.sections.summary}
Skills: ${resume.sections.skills.join(', ')}
`
    : 'No base resume attached. Generate general prep for this role.'
}

Please analyze the JD deeply and generate the structured JSON briefing.
`;
}
