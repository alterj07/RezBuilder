import { CERTIFICATION_LEXICON } from './jobRequirements';
import { FactorContext, FactorOutcome, clamp } from './common';

/** Fraction of certifications named in the posting that the profile holds (fuzzy lexicon match). */
export function scoreCertifications(ctx: FactorContext): FactorOutcome {
  const { profile, reqs } = ctx;
  const mentioned = reqs.certificationsMentioned;
  if (mentioned.length === 0) return { score: 0, applicable: false, evidence: [], gaps: [] };

  const profileText = [
    ...(profile.certifications || []).map((c) => `${c.name} ${c.issuer || ''}`),
    ...(profile.skills || []).map((s) => s.name),
  ].join('\n');

  const held: string[] = [];
  const missing: string[] = [];
  for (const label of mentioned) {
    const def = CERTIFICATION_LEXICON.find((d) => d.label === label);
    const hit = def ? def.pattern.test(profileText) : false;
    const loose = !hit && (profile.certifications || []).some((c) => c.name.toLowerCase().includes(label.toLowerCase()));
    (hit || loose ? held : missing).push(label);
  }
  const ratio = held.length / mentioned.length;
  const score = clamp(Math.round(15 + 85 * ratio));
  const evidence = held.map((l) => `Holds ${l} certification (mentioned in posting)`);
  const gaps = missing.map((l) => `Consider the ${l} certification (mentioned in posting)`);
  return { score, applicable: true, evidence, gaps };
}
