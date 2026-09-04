/**
 * Skill-name normalisation shared by the fit engine.
 *
 * The keyword dictionary (`SKILL_DICTIONARY`) contains several spellings of
 * the same technology ("react" / "react.js", "postgres" / "postgresql"). The
 * engine works on one canonical lowercase id per technology and only turns
 * it back into a display label for user-facing evidence strings.
 */

const CANONICAL_MAP: Record<string, string> = {
  'react.js': 'react',
  reactjs: 'react',
  'react js': 'react',
  nodejs: 'node.js',
  node: 'node.js',
  'node js': 'node.js',
  k8s: 'kubernetes',
  postgres: 'postgresql',
  psql: 'postgresql',
  'amazon web services': 'aws',
  'google cloud': 'gcp',
  'google cloud platform': 'gcp',
  golang: 'go',
  'vue.js': 'vue',
  vuejs: 'vue',
  'tailwind css': 'tailwind',
  websockets: 'websocket',
  'apache kafka': 'kafka',
  e2e: 'end-to-end testing',
  oop: 'object-oriented programming',
  html5: 'html',
  css3: 'css',
  js: 'javascript',
  ts: 'typescript',
  nextjs: 'next.js',
  cicd: 'ci/cd',
  'continuous integration': 'ci/cd',
  'continuous deployment': 'ci/cd',
  csharp: 'c#',
  'scikit learn': 'scikit-learn',
  sklearn: 'scikit-learn',
  'ml': 'machine learning',
};

const DISPLAY_MAP: Record<string, string> = {
  aws: 'AWS',
  gcp: 'GCP',
  sql: 'SQL',
  nosql: 'NoSQL',
  'ci/cd': 'CI/CD',
  'node.js': 'Node.js',
  'next.js': 'Next.js',
  typescript: 'TypeScript',
  javascript: 'JavaScript',
  postgresql: 'PostgreSQL',
  mongodb: 'MongoDB',
  mysql: 'MySQL',
  graphql: 'GraphQL',
  nlp: 'NLP',
  llm: 'LLM',
  php: 'PHP',
  'c++': 'C++',
  'c#': 'C#',
  html: 'HTML',
  css: 'CSS',
  etl: 'ETL',
  tdd: 'TDD',
  bdd: 'BDD',
  jwt: 'JWT',
  oauth: 'OAuth',
  gdpr: 'GDPR',
  'pci-dss': 'PCI-DSS',
  'soc 2': 'SOC 2',
  cuda: 'CUDA',
  tensorrt: 'TensorRT',
  'rest api': 'REST API',
  wcag: 'WCAG',
  'asp.net': 'ASP.NET',
  '.net': '.NET',
  nestjs: 'NestJS',
  fastapi: 'FastAPI',
  pytorch: 'PyTorch',
  tensorflow: 'TensorFlow',
  numpy: 'NumPy',
  'scikit-learn': 'scikit-learn',
  langchain: 'LangChain',
  dynamodb: 'DynamoDB',
  bigquery: 'BigQuery',
  sqlite: 'SQLite',
  sqlalchemy: 'SQLAlchemy',
  typeorm: 'TypeORM',
  grpc: 'gRPC',
  rabbitmq: 'RabbitMQ',
  'github actions': 'GitHub Actions',
  github: 'GitHub',
  gitlab: 'GitLab',
  'gitlab ci': 'GitLab CI',
  'argo cd': 'Argo CD',
  cloudformation: 'CloudFormation',
  'object-oriented programming': 'Object-oriented programming',
  'end-to-end testing': 'End-to-end testing',
  'machine learning': 'Machine learning',
  'deep learning': 'Deep learning',
  ios: 'iOS',
  macos: 'macOS',
  junit: 'JUnit',
  'ruby on rails': 'Ruby on Rails',
  'spring boot': 'Spring Boot',
  mobx: 'MobX',
  'react native': 'React Native',
  'web accessibility': 'Web accessibility',
  'responsive design': 'Responsive design',
  'system design': 'System design',
  'distributed systems': 'Distributed systems',
  'event-driven architecture': 'Event-driven architecture',
  'data pipelines': 'Data pipelines',
  'unit testing': 'Unit testing',
  'integration testing': 'Integration testing',
};

/** Lowercase, trim, collapse whitespace and fold known aliases to one id. */
export function canonicalSkill(name: string): string {
  const key = (name || '').toLowerCase().trim().replace(/\s+/g, ' ');
  return CANONICAL_MAP[key] || key;
}

/** Human-readable label for a canonical skill id. */
export function displaySkill(id: string): string {
  const key = canonicalSkill(id);
  if (DISPLAY_MAP[key]) return DISPLAY_MAP[key];
  return key.replace(/(^|\s)([a-z])/g, (_m, sp: string, ch: string) => sp + ch.toUpperCase());
}

/**
 * Dictionary entries that are also ordinary English words. They only count
 * as a skill when the raw posting spells them capitalised as a standalone
 * word ("Go", "Rust", "Express") – "go to market" or "express interest" do not.
 */
const AMBIGUOUS_SKILLS = new Set([
  'go', 'r', 'express', 'dart', 'spark', 'shell', 'helm', 'chai', 'celery', 'flask', 'swift', 'rust', 'oracle',
]);

const GO_FOLLOWERS = /^(?:to|through|beyond|above|live|for|the|a|an|out|on|over|ahead|back|get|and|into|home|by|with|forward|further|from|in|up|down|deep|far|all|there|here|beyond)\b/i;

/** Returns true when an ambiguous dictionary word is genuinely used as a technology in `rawText`. */
export function isAmbiguousSkillConfirmed(skill: string, rawText: string): boolean {
  const id = canonicalSkill(skill);
  if (!AMBIGUOUS_SKILLS.has(id)) return true;
  if (id === 'go') {
    if (/\bGolang\b/i.test(rawText)) return true;
    const re = /(?:^|[^A-Za-z0-9])Go(?=[^A-Za-z0-9]|$)\s*([A-Za-z]+)?/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(rawText)) !== null) {
      const follower = m[1] || '';
      if (!follower || !GO_FOLLOWERS.test(follower)) return true;
    }
    return false;
  }
  if (id === 'r') {
    return /(?:^|[\s,(/])R(?=[\s,)/.;]|$)(?!\s*&)/.test(rawText) && !/\bR&D\b/.test(rawText);
  }
  const cap = id.charAt(0).toUpperCase() + id.slice(1);
  const re = new RegExp(`(?:^|[^A-Za-z0-9])${cap}(?=[^A-Za-z0-9]|$)`);
  return re.test(rawText);
}
