/**
 * Offscreen document: the only place the ML runtime lives. The service worker
 * is ephemeral and cannot host WASM reliably, so it creates this page on
 * demand and forwards LABEL_JOB / LABELLER_* requests here.
 */
import { ZeroShotLabeller } from '../services/labeller/zeroShotLabeller';
import { MODEL_ID } from '../services/labeller/labelset';
import { LabelRequest } from '../services/labeller/types';

const TRANSFORMERS_CACHE = 'transformers-cache';

let labeller: ZeroShotLabeller | null = null;

function getLabeller(): ZeroShotLabeller {
  if (!labeller) {
    labeller = new ZeroShotLabeller({
      wasmPaths: chrome.runtime.getURL('wasm/'),
      device: 'wasm',
      onProgress: (p) => {
        chrome.runtime
          .sendMessage({ type: 'LABELLER_PROGRESS', payload: { file: p.file, loaded: p.loaded, total: p.total, status: p.status } })
          .catch(() => {});
      },
    });
  }
  return labeller;
}

/** True when the quantised weights are already in the extension-origin Cache API. */
export async function isModelCached(): Promise<boolean> {
  if (typeof caches === 'undefined') return false;
  try {
    const cache = await caches.open(TRANSFORMERS_CACHE);
    const keys = await cache.keys();
    return keys.some((req) => req.url.includes(MODEL_ID) && /model_quantized\.onnx/.test(req.url));
  } catch {
    return false;
  }
}

async function removeModel(): Promise<void> {
  if (labeller) {
    await labeller.dispose();
    labeller = null;
  }
  if (typeof caches === 'undefined') return;
  const cache = await caches.open(TRANSFORMERS_CACHE);
  const keys = await cache.keys();
  await Promise.all(keys.filter((req) => req.url.includes(MODEL_ID)).map((req) => cache.delete(req)));
}

type OffscreenMessage =
  | { type: 'LABEL_JOB'; payload: LabelRequest }
  | { type: 'LABELLER_WARMUP' }
  | { type: 'LABELLER_DOWNLOAD' }
  | { type: 'LABELLER_IS_CACHED' }
  | { type: 'LABELLER_REMOVE' }
  | { type: 'OFFSCREEN_PING' };

export async function handleOffscreenMessage(message: OffscreenMessage): Promise<unknown> {
  switch (message.type) {
    case 'OFFSCREEN_PING':
      return { ok: true };
    case 'LABELLER_IS_CACHED':
      return { cached: await isModelCached() };
    case 'LABELLER_DOWNLOAD':
    case 'LABELLER_WARMUP':
      await getLabeller().load();
      return { ok: true, ready: true };
    case 'LABELLER_REMOVE':
      await removeModel();
      return { ok: true };
    case 'LABEL_JOB':
      return getLabeller().label(message.payload);
    default:
      return undefined;
  }
}

if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || message.target !== 'offscreen') return false;
    handleOffscreenMessage(message)
      .then((result) => sendResponse({ ok: true, result }))
      .catch((err) => sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }));
    return true;
  });
}
