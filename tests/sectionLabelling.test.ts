import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupMockChrome, SetupMockChromeResult } from './helpers/mockChrome';
import { JobPosting, JobSection } from '../src/types/job';
import { LabelRequest, LabelResponse, LABELLER_STATE_KEY, LABEL_CACHE_KEY } from '../src/services/labeller/types';
import { LABELSET_VERSION, MODEL_ID } from '../src/services/labeller/labelset';
import { applyLabels, planLabelling } from '../src/services/labeller/planLabelling';
import { cacheKey, hashText } from '../src/services/labeller/labelCache';
import { extractJobRequirements } from '../src/services/fit/jobRequirements';
import {
  downloadModel,
  getLabellerStatus,
  recordDetectionWithLabelling,
  removeModel,
  setOffscreenTransportForTests,
} from '../src/background/sectionLabelling';

const SETTINGS_KEY = 'rezbuilder_settings';

function section(partial: Partial<JobSection> & Pick<JobSection, 'items'>): JobSection {
  return { heading: '', kind: 'unknown', kindSource: 'default', ...partial };
}

function job(partial: Partial<JobPosting> = {}): JobPosting {
  return {
    id: 'job_1',
    title: 'Platform Engineer',
    company: 'TinyCo',
    description: 'You will run Kubernetes on GCP\nYou are fluent in Go\nPulumi would be great',
    requiredSkills: [],
    url: 'https://boards.greenhouse.io/tinyco/jobs/1',
    source: 'greenhouse',
    scrapedAt: '2026-09-01T00:00:00.000Z',
    detection: { score: 90, confidence: 'high' },
    sections: [
      section({ heading: 'You might be a fit if', kind: 'required', kindSource: 'heading', items: ['You are fluent in Go'] }),
      section({ heading: 'Our interview loop', items: ['Three rounds'] }),
      section({ items: ['You will run Kubernetes on GCP', 'Pulumi would be great'] }),
    ],
    ...partial,
  };
}

/** Fake offscreen: records requests and answers from a script. */
function fakeTransport(answer: (req: LabelRequest) => Partial<LabelResponse> | Promise<Partial<LabelResponse>>) {
  const calls: { type: string; payload?: unknown }[] = [];
  setOffscreenTransportForTests(async (message) => {
    calls.push(message);
    if (message.type !== 'LABEL_JOB') return { ok: true };
    const req = message.payload as LabelRequest;
    const partial = await answer(req);
    return { kinds: {}, ms: 12, modelId: MODEL_ID, labelsetVersion: LABELSET_VERSION, ...partial } as LabelResponse;
  });
  return calls;
}

describe('planLabelling / applyLabels (pure)', () => {
  it('sends heading text for unknown headed sections and items for headingless blocks', () => {
    const plan = planLabelling(job());
    expect(plan.segments.map((s) => s.text)).toEqual(['Our interview loop', 'You will run Kubernetes on GCP', 'Pulumi would be great']);
    expect(plan.pageCheck).toBeUndefined();
    expect([...plan.sectionSegments.keys()]).toEqual([1, 2]);
  });

  it('requests a page check only for medium-confidence detections', () => {
    expect(planLabelling(job({ detection: { score: 70, confidence: 'medium' } })).pageCheck).toMatchObject({ title: 'Platform Engineer' });
    expect(planLabelling(job({ detection: { score: 95, confidence: 'high' } })).pageCheck).toBeUndefined();
    expect(planLabelling(job({ detection: undefined })).pageCheck).toBeUndefined();
  });

  it('applies labels: headed sections take the heading label, headingless blocks split by kind', () => {
    const j = job();
    const plan = planLabelling(j);
    const sections = applyLabels(j, plan, {
      's1:h': { kind: 'other', confidence: 0.7 },
      's2:i0': { kind: 'responsibilities', confidence: 0.8 },
      's2:i1': { kind: 'preferred', confidence: 0.6 },
    });
    expect(sections[0]).toEqual(j.sections![0]);
    expect(sections[1]).toMatchObject({ heading: 'Our interview loop', kind: 'other', kindSource: 'model', confidence: 0.7 });
    expect(sections.slice(2).map((s) => [s.kind, s.items])).toEqual([
      ['responsibilities', ['You will run Kubernetes on GCP']],
      ['preferred', ['Pulumi would be great']],
    ]);
  });

  it('leaves unanswered segments unknown', () => {
    const j = job();
    const sections = applyLabels(j, planLabelling(j), {});
    expect(sections[1].kind).toBe('unknown');
    expect(sections[2].kind).toBe('unknown');
  });

  it('model-labelled sections bucket exactly like heading-labelled ones', () => {
    const j = job();
    const plan = planLabelling(j);
    const labelled = { ...j, sections: applyLabels(j, plan, { 's2:i1': { kind: 'preferred', confidence: 0.9 }, 's2:i0': { kind: 'required', confidence: 0.9 } }) };
    const r = extractJobRequirements(labelled);
    expect(r.requiredSkills).toEqual(expect.arrayContaining(['go', 'kubernetes', 'gcp']));
    expect(r.unknownSectionCount).toBe(1);
  });
});

