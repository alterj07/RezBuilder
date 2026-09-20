/**
 * Ad-hoc labelset tuning: RUN_MODEL_EVAL=1 npx vite-node tests/model/tuneLabelset.ts
 * Prints per-variant scores over the gold set. Not part of the test suite.
 *
 * Scoring collapses gold kinds to what the fit engine consumes:
 *   required | preferred | other   (responsibilities/about/benefits/eeo → other)
 */
import path from 'path';
import { env, pipeline } from '@huggingface/transformers';
import { GOLD_SEGMENTS } from '../fixtures/goldSegments';
import { MODEL_ID } from '../../src/services/labeller/labelset';
import { NICE_INLINE, REQUIRED_STRONG_INLINE } from '../../src/services/fit/sectionHeaders';

type Coarse = 'required' | 'preferred' | 'other';
const coarse = (k: string): Coarse => (k === 'required' || k === 'preferred' ? k : 'other');

interface Stage {
  template: string;
  labels: { label: string; kind: string }[];
}
interface Variant {
  name: string;
  stage1: Stage;
  /** Optional second stage run when stage1 yields `qualification`. */
  stage2?: Stage;
  min?: number;
  /** Stage-2 policy: 'model' (default), 'regex' (NICE_INLINE→preferred else required), 'either' (regex or model≥margin). */
  stage2Policy?: 'model' | 'regex' | 'either';
  margin?: number;
}

