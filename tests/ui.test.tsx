import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React, { act } from 'react';
import ReactDOM from 'react-dom/client';
import App from '../src/sidepanel/App';
import { JobTab } from '../src/sidepanel/tabs/JobTab';
import { ResumesTab } from '../src/sidepanel/tabs/ResumesTab';
import { TailorTab } from '../src/sidepanel/tabs/TailorTab';
import { InterviewTab } from '../src/sidepanel/tabs/InterviewTab';
import { SettingsTab } from '../src/sidepanel/tabs/SettingsTab';
import { FloatingButton } from '../src/content/floatingButton';
import { JobPosting } from '../src/types/job';
import { TailoredResume } from '../src/types/resume';
import { MOCK_SENIOR_FULLSTACK_RESUME, MOCK_JUNIOR_FRONTEND_RESUME } from './fixtures/mockResumes';
import { setupMockChrome } from './helpers/mockChrome';

const MOCK_JOB: JobPosting = {
  id: 'job_ui_123',
  title: 'Senior Full Stack Engineer',
  company: 'Stripe Inc',
  location: 'San Francisco, CA',
  description: 'We are seeking a Senior Full Stack Engineer with strong experience in React, TypeScript, Node.js, Go, Docker, Kubernetes, and distributed systems architecture.',
  requiredSkills: ['React', 'TypeScript', 'Node.js', 'Go', 'Docker', 'Kubernetes', 'PostgreSQL', 'AWS'],
  url: 'https://boards.greenhouse.io/stripe/jobs/123',
  source: 'greenhouse',
  scrapedAt: '2026-09-01T12:00:00.000Z',
  remoteStatus: 'Hybrid',
};

const MOCK_TAILORED_RESUME: TailoredResume = {
  id: 'tailored_res_123',
  baseResumeId: MOCK_SENIOR_FULLSTACK_RESUME.id,
  jobId: MOCK_JOB.id,
  createdAt: '2026-09-01T12:00:00.000Z',
  sections: MOCK_SENIOR_FULLSTACK_RESUME.sections,
  rawText: MOCK_SENIOR_FULLSTACK_RESUME.rawText,
  changesSummary: [
    'Refocused professional summary around cloud microservices and distributed systems.',
    'Strengthened bullet action verbs with Architected and Engineered.',
  ],
  unresolvedGaps: ['GraphQL API design'],
};

