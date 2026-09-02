import { Resume } from '../../types/resume';
import { ActionVerbRecommendation } from '../../types/scoring';

export const WEAK_VERB_MAP: Record<string, string> = {
  'was responsible for': 'Architected and delivered',
  'responsible for': 'Architected and delivered',
  'duties included': 'Spearheaded',
  'worked on': 'Engineered',
  'worked with': 'Collaborated with',
  'helped with': 'Spearheaded',
  'helped': 'Spearheaded',
  'assisted in': 'Collaborated on',
  'assisted with': 'Collaborated on',
  'assisted': 'Supported',
  'participated in': 'Contributed to',
  'participated': 'Contributed to',
  'looked after': 'Maintained and scaled',
  'talked to': 'Partnered with',
  'dealt with': 'Resolved and streamlined',
  'was involved in': 'Spearheaded',
  'handled': 'Managed and optimized',
  'made': 'Developed',
  'fixed': 'Resolved and optimized',
  'used': 'Leveraged',
  'changed': 'Modernized',
  'wrote': 'Authored and deployed',
  'built': 'Engineered',
  'tried': 'Piloted',
  'supported': 'Facilitated',
  'did': 'Executed',
};

/**
 * Strips leading bullet symbols, list numbering, and whitespace from a bullet line
 */
export function stripBulletPrefix(text: string): string {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/^[\s•\-\*\u2022\u2023\u25E6\u2043\u2219]+/, '')
    .replace(/^\d+[\.\)]\s*/, '')
    .trim();
}

/**
 * Scans resume experience & project bullet points for weak verbs and returns recommendations
 */
export function extractActionVerbRecommendations(resume: Resume): ActionVerbRecommendation[] {
  const recommendations: ActionVerbRecommendation[] = [];
  if (!resume || !resume.sections) return recommendations;

  // Sort weak verbs longest-first to match multi-word phrases before single words
  const entries = Object.entries(WEAK_VERB_MAP).sort((a, b) => b[0].length - a[0].length);

  const bulletsToScan: string[] = [];

  if (resume.sections.experience && Array.isArray(resume.sections.experience)) {
    for (const exp of resume.sections.experience) {
      if (Array.isArray(exp.bullets)) {
        for (const b of exp.bullets) {
          if (b && typeof b === 'string' && b.trim().length > 0) {
            bulletsToScan.push(b.trim());
          }
        }
      }
    }
  }

  if (resume.sections.projects && Array.isArray(resume.sections.projects)) {
    for (const proj of resume.sections.projects) {
      if (Array.isArray(proj.bullets)) {
        for (const b of proj.bullets) {
          if (b && typeof b === 'string' && b.trim().length > 0) {
            bulletsToScan.push(b.trim());
          }
        }
      }
    }
  }

  for (const rawBullet of bulletsToScan) {
    const cleaned = stripBulletPrefix(rawBullet);
    if (!cleaned) continue;
    const lowerCleaned = cleaned.toLowerCase();

    for (const [weakVerb, strongVerb] of entries) {
      const regex = new RegExp(`^\\b${weakVerb.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (regex.test(lowerCleaned)) {
        const matchedCurrent = cleaned.substring(0, weakVerb.length);
        const context = rawBullet.length > 80 ? rawBullet.substring(0, 80) + '...' : rawBullet;
        recommendations.push({
          current: matchedCurrent,
          suggested: strongVerb,
          context,
        });
        break; // Match one weak verb per bullet
      }
    }
  }

  return recommendations;
}