const V: Variant[] = [
  {
    name: 'A: 4-way "This text is about {}."',
    stage1: {
      template: 'This text is about {}.',
      labels: [
        { label: 'skills the candidate must have', kind: 'required' },
        { label: 'skills that are optional or a bonus', kind: 'preferred' },
        { label: 'tasks the employee will do', kind: 'other' },
        { label: 'the company, benefits or hiring process', kind: 'other' },
      ],
    },
  },
  {
    name: 'B: 3-way "This example is {}."',
    stage1: {
      template: 'This example is {}.',
      labels: [
        { label: 'a mandatory requirement', kind: 'required' },
        { label: 'a nice-to-have', kind: 'preferred' },
        { label: 'not a requirement', kind: 'other' },
      ],
    },
  },
  {
    name: 'C: two-stage (qualification? then mandatory vs optional)',
    stage1: {
      template: 'This text is about {}.',
      labels: [
        { label: 'skills or experience the candidate should have', kind: 'qualification' },
        { label: 'tasks the employee will do', kind: 'other' },
        { label: 'the company, its benefits, or legal statements', kind: 'other' },
        { label: 'the hiring process', kind: 'other' },
      ],
    },
    stage2: {
      template: 'This qualification is {}.',
      labels: [
        { label: 'mandatory', kind: 'required' },
        { label: 'optional', kind: 'preferred' },
      ],
    },
  },
  {
    name: 'D: two-stage, stage2 "{}"',
    stage1: {
      template: 'This text is about {}.',
      labels: [
        { label: 'skills or experience the candidate should have', kind: 'qualification' },
        { label: 'tasks the employee will do', kind: 'other' },
        { label: 'the company, its benefits, or legal statements', kind: 'other' },
        { label: 'the hiring process', kind: 'other' },
      ],
    },
    stage2: {
      template: '{}',
      labels: [
        { label: 'The candidate must have this.', kind: 'required' },
        { label: 'This is a bonus, not required.', kind: 'preferred' },
      ],
    },
  },
  {
    name: 'E: two-stage, stage1 binary',
    stage1: {
      template: 'This text is about {}.',
      labels: [
        { label: 'the skills or experience a candidate needs', kind: 'qualification' },
        { label: 'something other than candidate skills', kind: 'other' },
      ],
    },
    stage2: {
      template: 'This qualification is {}.',
      labels: [
        { label: 'required', kind: 'required' },
        { label: 'preferred but not required', kind: 'preferred' },
      ],
    },
  },
  {
    name: 'F: C + stage2 "This requirement is {}." required/preferred',
    stage1: {
      template: 'This text is about {}.',
      labels: [
        { label: 'skills or experience the candidate should have', kind: 'qualification' },
        { label: 'tasks the employee will do', kind: 'other' },
        { label: 'the company, its benefits, or legal statements', kind: 'other' },
        { label: 'the hiring process', kind: 'other' },
      ],
    },
    stage2: {
      template: 'This requirement is {}.',
      labels: [
        { label: 'required', kind: 'required' },
        { label: 'preferred', kind: 'preferred' },
      ],
    },
  },
  {
    name: 'G: C + stage2 "This example is {}." must-have/nice-to-have',
    stage1: {
      template: 'This text is about {}.',
      labels: [
        { label: 'skills or experience the candidate should have', kind: 'qualification' },
        { label: 'tasks the employee will do', kind: 'other' },
        { label: 'the company, its benefits, or legal statements', kind: 'other' },
        { label: 'the hiring process', kind: 'other' },
      ],
    },
    stage2: {
      template: 'This example is {}.',
      labels: [
        { label: 'a must-have requirement', kind: 'required' },
        { label: 'a nice-to-have or bonus', kind: 'preferred' },
      ],
    },
  },
  {
    name: 'H: stage1 "This example is {}." 5 labels + stage2 C',
    stage1: {
      template: 'This example is {}.',
      labels: [
        { label: 'a candidate qualification', kind: 'qualification' },
        { label: 'a job duty', kind: 'other' },
        { label: 'a company description', kind: 'other' },
        { label: 'an employee benefit', kind: 'other' },
        { label: 'an equal opportunity statement', kind: 'other' },
        { label: 'an application instruction', kind: 'other' },
      ],
    },
    stage2: {
      template: 'This qualification is {}.',
      labels: [
        { label: 'mandatory', kind: 'required' },
        { label: 'optional', kind: 'preferred' },
      ],
    },
  },
  {
    name: 'I: H stage1 + stage2 "This example is {}." strict/optional',
    stage1: {
      template: 'This example is {}.',
      labels: [
        { label: 'a candidate qualification', kind: 'qualification' },
        { label: 'a job duty', kind: 'other' },
        { label: 'a company description', kind: 'other' },
        { label: 'an employee benefit', kind: 'other' },
        { label: 'an equal opportunity statement', kind: 'other' },
        { label: 'an application instruction', kind: 'other' },
      ],
    },
    stage2: {
      template: 'This example is {}.',
      labels: [
        { label: 'a strict requirement', kind: 'required' },
        { label: 'optional, a bonus, or nice to have', kind: 'preferred' },
      ],
    },
  },
  {
    name: 'J: single 3-way "This example is {}." with richer labels',
    stage1: {
      template: 'This example is {}.',
      labels: [
        { label: 'a required qualification the candidate must have', kind: 'required' },
        { label: 'a preferred qualification that is a bonus but not required', kind: 'preferred' },
        { label: 'a job duty, company description, benefit or legal statement', kind: 'other' },
      ],
    },
  },
  {
    name: 'K: C stage1 + regex stage2',
    stage2Policy: 'regex',
    stage1: {
      template: 'This text is about {}.',
      labels: [
        { label: 'skills or experience the candidate should have', kind: 'qualification' },
        { label: 'tasks the employee will do', kind: 'other' },
        { label: 'the company, its benefits, or legal statements', kind: 'other' },
        { label: 'the hiring process', kind: 'other' },
      ],
    },
  },
  {
    name: 'L: C stage1 + (regex OR model optional>=0.7)',
    stage2Policy: 'either',
    margin: 0.7,
    stage1: {
      template: 'This text is about {}.',
      labels: [
        { label: 'skills or experience the candidate should have', kind: 'qualification' },
        { label: 'tasks the employee will do', kind: 'other' },
        { label: 'the company, its benefits, or legal statements', kind: 'other' },
        { label: 'the hiring process', kind: 'other' },
      ],
    },
    stage2: {
      template: 'This qualification is {}.',
      labels: [
        { label: 'mandatory', kind: 'required' },
        { label: 'optional', kind: 'preferred' },
      ],
    },
  },
  {
    name: 'M: L with margin 0.6',
    stage2Policy: 'either',
    margin: 0.6,
    stage1: {
      template: 'This text is about {}.',
      labels: [
        { label: 'skills or experience the candidate should have', kind: 'qualification' },
        { label: 'tasks the employee will do', kind: 'other' },
        { label: 'the company, its benefits, or legal statements', kind: 'other' },
        { label: 'the hiring process', kind: 'other' },
      ],
    },
    stage2: {
      template: 'This qualification is {}.',
      labels: [
        { label: 'mandatory', kind: 'required' },
        { label: 'optional', kind: 'preferred' },
      ],
    },
  },
];

