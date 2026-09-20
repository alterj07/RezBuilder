/**
 * Opt-in model evaluation. Downloads the real zero-shot classifier (~87 MB,
 * cached under .cache/) and measures it against the hand-labelled gold set.
 *
 *   RUN_MODEL_EVAL=1 npx vitest run tests/model/
 *
 * Skipped in the normal suite so `npm test` stays offline and fast. Change the
 * model / label set / thresholds in labelset.ts only when this passes; use
 * tests/model/tuneLabelset.ts to compare candidates first.
 *
 * Scoring collapses kinds to what the fit engine consumes:
 * required | preferred | other (responsibilities/about/benefits/eeo → other).
 */
import { describe, it, expect } from 'vitest';
import path from 'path';
import { GOLD_SEGMENTS } from '../fixtures/goldSegments';

const RUN = !!process.env.RUN_MODEL_EVAL;

/**
 * Regression gates = what labelset v2 achieved on the initial 44-segment gold
 * set (acc 0.79, macro-F1 0.76, required-vs-preferred 0.78) minus a little
 * slack. They are a floor against regressions, not a quality target; the
 * required-vs-preferred split is still the weak stage and the deterministic
 * inline cues remain the primary signal for it.
 */
export const MIN_ACCURACY = 0.75;
export const MIN_MACRO_F1 = 0.7;
export const MIN_REQUIRED_VS_PREFERRED_ACCURACY = 0.72;

type Coarse = 'required' | 'preferred' | 'other';
const KINDS: Coarse[] = ['required', 'preferred', 'other'];
const coarse = (k: string): Coarse => (k === 'required' || k === 'preferred' ? k : 'other');

describe.skipIf(!RUN)('zero-shot section labeller — gold set evaluation', () => {
  it(
    'meets the regression gates',
    async () => {
      const { ZeroShotLabeller } = await import('../../src/services/labeller/zeroShotLabeller');
      const labeller = new ZeroShotLabeller({
        device: 'cpu',
        cacheDir: path.resolve(__dirname, '../../.cache/transformers'),
        onProgress: (p) => {
          if (p.status === 'progress' && p.total) process.stdout.write(`\r  ${p.file} ${Math.round((p.loaded / p.total) * 100)}%   `);
        },
      });

      const started = Date.now();
      const response = await labeller.label({
        segments: GOLD_SEGMENTS.map((g, i) => ({ id: String(i), text: g.text })),
      });
      const elapsed = Date.now() - started;

      const confusion: Record<string, Record<string, number>> = {};
      for (const a of KINDS) confusion[a] = Object.fromEntries(KINDS.map((b) => [b, 0]));
      const rows: string[] = [];
      GOLD_SEGMENTS.forEach((g, i) => {
        const got = response.kinds[String(i)];
        const gold = coarse(g.kind);
        const pred = coarse(got.kind);
        confusion[gold][pred] += 1;
        if (pred !== gold) rows.push(`  ✗ [${gold} → ${pred} (${got.kind}) @${got.confidence.toFixed(2)}] ${g.text.slice(0, 80)}`);
      });

      const f1s = KINDS.map((k) => {
        const tp = confusion[k][k];
        const fp = KINDS.reduce((s, o) => s + (o === k ? 0 : confusion[o][k]), 0);
        const fn = KINDS.reduce((s, o) => s + (o === k ? 0 : confusion[k][o]), 0);
        const p = tp + fp === 0 ? 0 : tp / (tp + fp);
        const r = tp + fn === 0 ? 0 : tp / (tp + fn);
        const f1 = p + r === 0 ? 0 : (2 * p * r) / (p + r);
        console.log(`  ${k.padEnd(10)} P=${p.toFixed(2)} R=${r.toFixed(2)} F1=${f1.toFixed(2)} (n=${tp + fn})`);
        return f1;
      });
      const macroF1 = f1s.reduce((a, b) => a + b, 0) / f1s.length;
      const accuracy = GOLD_SEGMENTS.filter((g, i) => coarse(response.kinds[String(i)].kind) === coarse(g.kind)).length / GOLD_SEGMENTS.length;

      const rp = GOLD_SEGMENTS.map((g, i) => ({ gold: coarse(g.kind), pred: coarse(response.kinds[String(i)].kind) })).filter(
        ({ gold }) => gold !== 'other',
      );
      const rpCorrect = rp.filter(({ gold, pred }) => gold === pred).length / rp.length;

      console.log(
        `\n  accuracy=${accuracy.toFixed(3)} macro-F1=${macroF1.toFixed(3)} required-vs-preferred=${rpCorrect.toFixed(3)}  ${elapsed} ms for ${GOLD_SEGMENTS.length} segments`,
      );
      if (rows.length) console.log('\n' + rows.join('\n'));

      expect(accuracy).toBeGreaterThanOrEqual(MIN_ACCURACY);
      expect(macroF1).toBeGreaterThanOrEqual(MIN_MACRO_F1);
      expect(rpCorrect).toBeGreaterThanOrEqual(MIN_REQUIRED_VS_PREFERRED_ACCURACY);
      await labeller.dispose();
    },
    10 * 60 * 1000,
  );
});
