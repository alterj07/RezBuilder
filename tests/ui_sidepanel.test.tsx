import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React, { act } from 'react';
import ReactDOM from 'react-dom/client';
import App from '../src/sidepanel/App';
import { ErrorBoundary } from '../src/sidepanel/index';
import { JobTab } from '../src/sidepanel/tabs/JobTab';
import { ResumesTab } from '../src/sidepanel/tabs/ResumesTab';
import { TailorTab } from '../src/sidepanel/tabs/TailorTab';
import { InterviewTab } from '../src/sidepanel/tabs/InterviewTab';
import { SettingsTab } from '../src/sidepanel/tabs/SettingsTab';
import { DiffViewer } from '../src/components/tailor/DiffViewer';
import { JobPosting } from '../src/types/job';
import { TailoredResume } from '../src/types/resume';
import { MOCK_SENIOR_FULLSTACK_RESUME, MOCK_JUNIOR_FRONTEND_RESUME } from './fixtures/mockResumes';
import { MOCK_SENIOR_PROFILE } from './fixtures/mockProfiles';
import { setupMockChrome } from './helpers/mockChrome';

const MOCK_JOB_FIXTURE: JobPosting = {
  id: 'job_sidepanel_test_1',
  title: 'Lead Software Architect',
  company: 'CloudSphere Global',
  location: 'Remote, US',
  description: 'Seeking a Lead Software Architect with expertise in React, TypeScript, Go, Cloud Architecture, Kubernetes, Distributed Systems, and ATS Optimization.',
  requiredSkills: ['React', 'TypeScript', 'Go', 'Kubernetes', 'Cloud Architecture', 'PostgreSQL', 'Docker'],
  url: 'https://boards.greenhouse.io/cloudsphere/jobs/101',
  source: 'greenhouse',
  scrapedAt: '2026-09-01T15:00:00.000Z',
  remoteStatus: 'Remote',
};

const MOCK_TAILORED_FIXTURE: TailoredResume = {
  ...MOCK_SENIOR_FULLSTACK_RESUME,
  id: 'tailored_sidepanel_1',
  baseResumeId: MOCK_SENIOR_FULLSTACK_RESUME.id,
  jobId: MOCK_JOB_FIXTURE.id,
  createdAt: '2026-09-01T15:30:00.000Z',
  changesSummary: [
    'Realigned professional summary for Lead Architect role.',
    'Enhanced bullet action verbs with Architected and Orchestrated.',
  ],
  unresolvedGaps: ['GraphQL Federation'],
};

// Faulty component for testing ErrorBoundary
const CrashComponent: React.FC<{ shouldCrash?: boolean }> = ({ shouldCrash = true }) => {
  if (shouldCrash) {
    throw new Error('Simulated runtime render crash in tab child');
  }
  return <div data-testid="crash-child-healthy">Child Healthy</div>;
};

