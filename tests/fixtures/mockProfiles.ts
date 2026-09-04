import { JobPosting } from '../../src/types/job';
import { UserProfile, createEmptyProfile } from '../../src/types/profile';

const NOW = '2026-09-01T12:00:00.000Z';

function base(id: string): UserProfile {
  const p = createEmptyProfile(NOW);
  p.id = id;
  return p;
}

/**
 * 1. Strong senior fullstack engineer (~9 years, rated skills, AWS cert).
 */
export const MOCK_SENIOR_PROFILE: UserProfile = {
  ...base('profile_senior'),
  contact: { name: 'Alex Rivera', location: 'San Francisco, CA' },
  education: [
    {
      id: 'edu_1',
      institution: 'UC Berkeley',
      degreeLevel: 'bachelor',
      degree: 'B.S.',
      fieldOfStudy: 'Computer Science',
      status: 'graduated',
      graduationYear: 2016,
    },
  ],
  skills: [
    { id: 's1', name: 'TypeScript', rating: 5 },
    { id: 's2', name: 'Node.js', rating: 5 },
    { id: 's3', name: 'React', rating: 4 },
    { id: 's4', name: 'PostgreSQL', rating: 5 },
    { id: 's5', name: 'Kubernetes', rating: 4 },
    { id: 's6', name: 'AWS', rating: 5 },
    { id: 's7', name: 'Docker', rating: 5 },
    { id: 's8', name: 'Go', rating: 3 },
    { id: 's9', name: 'Kafka', rating: 3 },
    { id: 's10', name: 'Terraform', rating: 4 },
    { id: 's11', name: 'GraphQL', rating: 3 },
    { id: 's12', name: 'Python', rating: 3 },
  ],
  experiences: [
    {
      id: 'exp_1',
      company: 'CloudScale Inc',
      title: 'Lead Backend Engineer',
      type: 'full_time',
      startDate: '2021-01',
      isCurrent: true,
      bullets: [
        'Architected microservices in Go, Node.js and TypeScript serving 50M+ daily requests.',
        'Deployed multi-region Kubernetes clusters with Terraform on AWS.',
        'Owned PostgreSQL and Redis data layers; introduced Kafka event streaming.',
        'Mentored four engineers and led the platform team.',
      ],
      skillsUsed: ['Go', 'Node.js', 'TypeScript', 'Kubernetes', 'Terraform', 'AWS', 'PostgreSQL', 'Kafka'],
    },
    {
      id: 'exp_2',
      company: 'Platform Dynamics',
      title: 'Senior Software Engineer',
      type: 'full_time',
      startDate: '2018-06',
      endDate: '2020-12',
      bullets: [
        'Built customer-facing web apps with React, Next.js and TypeScript.',
        'Containerised 30+ services with Docker and GitHub Actions CI/CD.',
        'Designed REST and GraphQL APIs for payments.',
      ],
      skillsUsed: ['React', 'Next.js', 'Docker', 'GraphQL'],
    },
    {
      id: 'exp_3',
      company: 'WebTech Solutions',
      title: 'Software Engineer',
      type: 'full_time',
      startDate: '2016-08',
      endDate: '2018-05',
      bullets: ['Developed responsive frontends with React and JavaScript.', 'Maintained Node.js and PostgreSQL backends.'],
    },
  ],
  certifications: [{ id: 'cert_1', name: 'AWS Certified Solutions Architect – Associate', issuer: 'Amazon', issuedYear: 2022 }],
  story: {
    summary: 'Backend-leaning full stack engineer who loves building systems at scale, mentoring engineers and owning problems end-to-end.',
    drives: ['impact', 'scale', 'mentorship', 'ownership'],
    targetRoles: ['Senior Backend Engineer', 'Staff Software Engineer'],
    targetIndustries: ['fintech', 'developer tools'],
    remotePreference: 'remote',
    preferredLocations: ['San Francisco, CA', 'Remote'],
    employmentTypes: ['full_time'],
    authorizedToWork: true,
    needsSponsorship: false,
  },
  sources: [{ kind: 'manual', importedAt: NOW }],
};

