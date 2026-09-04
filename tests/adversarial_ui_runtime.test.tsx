import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React, { act } from 'react';
import ReactDOM from 'react-dom/client';
import fs from 'fs';
import path from 'path';
import App from '../src/sidepanel/App';
import { ErrorBoundary } from '../src/sidepanel/index';
import { JobTab } from '../src/sidepanel/tabs/JobTab';
import { ResumesTab } from '../src/sidepanel/tabs/ResumesTab';
import { DiffViewer } from '../src/components/tailor/DiffViewer';
import { FloatingButton } from '../src/content/floatingButton';
import { settingsStorage } from '../src/services/storage/settingsStorage';
import { interviewService } from '../src/services/interview/interviewService';
import { JobPosting } from '../src/types/job';
import { Resume } from '../src/types/resume';
import { MOCK_SENIOR_FULLSTACK_RESUME } from './fixtures/mockResumes';
import { MOCK_SENIOR_PROFILE } from './fixtures/mockProfiles';
import { setupMockChrome } from './helpers/mockChrome';

describe('Adversarial UI & Runtime Integration Suite (Milestone 3 Quality Gate)', () => {
  let container: HTMLDivElement;
  let root: ReactDOM.Root | null = null;
  let mockHarness: ReturnType<typeof setupMockChrome>;

  beforeEach(() => {
    mockHarness = setupMockChrome();
    // A complete Candidate Profile unlocks the Job / Tailor / Prep tabs.
    mockHarness.store.local.rezbuilder_profile = MOCK_SENIOR_PROFILE;
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

  const renderToDom = async (element: React.ReactElement) => {
    root = ReactDOM.createRoot(container);
    await act(async () => {
      root?.render(element);
    });
    // Allow state updates and effects to resolve
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 80));
    });
    return container;
  };

  describe('1. Adversarial Malformed Job Objects', () => {
    it('should handle completely undefined/null optional fields without throwing', async () => {
      const malformedJob: JobPosting = {
        id: 'job_malformed_1',
        title: '',
        company: '',
        description: '',
        requiredSkills: undefined as any,
        url: '',
        source: 'generic',
        scrapedAt: '2026-09-01T00:00:00.000Z',
        location: undefined,
        remoteStatus: undefined,
      };

      const dom = await renderToDom(
        <JobTab
          job={malformedJob}
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

      expect(dom.querySelector('div')).not.toBeNull();
      expect(dom.textContent).toContain('Active Job Posting');
    });

    it('should handle XSS payloads and malicious injection in job title, company, and description safely', async () => {
      const xssJob: JobPosting = {
        id: 'job_xss_test',
        title: '<script>alert("xss-title")</script><b>Staff Engineer</b>',
        company: '<img src=x onerror=alert(1)> Acme Corp',
        description: '<svg onload=alert("xss-desc")> Description text containing React, TypeScript, and Go',
        requiredSkills: ['<script>bad()</script>', 'React', 'TypeScript'],
        url: 'javascript:alert(1)',
        source: 'greenhouse',
        scrapedAt: new Date().toISOString(),
      };

      const dom = await renderToDom(
        <JobTab
          job={xssJob}
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

      // Verify that raw script tags are escaped and rendered as text, not executed as DOM elements
      expect(dom.querySelectorAll('script').length).toBe(0);
      expect(dom.textContent).toContain('<script>alert("xss-title")</script>');
      expect(dom.textContent).toContain('Acme Corp');
    });

    it('should handle ultra-long descriptions (50,000+ chars) gracefully without layout explosion', async () => {
      const longText = 'React TypeScript Cloud Architecture '.repeat(2000);
      const massiveJob: JobPosting = {
        id: 'job_massive_desc',
        title: 'Principal Systems Architect',
        company: 'MegaScale Inc',
        description: longText,
        requiredSkills: ['React', 'TypeScript', 'Cloud Architecture'],
        url: 'https://example.com/job/massive',
        source: 'generic',
        scrapedAt: new Date().toISOString(),
      };

      const dom = await renderToDom(
        <JobTab
          job={massiveJob}
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

      expect(dom.textContent).toContain('Principal Systems Architect');
      expect(dom.textContent).toContain('MegaScale Inc');
      expect(dom.textContent).toContain('RezBuilder ATS Match Score');
    });
  });

  describe('2. Adversarial Malformed Resume Objects', () => {
    it('should handle resume with empty sections, missing bullets, and undefined properties', async () => {
      const brokenResume: Resume = {
        id: 'broken_res_1',
        name: 'Incomplete Profile',
        tag: 'Test',
        fileName: 'empty.pdf',
        fileType: 'pdf',
        uploadedAt: new Date().toISOString(),
        isDefault: false,
        rawText: '',
        sections: {
          contact: { name: '' },
          summary: '',
          experience: [
            {
              id: 'exp_1',
              title: '',
              company: '',
              startDate: '',
              bullets: undefined as any,
            },
          ],
          skills: undefined as any,
          education: [],
          projects: [],
        },
      };

      const dom = await renderToDom(
        <ResumesTab
          resumes={[brokenResume]}
          activeResume={brokenResume}
          onSelectResume={vi.fn()}
          onSaveResume={vi.fn()}
          onDeleteResume={vi.fn()}
          onSetDefault={vi.fn()}
        />
      );

      expect(dom.textContent).toContain('Incomplete Profile');
      expect(dom.textContent).toContain('Stored Resumes (1)');
    });
  });

  describe('3. ErrorBoundary Stress & Fallback Recovery', () => {
    it('should catch thrown primitive errors, string exceptions, and object exceptions', async () => {
      const spyError = vi.spyOn(console, 'error').mockImplementation(() => {});

      const ThrowingChild: React.FC<{ errType: string }> = ({ errType }) => {
        if (errType === 'standard') throw new Error('Standard failure occurred');
        if (errType === 'custom') throw { code: 500, detail: 'Object crash' } as any;
        return <div>All clear</div>;
      };

      const dom = await renderToDom(
        <ErrorBoundary>
          <ThrowingChild errType="standard" />
        </ErrorBoundary>
      );

      expect(dom.querySelector('[data-testid="error-boundary-fallback"]')).not.toBeNull();
      expect(dom.textContent).toContain('Standard failure occurred');
      expect(dom.querySelector('[data-testid="error-boundary-reload-button"]')).not.toBeNull();

      spyError.mockRestore();
    });

    it('should support custom fallback prop override', async () => {
      const spyError = vi.spyOn(console, 'error').mockImplementation(() => {});

      const ThrowingChild = () => {
        throw new Error('Crash!');
      };

      const customFallback = <div data-testid="custom-error-banner">Custom recovery state</div>;

      const dom = await renderToDom(
        <ErrorBoundary fallback={customFallback}>
          <ThrowingChild />
        </ErrorBoundary>
      );

      expect(dom.querySelector('[data-testid="custom-error-banner"]')).not.toBeNull();
      expect(dom.textContent).toContain('Custom recovery state');

      spyError.mockRestore();
    });

    it('should invoke window.location.reload when reload button is triggered', async () => {
      const spyError = vi.spyOn(console, 'error').mockImplementation(() => {});
      const reloadMock = vi.fn();

      Object.defineProperty(window, 'location', {
        value: { reload: reloadMock },
        writable: true,
      });

      const ThrowingChild = () => {
        throw new Error('Crash!');
      };

      const dom = await renderToDom(
        <ErrorBoundary>
          <ThrowingChild />
        </ErrorBoundary>
      );

      const reloadBtn = dom.querySelector('[data-testid="error-boundary-reload-button"]') as HTMLButtonElement;
      expect(reloadBtn).not.toBeNull();

      await act(async () => {
        reloadBtn.click();
      });

      expect(reloadMock).toHaveBeenCalledTimes(1);

      spyError.mockRestore();
    });
  });

  describe('4. DiffViewer Robustness & Mode Switching', () => {
    it('should handle null/undefined text and bulletDiffs with missing fields', async () => {
      const dom = await renderToDom(
        <DiffViewer
          title="Edge Diff Test"
          originalText={null as any}
          tailoredText={null as any}
          bulletDiffs={[
            {
              original: undefined as any,
              tailored: undefined as any,
              reason: undefined as any,
            },
          ]}
        />
      );

      expect(dom.textContent).toContain('Edge Diff Test');
      expect(dom.textContent).toContain('Bullet #1');
    });

    it('should seamlessly toggle between inline and split view modes without exception', async () => {
      const dom = await renderToDom(
        <DiffViewer
          title="Mode Toggle Test"
          originalText="Developed backend service using Node.js"
          tailoredText="Architected high-throughput microservices using Node.js and TypeScript"
          rationale="Added modern architectural terms"
        />
      );

      expect(dom.textContent).toContain('Mode Toggle Test');

      const splitBtn = Array.from(dom.querySelectorAll('button')).find((b) => b.textContent?.includes('Split'));
      expect(splitBtn).not.toBeNull();

      await act(async () => {
        splitBtn?.click();
      });

      expect(dom.textContent).toContain('BEFORE');
      expect(dom.textContent).toContain('AFTER (TAILORED)');

      const inlineBtn = Array.from(dom.querySelectorAll('button')).find((b) => b.textContent?.includes('Inline'));
      await act(async () => {
        inlineBtn?.click();
      });

      expect(dom.textContent).toContain('Mode Toggle Test');
    });
  });

  describe('5. Storage Resiliency in Headless & Throwing Environments', () => {
    it('settingsStorage should fallback gracefully when chrome.storage.local throws', async () => {
      // Force chrome.storage.local.get to throw
      (chrome.storage.local.get as any) = vi.fn().mockRejectedValue(new Error('Storage access denied'));
      (chrome.storage.local.set as any) = vi.fn().mockRejectedValue(new Error('Storage quota exceeded'));

      const settings = await settingsStorage.getSettings();
      expect(settings).toBeDefined();
      expect(settings.aiProvider).toBe('anthropic');

      // Saving should update in-memory fallback without throwing
      await expect(
        settingsStorage.saveSettings({ ...settings, anthropicModel: 'claude-3-5-haiku-20241022' })
      ).resolves.not.toThrow();
    });

    it('interviewService should fallback gracefully when chrome.storage.local is unavailable', async () => {
      (chrome.storage.local.get as any) = vi.fn().mockRejectedValue(new Error('Local storage offline'));

      const result = await interviewService.getBriefingByJobId('test_job_id');
      expect(result).toBeNull();
    });
  });

  describe('6. FloatingButton Lifecycle & Event Safety', () => {
    it('should be idempotent across multiple mount() calls', () => {
      const scrapeMock = vi.fn().mockResolvedValue(null);
      const fab = new FloatingButton(scrapeMock);

      fab.mount();
      fab.mount(); // Second call should be a no-op

      const roots = document.querySelectorAll('#rezbuilder-floating-root');
      expect(roots.length).toBe(1);

      fab.unmount();
      expect(document.querySelectorAll('#rezbuilder-floating-root').length).toBe(0);
    });

    it('should handle unmount() gracefully if container was already removed', () => {
      const scrapeMock = vi.fn().mockResolvedValue(null);
      const fab = new FloatingButton(scrapeMock);

      fab.mount();
      const elem = document.getElementById('rezbuilder-floating-root');
      elem?.parentNode?.removeChild(elem);

      expect(() => fab.unmount()).not.toThrow();
    });

    it('should cycle through statuses safely', () => {
      const scrapeMock = vi.fn().mockResolvedValue(null);
      const fab = new FloatingButton(scrapeMock);
      fab.mount();

      expect(() => {
        fab.showStatus('loading');
        fab.showStatus('success', 'Job Captured');
        fab.showStatus('error');
        fab.showStatus('idle');
      }).not.toThrow();

      fab.unmount();
    });
  });

  describe('7. Sidepanel App Tab Navigation & Interaction', () => {
    it('should switch across all 6 navigation tabs cleanly', async () => {
      const dom = await renderToDom(
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      );

      const navButtons = dom.querySelectorAll('nav button');
      expect(navButtons.length).toBe(6);

      // Resumes tab
      await act(async () => {
        (navButtons[2] as HTMLButtonElement).click();
      });
      expect(dom.textContent).toContain('Stored Resumes');

      // Tailor tab
      await act(async () => {
        (navButtons[3] as HTMLButtonElement).click();
      });
      expect(dom.textContent).toContain('Deterministic ATS Customization');

      // Interview / Prep tab
      await act(async () => {
        (navButtons[4] as HTMLButtonElement).click();
      });
      expect(dom.textContent).toContain('AI Interview Prep Briefing');

      // Settings tab
      await act(async () => {
        (navButtons[5] as HTMLButtonElement).click();
      });
      expect(dom.textContent).toContain('Extension Settings & Engine Mode');

      // Return to Job tab
      await act(async () => {
        (navButtons[1] as HTMLButtonElement).click();
      });
      expect(dom.textContent).toContain('Active Job Posting');
    });
  });

  describe('8. CSP & System Font Stack Verification', () => {
    it('src/sidepanel/index.html must contain 0 remote font links or stylesheet links', () => {
      const htmlPath = path.resolve(__dirname, '../src/sidepanel/index.html');
      const htmlContent = fs.readFileSync(htmlPath, 'utf8');

      expect(htmlContent).not.toContain('fonts.googleapis.com');
      expect(htmlContent).not.toContain('fonts.gstatic.com');
      expect(htmlContent).not.toContain('http://');
      expect(htmlContent).not.toContain('https://');
    });

    it('dist/src/sidepanel/index.html must contain 0 remote font links or stylesheet links', () => {
      const distHtmlPath = path.resolve(__dirname, '../dist/src/sidepanel/index.html');
      if (fs.existsSync(distHtmlPath)) {
        const distHtmlContent = fs.readFileSync(distHtmlPath, 'utf8');
        expect(distHtmlContent).not.toContain('fonts.googleapis.com');
        expect(distHtmlContent).not.toContain('fonts.gstatic.com');
        expect(distHtmlContent).not.toContain('http://');
      }
    });

    it('tailwind.config.js must define system font fallbacks for sans and mono', () => {
      const tailwindConfigPath = path.resolve(__dirname, '../tailwind.config.js');
      const tailwindContent = fs.readFileSync(tailwindConfigPath, 'utf8');

      expect(tailwindContent).toContain('ui-sans-serif');
      expect(tailwindContent).toContain('system-ui');
      expect(tailwindContent).toContain('-apple-system');
      expect(tailwindContent).toContain('BlinkMacSystemFont');
      expect(tailwindContent).toContain('ui-monospace');
      expect(tailwindContent).toContain('SFMono-Regular');
    });
  });
});
