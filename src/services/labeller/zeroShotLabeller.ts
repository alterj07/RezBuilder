/**
 * Zero-shot NLI labeller on top of transformers.js. Label-only: it never
 * generates text, never scores a candidate. Runs in the offscreen document
 * (browser) and in the opt-in eval suite (Node); nothing here touches chrome.*.
 */
import { env, pipeline, type ZeroShotClassificationPipeline } from '@huggingface/transformers';
import { JobSectionKind } from '../../types/job';
import { NICE_INLINE, REQUIRED_STRONG_INLINE } from '../fit/sectionHeaders';
import {
  LABELSET_VERSION,
  MAX_SEGMENTS_PER_REQUEST,
  MAX_SEGMENT_CHARS,
  MODEL_DTYPE,
  MODEL_ID,
  PAGE_DEMOTE_MIN_CONFIDENCE,
  PAGE_HYPOTHESIS_TEMPLATE,
  PAGE_LABELS,
  STAGE1_LABELS,
  STAGE1_TEMPLATE,
  STAGE2_LABELS,
  STAGE2_OPTIONAL_MIN_CONFIDENCE,
  STAGE2_TEMPLATE,
  stage1KindForLabel,
} from './labelset';
import { LabelRequest, LabelResponse, PageVerdict, SegmentLabel, SegmentLabeller } from './types';

export interface DownloadProgress {
  file: string;
  loaded: number;
  total: number;
  status: string;
}

export interface ZeroShotLabellerOptions {
  /** Prefix under which the ORT wasm/mjs pair is served (browser only). */
  wasmPaths?: string;
  /** Node only: where to keep downloaded weights. */
  cacheDir?: string;
  device?: 'wasm' | 'webgpu' | 'cpu';
  onProgress?: (p: DownloadProgress) => void;
}

/** Applies environment settings once per runtime. Safe to call repeatedly. */
export function configureTransformersEnv(opts: ZeroShotLabellerOptions = {}): void {
  env.allowRemoteModels = true;
  env.allowLocalModels = false;
  if (opts.cacheDir) env.cacheDir = opts.cacheDir;
  const onnx = env.backends.onnx as any;
  if (onnx?.wasm) {
    if (opts.wasmPaths) onnx.wasm.wasmPaths = opts.wasmPaths;
    // Extension pages are not cross-origin isolated, so SharedArrayBuffer (and
    // therefore worker threads) are unavailable.
    onnx.wasm.numThreads = 1;
  }
}

export type ZeroShotOutput = { sequence: string; labels: string[]; scores: number[] };

type Classifier = (texts: string | string[], labels: string[], opts: { hypothesis_template: string; multi_label: boolean }) => Promise<unknown>;

export class ZeroShotLabeller implements SegmentLabeller {
  private classifier: ZeroShotClassificationPipeline | null = null;
  private loading: Promise<ZeroShotClassificationPipeline> | null = null;

  constructor(private readonly opts: ZeroShotLabellerOptions = {}) {}

  /** Loads (downloading if needed) the pipeline; concurrent callers share one load. */
  async load(): Promise<ZeroShotClassificationPipeline> {
    if (this.classifier) return this.classifier;
    if (!this.loading) {
      configureTransformersEnv(this.opts);
      this.loading = (pipeline('zero-shot-classification', MODEL_ID, {
        dtype: MODEL_DTYPE,
        device: this.opts.device ?? 'wasm',
        progress_callback: (p: any) => {
          if (this.opts.onProgress && p && typeof p === 'object') {
            this.opts.onProgress({
              file: p.file ?? '',
              loaded: p.loaded ?? 0,
              total: p.total ?? 0,
              status: p.status ?? '',
            });
          }
        },
      } as any) as Promise<ZeroShotClassificationPipeline>).then((c) => {
        this.classifier = c;
        return c;
      });
      this.loading.catch(() => {
        this.loading = null;
      });
    }
    return this.loading;
  }

  async ready(): Promise<boolean> {
    return this.classifier !== null;
  }

  async dispose(): Promise<void> {
    const c = this.classifier;
    this.classifier = null;
    this.loading = null;
    if (c) await c.dispose();
  }

