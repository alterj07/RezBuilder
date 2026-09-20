/**
 * Background-side orchestration of on-device section labelling.
 *
 * The content script reports a job whose `sections` may contain `unknown`
 * kinds. When the user has opted in and the model is downloaded, the unknown
 * segments (minus cache hits) go to the offscreen document, the answers are
 * merged back, and the labelled job replaces the deterministic one in the
 * per-tab store. Every other path publishes the deterministic job unchanged
 * with a `labelling.status` explaining why.
 */
import { JobLabellingMeta, JobPosting } from '../types/job';
import { UserSettings, DEFAULT_SETTINGS } from '../types/settings';
import { getTabJob, recordDetection } from '../services/storage/tabJobStore';
import { getCachedLabels, putCachedLabels } from '../services/labeller/labelCache';
import { applyLabels, countModelLabelled, planLabelling } from '../services/labeller/planLabelling';
import {
  LABELLER_STATE_KEY,
  LABEL_TIMEOUT_MS,
  LabelRequest,
  LabelResponse,
  LabellerModelState,
  LabellerStatus,
  SegmentLabel,
} from '../services/labeller/types';
import { LABELSET_VERSION, MODEL_ID, MODEL_SIZE_BYTES } from '../services/labeller/labelset';

const SETTINGS_KEY = 'rezbuilder_settings';
export const OFFSCREEN_URL = 'src/offscreen/index.html';
export const OFFSCREEN_IDLE_MS = 5 * 60 * 1000;

interface StoredModelState {
  state: LabellerModelState;
  progress?: number;
  error?: string;
}

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

