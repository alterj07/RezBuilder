/**
 * Fixed lexicon of "drive" themes used by the story factor of Best Fit %.
 *
 * Both the posting text and the user's free-text drives/summary are mapped
 * onto the same theme ids so they can be compared without an LLM.
 */

export type ThemeId =
  | 'impact'
  | 'mission'
  | 'growth'
  | 'mentorship'
  | 'autonomy'
  | 'fast_paced'
  | 'stability'
  | 'innovation'
  | 'collaboration'
  | 'customer_focus'
  | 'craftsmanship'
  | 'scale'
  | 'open_source'
  | 'remote_first'
  | 'leadership'
  | 'diversity';

export interface ThemeDefinition {
  id: ThemeId;
  label: string;
  /** Phrases (case-insensitive, whole-word) that signal the theme. */
  keywords: string[];
}

export const THEME_LEXICON: ThemeDefinition[] = [
  {
    id: 'impact',
    label: 'Impact',
    keywords: ['impact', 'impactful', 'make a difference', 'meaningful work', 'meaningful', 'real-world impact', 'move the needle', 'outcomes'],
  },
  {
    id: 'mission',
    label: 'Mission',
    keywords: ['mission', 'mission-driven', 'purpose', 'purpose-driven', 'social good', 'nonprofit', 'non-profit', 'change the world', 'public good', 'sustainability', 'climate', 'values-driven', 'do good'],
  },
  {
    id: 'growth',
    label: 'Growth & learning',
    keywords: ['growth', 'learning', 'learn and grow', 'professional development', 'career development', 'upskill', 'continuous learning', 'grow your career', 'growth opportunities', 'tuition reimbursement', 'learning budget', 'keep learning', 'grow'],
  },
  {
    id: 'mentorship',
    label: 'Mentorship',
    keywords: ['mentor', 'mentors', 'mentorship', 'mentoring', 'mentored', 'coaching', 'coach', 'guidance', 'apprenticeship', 'buddy program'],
  },
  {
    id: 'autonomy',
    label: 'Autonomy & ownership',
    keywords: ['autonomy', 'autonomous', 'ownership', 'own the', 'self-directed', 'self-starter', 'independently', 'end-to-end', 'take ownership', 'owner mindset', 'freedom', 'own projects'],
  },
  {
    id: 'fast_paced',
    label: 'Fast-paced / startup',
    keywords: ['fast-paced', 'fast paced', 'startup', 'start-up', 'startups', 'move fast', 'scrappy', 'hypergrowth', 'hyper-growth', 'high-growth', 'early-stage', 'early stage', 'seed stage', 'series a', 'series b', 'rapidly growing', 'dynamic environment', 'wear many hats', 'zero to one', '0 to 1', 'ship quickly', 'ship fast'],
  },
  {
    id: 'stability',
    label: 'Stability & balance',
    keywords: ['stability', 'stable', 'established', 'fortune 500', 'work-life balance', 'work/life balance', 'work life balance', 'long-term', 'job security', 'sustainable pace', 'predictable', 'well-funded', 'profitable', 'decades'],
  },
  {
    id: 'innovation',
    label: 'Innovation & research',
    keywords: ['innovation', 'innovative', 'innovate', 'research', 'cutting-edge', 'cutting edge', 'state-of-the-art', 'state of the art', 'r&d', 'novel', 'publish', 'publications', 'experiment', 'experimentation', 'prototype', 'frontier', 'breakthrough', 'pioneering'],
  },
  {
    id: 'collaboration',
    label: 'Collaboration',
    keywords: ['collaborate', 'collaboration', 'collaborative', 'teamwork', 'team player', 'cross-functional', 'cross functional', 'work closely with', 'partner with', 'pair programming', 'team-oriented', 'together'],
  },
  {
    id: 'customer_focus',
    label: 'Customer focus',
    keywords: ['customer', 'customers', 'customer-focused', 'customer obsession', 'customer-obsessed', 'user-centric', 'user experience', 'user needs', 'clients', 'client-facing', 'delight users', 'end users', 'users'],
  },
  {
    id: 'craftsmanship',
    label: 'Craftsmanship & quality',
    keywords: ['craftsmanship', 'craft', 'quality', 'clean code', 'best practices', 'well-tested', 'code quality', 'attention to detail', 'maintainable', 'reliability', 'robust', 'high standards', 'excellence', 'polish'],
  },
  {
    id: 'scale',
    label: 'Scale',
    keywords: ['scale', 'scalable', 'scalability', 'large-scale', 'large scale', 'high-throughput', 'millions of users', 'millions of', 'billions of', 'high availability', 'planet-scale', 'web-scale', 'at scale'],
  },
  {
    id: 'open_source',
    label: 'Open source',
    keywords: ['open source', 'open-source', 'oss', 'contribute to open', 'github contributions', 'open source contributions', 'maintainer', 'community-driven', 'public repositories'],
  },
  {
    id: 'remote_first',
    label: 'Remote-first',
    keywords: ['remote-first', 'remote first', 'fully remote', 'distributed team', 'work from anywhere', 'remote', 'async-first', 'asynchronous'],
  },
  {
    id: 'leadership',
    label: 'Leadership',
    keywords: ['leadership', 'lead a team', 'leading a team', 'lead the team', 'manage a team', 'technical leadership', 'people management', 'drive strategy', 'set direction', 'lead projects', 'team lead', 'leading', 'management'],
  },
  {
    id: 'diversity',
    label: 'Diversity & inclusion',
    keywords: ['diversity', 'inclusion', 'inclusive', 'belonging', 'underrepresented', 'dei', 'diverse team', 'equity'],
  },
];

const THEME_IDS = new Set<string>(THEME_LEXICON.map((t) => t.id));

function buildPhraseRegex(phrases: string[]): RegExp {
  const alternatives = phrases.map((p) =>
    p
      .toLowerCase()
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/[\s-]+/g, '[\\s-]+'),
  );
  return new RegExp(`(?:^|[^a-z0-9])(?:${alternatives.join('|')})(?=$|[^a-z0-9])`);
}

const THEME_PATTERNS: { id: ThemeId; regex: RegExp }[] = THEME_LEXICON.map((t) => ({
  id: t.id,
  regex: buildPhraseRegex(t.keywords),
}));

/** Theme ids signalled by free text, in lexicon order. */
export function extractThemesFromText(text: string): ThemeId[] {
  if (!text) return [];
  const lower = text.toLowerCase();
  const out: ThemeId[] = [];
  for (const { id, regex } of THEME_PATTERNS) {
    if (regex.test(lower)) out.push(id);
  }
  return out;
}

/**
 * Resolves the user's free-text drives (e.g. "fast-paced startup", "research",
 * "mentorship") plus their summary onto theme ids. Drive strings that already
 * equal a theme id (or its label) map directly.
 */
export function mapDrivesToThemes(drives: string[], summary: string): ThemeId[] {
  const ids = new Set<string>();
  const text = [...(drives || []), summary || ''].join('. ');
  for (const id of extractThemesFromText(text)) ids.add(id);
  for (const drive of drives || []) {
    const key = drive.trim().toLowerCase().replace(/[\s/-]+/g, '_');
    if (THEME_IDS.has(key)) ids.add(key);
  }
  return THEME_LEXICON.filter((t) => ids.has(t.id)).map((t) => t.id);
}

export function themeLabel(id: string): string {
  return THEME_LEXICON.find((t) => t.id === id)?.label || id;
}