describe('labelCache keys', () => {
  it('normalises whitespace and case and embeds the labelset version', () => {
    expect(cacheKey('  Nice   To Have ')).toBe(cacheKey('nice to have'));
    expect(cacheKey('a')).toMatch(new RegExp(`^${LABELSET_VERSION}:`));
    expect(hashText('abc')).not.toBe(hashText('abd'));
  });
});

describe('recordDetectionWithLabelling', () => {
  let h: SetupMockChromeResult;
  const isActive = async () => true;

  beforeEach(() => {
    h = setupMockChrome();
    vi.useRealTimers();
  });
  afterEach(() => {
    setOffscreenTransportForTests(null);
    h.resetStore();
  });

  const enable = (state = 'ready') => {
    h.store.local[SETTINGS_KEY] = { enableLocalLabeller: true };
    h.store.local[LABELLER_STATE_KEY] = { state };
  };

  it('disabled: stores the deterministic job with status=disabled and never touches the offscreen page', async () => {
    const calls = fakeTransport(() => ({}));
    const out = await recordDetectionWithLabelling(1, job(), isActive);
    expect(out?.labelling).toEqual({ status: 'disabled' });
    expect(h.store.local.activeJob.labelling.status).toBe('disabled');
    expect(calls).toHaveLength(0);
    expect(h.mockChrome.offscreen.createDocument).not.toHaveBeenCalled();
  });

  it('enabled but model absent: status=unavailable, no model call', async () => {
    enable('absent');
    const calls = fakeTransport(() => ({}));
    const out = await recordDetectionWithLabelling(1, job(), isActive);
    expect(out?.labelling?.status).toBe('unavailable');
    expect(calls).toHaveLength(0);
  });

  it('nothing unknown and high confidence: status=skipped', async () => {
    enable();
    const calls = fakeTransport(() => ({}));
    const j = job({ sections: [section({ heading: 'Requirements', kind: 'required', kindSource: 'heading', items: ['Go'] })] });
    const out = await recordDetectionWithLabelling(1, j, isActive);
    expect(out?.labelling?.status).toBe('skipped');
    expect(calls).toHaveLength(0);
  });

  it('labels unknown sections, publishes pending first, then the merged job', async () => {
    enable();
    const seen: string[] = [];
    h.storageListeners.push((changes, area) => {
      if (area === 'local' && changes.activeJob?.newValue) seen.push(changes.activeJob.newValue.labelling.status);
    });
    const calls = fakeTransport((req) => ({
      kinds: Object.fromEntries(req.segments.map((s) => [s.id, { kind: s.text.includes('Pulumi') ? 'preferred' : 'responsibilities', confidence: 0.8 }])),
    }));
    const out = await recordDetectionWithLabelling(1, job(), isActive);
    expect(seen).toEqual(['pending', 'done']);
    expect(out?.labelling).toMatchObject({ status: 'done', modelId: MODEL_ID, labelledSegments: 3 });
    expect(out?.sections!.map((s) => s.kind)).toEqual(['required', 'responsibilities', 'responsibilities', 'preferred']);
    expect(calls.filter((c) => c.type === 'LABEL_JOB')).toHaveLength(1);
    expect(h.store.session[LABEL_CACHE_KEY]).toBeDefined();
    expect(Object.keys(h.store.session[LABEL_CACHE_KEY])).toHaveLength(3);
  });

  it('second identical job is served from the cache with zero model calls', async () => {
    enable();
    fakeTransport((req) => ({ kinds: Object.fromEntries(req.segments.map((s) => [s.id, { kind: 'other', confidence: 0.9 }])) }));
    await recordDetectionWithLabelling(1, job(), isActive);
    const calls = fakeTransport(() => ({}));
    const out = await recordDetectionWithLabelling(2, job({ id: 'job_2' }), isActive);
    expect(calls).toHaveLength(0);
    expect(out?.labelling).toMatchObject({ status: 'done', ms: 0, labelledSegments: 2 });
  });

  it('timeout: publishes the deterministic job with status=timeout', async () => {
    enable();
    vi.useFakeTimers();
    fakeTransport(() => new Promise(() => {}));
    const p = recordDetectionWithLabelling(1, job(), isActive);
    await vi.advanceTimersByTimeAsync(6500);
    const out = await p;
    expect(out?.labelling?.status).toBe('timeout');
    expect(out?.sections![1].kind).toBe('unknown');
    expect(h.store.local.activeJob.labelling.status).toBe('timeout');
  });

  it('failure: publishes status=failed', async () => {
    enable();
    setOffscreenTransportForTests(async () => {
      throw new Error('no available backend found');
    });
    const out = await recordDetectionWithLabelling(1, job(), isActive);
    expect(out?.labelling?.status).toBe('failed');
  });

  it('stale guard: does not overwrite a job that replaced the one being labelled', async () => {
    enable();
    let resolveLabels: (r: Partial<LabelResponse>) => void = () => {};
    fakeTransport(() => new Promise((res) => (resolveLabels = res)));
    const p = recordDetectionWithLabelling(1, job(), isActive);
    await new Promise((r) => setTimeout(r, 0));
    // Tab navigated: a newer job now owns the slot.
    h.store.session.tabJobs = { '1': job({ id: 'job_newer', sections: [] }) };
    h.store.local.activeJob = h.store.session.tabJobs['1'];
    resolveLabels({ kinds: { 's1:h': { kind: 'other', confidence: 0.9 } } });
    const out = await p;
    expect(out?.labelling?.status).toBe('done');
    expect(h.store.session.tabJobs['1'].id).toBe('job_newer');
    expect(h.store.local.activeJob.id).toBe('job_newer');
  });

  it('demotes a medium-confidence page when the verdict is "not a job"', async () => {
    enable();
    fakeTransport(() => ({ pageVerdict: { isJob: false, confidence: 0.93 } }));
    const out = await recordDetectionWithLabelling(1, job({ detection: { score: 68, confidence: 'medium' } }), isActive);
    expect(out).toBeNull();
    expect(h.store.local.activeJob).toBeUndefined();
    expect(h.store.session.tabJobs?.['1']).toBeUndefined();
  });

  it('never demotes a high-confidence page even if the model dislikes it', async () => {
    enable();
    const calls = fakeTransport(() => ({ pageVerdict: { isJob: false, confidence: 0.99 } }));
    const out = await recordDetectionWithLabelling(1, job({ detection: { score: 95, confidence: 'high' } }), isActive);
    expect(out).not.toBeNull();
    const req = calls.find((c) => c.type === 'LABEL_JOB')!.payload as LabelRequest;
    expect(req.pageCheck).toBeUndefined();
  });

  it('keeps a medium-confidence page when the verdict is a job', async () => {
    enable();
    fakeTransport(() => ({ pageVerdict: { isJob: true, confidence: 0.2 } }));
    const out = await recordDetectionWithLabelling(1, job({ detection: { score: 68, confidence: 'medium' } }), isActive);
    expect(out?.labelling?.status).toBe('done');
    expect(h.store.local.activeJob.id).toBe('job_1');
  });
});

