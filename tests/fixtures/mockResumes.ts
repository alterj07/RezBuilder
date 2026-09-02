import { Resume } from '../../src/types/resume';

/**
 * 1. Senior Fullstack & DevOps Engineer Resume
 * High match for Fullstack, Cloud, DevOps, and Backend roles.
 */
export const MOCK_SENIOR_FULLSTACK_RESUME: Resume = {
  id: 'res_senior_fullstack',
  name: 'Alex Rivera',
  tag: 'Senior Full Stack & Cloud Architect',
  fileName: 'alex_rivera_resume.pdf',
  fileType: 'pdf',
  uploadedAt: '2026-08-15T10:00:00.000Z',
  isDefault: true,
  rawText: `
    Alex Rivera
    alex.rivera@example.com | (555) 234-5678 | San Francisco, CA
    https://linkedin.com/in/alexrivera-dev | https://github.com/alexrivera

    Professional Summary
    Results-driven Senior Full Stack & Cloud Engineer with 8+ years of experience designing, scaling, and operating distributed systems and cloud infrastructure.

    Work Experience
    Lead Infrastructure & Backend Engineer — CloudScale Inc
    Jan 2021 - Present | San Francisco, CA
    • Architected microservices in Go, Node.js, and TypeScript serving 50M+ daily requests with 99.99% uptime.
    • Deployed and managed multi-region Kubernetes clusters with Terraform and GCP / AWS automation.
    • Engineered high-performance relational and caching layers using PostgreSQL, Redis, and Kafka.
    • Implemented automated CI/CD pipelines, Prometheus monitoring, and zero-downtime canary rollouts.

    Senior Software Engineer — Platform Dynamics
    Jun 2018 - Dec 2020 | San Jose, CA
    • Built customer-facing web applications using React, Next.js, TypeScript, and Tailwind CSS.
    • Containerized 30+ legacy services with Docker and streamlined deployments via GitHub Actions.
    • Designed RESTful APIs and GraphQL gateways for real-time payments processing.

    Software Engineer — WebTech Solutions
    Aug 2016 - May 2018 | Austin, TX
    • Developed responsive frontend interfaces with React and JavaScript.
    • Maintained backend endpoints in Node.js and PostgreSQL databases.

    Education
    University of California, Berkeley
    Bachelor of Science in Computer Science
    Graduated May 2016 | GPA: 3.8

    Technical Skills
    React, Next.js, TypeScript, JavaScript, Node.js, Go, Python, PostgreSQL, Redis, Kafka, Docker, Kubernetes, Terraform, AWS, GCP, CI/CD, GraphQL, REST API, System Design, Vitest, Jest

    Projects
    Distributed KV Store (Go, Raft Consensus, Docker)
    Cloud Deployment CLI (TypeScript, AWS SDK, Terraform)
  `,
  sections: {
    contact: {
      name: 'Alex Rivera',
      email: 'alex.rivera@example.com',
      phone: '(555) 234-5678',
      location: 'San Francisco, CA',
      linkedin: 'https://linkedin.com/in/alexrivera-dev',
      github: 'https://github.com/alexrivera',
      website: 'https://alexrivera.dev',
    },
    summary:
      'Results-driven Senior Full Stack & Cloud Engineer with 8+ years of experience designing, scaling, and operating distributed systems and cloud infrastructure.',
    experience: [
      {
        id: 'exp_sr_1',
        company: 'CloudScale Inc',
        title: 'Lead Infrastructure & Backend Engineer',
        startDate: 'Jan 2021',
        endDate: 'Present',
        isCurrent: true,
        location: 'San Francisco, CA',
        bullets: [
          'Architected microservices in Go, Node.js, and TypeScript serving 50M+ daily requests with 99.99% uptime.',
          'Deployed and managed multi-region Kubernetes clusters with Terraform and GCP / AWS automation.',
          'Engineered high-performance relational and caching layers using PostgreSQL, Redis, and Kafka.',
          'Implemented automated CI/CD pipelines, Prometheus monitoring, and zero-downtime canary rollouts.',
        ],
      },
      {
        id: 'exp_sr_2',
        company: 'Platform Dynamics',
        title: 'Senior Software Engineer',
        startDate: 'Jun 2018',
        endDate: 'Dec 2020',
        isCurrent: false,
        location: 'San Jose, CA',
        bullets: [
          'Built customer-facing web applications using React, Next.js, TypeScript, and Tailwind CSS.',
          'Containerized 30+ legacy services with Docker and streamlined deployments via GitHub Actions.',
          'Designed RESTful APIs and GraphQL gateways for real-time payments processing.',
        ],
      },
      {
        id: 'exp_sr_3',
        company: 'WebTech Solutions',
        title: 'Software Engineer',
        startDate: 'Aug 2016',
        endDate: 'May 2018',
        isCurrent: false,
        location: 'Austin, TX',
        bullets: [
          'Developed responsive frontend interfaces with React and JavaScript.',
          'Maintained backend endpoints in Node.js and PostgreSQL databases.',
        ],
      },
    ],
    education: [
      {
        id: 'edu_sr_1',
        institution: 'University of California, Berkeley',
        degree: 'Bachelor of Science',
        fieldOfStudy: 'Computer Science',
        graduationYear: '2016',
        gpa: '3.8',
        highlights: ['Dean’s Honors List', 'Tau Beta Pi Engineering Honor Society'],
      },
    ],
    skills: [
      'React',
      'Next.js',
      'TypeScript',
      'JavaScript',
      'Node.js',
      'Go',
      'Python',
      'PostgreSQL',
      'Redis',
      'Kafka',
      'Docker',
      'Kubernetes',
      'Terraform',
      'AWS',
      'GCP',
      'CI/CD',
      'GraphQL',
      'REST API',
      'System Design',
      'Vitest',
      'Jest',
    ],
    projects: [
      {
        id: 'proj_sr_1',
        name: 'Distributed KV Store',
        description: 'Fault-tolerant distributed key-value store implementing Raft consensus.',
        technologies: ['Go', 'Raft', 'Docker', 'gRPC'],
        link: 'https://github.com/alexrivera/raft-kv',
        bullets: ['Implemented leader election and log replication with sub-5ms latency.'],
      },
    ],
    certifications: ['AWS Certified Solutions Architect – Professional', 'Certified Kubernetes Administrator (CKA)'],
  },
};

