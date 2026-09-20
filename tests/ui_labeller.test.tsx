import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React, { act } from 'react';
import ReactDOM from 'react-dom/client';
import { JobTab } from '../src/sidepanel/tabs/JobTab';
import { LocalLabellerCard } from '../src/components/settings/LocalLabellerCard';
import { SettingsTab } from '../src/sidepanel/tabs/SettingsTab';
import { MOCK_SENIOR_PROFILE, MOCK_SENIOR_BACKEND_JOB } from './fixtures/mockProfiles';
import { MOCK_SENIOR_FULLSTACK_RESUME } from './fixtures/mockResumes';
import { setupMockChrome } from './helpers/mockChrome';
import { LABELLER_STATE_KEY, LabellerStatus } from '../src/services/labeller/types';
import { MODEL_ID, MODEL_SIZE_BYTES } from '../src/services/labeller/labelset';
import { JobPosting } from '../src/types/job';

describe('On-device labeller UI', () => {
  let container: HTMLDivElement;
  let root: ReactDOM.Root | null = null;
  let h: ReturnType<typeof setupMockChrome>;

  beforeEach(() => {
    h = setupMockChrome();
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (root) {
      act(() => root?.unmount());
      root = null;
    }
    container.remove();
    h.resetStore();
    vi.restoreAllMocks();
  });

  const render = async (el: React.ReactElement) => {
    root = ReactDOM.createRoot(container);
    await act(async () => root?.render(el));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30));
    });
    return container;
  };

  const jobTab = (job: JobPosting) => (
    <JobTab
      job={job}
      profile={MOCK_SENIOR_PROFILE}
      resumes={[MOCK_SENIOR_FULLSTACK_RESUME]}
      activeResume={MOCK_SENIOR_FULLSTACK_RESUME}
      onSelectResume={vi.fn()}
      onRefreshScrape={vi.fn()}
      onManualJobSave={vi.fn()}
      onNavigateToTailor={vi.fn()}
      isLoading={false}
    />
  );

  describe('JobTab', () => {
    it('shows the labelling state instead of the Best Fit card while pending', async () => {
      const dom = await render(jobTab({ ...MOCK_SENIOR_BACKEND_JOB, labelling: { status: 'pending' } }));
      expect(dom.querySelector('[data-testid="best-fit-labelling"]')).not.toBeNull();
      expect(dom.querySelector('[data-testid="best-fit-card"]')).toBeNull();
      expect(dom.textContent).toContain('Labelling posting sections on-device');
    });

    it('renders Best Fit once labelling is done and mentions on-device labels in the source line', async () => {
      const job: JobPosting = {
        ...MOCK_SENIOR_BACKEND_JOB,
        labelling: { status: 'done', modelId: MODEL_ID, labelledSegments: 1 },
        sections: [
          { heading: 'Requirements', kind: 'required', kindSource: 'heading', items: ['TypeScript', 'Node.js'] },
          { heading: 'Fit', kind: 'preferred', kindSource: 'model', confidence: 0.8, items: ['Kafka'] },
        ],
      };
      const dom = await render(jobTab(job));
      expect(dom.querySelector('[data-testid="best-fit-card"]')).not.toBeNull();
      await act(async () => {
        (dom.querySelector('[data-testid="best-fit-breakdown-toggle"]') as HTMLButtonElement).click();
      });
      const src = dom.querySelector('[data-testid="best-fit-requirements-source"]')!;
      expect(src.textContent).toContain('2 posting sections');
      expect(src.textContent).toContain('1 labelled on-device');
    });

    it('falls back to heuristics with a footnote when labelling timed out', async () => {
      const dom = await render(jobTab({ ...MOCK_SENIOR_BACKEND_JOB, labelling: { status: 'timeout' } }));
      expect(dom.querySelector('[data-testid="best-fit-card"]')).not.toBeNull();
      expect(dom.querySelector('[data-testid="best-fit-labelling-fallback"]')!.textContent).toContain('timed out');
    });

    it('renders normally for jobs without labelling metadata', async () => {
      const dom = await render(jobTab(MOCK_SENIOR_BACKEND_JOB));
      expect(dom.querySelector('[data-testid="best-fit-card"]')).not.toBeNull();
      expect(dom.querySelector('[data-testid="best-fit-labelling"]')).toBeNull();
    });
  });

  describe('LocalLabellerCard', () => {
    const status = (over: Partial<LabellerStatus>): LabellerStatus => ({
      enabled: false,
      state: 'absent',
      modelId: MODEL_ID,
      sizeBytes: MODEL_SIZE_BYTES,
      ...over,
    });

    /** Background stand-in answering the card's messages. */
    const installBackground = (initial: LabellerStatus) => {
      let current = initial;
      const seen: any[] = [];
      h.messageListeners.push((msg, _sender, sendResponse) => {
        seen.push(msg);
        switch (msg.type) {
          case 'LABELLER_STATUS':
            sendResponse(current);
            return false;
          case 'LABELLER_DOWNLOAD':
            current = status({ enabled: true, state: 'ready' });
            sendResponse(current);
            return false;
          case 'LABELLER_SET_ENABLED':
            current = { ...current, enabled: !!msg.enabled };
            sendResponse(current);
            return false;
          case 'LABELLER_REMOVE':
            current = status({});
            sendResponse(current);
            return false;
        }
        return false;
      });
      return seen;
    };

    it('asks for consent before downloading, then reports ready + enabled', async () => {
      const seen = installBackground(status({}));
      const onEnabled = vi.fn();
      const dom = await render(<LocalLabellerCard onEnabledChange={onEnabled} />);
      expect(dom.querySelector('[data-testid="local-labeller-state"]')!.textContent).toContain('Not downloaded');
      expect(dom.textContent).toContain('87 MB');

      await act(async () => (dom.querySelector('[data-testid="local-labeller-toggle"]') as HTMLButtonElement).click());
      expect(dom.querySelector('[data-testid="local-labeller-consent"]')).not.toBeNull();
      expect(seen.some((m) => m.type === 'LABELLER_DOWNLOAD')).toBe(false);

      await act(async () => (dom.querySelector('[data-testid="local-labeller-download"]') as HTMLButtonElement).click());
      expect(seen.some((m) => m.type === 'LABELLER_DOWNLOAD')).toBe(true);
      expect(dom.querySelector('[data-testid="local-labeller-state"]')!.textContent).toContain('Ready');
      expect(dom.querySelector('[data-testid="local-labeller-toggle"]')!.getAttribute('aria-checked')).toBe('true');
      expect(onEnabled).toHaveBeenLastCalledWith(true);
    });

    it('toggles off without re-downloading when the model is ready', async () => {
      const seen = installBackground(status({ enabled: true, state: 'ready' }));
      const dom = await render(<LocalLabellerCard onEnabledChange={vi.fn()} />);
      await act(async () => (dom.querySelector('[data-testid="local-labeller-toggle"]') as HTMLButtonElement).click());
      expect(seen.filter((m) => m.type === 'LABELLER_SET_ENABLED').map((m) => m.enabled)).toEqual([false]);
      expect(seen.some((m) => m.type === 'LABELLER_DOWNLOAD')).toBe(false);
    });

    it('shows download progress from storage changes and disables the toggle meanwhile', async () => {
      installBackground(status({ state: 'downloading', progress: 0.42 }));
      const dom = await render(<LocalLabellerCard onEnabledChange={vi.fn()} />);
      expect(dom.querySelector('[data-testid="local-labeller-state"]')!.textContent).toContain('42%');
      expect((dom.querySelector('[data-testid="local-labeller-toggle"]') as HTMLButtonElement).disabled).toBe(true);
    });

    it('offers removal when ready', async () => {
      const seen = installBackground(status({ enabled: true, state: 'ready' }));
      const dom = await render(<LocalLabellerCard onEnabledChange={vi.fn()} />);
      await act(async () => (dom.querySelector('[data-testid="local-labeller-remove"]') as HTMLButtonElement).click());
      expect(seen.some((m) => m.type === 'LABELLER_REMOVE')).toBe(true);
      expect(dom.querySelector('[data-testid="local-labeller-state"]')!.textContent).toContain('Not downloaded');
    });

    it('refreshes when the background updates the model state', async () => {
      const seen = installBackground(status({}));
      await render(<LocalLabellerCard onEnabledChange={vi.fn()} />);
      const before = seen.filter((m) => m.type === 'LABELLER_STATUS').length;
      await act(async () => {
        await h.mockChrome.storage.local.set({ [LABELLER_STATE_KEY]: { state: 'downloading', progress: 0.1 } });
        await new Promise((r) => setTimeout(r, 10));
      });
      expect(seen.filter((m) => m.type === 'LABELLER_STATUS').length).toBeGreaterThan(before);
    });
  });

  it('SettingsTab hosts the labeller card and saving keeps the background-owned flag', async () => {
    h.store.local.rezbuilder_settings = { enableLocalLabeller: false };
    h.messageListeners.push((msg, _s, sendResponse) => {
      if (msg.type === 'LABELLER_STATUS') {
        sendResponse({ enabled: true, state: 'ready', modelId: MODEL_ID, sizeBytes: MODEL_SIZE_BYTES });
      }
      return false;
    });
    const dom = await render(<SettingsTab onDataCleared={vi.fn()} />);
    expect(dom.querySelector('[data-testid="local-labeller-card"]')).not.toBeNull();
    // Background flips the flag (e.g. download consent) after the tab loaded its draft…
    h.store.local.rezbuilder_settings = { enableLocalLabeller: true, labellerConsentAt: '2026-09-20T00:00:00.000Z' };
    const save = Array.from(dom.querySelectorAll('button')).find((b) => b.textContent?.includes('Save Settings'))!;
    await act(async () => save.click());
    // …and saving the draft must not clobber it.
    expect(h.store.local.rezbuilder_settings.enableLocalLabeller).toBe(true);
    expect(h.store.local.rezbuilder_settings.labellerConsentAt).toBe('2026-09-20T00:00:00.000Z');
    expect(h.store.local.rezbuilder_settings.atsPreset).toBe('standard');
  });
});
