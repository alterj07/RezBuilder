/**
 * Zero-shot label vocabulary. Bump LABELSET_VERSION whenever the model,
 * labels, templates or thresholds change — it is part of the cache key.
 *
 * Two stages, chosen by `tests/model/tuneLabelset.ts` over the gold set:
 *   1. What is this text about?  qualification | duties | company/benefits/legal | hiring process
 *   2. For qualifications only: mandatory vs optional, combined with the
 *      deterministic NICE_INLINE / REQUIRED_STRONG_INLINE cues (the model alone
 *      is weak at modality; the regexes alone miss unhedged nice-to-haves).
 */
import { JobSectionKind } from '../../types/job';

export const LABELSET_VERSION = 2;

/** DeBERTa-v3-xsmall fine-tuned for zero-shot on 33 datasets; onnx/model_quantized.onnx. */
export const MODEL_ID = 'MoritzLaurer/deberta-v3-xsmall-zeroshot-v1.1-all-33';
export const MODEL_DTYPE = 'q8';
export const MODEL_SIZE_BYTES = 87_246_195;

export const STAGE1_TEMPLATE = 'This text is about {}.';
export type Stage1Kind = 'qualification' | JobSectionKind;
export const STAGE1_LABELS: { label: string; kind: Stage1Kind }[] = [
  { label: 'skills or experience the candidate should have', kind: 'qualification' },
  { label: 'tasks the employee will do', kind: 'responsibilities' },
  { label: 'the company, its benefits, or legal statements', kind: 'other' },
  { label: 'the hiring process', kind: 'other' },
];

export const STAGE2_TEMPLATE = 'This qualification is {}.';
export const STAGE2_LABELS = { required: 'mandatory', preferred: 'optional' };
/** The model may call a qualification optional only when at least this sure. */
export const STAGE2_OPTIONAL_MIN_CONFIDENCE = 0.7;

export const PAGE_HYPOTHESIS_TEMPLATE = 'This web page is {}.';
export const PAGE_LABELS = {
  job: 'a job posting',
  notJob: 'an article, documentation or other web page',
};
/** Demote a medium-confidence detection only when the model is this sure it is not a job. */
export const PAGE_DEMOTE_MIN_CONFIDENCE = 0.85;

/** Segments longer than this are truncated before inference (speed, not accuracy). */
export const MAX_SEGMENT_CHARS = 256;
export const MAX_SEGMENTS_PER_REQUEST = 32;

export function stage1KindForLabel(label: string): Stage1Kind {
  return STAGE1_LABELS.find((l) => l.label === label)?.kind ?? 'other';
}