async function readSettings(): Promise<UserSettings> {
  try {
    const stored = await chrome.storage.local.get([SETTINGS_KEY]);
    return { ...DEFAULT_SETTINGS, ...(stored?.[SETTINGS_KEY] || {}) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

async function writeSettings(patch: Partial<UserSettings>): Promise<void> {
  const current = await readSettings();
  await chrome.storage.local.set({ [SETTINGS_KEY]: { ...current, ...patch } });
}

export async function readModelState(): Promise<StoredModelState> {
  try {
    const stored = await chrome.storage.local.get([LABELLER_STATE_KEY]);
    const s = stored?.[LABELLER_STATE_KEY];
    return s && typeof s === 'object' && s.state ? s : { state: 'absent' };
  } catch {
    return { state: 'absent' };
  }
}

async function writeModelState(state: StoredModelState): Promise<void> {
  await chrome.storage.local.set({ [LABELLER_STATE_KEY]: state });
}

// ---------------------------------------------------------------------------
// Offscreen transport
// ---------------------------------------------------------------------------

type OffscreenTransport = (message: { type: string; payload?: unknown }) => Promise<unknown>;

let creating: Promise<void> | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;

async function hasOffscreenDocument(): Promise<boolean> {
  const rt = chrome.runtime as any;
  if (typeof rt.getContexts === 'function') {
    const contexts = await rt.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
    return Array.isArray(contexts) && contexts.length > 0;
  }
  return false;
}

export async function ensureOffscreen(): Promise<void> {
  if (await hasOffscreenDocument()) return;
  if (!creating) {
    creating = chrome.offscreen
      .createDocument({
        url: OFFSCREEN_URL,
        reasons: ['WORKERS' as chrome.offscreen.Reason],
        justification: 'Runs on-device ML inference to label job posting sections',
      })
      .catch((err: unknown) => {
        // "Only a single offscreen document may be created" — someone beat us to it.
        if (!(err instanceof Error && /single offscreen/i.test(err.message))) throw err;
      })
      .finally(() => {
        creating = null;
      });
  }
  await creating;
}

export async function closeOffscreen(): Promise<void> {
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
  if (await hasOffscreenDocument()) {
    await chrome.offscreen.closeDocument().catch(() => {});
  }
}

function scheduleIdleClose(): void {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    idleTimer = null;
    closeOffscreen().catch(() => {});
  }, OFFSCREEN_IDLE_MS);
}

const defaultTransport: OffscreenTransport = async (message) => {
  await ensureOffscreen();
  const response = (await chrome.runtime.sendMessage({ ...message, target: 'offscreen' })) as
    | { ok: true; result: unknown }
    | { ok: false; error: string }
    | undefined;
  scheduleIdleClose();
  if (!response) throw new Error('Offscreen document did not respond');
  if (!response.ok) throw new Error(response.error || 'Offscreen error');
  return response.result;
};

let transport: OffscreenTransport = defaultTransport;

/** Test hook: swap the offscreen round-trip for a fake. */
export function setOffscreenTransportForTests(fn: OffscreenTransport | null): void {
  transport = fn || defaultTransport;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new LabelTimeoutError()), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

class LabelTimeoutError extends Error {
  constructor() {
    super('Labelling timed out');
    this.name = 'LabelTimeoutError';
  }
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

function withLabelling(job: JobPosting, labelling: JobLabellingMeta): JobPosting {
  return { ...job, labelling };
}

/**
 * Records `job` for `tabId`, labelling its unknown sections on-device when
 * possible. Resolves to the job that ended up in the store, or null when the
 * model demoted a borderline page.
 */
export async function recordDetectionWithLabelling(
  tabId: number,
  job: JobPosting,
  isActiveTab: () => Promise<boolean>,
): Promise<JobPosting | null> {
  const settings = await readSettings();
  if (!settings.enableLocalLabeller) {
    const out = withLabelling(job, { status: 'disabled' });
    await recordDetection(tabId, out, await isActiveTab());
    return out;
  }

  const model = await readModelState();
  if (model.state !== 'ready') {
    const out = withLabelling(job, { status: 'unavailable' });
    await recordDetection(tabId, out, await isActiveTab());
    return out;
  }

  const plan = planLabelling(job);
  if (plan.segments.length === 0 && !plan.pageCheck) {
    const out = withLabelling(job, { status: 'skipped' });
    await recordDetection(tabId, out, await isActiveTab());
    return out;
  }

  const labels: Record<string, SegmentLabel> = {};
  const cached = await getCachedLabels(plan.segments.map((s) => s.text));
  const remaining = plan.segments.filter((s) => {
    const hit = cached.get(s.text);
    if (hit) labels[s.id] = hit;
    return !hit;
  });

  if (remaining.length === 0 && !plan.pageCheck) {
    const sections = applyLabels(job, plan, labels);
    const out = withLabelling({ ...job, sections }, {
      status: 'done',
      modelId: MODEL_ID,
      labelsetVersion: LABELSET_VERSION,
      ms: 0,
      labelledSegments: countModelLabelled(sections),
    });
    await recordDetection(tabId, out, await isActiveTab());
    return out;
  }

  // The panel shows a "labelling…" state until the model answers or the timeout fires.
  await recordDetection(tabId, withLabelling(job, { status: 'pending' }), await isActiveTab());

  let result: JobPosting | null;
  try {
    const request: LabelRequest = { segments: remaining, pageCheck: plan.pageCheck };
    const pending = transport({ type: 'LABEL_JOB', payload: request }) as Promise<LabelResponse>;
    // Late answers still warm the cache for the next visit.
    pending
      .then((r) => putCachedLabels(remaining.filter((s) => r.kinds[s.id]).map((s) => ({ text: s.text, label: r.kinds[s.id] }))))
      .catch(() => {});
    const response = await withTimeout(pending, LABEL_TIMEOUT_MS);

    for (const seg of remaining) if (response.kinds[seg.id]) labels[seg.id] = response.kinds[seg.id];

    // Only a verdict we asked for (medium confidence) may demote; high-confidence pages are never second-guessed.
    if (plan.pageCheck && response.pageVerdict && !response.pageVerdict.isJob) {
      if (await isStillCurrent(tabId, job)) await recordDetection(tabId, null, await isActiveTab());
      return null;
    }

    const sections = applyLabels(job, plan, labels);
    result = withLabelling({ ...job, sections }, {
      status: 'done',
      modelId: response.modelId,
      labelsetVersion: response.labelsetVersion,
      ms: response.ms,
      labelledSegments: countModelLabelled(sections),
    });
  } catch (err) {
    result = withLabelling(job, { status: err instanceof LabelTimeoutError ? 'timeout' : 'failed' });
  }

  if (await isStillCurrent(tabId, job)) await recordDetection(tabId, result, await isActiveTab());
  return result;
}

/** The tab may have navigated while the model was busy; never overwrite a newer job. */
async function isStillCurrent(tabId: number, job: JobPosting): Promise<boolean> {
  const current = await getTabJob(tabId);
  return !!current && current.id === job.id && current.scrapedAt === job.scrapedAt;
}

// ---------------------------------------------------------------------------
// Side-panel facing management messages
// ---------------------------------------------------------------------------

export async function getLabellerStatus(): Promise<LabellerStatus> {
  const [settings, model] = await Promise.all([readSettings(), readModelState()]);
  return {
    enabled: !!settings.enableLocalLabeller,
    state: model.state,
    modelId: MODEL_ID,
    sizeBytes: MODEL_SIZE_BYTES,
    progress: model.progress,
    error: model.error,
  };
}

export async function downloadModel(): Promise<LabellerStatus> {
  await writeModelState({ state: 'downloading', progress: 0 });
  try {
    await transport({ type: 'LABELLER_DOWNLOAD' });
    await writeModelState({ state: 'ready' });
    await writeSettings({ enableLocalLabeller: true, labellerConsentAt: new Date().toISOString() });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const unsupported = /wasm|webassembly|no available backend/i.test(message);
    await writeModelState({ state: unsupported ? 'unsupported' : 'error', error: message });
  }
  return getLabellerStatus();
}

export async function removeModel(): Promise<LabellerStatus> {
  try {
    await transport({ type: 'LABELLER_REMOVE' });
  } catch {
    // Nothing to remove or the offscreen page is gone; state reset is what matters.
  }
  await writeModelState({ state: 'absent' });
  await writeSettings({ enableLocalLabeller: false });
  await closeOffscreen();
  return getLabellerStatus();
}

export async function setLabellerEnabled(enabled: boolean): Promise<LabellerStatus> {
  await writeSettings({ enableLocalLabeller: enabled });
  return getLabellerStatus();
}

/** Progress relayed from the offscreen document while weights download. */
export async function recordDownloadProgress(payload: { loaded?: number; total?: number }): Promise<void> {
  const total = payload?.total || MODEL_SIZE_BYTES;
  const loaded = payload?.loaded || 0;
  const model = await readModelState();
  if (model.state !== 'downloading') return;
  await writeModelState({ state: 'downloading', progress: Math.max(0, Math.min(1, loaded / total)) });
}

export type LabellerMessage =
  | { type: 'LABELLER_STATUS' }
  | { type: 'LABELLER_DOWNLOAD' }
  | { type: 'LABELLER_REMOVE' }
  | { type: 'LABELLER_SET_ENABLED'; enabled: boolean }
  | { type: 'LABELLER_PROGRESS'; payload: { loaded?: number; total?: number } };

export function isLabellerMessage(message: any): message is LabellerMessage {
  return (
    !!message &&
    message.target !== 'offscreen' &&
    ['LABELLER_STATUS', 'LABELLER_DOWNLOAD', 'LABELLER_REMOVE', 'LABELLER_SET_ENABLED', 'LABELLER_PROGRESS'].includes(message.type)
  );
}

/** Returns true (async response) like the other background handlers. */
export function handleLabellerMessage(message: LabellerMessage, sendResponse: (r: unknown) => void): boolean {
  (async () => {
    switch (message.type) {
      case 'LABELLER_STATUS':
        return getLabellerStatus();
      case 'LABELLER_DOWNLOAD':
        return downloadModel();
      case 'LABELLER_REMOVE':
        return removeModel();
      case 'LABELLER_SET_ENABLED':
        return setLabellerEnabled(!!message.enabled);
      case 'LABELLER_PROGRESS':
        await recordDownloadProgress(message.payload);
        return { ok: true };
    }
  })()
    .then((r) => sendResponse(r))
    .catch((err) => sendResponse({ error: err instanceof Error ? err.message : String(err) }));
  return true;
}
