import { JobPosting } from '../../types/job';
import { Resume } from '../../types/resume';
import {
  InterviewPrepBriefing,
  CoreConceptItem,
  TechnicalQuestionItem,
  BehavioralQuestionItem,
  InterviewerQuestionItem,
} from '../../types/interview';
import { extractSkillsFromText } from '../../content/scrapers/keywordExtractor';

// Comprehensive technical knowledge base mapped by skill
const TECH_KNOWLEDGE_BASE: Record<
  string,
  {
    concept: string;
    explanation: string;
    category: string;
    question: string;
    talkingPoints: string[];
    keyTerms: string[];
  }
> = {
  react: {
    concept: 'React Rendering Lifecycle & State Architecture',
    explanation: 'Fundamental for building high-performance single-page applications and managing component reconciliation.',
    category: 'Frontend',
    question: 'How do you optimize rendering performance in a large-scale React application?',
    talkingPoints: [
      'Use memoization (useMemo, useCallback, React.memo) to prevent unnecessary child re-renders.',
      'Implement code-splitting with React.lazy and Suspense for dynamic route imports.',
      'Optimize state location to avoid top-level context churn and batch state updates.',
    ],
    keyTerms: ['Virtual DOM', 'Reconciliation', 'Fiber Architecture', 'Code Splitting', 'useMemo'],
  },
  typescript: {
    concept: 'TypeScript Type Safety & Generics',
    explanation: 'Guarantees compile-time safety and prevents runtime type errors across complex domain logic.',
    category: 'Architecture',
    question: 'Explain how you utilize advanced TypeScript features (Generics, Discriminated Unions, Mapped Types) in production.',
    talkingPoints: [
      'Use discriminated unions for exhaustiveness checking in state machines and reducers.',
      'Build reusable generic utilities (e.g. API client wrapper, event bus) with type constraints.',
      'Utilize mapped and conditional types (ReturnType, Pick, Omit) for type derivations.',
    ],
    keyTerms: ['Generics', 'Discriminated Unions', 'Mapped Types', 'Strict Mode', 'Type Narrowing'],
  },
  'node.js': {
    concept: 'Node.js Event Loop & Asynchronous I/O',
    explanation: 'Critical for architecting scalable, non-blocking network services and event-driven backends.',
    category: 'Backend',
    question: 'How does the Node.js Event Loop work, and how do you handle CPU-intensive tasks without blocking it?',
    talkingPoints: [
      'The event loop processes phases: Timers, Pending Callbacks, Poll (I/O), Check (setImmediate), Close.',
      'Offload heavy computation to Worker Threads, child processes, or background job queues (Redis/BullMQ).',
      'Leverage async streams for memory-efficient file and socket processing.',
    ],
    keyTerms: ['Event Loop', 'Libuv', 'Worker Threads', 'Non-blocking I/O', 'Streams'],
  },
  postgresql: {
    concept: 'PostgreSQL Relational Modeling, Indexing & Transactions',
    explanation: 'Essential for ACID compliance, complex relational queries, and resilient transactional storage.',
    category: 'Database',
    question: 'How do you diagnose and optimize a slow query in PostgreSQL, and how do you choose indexing strategies?',
    talkingPoints: [
      'Analyze query execution plans using EXPLAIN (ANALYZE, BUFFERS) to detect sequential scans.',
      'Apply appropriate index types (B-Tree, GIN for JSONB/arrays, BRIN for timeseries).',
      'Optimize connection pooling (PgBouncer) and transaction isolation levels to prevent lock contention.',
    ],
    keyTerms: ['EXPLAIN ANALYZE', 'B-Tree & GIN Indexes', 'ACID Transactions', 'PgBouncer', 'MVCC'],
  },
  docker: {
    concept: 'Containerization & Microservice Packaging',
    explanation: 'Standardizes environments from local development to production, eliminating configuration drift.',
    category: 'DevOps',
    question: 'What best practices do you follow to create secure, lightweight production Docker containers?',
    talkingPoints: [
      'Use multi-stage builds to produce minimal runtime images with minimal attack surface.',
      'Run containers as non-root users and pin base image digest hashes (e.g., Alpine/Distroless).',
      'Order Dockerfile layers from least to most frequently modified for optimal build caching.',
    ],
    keyTerms: ['Multi-Stage Builds', 'Layer Caching', 'Distroless Images', 'Non-root User', 'OCI Compliance'],
  },
  kubernetes: {
    concept: 'Kubernetes Container Orchestration & Scaling',
    explanation: 'Automates deployment, horizontal scaling, self-healing, and networking for distributed microservices.',
    category: 'DevOps',
    question: 'How do you architect high-availability Kubernetes deployments with zero-downtime rolling updates?',
    talkingPoints: [
      'Configure accurate Liveness and Readiness probes with pod anti-affinity across availability zones.',
      'Use Horizontal Pod Autoscalers (HPA) and Pod Disruption Budgets (PDB) to safeguard capacity.',
      'Implement Ingress controllers and Service Mesh for traffic management and mutual TLS.',
    ],
    keyTerms: ['Deployments & StatefulSets', 'HPA & PDB', 'Liveness/Readiness Probes', 'Ingress', 'Service Mesh'],
  },
  aws: {
    concept: 'Cloud Infrastructure & Managed Services',
    explanation: 'Powers resilient, fault-tolerant cloud architecture with auto-scaling compute, storage, and networking.',
    category: 'Cloud',
    question: 'How do you design a secure, cost-effective cloud architecture on AWS for a high-traffic service?',
    talkingPoints: [
      'Separate resources across private VPC subnets with NAT Gateways, IAM least-privilege roles, and KMS encryption.',
      'Use ALB/NLB with ECS/EKS auto-scaling and Aurora PostgreSQL with read replicas.',
      'Leverage CloudFront CDN and S3 for static assets, with CloudWatch/OpenSearch for telemetry.',
    ],
    keyTerms: ['VPC & Subnets', 'IAM Least Privilege', 'ALB & Auto-Scaling', 'Aurora Serverless', 'CloudFront'],
  },
  python: {
    concept: 'Python Async, Memory Management & Backend Frameworks',
    explanation: 'Widely used for rapid API development, data engineering pipelines, and automation scripting.',
    category: 'Backend',
    question: 'How do async frameworks like FastAPI compare to synchronous WSGI frameworks, and how do you manage concurrency in Python?',
    talkingPoints: [
      'FastAPI uses asyncio with an ASGI event loop (Uvicorn), allowing thousands of concurrent I/O connections.',
      'The Global Interpreter Lock (GIL) affects CPU-bound multi-threading; multiprocessing or C-extensions are needed for CPU parallelism.',
      'Use Pydantic for validation and structured serialization.',
    ],
    keyTerms: ['Asyncio', 'ASGI vs WSGI', 'GIL', 'FastAPI & Pydantic', 'Multiprocessing'],
  },
  go: {
    concept: 'Go Concurrency (Goroutines & Channels)',
    explanation: 'Enables high-throughput, low-latency microservices and distributed tooling with lightweight concurrency.',
    category: 'Backend',
    question: 'How do goroutines and channels work in Go, and how do you prevent goroutine leaks and race conditions?',
    talkingPoints: [
      'Goroutines are lightweight user-space threads managed by Go runtime scheduler (M:N model).',
      'Use Context (context.Context) with cancellation/timeouts to ensure child goroutines terminate cleanly.',
      'Use Go race detector (`go test -race`) and sync primitives (sync.Mutex, sync.WaitGroup) when appropriate.',
    ],
    keyTerms: ['Goroutines', 'Channels & Select', 'context.Context', 'Race Detector', 'GMP Scheduler'],
  },
  graphql: {
    concept: 'GraphQL Query Language & Schema Federation',
    explanation: 'Allows clients to query exact data shapes in a single round-trip, eliminating over-fetching.',
    category: 'Architecture',
    question: 'How do you resolve the N+1 problem in GraphQL resolvers, and how do you manage schema evolution?',
    talkingPoints: [
      'Use DataLoader to batch and cache database requests across resolver hierarchies.',
      'Design modular schemas using Apollo Federation or schema stitching for microservices.',
      'Implement query depth and complexity limits to safeguard backend services against abusive queries.',
    ],
    keyTerms: ['DataLoader (Batching)', 'N+1 Problem', 'Schema Federation', 'Query Complexity Analysis'],
  },
};

