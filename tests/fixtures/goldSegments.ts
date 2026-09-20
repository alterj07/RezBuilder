/**
 * Hand-labelled posting segments for the opt-in model evaluation
 * (`RUN_MODEL_EVAL=1 npx vitest run tests/model/`). Each entry is a piece of
 * text the labeller might be asked to place — a heading with no regex match,
 * or a bullet from a headingless block — and the kind a human reader assigns.
 *
 * Add segments from postings you save; keep the kinds honest even when the
 * model gets them wrong, that is the point.
 */
import { JobSectionKind } from '../../src/types/job';

export interface GoldSegment {
  text: string;
  kind: Exclude<JobSectionKind, 'unknown'>;
  /** Where it came from, for triage. */
  source: string;
}

export const GOLD_SEGMENTS: GoldSegment[] = [
  // ---- required (headings the regexes miss + headingless bullets) ----
  { text: "You might be a fit if", kind: 'required', source: 'ashby' },
  { text: 'What you need to succeed', kind: 'required', source: 'greenhouse' },
  { text: "We'd love to hear from you if", kind: 'required', source: 'lever' },
  { text: 'Your experience', kind: 'required', source: 'workday' },
  { text: 'You have several years of experience operating production infrastructure and are fluent in Go', kind: 'required', source: 'headingless' },
  { text: 'Must be able to work on-site in Austin three days a week', kind: 'required', source: 'headingless' },
  { text: 'A degree in Computer Science or equivalent practical experience', kind: 'required', source: 'headingless' },
  { text: 'Fluency in written and spoken English', kind: 'required', source: 'headingless' },
  { text: '5+ years designing distributed systems at scale', kind: 'required', source: 'headingless' },
  { text: 'Strong grasp of SQL and relational data modelling', kind: 'required', source: 'headingless' },

  // ---- preferred ----
  { text: 'It would be great if you have used Pulumi or written Helm charts', kind: 'preferred', source: 'headingless' },
  { text: 'Even better if you have', kind: 'preferred', source: 'lever' },
  { text: 'Brownie points', kind: 'preferred', source: 'ashby' },
  { text: "Don't worry if you don't have all of these", kind: 'preferred', source: 'greenhouse' },
  { text: 'Prior experience in fintech is a nice bonus but not expected', kind: 'preferred', source: 'headingless' },
  { text: 'Familiarity with Rust or another systems language would help', kind: 'preferred', source: 'headingless' },
  { text: 'Exposure to observability tooling like Datadog or Grafana', kind: 'preferred', source: 'headingless' },
  { text: 'Contributions to open source projects', kind: 'preferred', source: 'headingless' },

  // ---- responsibilities ----
  { text: 'A day in the life', kind: 'responsibilities', source: 'workday' },
  { text: 'What success looks like', kind: 'responsibilities', source: 'ashby' },
  { text: 'You will design and run our Kubernetes clusters on GCP, own our Terraform modules, and keep our CI pipelines fast', kind: 'responsibilities', source: 'headingless' },
  { text: 'Partner with product managers to scope quarterly roadmaps', kind: 'responsibilities', source: 'headingless' },
  { text: 'Own the on-call rotation for the payments service', kind: 'responsibilities', source: 'headingless' },
  { text: 'Review code and mentor two junior engineers', kind: 'responsibilities', source: 'headingless' },
  { text: 'Translate Figma designs into accessible React components', kind: 'responsibilities', source: 'headingless' },

  // ---- about ----
  { text: 'Our story', kind: 'about', source: 'lever' },
  { text: 'Meet the team', kind: 'about', source: 'greenhouse' },
  { text: 'TinyCo is a five-person team building developer tooling for small businesses', kind: 'about', source: 'headingless' },
  { text: 'Founded in 2019, we serve over 4,000 clinics across North America', kind: 'about', source: 'headingless' },
  { text: 'We are backed by Sequoia and Index Ventures and recently closed our Series B', kind: 'about', source: 'headingless' },

  // ---- benefits ----
  { text: "What's in it for you", kind: 'benefits', source: 'workday' },
  { text: 'We offer remote work, a generous equipment budget and quarterly offsites', kind: 'benefits', source: 'headingless' },
  { text: 'Base pay $140,000 - $170,000 plus equity and a 401(k) match', kind: 'benefits', source: 'headingless' },
  { text: 'Unlimited PTO and a four-day work week every other week', kind: 'benefits', source: 'headingless' },
  { text: 'Comprehensive medical, dental and vision coverage for you and your dependents', kind: 'benefits', source: 'headingless' },

  // ---- eeo ----
  { text: 'Our commitment to inclusion', kind: 'eeo', source: 'greenhouse' },
  { text: 'We are an equal opportunity employer and value diversity at our company. We do not discriminate on the basis of race, religion, color, national origin, gender, sexual orientation, age, marital status, veteran status, or disability status', kind: 'eeo', source: 'headingless' },
  { text: 'If you need a reasonable accommodation during the application process, please let us know', kind: 'eeo', source: 'headingless' },
  { text: 'All qualified applicants will receive consideration for employment without regard to protected characteristics', kind: 'eeo', source: 'headingless' },

  // ---- other ----
  { text: 'Our interview process', kind: 'other', source: 'lever' },
  { text: 'How to apply', kind: 'other', source: 'greenhouse' },
  { text: 'Applications close on 31 October', kind: 'other', source: 'headingless' },
  { text: 'Please note this role is not eligible for relocation assistance', kind: 'other', source: 'headingless' },
];