describe('labeller management', () => {
  let h: SetupMockChromeResult;
  beforeEach(() => {
    h = setupMockChrome();
  });
  afterEach(() => {
    setOffscreenTransportForTests(null);
    h.resetStore();
  });

  it('status defaults to disabled / absent', async () => {
    const s = await getLabellerStatus();
    expect(s).toMatchObject({ enabled: false, state: 'absent', modelId: MODEL_ID });
    expect(s.sizeBytes).toBeGreaterThan(50_000_000);
  });

  it('download success marks the model ready, enables the setting and records consent', async () => {
    const calls = fakeTransport(() => ({}));
    const s = await downloadModel();
    expect(calls.map((c) => c.type)).toEqual(['LABELLER_DOWNLOAD']);
    expect(s).toMatchObject({ enabled: true, state: 'ready' });
    expect(h.store.local[SETTINGS_KEY].labellerConsentAt).toBeTruthy();
  });

  it('download failure without WebAssembly is reported as unsupported', async () => {
    setOffscreenTransportForTests(async () => {
      throw new Error('no available backend found. ERR: [wasm] ...');
    });
    const s = await downloadModel();
    expect(s.state).toBe('unsupported');
    expect(s.enabled).toBe(false);
  });

  it('remove resets the state, disables the setting and closes the offscreen page', async () => {
    fakeTransport(() => ({}));
    await downloadModel();
    const s = await removeModel();
    expect(s).toMatchObject({ enabled: false, state: 'absent' });
  });

  it('the default transport creates exactly one offscreen document', async () => {
    setOffscreenTransportForTests(null);
    h.messageListeners.push((msg, _s, sendResponse) => {
      if (msg.target === 'offscreen') {
        sendResponse({ ok: true, result: { ok: true } });
        return true;
      }
      return false;
    });
    await downloadModel();
    await downloadModel();
    expect(h.mockChrome.offscreen.createDocument).toHaveBeenCalledTimes(1);
  });
});
