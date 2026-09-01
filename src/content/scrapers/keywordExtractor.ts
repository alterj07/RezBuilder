// Common industry skills, languages, frameworks, tools, and certifications
export const SKILL_DICTIONARY: string[] = [
  // Programming Languages
  'javascript', 'typescript', 'python', 'java', 'c++', 'c#', 'golang', 'go', 'rust', 'ruby',
  'php', 'swift', 'kotlin', 'scala', 'r', 'dart', 'solidity', 'sql', 'bash', 'shell',
  
  // Frontend
  'react', 'react.js', 'react native', 'next.js', 'vue', 'vue.js', 'nuxt', 'angular', 'svelte',
  'tailwind', 'tailwind css', 'sass', 'css3', 'html5', 'redux', 'mobx', 'zustand', 'webpack',
  'vite', 'graphql', 'rest api', 'responsive design', 'web accessibility', 'wcag', 'storybook',
  
  // Backend & APIs
  'node.js', 'nodejs', 'express', 'nestjs', 'fastapi', 'django', 'flask', 'spring boot', 'ruby on rails',
  'asp.net', '.net', 'grpc', 'microservices', 'serverless', 'websocket', 'event-driven architecture',
  'rabbitmq', 'apache kafka', 'kafka', 'celery',
  
  // Databases & Storage
  'postgresql', 'postgres', 'mysql', 'mongodb', 'redis', 'elasticsearch', 'dynamodb',
  'cassandra', 'sqlite', 'snowflake', 'bigquery', 'oracle', 'prisma', 'typeorm', 'sqlalchemy',
  
  // Cloud & DevOps
  'aws', 'amazon web services', 'azure', 'gcp', 'google cloud', 'docker', 'kubernetes', 'k8s',
  'terraform', 'ansible', 'helm', 'ci/cd', 'github actions', 'gitlab ci', 'jenkins', 'argo cd',
  'prometheus', 'grafana', 'datadog', 'cloudformation', 'linux',
  
  // AI / ML / Data
  'machine learning', 'deep learning', 'llm', 'nlp', 'pytorch', 'tensorflow', 'keras', 'langchain',
  'scikit-learn', 'pandas', 'numpy', 'data pipelines', 'etl', 'airflow', 'spark', 'hadoop',
  
  // Testing & Quality
  'jest', 'vitest', 'cypress', 'playwright', 'selenium', 'mocha', 'chai', 'junit', 'pytest',
  'unit testing', 'integration testing', 'end-to-end testing', 'e2e', 'tdd', 'bdd',
  
  // Methodologies & Tools
  'agile', 'scrum', 'kanban', 'jira', 'confluence', 'git', 'github', 'gitlab', 'system design',
  'object-oriented programming', 'oop', 'distributed systems', 'security', 'oauth', 'jwt',
  'soc 2', 'gdpr', 'pci-dss'
];

/**
 * Normalizes text for keyword matching, handling periods/punctuation while preserving dotted tech names
 */
export function normalizeForMatching(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[;,!?"'()[\]{}|<>]/g, ' ')
    .replace(/\.(?=\s|$|[^a-z0-9])/gi, ' ')
    .replace(/\/(?!cd\b)/gi, ' ')
    .replace(/\s+/g, ' ');
}

/**
 * Extracts recognized keywords and skills from text using dictionary & regex heuristics
 */
export function extractSkillsFromText(text: string): string[] {
  if (!text) return [];
  const normalized = ` ${normalizeForMatching(text)} `;
  const matched = new Set<string>();

  for (const skill of SKILL_DICTIONARY) {
    const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?:^|[^a-zA-Z0-9#+.])${escaped}(?:$|[^a-zA-Z0-9#+.])`, 'i');
    if (regex.test(normalized)) {
      matched.add(skill);
    }
  }

  return Array.from(matched);
}

/**
 * Clean text from DOM elements by stripping excess whitespace and hidden characters
 */
export function cleanText(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
