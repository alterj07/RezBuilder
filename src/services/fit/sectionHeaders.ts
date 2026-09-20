/**
 * Shared vocabulary for recognising what a block of a job posting is about.
 * Used by the content-script structured extractor (to label DOM sections) and
 * by the requirements engine (to bucket free text), so the two cannot drift.
 * No DOM or chrome dependency — safe in every bundle and in tests.
 */
import { JobSectionKind } from '../../types/job';

export const NICE_HEADER = /\b(?:nice[- ]to[- ]haves?|preferred(?:\s+(?:qualifications?|skills?|experience|requirements?))?|bonus(?:\s+(?:points?|skills?|qualifications?))?|pluse?s|a\s+plus|great\s+to\s+have|good\s+to\s+have|desirable|advantageous|extra\s+credit|not\s+required\s+but|optional|additional\s+qualifications|would\s+be\s+(?:a\s+)?(?:plus|bonus|great)|it(?:'s|\s+is)\s+a\s+plus\s+if|stand\s+out\s+if)\b/i;

export const REQUIRED_HEADER = /\b(?:requirements?|qualifications?|must[- ]haves?|what\s+(?:you|you'll|you\s+will|we)\s+(?:need|bring|require|expect|are\s+looking\s+for|look\s+for)|what\s+we(?:'re|\s+are)\s+looking\s+for|who\s+you\s+are|required\s+skills|minimum|basic\s+qualifications|you\s+(?:have|bring|must|need|will\s+need|should\s+have)|skills\s+(?:&|and)\s+experience|your\s+(?:background|profile|experience)|essentials?|the\s+ideal\s+candidate|about\s+you|you'll\s+need|we\s+require|you\s+might\s+be\s+a\s+(?:good\s+|great\s+)?fit|we'd\s+love\s+to\s+hear\s+from\s+you\s+if)\b/i;

export const RESPONSIBILITIES_HEADER = /\b(?:responsibilities|what\s+you'll\s+do|what\s+you\s+will\s+do|your\s+(?:role|mission|impact)|day[- ]to[- ]day|in\s+this\s+role|you\s+will|duties|how\s+you'll\s+(?:contribute|make)|what\s+you'll\s+be\s+doing|key\s+accountabilities)\b/i;

export const ABOUT_HEADER = /\b(?:about\s+(?:us|the\s+(?:role|team|company|job|position))|^about\s+.{1,40}$|the\s+role|why\s+(?:join|us|work)|our\s+(?:stack|values|culture|mission|team)|overview|job\s+description|the\s+team|about\s+the|the\s+opportunity|who\s+we\s+are|company\s+description|position\s+summary|job\s+summary)\b/i;

export const BENEFITS_HEADER = /\b(?:benefits|perks|compensation|salary|what\s+we\s+offer|pay\s+(?:range|transparency)|total\s+rewards|what's\s+in\s+it\s+for\s+you)\b/i;

export const EEO_HEADER = /\b(?:equal\s+(?:opportunity|employment)|eeo|diversity(?:,?\s+equity)?(?:\s+(?:&|and)\s+inclusion)?|accommodations?|non-?discrimination)\b/i;

/** Union kept for callers that only need "not a qualifications block". */
export const OTHER_HEADER = new RegExp(
  [RESPONSIBILITIES_HEADER, ABOUT_HEADER, BENEFITS_HEADER, EEO_HEADER].map((r) => r.source).join('|'),
  'i',
);

export const NICE_INLINE = /\b(?:nice[- ]to[- ]have|preferred|bonus|(?:is|are|would\s+be)\s+(?:a\s+)?(?:big\s+|huge\s+|strong\s+)?plus|a\s+plus\b|great\s+to\s+have|good\s+to\s+have|desirable|advantageous|not\s+required|optional|familiarity\s+with|exposure\s+to|ideally|helpful\s+but)\b/i;

export const REQUIRED_STRONG_INLINE = /\b(?:required|must\s+have|must\s+be|mandatory|minimum\s+of|at\s+least|need\s+to\s+have|essential|prerequisite|requires?\b)/i;

const HEADING_MAX_CHARS = 70;
const HEADING_MAX_WORDS = 8;

/** Short, unpunctuated line that could be a section heading. */
export function isHeadingLike(text: string): boolean {
  const t = text.trim();
  if (!t || t.length > HEADING_MAX_CHARS) return false;
  if (t.split(/\s+/).filter(Boolean).length > HEADING_MAX_WORDS) return false;
  return !/[.;!?]$/.test(t);
}

/**
 * Maps a heading to a section kind. Nice-to-have wording wins over required
 * wording ("Preferred Qualifications" contains "qualifications").
 */
export function classifyHeading(text: string): JobSectionKind {
  const t = text.trim();
  if (!t) return 'unknown';
  if (NICE_HEADER.test(t)) return 'preferred';
  if (REQUIRED_HEADER.test(t)) return 'required';
  if (RESPONSIBILITIES_HEADER.test(t)) return 'responsibilities';
  if (BENEFITS_HEADER.test(t)) return 'benefits';
  if (EEO_HEADER.test(t)) return 'eeo';
  if (ABOUT_HEADER.test(t)) return 'about';
  return 'unknown';
}