/**
 * 2. Junior Frontend Developer Resume
 * Low to moderate match for senior roles; good for junior/entry frontend roles.
 */
export const MOCK_JUNIOR_FRONTEND_RESUME: Resume = {
  id: 'res_junior_frontend',
  name: 'Jordan Lee',
  tag: 'Junior Frontend Developer',
  fileName: 'jordan_lee_resume.pdf',
  fileType: 'pdf',
  uploadedAt: '2026-08-20T14:30:00.000Z',
  isDefault: false,
  rawText: `
    Jordan Lee
    jordan.lee@example.com | (555) 345-6789 | Austin, TX

    Work Experience
    Junior Web Developer — Startup Sprint
    Feb 2024 - Present
    • Built static landing pages using HTML, CSS, and basic JavaScript.
    • Assisted in maintaining React components.

    Education
    Austin Community College
    Associate Degree in Web Development, 2023

    Skills
    HTML, CSS, JavaScript, React, Git
  `,
  sections: {
    contact: {
      name: 'Jordan Lee',
      email: 'jordan.lee@example.com',
      phone: '(555) 345-6789',
      location: 'Austin, TX',
      github: 'https://github.com/jordanlee',
    },
    summary: 'Enthusiastic Junior Web Developer with 1 year of experience crafting accessible web pages.',
    experience: [
      {
        id: 'exp_jr_1',
        company: 'Startup Sprint',
        title: 'Junior Web Developer',
        startDate: 'Feb 2024',
        endDate: 'Present',
        isCurrent: true,
        bullets: [
          'Built static landing pages using HTML, CSS, and basic JavaScript.',
          'Assisted in maintaining React components.',
        ],
      },
    ],
    education: [
      {
        id: 'edu_jr_1',
        institution: 'Austin Community College',
        degree: 'Associate Degree in Web Development',
        graduationYear: '2023',
      },
    ],
    skills: ['HTML', 'CSS', 'JavaScript', 'React', 'Git'],
    projects: [],
  },
};