/**
 * 2. CS student, class of 2027, four rated skills, one internship.
 */
export const MOCK_STUDENT_PROFILE: UserProfile = {
  ...base('profile_student'),
  contact: { name: 'Priya Natarajan', location: 'Austin, TX' },
  education: [
    {
      id: 'edu_s1',
      institution: 'UT Austin',
      degreeLevel: 'bachelor',
      degree: 'B.S.',
      fieldOfStudy: 'Computer Science',
      status: 'in_progress',
      graduationYear: 2027,
      graduationMonth: 5,
    },
  ],
  skills: [
    { id: 'ss1', name: 'Python', rating: 4 },
    { id: 'ss2', name: 'Java', rating: 3 },
    { id: 'ss3', name: 'React', rating: 2 },
    { id: 'ss4', name: 'SQL', rating: 3 },
  ],
  experiences: [
    {
      id: 'exp_s1',
      company: 'Campus Labs',
      title: 'Software Engineering Intern',
      type: 'internship',
      startDate: '2026-06',
      endDate: '2026-08',
      bullets: ['Built a Flask API in Python backed by PostgreSQL.', 'Wrote unit tests with pytest and set up GitHub Actions.'],
      skillsUsed: ['Python', 'PostgreSQL'],
    },
    {
      id: 'exp_s2',
      company: 'Personal',
      title: 'Course Scheduler (project)',
      type: 'project',
      startDate: '2026-01',
      endDate: '2026-04',
      bullets: ['React front end with a Java Spring Boot backend.'],
      skillsUsed: ['React', 'Java'],
    },
  ],
  certifications: [],
  story: {
    summary: 'Third-year CS student who wants to learn fast, ship real products and grow with great mentors.',
    drives: ['growth/learning', 'mentorship', 'impact'],
    targetRoles: ['Software Engineer Intern', 'Software Engineer'],
    targetIndustries: [],
    remotePreference: 'any',
    preferredLocations: ['Austin, TX', 'Seattle, WA'],
    employmentTypes: ['internship'],
    authorizedToWork: true,
    needsSponsorship: false,
  },
  sources: [{ kind: 'manual', importedAt: NOW }],
};

/**
 * 3. Minimal / empty profile — one skill, nothing else.
 */
export const MOCK_EMPTY_PROFILE: UserProfile = {
  ...base('profile_empty'),
  contact: { name: 'Sam' },
  skills: [{ id: 'e1', name: 'Excel', rating: 2 }],
};

// ---------------------------------------------------------------------------
// Job postings
// ---------------------------------------------------------------------------

const SCRAPED = '2026-09-01T12:00:00.000Z';

function job(partial: Partial<JobPosting> & Pick<JobPosting, 'id' | 'title' | 'description'>): JobPosting {
  return {
    company: 'Acme',
    requiredSkills: [],
    url: `https://jobs.example.com/${partial.id}`,
    source: 'generic',
    scrapedAt: SCRAPED,
    ...partial,
  };
}

export const MOCK_SENIOR_BACKEND_JOB: JobPosting = job({
  id: 'job_senior_backend',
  title: 'Senior Backend Engineer',
  company: 'Ledgerly',
  location: 'San Francisco, CA',
  remoteStatus: 'Remote',
  description: `About Ledgerly
Ledgerly is a fintech company building payment infrastructure at scale for millions of users. We are a collaborative, remote-first team that values ownership, mentorship and real-world impact.

What you'll do
- Design and operate high-throughput services that process billions of transactions.
- Own services end-to-end, from design to production reliability.
- Mentor engineers and lead technical design reviews.

Requirements
- 5+ years of experience building backend systems.
- Strong proficiency in TypeScript and Node.js.
- Production experience with PostgreSQL and Kubernetes.
- Experience with AWS and Docker.
- Bachelor's degree in Computer Science or a related field, or equivalent experience.

Nice to have
- Experience with Kafka or other streaming systems.
- Familiarity with GraphQL.
- Terraform or other infrastructure-as-code tooling is a plus.
- AWS certification is a plus.

Full-time. We are an equal opportunity employer and value diversity and inclusion.`,
  requiredSkills: ['typescript', 'node.js', 'postgresql', 'kubernetes', 'aws', 'docker', 'kafka', 'graphql', 'terraform'],
});

