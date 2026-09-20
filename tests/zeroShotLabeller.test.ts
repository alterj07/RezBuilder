import { describe, it, expect } from 'vitest';
import { decideQualificationKind, labelSegments, toPageVerdict, ZeroShotOutput } from '../src/services/labeller/zeroShotLabeller';
import { STAGE1_LABELS, STAGE1_TEMPLATE, STAGE2_LABELS, STAGE2_TEMPLATE, PAGE_LABELS } from '../src/services/labeller/labelset';

const out = (labels: string[], scores: number[]): ZeroShotOutput => ({ sequence: '', labels, scores });
const QUAL = STAGE1_LABELS[0].label;
const DUTY = STAGE1_LABELS[1].label;
const COMPANY = STAGE1_LABELS[2].label;

describe('labelSegments (two-stage, fake classifier)', () => {
  it('runs stage 2 only for qualifications and honours regex hedges over the model', async () => {
    const calls: { texts: string[]; template: string }[] = [];
    const classifier = async (texts: string | string[], labels: string[], opts: { hypothesis_template: string }) => {
      const arr = Array.isArray(texts) ? texts : [texts];
      calls.push({ texts: arr, template: opts.hypothesis_template });
      if (opts.hypothesis_template === STAGE1_TEMPLATE) {
        return arr.map((t) =>
          t.startsWith('DUTY') ? out([DUTY, QUAL, COMPANY], [0.8, 0.1, 0.1]) : t.startsWith('CO') ? out([COMPANY, DUTY, QUAL], [0.7, 0.2, 0.1]) : out([QUAL, DUTY, COMPANY], [0.9, 0.05, 0.05]),
        );
      }
      expect(labels).toEqual([STAGE2_LABELS.required, STAGE2_LABELS.preferred]);
      return arr.map((t) => (t.includes('optional-by-model') ? out([STAGE2_LABELS.preferred, STAGE2_LABELS.required], [0.9, 0.1]) : out([STAGE2_LABELS.required, STAGE2_LABELS.preferred], [0.6, 0.4])));
    };

    const kinds = await labelSegments(classifier as any, [
      { id: 'a', text: 'DUTY: ship features' },
      { id: 'b', text: 'CO: we are backed by Sequoia' },
      { id: 'c', text: '5+ years with Go' },
      { id: 'd', text: 'Rust optional-by-model' },
      { id: 'e', text: 'Familiarity with Helm' },
    ]);

    expect(kinds.a.kind).toBe('responsibilities');
    expect(kinds.b.kind).toBe('other');
    expect(kinds.c.kind).toBe('required');
    expect(kinds.d.kind).toBe('preferred');
    expect(kinds.e.kind).toBe('preferred'); // regex hedge, regardless of model
    expect(calls.map((c) => c.template)).toEqual([STAGE1_TEMPLATE, STAGE2_TEMPLATE]);
    expect(calls[1].texts).toEqual(['5+ years with Go', 'Rust optional-by-model', 'Familiarity with Helm']);
  });

  it('returns no labels for an empty request without calling the model', async () => {
    let called = false;
    const kinds = await labelSegments((async () => {
      called = true;
      return [];
    }) as any, []);
    expect(kinds).toEqual({});
    expect(called).toBe(false);
  });
});

describe('decideQualificationKind', () => {
  const optional = out([STAGE2_LABELS.preferred, STAGE2_LABELS.required], [0.8, 0.2]);
  const mandatory = out([STAGE2_LABELS.required, STAGE2_LABELS.preferred], [0.8, 0.2]);
  const unsure = out([STAGE2_LABELS.preferred, STAGE2_LABELS.required], [0.55, 0.45]);

  it('regex hedge wins', () => {
    expect(decideQualificationKind('Exposure to Kafka is a plus', mandatory)).toBe('preferred');
  });
  it('a strong required cue neutralises a hedge', () => {
    expect(decideQualificationKind('Required: familiarity with Kafka', mandatory)).toBe('required');
  });
  it('model calls optional only above the confidence floor', () => {
    expect(decideQualificationKind('Rust', optional)).toBe('preferred');
    expect(decideQualificationKind('Rust', unsure)).toBe('required');
    expect(decideQualificationKind('Rust', mandatory)).toBe('required');
  });
});

describe('toPageVerdict', () => {
  it('demotes only when "not a job" clears the floor', () => {
    expect(toPageVerdict(out([PAGE_LABELS.notJob, PAGE_LABELS.job], [0.9, 0.1]))).toEqual({ isJob: false, confidence: 0.9 });
    expect(toPageVerdict(out([PAGE_LABELS.notJob, PAGE_LABELS.job], [0.7, 0.3])).isJob).toBe(true);
    expect(toPageVerdict(out([PAGE_LABELS.job, PAGE_LABELS.notJob], [0.95, 0.05])).isJob).toBe(true);
  });
});