/**
 * 3. Machine Learning & AI Specialist Resume
 */
export const MOCK_SPECIALIST_ML_RESUME: Resume = {
  id: 'res_specialist_ml',
  name: 'Dr. Elena Rostova',
  tag: 'Staff AI/ML Research Engineer',
  fileName: 'elena_rostova_resume.pdf',
  fileType: 'pdf',
  uploadedAt: '2026-08-22T09:15:00.000Z',
  isDefault: false,
  rawText: `
    Dr. Elena Rostova
    elena.rostova@example.com | (555) 456-7890 | San Francisco, CA
    https://linkedin.com/in/elena-rostova | https://github.com/erostova

    Summary
    Staff AI/ML Researcher and Engineer with 7+ years of expertise in deep learning, LLM fine-tuning, PyTorch, CUDA, and distributed GPU training.

    Experience
    Staff ML Engineer — Frontier AI Labs
    Jan 2022 - Present
    • Spearheaded pre-training and fine-tuning of 70B parameter LLM models using PyTorch, CUDA, and DeepSpeed.
    • Engineered reinforcement learning from human feedback (RLHF) pipelines reducing inference latency by 45%.
    • Authored GPU kernel optimizations in C++ and CUDA for distributed transformer training.

    Research Scientist — Neural Systems
    Sep 2019 - Dec 2021
    • Developed computer vision and NLP models using PyTorch, TensorFlow, and Python.

    Education
    Stanford University — Ph.D. in Computer Science (Machine Learning), 2019

    Skills
    Python, PyTorch, CUDA, LLM, Machine Learning, Reinforcement Learning, Deep Learning, C++, Distributed Systems, AWS, Docker
  `,
  sections: {
    contact: {
      name: 'Dr. Elena Rostova',
      email: 'elena.rostova@example.com',
      phone: '(555) 456-7890',
      location: 'San Francisco, CA',
      linkedin: 'https://linkedin.com/in/elena-rostova',
      github: 'https://github.com/erostova',
    },
    summary:
      'Staff AI/ML Researcher and Engineer with 7+ years of expertise in deep learning, LLM fine-tuning, PyTorch, CUDA, and distributed GPU training.',
    experience: [
      {
        id: 'exp_ml_1',
        company: 'Frontier AI Labs',
        title: 'Staff ML Engineer',
        startDate: 'Jan 2022',
        endDate: 'Present',
        isCurrent: true,
        bullets: [
          'Spearheaded pre-training and fine-tuning of 70B parameter LLM models using PyTorch, CUDA, and DeepSpeed.',
          'Engineered reinforcement learning from human feedback (RLHF) pipelines reducing inference latency by 45%.',
          'Authored GPU kernel optimizations in C++ and CUDA for distributed transformer training.',
        ],
      },
      {
        id: 'exp_ml_2',
        company: 'Neural Systems',
        title: 'Research Scientist',
        startDate: 'Sep 2019',
        endDate: 'Dec 2021',
        isCurrent: false,
        bullets: [
          'Developed computer vision and NLP models using PyTorch, TensorFlow, and Python.',
        ],
      },
    ],
    education: [
      {
        id: 'edu_ml_1',
        institution: 'Stanford University',
        degree: 'Ph.D. in Computer Science (Machine Learning)',
        graduationYear: '2019',
      },
    ],
    skills: [
      'Python',
      'PyTorch',
      'CUDA',
      'LLM',
      'Machine Learning',
      'Reinforcement Learning',
      'Deep Learning',
      'C++',
      'Distributed Systems',
      'AWS',
      'Docker',
    ],
    projects: [],
  },
};