const MODELS = process.env.TUNE_MODELS?.split(',') || [MODEL_ID, 'MoritzLaurer/deberta-v3-xsmall-zeroshot-v1.1-all-33'];

async function main() {
  env.allowLocalModels = false;
  env.cacheDir = path.resolve(__dirname, '../../.cache/transformers');
  for (const model of MODELS) {
    console.log(`\n######## ${model}`);
    await evalModel(model);
  }
}

async function evalModel(model: string) {
  const clf: any = await pipeline('zero-shot-classification', model, { dtype: 'q8', device: 'cpu' } as any);
  const texts = GOLD_SEGMENTS.map((g) => g.text);

  for (const v of V) {
    const t0 = Date.now();
    const s1: any[] = await clf(texts, v.stage1.labels.map((l) => l.label), { hypothesis_template: v.stage1.template, multi_label: false });
    const predicted: Coarse[] = new Array(texts.length).fill('other');
    const stage2Idx: number[] = [];
    s1.forEach((o, i) => {
      const kind = v.stage1.labels.find((l) => l.label === o.labels[0])!.kind;
      if (kind === 'qualification') stage2Idx.push(i);
      else predicted[i] = coarse(kind);
    });
    const policy = v.stage2Policy || 'model';
    const regexKind = (t: string): Coarse => (NICE_INLINE.test(t) && !REQUIRED_STRONG_INLINE.test(t) ? 'preferred' : 'required');
    if (policy === 'regex') {
      stage2Idx.forEach((i) => (predicted[i] = regexKind(texts[i])));
    } else if (v.stage2 && stage2Idx.length) {
      const s2: any[] = await clf(stage2Idx.map((i) => texts[i]), v.stage2.labels.map((l) => l.label), {
        hypothesis_template: v.stage2.template,
        multi_label: false,
      });
      s2.forEach((o, j) => {
        const i = stage2Idx[j];
        const modelKind = coarse(v.stage2!.labels.find((l) => l.label === o.labels[0])!.kind);
        if (policy === 'model') predicted[i] = modelKind;
        else predicted[i] = regexKind(texts[i]) === 'preferred' || (modelKind === 'preferred' && o.scores[0] >= (v.margin ?? 0.6)) ? 'preferred' : 'required';
      });
    }
    const ms = Date.now() - t0;

    const kinds: Coarse[] = ['required', 'preferred', 'other'];
    const conf: Record<string, Record<string, number>> = {};
    for (const a of kinds) conf[a] = Object.fromEntries(kinds.map((b) => [b, 0]));
    const misses: string[] = [];
    GOLD_SEGMENTS.forEach((g, i) => {
      const gold = coarse(g.kind);
      conf[gold][predicted[i]]++;
      if (predicted[i] !== gold) misses.push(`    ${gold}→${predicted[i]} ${texts[i].slice(0, 70)}`);
    });
    const f1s = kinds.map((k) => {
      const tp = conf[k][k];
      const fp = kinds.reduce((s, o) => s + (o === k ? 0 : conf[o][k]), 0);
      const fn = kinds.reduce((s, o) => s + (o === k ? 0 : conf[k][o]), 0);
      const p = tp + fp ? tp / (tp + fp) : 0;
      const r = tp + fn ? tp / (tp + fn) : 0;
      return p + r ? (2 * p * r) / (p + r) : 0;
    });
    const macro = f1s.reduce((a, b) => a + b, 0) / f1s.length;
    const rp = GOLD_SEGMENTS.map((g, i) => ({ g: coarse(g.kind), p: predicted[i] })).filter(({ g }) => g !== 'other');
    const rpOk = rp.filter(({ g, p }) => g === p).length / rp.length;
    const acc = GOLD_SEGMENTS.filter((g, i) => coarse(g.kind) === predicted[i]).length / texts.length;
    console.log(`\n== ${v.name}: acc=${acc.toFixed(3)} macroF1=${macro.toFixed(3)} req/pref=${rpOk.toFixed(3)} (${ms} ms)  F1 ${kinds.map((k, i) => `${k}=${f1s[i].toFixed(2)}`).join(' ')}`);
    console.log(misses.join('\n'));
  }
  await clf.dispose();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