/**
 * Generates structured interview prep completely locally without external LLM dependencies
 */
export function generateLocalInterviewPrep(job: JobPosting, _resume?: Resume): InterviewPrepBriefing {
  const extractedSkills = Array.from(
    new Set([
      ...job.requiredSkills.map((s) => s.toLowerCase()),
      ...extractSkillsFromText(job.title + ' ' + job.description),
    ])
  );

  // 1. Role Synthesis
  const isSenior = /senior|lead|staff|principal|director/i.test(job.title);
  const isBackend = /backend|api|server|infrastructure|cloud|devops|data|platform/i.test(job.title + ' ' + job.description);
  const isFrontend = /frontend|ui|ux|web|react|mobile/i.test(job.title + ' ' + job.description);

  let roleFocus = 'building scalable software, engineering excellence, and rapid feature execution';
  if (isBackend && isSenior) {
    roleFocus = 'architectural robustness, system scalability, database performance, and distributed systems reliability';
  } else if (isFrontend && isSenior) {
    roleFocus = 'component architecture, rendering performance, user experience excellence, and design system scaling';
  } else if (isSenior) {
    roleFocus = 'technical leadership, cross-functional collaboration, system design, and mentoring junior engineers';
  }

  const roleSynthesis = `For this ${job.title} role at ${job.company}, the hiring team is heavily prioritizing ${roleFocus}. They are looking for someone who can translate product requirements into maintainable, high-impact technical solutions while maintaining strong engineering rigor.`;

  // 2. Core Concepts & Technologies
  const coreConcepts: CoreConceptItem[] = [];
  const technicalQuestions: TechnicalQuestionItem[] = [];

  for (const skill of extractedSkills) {
    const matchedKB = TECH_KNOWLEDGE_BASE[skill];
    if (matchedKB) {
      coreConcepts.push({
        concept: matchedKB.concept,
        explanation: matchedKB.explanation,
        category: matchedKB.category,
      });

      technicalQuestions.push({
        question: matchedKB.question,
        category: matchedKB.category,
        suggestedTalkingPoints: matchedKB.talkingPoints,
        keyTermsToMention: matchedKB.keyTerms,
      });
    }
  }

  // Fallback if few specific skills were matched
  if (coreConcepts.length < 3) {
    coreConcepts.push({
      concept: 'System Architecture & Modularity',
      explanation: 'Designing decoupled, testable components that scale smoothly with user growth.',
      category: 'Architecture',
    });
    coreConcepts.push({
      concept: 'CI/CD & Automated Testing',
      explanation: 'Ensuring seamless automated pipelines with high test coverage and rapid delivery cycles.',
      category: 'DevOps',
    });
  }

  if (technicalQuestions.length < 3) {
    technicalQuestions.push({
      question: `How would you architect an end-to-end solution for a core feature required by ${job.title}?`,
      category: 'System Design',
      suggestedTalkingPoints: [
        'Clarify functional and non-functional requirements (traffic scale, latency, data retention).',
        'Outline high-level API boundaries, database schemas, and caching layers.',
        'Discuss failure modes, monitoring, and horizontal scaling strategies.',
      ],
      keyTermsToMention: ['Scalability', 'Fault Tolerance', 'API Contracts', 'Observability'],
    });
  }

  // 3. Behavioral Questions (STAR)
  const behavioralQuestions: BehavioralQuestionItem[] = [
    {
      question: 'Tell me about a time you had to deliver a complex technical project with ambiguous requirements or tight deadlines.',
      targetedValue: 'Ownership & Ambiguity Navigation',
      starFrameworkTip: 'Situation: Highlight the uncertainty. Task: Break down what needed to happen. Action: Detail how you aligned stakeholders and iterated quickly. Result: State the delivered outcome and key metric.',
    },
    {
      question: 'Describe a situation where you had a strong technical disagreement with a teammate. How did you resolve it?',
      targetedValue: 'Constructive Collaboration & Communication',
      starFrameworkTip: 'Situation: Describe the architectural tradeoff. Task: Find the best path for the product. Action: Use data, prototypes, and respectful dialogue. Result: Successful team alignment without friction.',
    },
    {
      question: 'Can you share an example of a production bug or outage you investigated? How did you respond and prevent recurrence?',
      targetedValue: 'Operational Rigor & Blameless Postmortems',
      starFrameworkTip: 'Situation: Incident impact and urgency. Task: Lead containment and root cause analysis. Action: Implement telemetry and regression tests. Result: Long-term reliability enhancement.',
    },
  ];

  if (isSenior) {
    behavioralQuestions.push({
      question: 'How do you balance technical debt against urgent feature requests from product managers?',
      targetedValue: 'Pragmatic Leadership & Prioritization',
      starFrameworkTip: 'Explain how you quantify tech debt impact (velocity drag, risk) and negotiate dedicated sprint capacity alongside product roadmaps.',
    });
  }

  // 4. Questions to Ask Interviewer
  const questionsToAskInterviewer: InterviewerQuestionItem[] = [
    {
      question: 'What are the biggest technical or architectural bottlenecks the team is tackling over the next 6–12 months?',
      purpose: 'Demonstrates forward-thinking engineering focus and reveals realistic day-to-day challenges.',
    },
    {
      question: 'How does the engineering team balance rapid experimentation with code quality, testing, and system stability?',
      purpose: 'Uncovers team culture, deployment cadence, and operational maturity.',
    },
    {
      question: 'What does success look like for this role during the first 90 days?',
      purpose: 'Sets clear expectations and shows immediate alignment with team impact goals.',
    },
  ];

  return {
    id: 'prep_local_' + Date.now(),
    jobId: job.id,
    jobTitle: job.title,
    companyName: job.company,
    createdAt: new Date().toISOString(),
    roleSynthesis,
    coreConcepts: coreConcepts.slice(0, 6),
    technicalQuestions: technicalQuestions.slice(0, 6),
    behavioralQuestions,
    questionsToAskInterviewer,
  };
}
