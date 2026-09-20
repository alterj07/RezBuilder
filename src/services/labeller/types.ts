import { JobSectionKind } from '../../types/job';

/** One piece of posting text the model should place. */
export interface LabelSegment {
  id: string;
  text: string;
}

export interface LabelRequest {
  segments: LabelSegment[];
  /** Present only for medium-confidence detections; asks "is this even a job posting?". */
  pageCheck?: { title: string; excerpt: string };
}

export interface SegmentLabel {
  kind: JobSectionKind;
  confidence: number;
}

export interface PageVerdict {
  isJob: boolean;
  confidence: number;
}

export interface LabelResponse {
  kinds: Record<string, SegmentLabel>;
  pageVerdict?: PageVerdict;
  ms: number;
  modelId: string;
  labelsetVersion: number;
}

export interface SegmentLabeller {
  /** True once the model is loaded (or can be loaded from cache without a download). */
  ready(): Promise<boolean>;
  label(req: LabelRequest): Promise<LabelResponse>;
}

/** Persisted in chrome.storage.local under LABELLER_STATE_KEY. */
export type LabellerModelState = 'absent' | 'downloading' | 'ready' | 'unsupported' | 'error';

export interface LabellerStatus {
  enabled: boolean;
  state: LabellerModelState;
  modelId: string;
  sizeBytes: number;
  /** 0-1 while downloading. */
  progress?: number;
  error?: string;
}

export const LABELLER_STATE_KEY = 'labellerModelState';
export const LABEL_CACHE_KEY = 'labelCache';

/** Hard bound on how long the panel waits for labels before falling back. */
export const LABEL_TIMEOUT_MS = 6000;