/**
 * 4. Senior Product Manager Resume
 */
export const MOCK_PRODUCT_MANAGER_RESUME: Resume = {
  id: 'res_product_manager',
  name: 'Morgan Vance',
  tag: 'Senior Product Manager',
  fileName: 'morgan_vance_resume.pdf',
  fileType: 'pdf',
  uploadedAt: '2026-08-25T11:20:00.000Z',
  isDefault: false,
  rawText: `
    Morgan Vance
    morgan.vance@example.com | (555) 567-8901 | Austin, TX
    https://linkedin.com/in/morgan-vance

    Summary
    Senior Product Manager with 6+ years driving product strategy, agile sprint delivery, SQL data analysis, and user research.

    Experience
    Senior Product Manager — SaaS Metrics Co
    Mar 2021 - Present | Austin, TX
    • Managed product roadmaps for enterprise B2B SaaS platform using Agile, Scrum, and Jira.
    • Analyzed user cohorts and SQL data pipelines to increase conversion by 28%.
    • Conducted 100+ user research sessions and synthesized actionable UX insights.

    Product Manager — Growth Labs
    Jun 2018 - Feb 2021
    • Led cross-functional engineering and design sprints delivering mobile and web apps.

    Education
    UT Austin — B.B.A. in Management Information Systems, 2018

    Skills
    Agile, Jira, SQL, Product Strategy, User Research, Scrum, Analytics, Product Management
  `,
  sections: {
    contact: {
      name: 'Morgan Vance',
      email: 'morgan.vance@example.com',
      phone: '(555) 567-8901',
      location: 'Austin, TX',
      linkedin: 'https://linkedin.com/in/morgan-vance',
    },
    summary:
      'Senior Product Manager with 6+ years driving product strategy, agile sprint delivery, SQL data analysis, and user research.',
    experience: [
      {
        id: 'exp_pm_1',
        company: 'SaaS Metrics Co',
        title: 'Senior Product Manager',
        startDate: 'Mar 2021',
        endDate: 'Present',
        isCurrent: true,
        bullets: [
          'Managed product roadmaps for enterprise B2B SaaS platform using Agile, Scrum, and Jira.',
          'Analyzed user cohorts and SQL data pipelines to increase conversion by 28%.',
          'Conducted 100+ user research sessions and synthesized actionable UX insights.',
        ],
      },
    ],
    education: [
      {
        id: 'edu_pm_1',
        institution: 'UT Austin',
        degree: 'B.B.A. in Management Information Systems',
        graduationYear: '2018',
      },
    ],
    skills: ['Agile', 'Jira', 'SQL', 'Product Strategy', 'User Research', 'Scrum', 'Analytics', 'Product Management'],
    projects: [],
  },
};

/**
 * 5. Minimal Candidate Resume (Single Name, minimal fields)
 */
export const MOCK_MINIMAL_RESUME: Resume = {
  id: 'res_minimal',
  name: 'Cher',
  tag: 'Minimal Profile',
  fileName: 'minimal_resume.txt',
  fileType: 'text',
  uploadedAt: '2026-08-28T16:00:00.000Z',
  isDefault: false,
  rawText: 'Cher\ncher@example.com\nSkills: HTML, CSS',
  sections: {
    contact: {
      name: 'Cher',
      email: 'cher@example.com',
    },
    summary: '',
    experience: [],
    education: [],
    skills: ['html', 'css'],
    projects: [],
  },
};

/**
 * 6. Degenerate Empty Resume (all empty strings and empty arrays)
 */
export const MOCK_DEGENERATE_RESUME: Resume = {
  id: 'res_degenerate',
  name: '',
  tag: 'Degenerate',
  fileName: 'empty.pdf',
  fileType: 'pdf',
  uploadedAt: '2026-08-30T00:00:00.000Z',
  isDefault: false,
  rawText: '',
  sections: {
    contact: {},
    summary: '',
    experience: [],
    education: [],
    skills: [],
    projects: [],
  },
};
