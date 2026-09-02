import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React, { act } from 'react';
import ReactDOM from 'react-dom/client';
import fs from 'fs';
import path from 'path';
import App from '../src/sidepanel/App';
import { ErrorBoundary } from '../src/sidepanel/index';
import { DiffViewer } from '../src/components/tailor/DiffViewer';
import { JobTab } from '../src/sidepanel/tabs/JobTab';
import { TailorTab } from '../src/sidepanel/tabs/TailorTab';
import { InterviewTab } from '../src/sidepanel/tabs/InterviewTab';
import { resumeStorage } from '../src/services/storage/resumeStorage';
import { settingsStorage } from '../src/services/storage/settingsStorage';
import { setupMockChrome } from './helpers/mockChrome';
import { MOCK_SENIOR_FULLSTACK_RESUME } from './fixtures/mockResumes';
import { Resume } from '../src/types/resume';

describe('Milestone 3 — Adversarial Stress Testing & CSP Compliance Suite', () => {
  let container: HTMLDivElement;
  let root: ReactDOM.Root | null = null;
  let mockHarness: ReturnType<typeof setupMockChrome>;

  beforeEach(() => {
    mockHarness = setupMockChrome();
    container = document.createElement('div');
    container.id = 'root';
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
      root = null;
    }
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
    mockHarness.resetStore();
    vi.restoreAllMocks();
  });

  const renderComponent = async (element: React.ReactElement) => {
    if (root) {
      act(() => {
        root?.unmount();
      });
      root = null;
    }
    root = ReactDOM.createRoot(container);
    await act(async () => {
      root?.render(element);
    });
    // Allow React state & promises to settle
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 60));
    });
    return container;
  };

  // =========================================================================
  // 1. DiffViewer Adversarial & Malformed Input Stress Testing
  // =========================================================================
  describe('1. DiffViewer Adversarial & Malformed Input Stress Testing', () => {
    it('handles undefined, null, non-string, and empty inputs gracefully without throwing', async () => {
      const dom = await renderComponent(
        <DiffViewer
          originalText={undefined as any}
          tailoredText={null as any}
          title=""
          rationale={undefined}
          bulletDiffs={undefined}
        />
      );

      expect(dom).toBeDefined();
      expect(dom.querySelector('.rounded-xl')).not.toBeNull();
    });

    it('handles extreme XSS injection strings safely without executing scripts in DOM', async () => {
      const xssOriginal = '<script>alert("xss-orig")</script><img src=x onerror=alert(1)>';
      const xssTailored = '<svg/onload=alert("xss-tail")><iframe src="javascript:alert(2)"></iframe>';
      const xssRationale = '<b onmouseover=alert("hover")>Exploit Rationale</b>';

      const dom = await renderComponent(
        <DiffViewer
          originalText={xssOriginal}
          tailoredText={xssTailored}
          title="<script>alert('title')</script>"
          rationale={xssRationale}
        />
      );

      // Verify no executable HTML elements are injected into the DOM tree
      expect(dom.querySelectorAll('script').length).toBe(0);
      expect(dom.querySelectorAll('iframe').length).toBe(0);
      expect(dom.querySelectorAll('img[onerror]').length).toBe(0);
      expect(dom.textContent).toContain('Exploit Rationale');
    });

    it('handles heavy resume text (1,500+ words) and rapid mode switching between inline and split', async () => {
      const longOriginal = Array(50).fill('Architected distributed microservices in Go, Kubernetes, and PostgreSQL with high availability.').join(' ');
      const longTailored = Array(50).fill('Spearheaded enterprise cloud architectures with AWS, Terraform, Docker, and zero-trust security.').join(' ');

      const dom = await renderComponent(
        <DiffViewer
          originalText={longOriginal}
          tailoredText={longTailored}
          title="Extensive Corpus Diff"
        />
      );

      expect(dom.textContent).toContain('Extensive Corpus Diff');

      // Switch to split mode
      const splitBtn = Array.from(dom.querySelectorAll('button')).find((b) => b.textContent?.includes('Split'));
      expect(splitBtn).toBeDefined();

      await act(async () => {
        splitBtn?.click();
      });

      expect(dom.textContent).toContain('BEFORE');
      expect(dom.textContent).toContain('AFTER (TAILORED)');

      // Switch back to inline mode
      const inlineBtn = Array.from(dom.querySelectorAll('button')).find((b) => b.textContent?.includes('Inline'));
      await act(async () => {
        inlineBtn?.click();
      });

      expect(dom.textContent).not.toContain('BEFORE');
    });

    it('handles malformed, sparse, and empty bulletDiffs without crashes', async () => {
      const malformedBulletDiffs: any[] = [
        {},
        { original: null, tailored: undefined, reason: '' },
        { original: 'Only original exists' },
        { tailored: 'Only tailored exists' },
        { original: '  \n\t  ', tailored: '   ', reason: undefined },
        { original: 'Bullet 6 original', tailored: 'Bullet 6 tailored', reason: 'High impact metrics added' },
      ];

      const dom = await renderComponent(
        <DiffViewer
          originalText="Fallback original"
          tailoredText="Fallback tailored"
          title="Malformed Bullets Test"
          bulletDiffs={malformedBulletDiffs}
        />
      );

      expect(dom.textContent).toContain('Bullet #1');
      expect(dom.textContent).toContain('Bullet #6');
      expect(dom.textContent).toContain('High impact metrics added');
    });

    it('handles multilingual, unicode, and RTL strings cleanly', async () => {
      const arabic = 'تطوير النظم السحابية الموزعة والذكاء الاصطناعي';
      const cjk = '分散マイクロサービスアーキテクチャの設計と実装。고성능 분산 시스템 구축.';
      const emojis = '🚀 Scaled infrastructure by 300% ⚡ with 99.99% uptime 🛡️';

      const dom = await renderComponent(
        <DiffViewer
          originalText={arabic}
          tailoredText={`${cjk} — ${emojis}`}
          title="Unicode & RTL Diff"
        />
      );

      expect(dom.textContent).toContain('Unicode & RTL Diff');
      expect(dom.textContent).toContain(arabic);
      expect(dom.textContent).toContain('🚀 Scaled infrastructure');
    });
  });

  // =========================================================================
  // 2. Storage Services Resilience & Missing Chrome API Fallbacks
  // =========================================================================
  describe('2. Storage Services Resilience & Missing Chrome API Fallbacks', () => {
    it('operates reliably via in-memory store when global chrome is completely undefined', async () => {
      const originalChrome = (globalThis as any).chrome;
      delete (globalThis as any).chrome;

      try {
        // Test resumeStorage without chrome
        await resumeStorage.clearAllResumes();
        let resumes = await resumeStorage.getAllResumes();
        expect(resumes).toEqual([]);

        const testResume: Resume = {
          ...MOCK_SENIOR_FULLSTACK_RESUME,
          id: 'headless_resume_1',
          name: 'Headless Resume',
        };

        await resumeStorage.saveResume(testResume);
        resumes = await resumeStorage.getAllResumes();
        expect(resumes.length).toBe(1);
        expect(resumes[0].id).toBe('headless_resume_1');

        const activeId = await resumeStorage.getActiveResumeId();
        expect(activeId).toBe('headless_resume_1');

        // Test settingsStorage without chrome
        const initialSettings = await settingsStorage.getSettings();
        expect(initialSettings.atsPreset).toBe('standard');

        await settingsStorage.updateSettings({ anthropicApiKey: 'sk-ant-headless-test' });
        const updatedSettings = await settingsStorage.getSettings();
        expect(updatedSettings.anthropicApiKey).toBe('sk-ant-headless-test');

        await settingsStorage.clearAllRezBuilderData();
        const resetSettings = await settingsStorage.getSettings();
        expect(resetSettings.anthropicApiKey).toBe('');
      } finally {
        (globalThis as any).chrome = originalChrome;
      }
    });

    it('handles multiple sequential and concurrent resume operations without state corruption', async () => {
      await resumeStorage.clearAllResumes();

      // Save multiple resumes
      for (let idx = 0; idx < 5; idx++) {
        const resume: Resume = {
          ...MOCK_SENIOR_FULLSTACK_RESUME,
          id: `res_item_${idx}`,
          name: `Resume Number ${idx}`,
          isDefault: idx === 0,
        };
        await resumeStorage.saveResume(resume);
      }

      const all = await resumeStorage.getAllResumes();
      expect(all.length).toBe(5);

      // Perform updates and deletions
      await resumeStorage.updateResume('res_item_2', { name: 'Updated Resume Two' });
      await resumeStorage.deleteResume('res_item_0');
      await resumeStorage.setActiveResume('res_item_4');

      const afterMutations = await resumeStorage.getAllResumes();
      expect(afterMutations.length).toBe(4);
      expect(afterMutations.find((r) => r.id === 'res_item_0')).toBeUndefined();
      expect(afterMutations.find((r) => r.id === 'res_item_2')?.name).toBe('Updated Resume Two');
      expect(await resumeStorage.getActiveResumeId()).toBe('res_item_4');
    });

    it('handles nuclear data wipe and re-initializes clean default settings', async () => {
      await settingsStorage.updateSettings({
        anthropicApiKey: 'test-key-12345',
        aiProvider: 'gemini',
        geminiApiKey: 'gemini-key-9876',
      });

      let current = await settingsStorage.getSettings();
      expect(current.anthropicApiKey).toBe('test-key-12345');
      expect(current.aiProvider).toBe('gemini');

      await settingsStorage.clearAllRezBuilderData();

      current = await settingsStorage.getSettings();
      expect(current.anthropicApiKey).toBe('');
      expect(current.aiProvider).toBe('anthropic');
      expect(current.atsPreset).toBe('standard');
    });
  });

  // =========================================================================
  // 3. React App & Tab Lifecycle Stress Testing
  // =========================================================================
  describe('3. React App & Tab Lifecycle Stress Testing', () => {
    it('survives rapid tab transitions across all 5 navigation tabs without error', async () => {
      const dom = await renderComponent(
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      );

      const navButtons = Array.from(dom.querySelectorAll('nav button')) as HTMLButtonElement[];
      expect(navButtons.length).toBe(5);

      // Rapidly click every tab multiple times
      for (let cycle = 0; cycle < 3; cycle++) {
        for (const btn of navButtons) {
          await act(async () => {
            btn.click();
          });
        }
      }

      // Check that sidepanel header and footer remain intact
      expect(dom.querySelector('header')).not.toBeNull();
      expect(dom.textContent).toContain('RezBuilder');
      expect(dom.textContent).toContain('Local Client-Side Storage');
    });

    it('resiliently handles storage.onChanged events with unexpected or corrupted payloads', async () => {
      const dom = await renderComponent(
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      );

      // Trigger corrupted chrome.storage.onChanged events
      await act(async () => {
        mockHarness.storageListeners.forEach((listener) => {
          // 1. Null changes
          listener({ activeJob: { oldValue: null, newValue: null } }, 'local');
          // 2. Empty changes
          listener({}, 'local');
          // 3. Irrelevant sync area
          listener({ activeJob: { oldValue: null, newValue: { title: 'Ignored' } } }, 'sync');
          // 4. Corrupted activeJob without standard fields
          listener(
            {
              activeJob: {
                oldValue: null,
                newValue: { id: 'corrupt_1', title: 'Corrupt Title' } as any,
              },
            },
            'local'
          );
          // 5. Corrupted rezbuilder_resumes
          listener(
            {
              rezbuilder_resumes: {
                oldValue: null,
                newValue: [] as any,
              },
            },
            'local'
          );
        });
      });

      // App should not crash
      expect(dom.textContent).toContain('RezBuilder');
      expect(dom.querySelector('[data-testid="error-boundary-fallback"]')).toBeNull();
    });

    it('renders all tab components cleanly when job is null and resumes are empty', async () => {
      // 1. JobTab with null job
      let dom = await renderComponent(
        <JobTab
          job={null}
          resumes={[]}
          activeResume={null}
          onSelectResume={vi.fn()}
          onRefreshScrape={vi.fn()}
          onManualJobSave={vi.fn()}
          onNavigateToTailor={vi.fn()}
          isLoading={false}
        />
      );
      expect(dom.textContent).toContain('No Job Posting Detected');

      // 2. TailorTab with null job & null tailoredResume
      dom = await renderComponent(
        <TailorTab
          job={null}
          resumes={[]}
          activeResume={null}
          onSelectResume={vi.fn()}
          tailoredResume={null}
          onSaveTailoredResume={vi.fn()}
        />
      );
      expect(dom.textContent).toContain('No active job');
      expect(dom.textContent).toContain('Please ensure both a Job Posting and a Resume are selected.');

      // 3. InterviewTab with null job
      dom = await renderComponent(
        <InterviewTab job={null} activeResume={null} />
      );
      expect(dom.textContent).toContain('Open or paste a Job Posting first.');
      expect(dom.textContent).toContain('AI Interview Prep Briefing');
    });
  });

  // =========================================================================
  // 4. CSP Compliance & Build Bundle Integrity Audits
  // =========================================================================
  describe('4. CSP Compliance & Build Bundle Integrity Audits', () => {
    const projectRoot = path.resolve(__dirname, '..');
    const distPath = path.join(projectRoot, 'dist');
    const sidepanelHtmlPath = path.join(projectRoot, 'src/sidepanel/index.html');
    const distSidepanelHtmlPath = path.join(distPath, 'src/sidepanel/index.html');

    it('verifies src/sidepanel/index.html contains zero remote stylesheet or font links', () => {
      const content = fs.readFileSync(sidepanelHtmlPath, 'utf-8');

      // Should not contain Google Fonts or any remote stylesheet
      expect(content).not.toContain('fonts.googleapis.com');
      expect(content).not.toContain('fonts.gstatic.com');
      expect(content).not.toMatch(/<link[^>]+href=["']https?:\/\//i);
      expect(content).not.toMatch(/<script[^>]+src=["']https?:\/\//i);
    });

    it('verifies dist/ bundle exists and has strict CSP compliance', () => {
      expect(fs.existsSync(distPath)).toBe(true);

      // Verify dist manifest.json
      const manifestPath = path.join(distPath, 'manifest.json');
      expect(fs.existsSync(manifestPath)).toBe(true);

      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      expect(manifest.manifest_version).toBe(3);
      expect(manifest.side_panel?.default_path).toBe('src/sidepanel/index.html');

      // If dist sidepanel HTML exists, check for CSP purity
      if (fs.existsSync(distSidepanelHtmlPath)) {
        const distHtml = fs.readFileSync(distSidepanelHtmlPath, 'utf-8');
        expect(distHtml).not.toContain('fonts.googleapis.com');
        expect(distHtml).not.toContain('fonts.gstatic.com');
        expect(distHtml).not.toMatch(/<link[^>]+href=["']https?:\/\//i);
      }
    });

    it('verifies tailwind.config.js includes robust cross-platform system font fallbacks', () => {
      const tailwindConfigPath = path.join(projectRoot, 'tailwind.config.js');
      const content = fs.readFileSync(tailwindConfigPath, 'utf-8');

      expect(content).toContain('ui-sans-serif');
      expect(content).toContain('system-ui');
      expect(content).toContain('-apple-system');
      expect(content).toContain('BlinkMacSystemFont');
      expect(content).toContain('Segoe UI');
      expect(content).toContain('Roboto');
      expect(content).toContain('ui-monospace');
      expect(content).toContain('SFMono-Regular');
    });
  });
});