export const MOCK_INTERNSHIP_JOB: JobPosting = job({
  id: 'job_intern_2027',
  title: 'Software Engineer Intern (Summer 2027)',
  company: 'Northwind Labs',
  location: 'Austin, TX',
  remoteStatus: 'Hybrid',
  description: `Join Northwind Labs for Summer 2027! Our internship program pairs every intern with a mentor and gives you real ownership of a project that ships to customers. You will learn fast, grow your skills and collaborate with a cross-functional team.

What you'll do
- Build features across our React front end and Python services.
- Write tests and participate in code reviews.

Qualifications
- Currently pursuing a Bachelor's or Master's degree in Computer Science, Computer Engineering or a related field.
- Graduating between Dec 2026 and Jun 2027.
- Proficiency in Python or Java.
- Familiarity with SQL and Git.

Nice to have
- Exposure to React or another modern front-end framework.
- Experience with Docker.

This is a paid, full-time 12-week internship based in Austin, TX (hybrid).`,
  requiredSkills: ['react', 'python', 'java', 'sql', 'git', 'docker'],
});

export const MOCK_CLEARANCE_JOB: JobPosting = job({
  id: 'job_clearance',
  title: 'Software Engineer',
  company: 'Defense Systems Corp',
  location: 'Arlington, VA',
  remoteStatus: 'On-site',
  description: `Defense Systems Corp is hiring a Software Engineer to support mission-critical programs.

Responsibilities
- Develop and maintain Java and Python services for our analytics platform.
- Collaborate with government customers on-site in Arlington, VA.

Requirements
- Active TS/SCI security clearance required.
- Must be a U.S. citizen.
- 3+ years of experience with Java or Python.
- Experience with PostgreSQL and Docker.
- Bachelor's degree in Computer Science or related field required.

We offer stability, excellent benefits and long-term career growth.`,
  requiredSkills: ['java', 'python', 'postgresql', 'docker'],
});

export const MOCK_NO_SPONSORSHIP_JOB: JobPosting = job({
  id: 'job_no_sponsorship',
  title: 'Backend Engineer',
  company: 'Shipfast',
  location: 'New York, NY',
  remoteStatus: 'Hybrid',
  description: `Shipfast is a fast-paced startup building logistics software.

What we're looking for
- 3+ years of experience with Node.js and TypeScript.
- Experience with PostgreSQL and AWS.
- Strong ownership and a bias for shipping quickly.

Please note: we are unable to sponsor visas for this position now or in the future. Candidates must be authorized to work in the United States without sponsorship.

Full-time, hybrid in New York.`,
  requiredSkills: ['node.js', 'typescript', 'postgresql', 'aws'],
});

export const MOCK_THIN_JOB: JobPosting = job({
  id: 'job_thin',
  title: 'Engineer',
  company: 'Mystery Co',
  description: 'We need an engineer. Apply now if you like building things fast.',
  requiredSkills: [],
});

export const MOCK_MASTERS_REQUIRED_JOB: JobPosting = job({
  id: 'job_masters',
  title: 'Machine Learning Engineer',
  company: 'Deepwell AI',
  location: 'Seattle, WA',
  description: `Deepwell AI builds state-of-the-art recommendation models.

Requirements
- Master's degree or PhD in Computer Science, Statistics or a related quantitative field is required.
- 2+ years of experience with PyTorch or TensorFlow.
- Strong Python skills.

Nice to have
- Publications at top ML conferences.`,
  requiredSkills: ['pytorch', 'tensorflow', 'python'],
});