describe('Sidepanel UI & Runtime Resilience Test Suite', () => {
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
    // Flush microtasks and effects
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 60));
    });
    return container;
  };

  describe('1. ErrorBoundary Runtime Protection', () => {
    it('should catch uncaught rendering exceptions and display friendly fallback UI', async () => {
      // Suppress console.error during expected boundary catch
      const spyError = vi.spyOn(console, 'error').mockImplementation(() => {});

      const dom = await renderToDom(
        <ErrorBoundary>
          <CrashComponent shouldCrash={true} />
        </ErrorBoundary>
      );

      expect(dom.querySelector('[data-testid="error-boundary-fallback"]')).not.toBeNull();
      expect(dom.textContent).toContain('Something went wrong');
      expect(dom.textContent).toContain('Simulated runtime render crash in tab child');
      expect(dom.querySelector('[data-testid="error-boundary-reload-button"]')).not.toBeNull();

      spyError.mockRestore();
    });

    it('should render healthy children normally when no exception is thrown', async () => {
      const dom = await renderToDom(
        <ErrorBoundary>
          <CrashComponent shouldCrash={false} />
        </ErrorBoundary>
      );

      expect(dom.querySelector('[data-testid="crash-child-healthy"]')).not.toBeNull();
      expect(dom.textContent).toContain('Child Healthy');
      expect(dom.querySelector('[data-testid="error-boundary-fallback"]')).toBeNull();
    });
  });

  describe('2. Defensive Null Guards in DiffViewer', () => {
    it('should render cleanly without throwing when originalText or tailoredText is empty/undefined', async () => {
      const dom = await renderToDom(
        <DiffViewer
          originalText={'' as any}
          tailoredText={'' as any}
          title="Summary Optimization"
          rationale="Added distributed systems keywords"
        />
      );

      expect(dom.textContent).toContain('Summary Optimization');
      expect(dom.textContent).toContain('Added distributed systems keywords');
    });

    it('should render bullet diffs defensively when original or tailored bullet is empty', async () => {
      const dom = await renderToDom(
        <DiffViewer
          originalText="Sample"
          tailoredText="Sample"
          title="Experience Diff"
          bulletDiffs={[
            {
              original: '',
              tailored: 'Architected microservices in Go and Kubernetes.',
              reason: 'Added missing cloud technologies.',
            },
          ]}
        />
      );

      expect(dom.textContent).toContain('Experience Diff');
      expect(dom.textContent).toContain('Architected microservices in Go and Kubernetes.');
      expect(dom.textContent).toContain('Added missing cloud technologies.');
    });
  });

  describe('3. JobTab Defensive Rendering & ATS Scoring', () => {
    it('should safely render when job has undefined requiredSkills without throwing', async () => {
      const jobWithUndefinedSkills: JobPosting = {
        ...MOCK_JOB_FIXTURE,
        requiredSkills: undefined as any,
      };

      const dom = await renderToDom(
        <JobTab
          job={jobWithUndefinedSkills}
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

      expect(dom.textContent).toContain('Lead Software Architect');
      expect(dom.textContent).toContain('CloudSphere Global');
      expect(dom.textContent).toContain('RezBuilder ATS Match Score');
    });

    it('should display action verb recommendations and ATS breakdown bars', async () => {
      const dom = await renderToDom(
        <JobTab
          job={MOCK_JOB_FIXTURE}
          profile={MOCK_SENIOR_PROFILE}
          resumes={[MOCK_SENIOR_FULLSTACK_RESUME, MOCK_JUNIOR_FRONTEND_RESUME]}
          activeResume={MOCK_SENIOR_FULLSTACK_RESUME}
          onSelectResume={vi.fn()}
          onRefreshScrape={vi.fn()}
          onManualJobSave={vi.fn()}
          onNavigateToTailor={vi.fn()}
          isLoading={false}
        />
      );

      expect(dom.textContent).toContain('1. Keyword Match');
      expect(dom.textContent).toContain('2. Keyword Placement');
      expect(dom.textContent).toContain('3. Section Completeness');
      expect(dom.textContent).toContain('4. Parse Success & ATS Format');
      expect(dom.textContent).toContain('5. Role Relevance & Tenure');
    });
  });

  describe('4. ResumesTab Document Management', () => {
    it('should render empty state message when no resume is saved', async () => {
      const dom = await renderToDom(
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
    });

    it('should render candidate resume card and permit default selection', async () => {
      const onSetDefault = vi.fn();
      const dom = await renderToDom(
        <ResumesTab
          resumes={[MOCK_SENIOR_FULLSTACK_RESUME]}
          activeResume={MOCK_SENIOR_FULLSTACK_RESUME}
          onSelectResume={vi.fn()}
          onSaveResume={vi.fn()}
          onDeleteResume={vi.fn()}
          onSetDefault={onSetDefault}
        />
      );

      expect(dom.textContent).toContain('Alex Rivera');
      expect(dom.textContent).toContain('Senior Full Stack & Cloud Architect');
    });
  });

  describe('5. TailorTab Customization & Exports', () => {
    it('should render diff comparisons and export buttons when tailored resume exists', async () => {
      const dom = await renderToDom(
        <TailorTab
          job={MOCK_JOB_FIXTURE}
          resumes={[MOCK_SENIOR_FULLSTACK_RESUME]}
          activeResume={MOCK_SENIOR_FULLSTACK_RESUME}
          onSelectResume={vi.fn()}
          tailoredResume={MOCK_TAILORED_FIXTURE}
          onSaveTailoredResume={vi.fn()}
        />
      );

      expect(dom.textContent).toContain('Tailored Version Ready');
      expect(dom.textContent).toContain('DOCX');
      expect(dom.textContent).toContain('PDF');
      expect(dom.textContent).toContain('Key Optimizations:');
    });
  });

  describe('6. InterviewTab Instant Briefing Generator', () => {
    it('should render briefing trigger CTA and allow generating prep notes', async () => {
      const dom = await renderToDom(
        <InterviewTab job={MOCK_JOB_FIXTURE} activeResume={MOCK_SENIOR_FULLSTACK_RESUME} />
      );

      expect(dom.textContent).toContain('AI Interview Prep Briefing');
      expect(dom.textContent).toContain('Generate Prep Briefing');

      const btn = Array.from(dom.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Generate Prep Briefing')
      );

      await act(async () => {
        btn?.click();
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 80));
      });

      expect(dom.textContent).toContain('What This Role Actually Cares About');
      expect(dom.textContent).toContain('Likely Technical Questions');
    });
  });

  describe('7. SettingsTab & In-Memory Fallback', () => {
    it('should display settings controls and data reset modal', async () => {
      const onClear = vi.fn();
      const dom = await renderToDom(<SettingsTab onDataCleared={onClear} />);

      expect(dom.textContent).toContain('Extension Settings & Engine Mode');
      expect(dom.textContent).toContain('100% Local Deterministic Engine (Active)');

      const clearBtn = Array.from(dom.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Clear All RezBuilder Data')
      );
      await act(async () => {
        clearBtn?.click();
      });

      expect(dom.textContent).toContain('Delete All Extension Data?');
    });
  });

  describe('8. Sidepanel App Full Integration', () => {
    it('should mount App inside ErrorBoundary and render complete header and footer navigation', async () => {
      const dom = await renderToDom(
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      );

      expect(dom.textContent).toContain('RezBuilder');
      expect(dom.textContent).toContain('Local Job-Application Copilot');
      expect(dom.querySelector('nav')).not.toBeNull();
    });
  });
});