  async label(req: LabelRequest): Promise<LabelResponse> {
    const started = Date.now();
    const classifier = (await this.load()) as unknown as Classifier;
    const segments = req.segments
      .map((s) => ({ id: s.id, text: s.text.trim().slice(0, MAX_SEGMENT_CHARS) }))
      .filter((s) => s.text.length > 0);

    const kinds = await labelSegments(classifier, segments);

    let pageVerdict: PageVerdict | undefined;
    if (req.pageCheck) {
      const text = `${req.pageCheck.title}\n${req.pageCheck.excerpt}`.slice(0, 600);
      const raw = await classifier(text, [PAGE_LABELS.job, PAGE_LABELS.notJob], {
        hypothesis_template: PAGE_HYPOTHESIS_TEMPLATE,
        multi_label: false,
      });
      pageVerdict = toPageVerdict(firstOutput(raw));
    }

    return { kinds, pageVerdict, ms: Date.now() - started, modelId: MODEL_ID, labelsetVersion: LABELSET_VERSION };
  }
}

function firstOutput(raw: unknown): ZeroShotOutput {
  return (Array.isArray(raw) ? raw[0] : raw) as ZeroShotOutput;
}

function asOutputs(raw: unknown): ZeroShotOutput[] {
  return (Array.isArray(raw) ? raw : [raw]) as ZeroShotOutput[];
}

/**
 * Stage 1 on every segment, stage 2 only on the ones the model calls a
 * qualification. Exported so the eval harness and unit tests can drive it
 * with a fake classifier.
 */
export async function labelSegments(
  classifier: Classifier,
  segments: { id: string; text: string }[],
): Promise<Record<string, SegmentLabel>> {
  const kinds: Record<string, SegmentLabel> = {};
  const qualifications: { id: string; text: string; confidence: number }[] = [];
  const stage1Labels = STAGE1_LABELS.map((l) => l.label);

  for (let i = 0; i < segments.length; i += MAX_SEGMENTS_PER_REQUEST) {
    const batch = segments.slice(i, i + MAX_SEGMENTS_PER_REQUEST);
    const outputs = asOutputs(
      await classifier(batch.map((s) => s.text), stage1Labels, { hypothesis_template: STAGE1_TEMPLATE, multi_label: false }),
    );
    outputs.forEach((out, idx) => {
      const seg = batch[idx];
      const kind = stage1KindForLabel(out.labels[0]);
      const confidence = out.scores[0] ?? 0;
      if (kind === 'qualification') qualifications.push({ ...seg, confidence });
      else kinds[seg.id] = { kind, confidence };
    });
  }

  for (let i = 0; i < qualifications.length; i += MAX_SEGMENTS_PER_REQUEST) {
    const batch = qualifications.slice(i, i + MAX_SEGMENTS_PER_REQUEST);
    const outputs = asOutputs(
      await classifier(batch.map((s) => s.text), [STAGE2_LABELS.required, STAGE2_LABELS.preferred], {
        hypothesis_template: STAGE2_TEMPLATE,
        multi_label: false,
      }),
    );
    outputs.forEach((out, idx) => {
      const seg = batch[idx];
      kinds[seg.id] = { kind: decideQualificationKind(seg.text, out), confidence: Math.min(seg.confidence, out.scores[0] ?? 0) };
    });
  }

  return kinds;
}

/** Regex hedges win; otherwise the model must be confident to call something optional. */
export function decideQualificationKind(text: string, out: ZeroShotOutput): JobSectionKind {
  if (NICE_INLINE.test(text) && !REQUIRED_STRONG_INLINE.test(text)) return 'preferred';
  const optionalIdx = out.labels.indexOf(STAGE2_LABELS.preferred);
  const optionalScore = optionalIdx >= 0 ? out.scores[optionalIdx] : 0;
  return optionalScore >= STAGE2_OPTIONAL_MIN_CONFIDENCE ? 'preferred' : 'required';
}

export function toPageVerdict(out: ZeroShotOutput): PageVerdict {
  const notJobIdx = out.labels.indexOf(PAGE_LABELS.notJob);
  const notJobScore = notJobIdx >= 0 ? out.scores[notJobIdx] : 0;
  return { isJob: notJobScore < PAGE_DEMOTE_MIN_CONFIDENCE, confidence: notJobScore };
}