function changeInputValue(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const nativeSetter = Object.getOwnPropertyDescriptor(
    element instanceof HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype,
    'value'
  )?.set;
  nativeSetter?.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('Extension UI & Tab Components Suite', () => {
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
    root = ReactDOM.createRoot(container);
    await act(async () => {
      root?.render(element);
    });
    // Allow any internal promises / useEffect to flush
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    return container;
  };

  describe('1. Main App Shell (src/sidepanel/App.tsx)', () => {
    it('should mount App without throwing exceptions and display header branding', async () => {
      const dom = await renderComponent(<App />);
      expect(dom.textContent).toContain('RezBuilder');
      expect(dom.textContent).toContain('AI Job-Application Copilot');
      expect(dom.textContent).toContain('Local Client-Side Storage');
    });

    it('should switch tabs smoothly across Job, Resumes, Tailor, Prep, and Settings', async () => {
      const dom = await renderComponent(<App />);
      const buttons = Array.from(dom.querySelectorAll('nav button')) as HTMLButtonElement[];
      expect(buttons.length).toBe(5);

      // Tab 1: Job
      expect(dom.textContent).toContain('Active Job Posting');

      // Click Resumes Tab
      await act(async () => {
        buttons[1].click();
      });
      expect(dom.textContent).toContain('Upload New Resume');

      // Click Tailor Tab
      await act(async () => {
        buttons[2].click();
      });
      expect(dom.textContent).toContain('Deterministic ATS Customization');

      // Click Prep Tab
      await act(async () => {
        buttons[3].click();
      });
      expect(dom.textContent).toContain('AI Interview Prep Briefing');

      // Click Settings Tab
      await act(async () => {
        buttons[4].click();
      });
      expect(dom.textContent).toContain('Extension Settings & Engine Mode');
    });
  });

  describe('2. JobTab Component (src/sidepanel/tabs/JobTab.tsx)', () => {
    it('should render empty state when no job is detected', async () => {
      const dom = await renderComponent(
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
      expect(dom.textContent).toContain('Paste JD');
      expect(dom.textContent).toContain('Scrape Tab');
    });

    it('should render active job details, ATS composite score, and preset switcher', async () => {
      const dom = await renderComponent(
        <JobTab
          job={MOCK_JOB}
          resumes={[MOCK_SENIOR_FULLSTACK_RESUME]}
          activeResume={MOCK_SENIOR_FULLSTACK_RESUME}
          onSelectResume={vi.fn()}
          onRefreshScrape={vi.fn()}
          onManualJobSave={vi.fn()}
          onNavigateToTailor={vi.fn()}
          isLoading={false}
        />
      );

      expect(dom.textContent).toContain('Senior Full Stack Engineer');
      expect(dom.textContent).toContain('Stripe Inc');
      expect(dom.textContent).toContain('RezBuilder ATS Match Score');
      expect(dom.textContent).toContain('1. Keyword Match');
      expect(dom.textContent).toContain('2. Keyword Placement');
      expect(dom.textContent).toContain('3. Section Completeness');
      expect(dom.textContent).toContain('4. Parse Success & ATS Format');
      expect(dom.textContent).toContain('5. Role Relevance & Tenure');
      expect(dom.textContent).toContain('Tailor Resume for this Role');
    });

    it('should toggle keyword breakdown list when clicked', async () => {
      const dom = await renderComponent(
        <JobTab
          job={MOCK_JOB}
          resumes={[MOCK_SENIOR_FULLSTACK_RESUME]}
          activeResume={MOCK_SENIOR_FULLSTACK_RESUME}
          onSelectResume={vi.fn()}
          onRefreshScrape={vi.fn()}
          onManualJobSave={vi.fn()}
          onNavigateToTailor={vi.fn()}
          isLoading={false}
        />
      );

      const toggleButton = Array.from(dom.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Keyword Breakdown')
      );
      expect(toggleButton).toBeDefined();

      await act(async () => {
        toggleButton?.click();
      });

      expect(dom.textContent).toContain('Matched Keywords');
    });

    it('should open manual Paste JD modal and allow form submission', async () => {
      const onManualSave = vi.fn();
      const dom = await renderComponent(
        <JobTab
          job={null}
          resumes={[]}
          activeResume={null}
          onSelectResume={vi.fn()}
          onRefreshScrape={vi.fn()}
          onManualJobSave={onManualSave}
          onNavigateToTailor={vi.fn()}
          isLoading={false}
        />
      );

      const pasteButton = Array.from(dom.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Paste JD')
      );
      await act(async () => {
        pasteButton?.click();
      });

      expect(dom.textContent).toContain('Paste Job Description');
      const titleInput = dom.querySelector('input[placeholder*="Senior Backend"]') as HTMLInputElement;
      const descInput = dom.querySelector('textarea') as HTMLTextAreaElement;
      const form = dom.querySelector('form') as HTMLFormElement;

      await act(async () => {
        changeInputValue(titleInput, 'Staff Cloud Engineer');
        changeInputValue(descInput, 'Required skills: Kubernetes, Terraform, Go');
      });

      await act(async () => {
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      });

      expect(onManualSave).toHaveBeenCalled();
    });

    it('should show multi-resume recommendation badge when multiple resumes exist', async () => {
      const dom = await renderComponent(
        <JobTab
          job={MOCK_JOB}
          resumes={[MOCK_SENIOR_FULLSTACK_RESUME, MOCK_JUNIOR_FRONTEND_RESUME]}
          activeResume={MOCK_SENIOR_FULLSTACK_RESUME}
          onSelectResume={vi.fn()}
          onRefreshScrape={vi.fn()}
          onManualJobSave={vi.fn()}
          onNavigateToTailor={vi.fn()}
          isLoading={false}
        />
      );

      expect(dom.textContent).toContain('Best Fit:');
      expect(dom.textContent).toContain('Alex Rivera');
    });
  });

  describe('3. ResumesTab Component (src/sidepanel/tabs/ResumesTab.tsx)', () => {
    it('should render empty resume message when list is empty', async () => {
      const dom = await renderComponent(
        <ResumesTab
          resumes={[]}
          activeResume={null}
          onSelectResume={vi.fn()}
          onSaveResume={vi.fn()}
          onDeleteResume={vi.fn()}
          onSetDefault={vi.fn()}
        />
      );

      expect(dom.textContent).toContain('No resumes stored yet.');
      expect(dom.textContent).toContain('Upload New Resume');
    });

    it('should render stored resumes and allow expanding details', async () => {
      const onSelect = vi.fn();
      const dom = await renderComponent(
        <ResumesTab
          resumes={[MOCK_SENIOR_FULLSTACK_RESUME]}
          activeResume={MOCK_SENIOR_FULLSTACK_RESUME}
          onSelectResume={onSelect}
          onSaveResume={vi.fn()}
          onDeleteResume={vi.fn()}
          onSetDefault={vi.fn()}
        />
      );

      expect(dom.textContent).toContain('Alex Rivera');
      expect(dom.textContent).toContain('Senior Full Stack & Cloud Architect');
      expect(dom.textContent).toContain('Default');

      // Expand inspection eye button
      const viewButton = dom.querySelector('button[title="View Extracted Sections"]') as HTMLButtonElement;
      await act(async () => {
        viewButton.click();
      });

      expect(dom.textContent).toContain('alex.rivera@example.com');
      expect(dom.textContent).toContain('Lead Infrastructure & Backend Engineer');
      expect(dom.textContent).toContain('Parsed Skills');
    });
  });

  describe('4. TailorTab Component (src/sidepanel/tabs/TailorTab.tsx)', () => {
    it('should render initial deterministic tailoring CTA when no tailored resume exists', async () => {
      const dom = await renderComponent(
        <TailorTab
          job={MOCK_JOB}
          resumes={[MOCK_SENIOR_FULLSTACK_RESUME]}
          activeResume={MOCK_SENIOR_FULLSTACK_RESUME}
          onSelectResume={vi.fn()}
          tailoredResume={null}
          onSaveTailoredResume={vi.fn()}
        />
      );

      expect(dom.textContent).toContain('Deterministic ATS Customization');
      expect(dom.textContent).toContain('Generate Tailored Resume (Instant Local)');
    });

    it('should render tailored resume with DiffViewer, changes summary, and export buttons', async () => {
      const dom = await renderComponent(
        <TailorTab
          job={MOCK_JOB}
          resumes={[MOCK_SENIOR_FULLSTACK_RESUME]}
          activeResume={MOCK_SENIOR_FULLSTACK_RESUME}
          onSelectResume={vi.fn()}
          tailoredResume={MOCK_TAILORED_RESUME}
          onSaveTailoredResume={vi.fn()}
        />
      );

      expect(dom.textContent).toContain('Tailored Version Ready');
      expect(dom.textContent).toContain('DOCX');
      expect(dom.textContent).toContain('PDF');
      expect(dom.textContent).toContain('Key Optimizations:');
      expect(dom.textContent).toContain('Professional Summary');
      expect(dom.textContent).toContain('Before / After Comparisons');
    });

    it('should toggle manual inline editor and save updated sections', async () => {
      const onSave = vi.fn();
      const dom = await renderComponent(
        <TailorTab
          job={MOCK_JOB}
          resumes={[MOCK_SENIOR_FULLSTACK_RESUME]}
          activeResume={MOCK_SENIOR_FULLSTACK_RESUME}
          onSelectResume={vi.fn()}
          tailoredResume={MOCK_TAILORED_RESUME}
          onSaveTailoredResume={onSave}
        />
      );

      const editToggle = Array.from(dom.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Edit Tailored Text Manually')
      );
      await act(async () => {
        editToggle?.click();
      });

      expect(dom.textContent).toContain('Tailored Summary');
      expect(dom.textContent).toContain('Tailored Skills List');

      const summaryTextarea = dom.querySelector('textarea') as HTMLTextAreaElement;
      await act(async () => {
        changeInputValue(summaryTextarea, 'Updated Summary for Senior Cloud role');
      });

      const saveButton = Array.from(dom.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Save Edits')
      );
      await act(async () => {
        saveButton?.click();
      });

      expect(onSave).toHaveBeenCalled();
    });
  });

  describe('5. InterviewTab Component (src/sidepanel/tabs/InterviewTab.tsx)', () => {
    it('should render interview prep generator CTA when no cached briefing exists', async () => {
      const dom = await renderComponent(
        <InterviewTab job={MOCK_JOB} activeResume={MOCK_SENIOR_FULLSTACK_RESUME} />
      );

      expect(dom.textContent).toContain('AI Interview Prep Briefing');
      expect(dom.textContent).toContain('Generate Prep Briefing');
    });

    it('should generate interview briefing locally without errors', async () => {
      const dom = await renderComponent(
        <InterviewTab job={MOCK_JOB} activeResume={MOCK_SENIOR_FULLSTACK_RESUME} />
      );

      const generateBtn = Array.from(dom.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Generate Prep Briefing')
      );

      await act(async () => {
        generateBtn?.click();
      });

      // Wait for briefing generation
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      expect(dom.textContent).toContain('What This Role Actually Cares About');
      expect(dom.textContent).toContain('Likely Technical Questions');
      expect(dom.textContent).toContain('Behavioral Questions & STAR Tips');
      expect(dom.textContent).toContain('Export .MD');
    });
  });

  describe('6. SettingsTab Component (src/sidepanel/tabs/SettingsTab.tsx)', () => {
    it('should render local deterministic banner and provider options', async () => {
      const dom = await renderComponent(<SettingsTab onDataCleared={vi.fn()} />);

      expect(dom.textContent).toContain('Extension Settings & Engine Mode');
      expect(dom.textContent).toContain('100% Local Deterministic Engine (Active)');
      expect(dom.textContent).toContain('Local-Only Privacy Policy');
      expect(dom.textContent).toContain('Save Settings');
      expect(dom.textContent).toContain('Clear All RezBuilder Data');
    });

    it('should open clear confirmation modal on danger button click', async () => {
      const onCleared = vi.fn();
      const dom = await renderComponent(<SettingsTab onDataCleared={onCleared} />);

      const clearBtn = Array.from(dom.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Clear All RezBuilder Data')
      );

      await act(async () => {
        clearBtn?.click();
      });

      expect(dom.textContent).toContain('Delete All Extension Data?');
      expect(dom.textContent).toContain('Yes, Delete Everything');
    });
  });

  describe('7. FloatingButton Component (src/content/floatingButton.ts)', () => {
    it('should mount into document with shadow DOM and respond to clicks', async () => {
      const onTriggerScrape = vi.fn(async () => MOCK_JOB);
      const fab = new FloatingButton(onTriggerScrape);

      fab.mount();

      const host = document.getElementById('rezbuilder-floating-root');
      expect(host).not.toBeNull();
      expect(host?.shadowRoot).not.toBeNull();

      const fabInner = host?.shadowRoot?.getElementById('rezbuilder-fab');
      expect(fabInner).not.toBeNull();
      expect(fabInner?.textContent).toContain('RezBuilder');
      expect(fabInner?.textContent).toContain('Analyze Job & Score');

      // Click FAB
      await act(async () => {
        fabInner?.click();
      });

      expect(onTriggerScrape).toHaveBeenCalled();

      fab.unmount();
      expect(document.getElementById('rezbuilder-floating-root')).toBeNull();
    });

    it('should cycle through showStatus loading, success, and error states cleanly', () => {
      const fab = new FloatingButton(vi.fn());
      fab.mount();

      fab.showStatus('loading');
      const host = document.getElementById('rezbuilder-floating-root');
      expect(host?.shadowRoot?.textContent).toContain('Scraping Job...');

      fab.showStatus('success', 'Custom Message');
      expect(host?.shadowRoot?.textContent).toContain('Job Captured!');
      expect(host?.shadowRoot?.textContent).toContain('Custom Message');

      fab.showStatus('error');
      expect(host?.shadowRoot?.textContent).toContain('Not Detected');

      fab.unmount();
    });
  });
});
