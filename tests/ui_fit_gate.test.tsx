import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React, { act } from 'react';
import ReactDOM from 'react-dom/client';
import App from '../src/sidepanel/App';
import { JobTab } from '../src/sidepanel/tabs/JobTab';
import { HARD_BLOCKER_CAP } from '../src/services/fit';
import {
  MOCK_SENIOR_PROFILE,
  MOCK_STUDENT_PROFILE,
  MOCK_SENIOR_BACKEND_JOB,
  MOCK_CLEARANCE_JOB,
  MOCK_INTERNSHIP_JOB,
  MOCK_THIN_JOB,
} from './fixtures/mockProfiles';
import { MOCK_SENIOR_FULLSTACK_RESUME } from './fixtures/mockResumes';
import { setupMockChrome } from './helpers/mockChrome';

const PROFILE_KEY = 'rezbuilder_profile';

describe('Profile onboarding gate & Best Fit card (sidepanel UI)', () => {
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

  const renderToDom = async (element: React.ReactElement) => {
    root = ReactDOM.createRoot(container);
    await act(async () => {
      root?.render(element);
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    return container;
  };

  const navButtons = (dom: HTMLElement) => Array.from(dom.querySelectorAll('nav button')) as HTMLButtonElement[];
  const clickNav = async (dom: HTMLElement, index: number) => {
    await act(async () => {
      navButtons(dom)[index].click();
    });
  };
  const gate = (dom: HTMLElement) => dom.querySelector('[data-testid="profile-gate-card"]');

  const renderJobTab = (job: any, profile: any) =>
    renderToDom(
      <JobTab
        job={job}
        profile={profile}
        resumes={[MOCK_SENIOR_FULLSTACK_RESUME]}
        activeResume={MOCK_SENIOR_FULLSTACK_RESUME}
        onSelectResume={vi.fn()}
        onRefreshScrape={vi.fn()}
        onManualJobSave={vi.fn()}
        onNavigateToTailor={vi.fn()}
        isLoading={false}
      />
    );

  describe('1. App onboarding gate', () => {
    it('opens on the Profile tab and shows the gate on Job, Tailor and Prep when no profile is stored', async () => {
      const dom = await renderToDom(<App />);

      // Nav: Profile, Job, Resumes, Tailor, Prep, Settings
      expect(navButtons(dom).length).toBe(6);
      expect(navButtons(dom)[0].textContent).toContain('Profile');
      expect(dom.querySelector('[data-testid="profile-tab-placeholder"], [data-testid="profile-tab"]')).not.toBeNull();
      expect(dom.textContent).toContain('Local Job-Application Copilot');
      expect(dom.textContent).toContain('Local Client-Side Storage');

      await clickNav(dom, 1);
      expect(gate(dom)).not.toBeNull();
      expect(dom.textContent).toContain('Set up your Candidate Profile first');
      expect(dom.textContent).not.toContain('Active Job Posting');

      await clickNav(dom, 3);
      expect(gate(dom)).not.toBeNull();
      expect(dom.textContent).not.toContain('Deterministic ATS Customization');

      await clickNav(dom, 4);
      expect(gate(dom)).not.toBeNull();
      expect(dom.textContent).not.toContain('AI Interview Prep Briefing');
    });

    it('renders the missing-items checklist, score and a Complete profile button that jumps to the Profile tab', async () => {
      const dom = await renderToDom(<App />);
      await clickNav(dom, 1);

      const missing = dom.querySelectorAll('[data-testid="profile-gate-missing"]');
      expect(missing.length).toBe(4);
      expect(dom.textContent).toContain('Add your name');
      expect(dom.textContent).toContain('Add at least 3 skills');
      expect(dom.querySelector('[data-testid="profile-gate-score"]')?.textContent).toBe('0%');

      const cta = dom.querySelector('[data-testid="profile-gate-cta"]') as HTMLButtonElement;
      expect(cta.textContent).toContain('Complete profile');
      await act(async () => {
        cta.click();
      });
      expect(gate(dom)).toBeNull();
      expect(dom.querySelector('[data-testid="profile-tab-placeholder"], [data-testid="profile-tab"]')).not.toBeNull();
    });

    it('keeps Resumes and Settings usable while the profile is incomplete', async () => {
      const dom = await renderToDom(<App />);

      await clickNav(dom, 2);
      expect(gate(dom)).toBeNull();
      expect(dom.textContent).toContain('Upload New Resume');

      await clickNav(dom, 5);
      expect(gate(dom)).toBeNull();
      expect(dom.textContent).toContain('Extension Settings & Engine Mode');
    });

    it('shows an amber badge on the Profile tab only while the profile is incomplete', async () => {
      const dom = await renderToDom(<App />);
      expect(dom.querySelector('[data-testid="profile-incomplete-badge"]')).not.toBeNull();

      await act(async () => {
        await chrome.storage.local.set({ [PROFILE_KEY]: MOCK_SENIOR_PROFILE });
      });
      expect(dom.querySelector('[data-testid="profile-incomplete-badge"]')).toBeNull();
    });

    it('opens on the Job tab when a complete profile is stored', async () => {
      mockHarness.store.local[PROFILE_KEY] = MOCK_SENIOR_PROFILE;
      const dom = await renderToDom(<App />);

      expect(gate(dom)).toBeNull();
      expect(dom.textContent).toContain('Active Job Posting');
      expect(dom.querySelector('[data-testid="profile-incomplete-badge"]')).toBeNull();
    });

    it('unlocks Job, Tailor and Prep live when storage changes to a complete profile', async () => {
      const dom = await renderToDom(<App />);
      await clickNav(dom, 1);
      expect(gate(dom)).not.toBeNull();

      await act(async () => {
        await chrome.storage.local.set({ [PROFILE_KEY]: MOCK_SENIOR_PROFILE });
      });
      expect(gate(dom)).toBeNull();
      expect(dom.textContent).toContain('Active Job Posting');

      await clickNav(dom, 3);
      expect(dom.textContent).toContain('Deterministic ATS Customization');
      await clickNav(dom, 4);
      expect(dom.textContent).toContain('AI Interview Prep Briefing');
    });

    it('re-locks the tabs when the profile is removed from storage', async () => {
      mockHarness.store.local[PROFILE_KEY] = MOCK_SENIOR_PROFILE;
      const dom = await renderToDom(<App />);
      expect(dom.textContent).toContain('Active Job Posting');

      await act(async () => {
        await chrome.storage.local.set({ [PROFILE_KEY]: null });
      });
      expect(gate(dom)).not.toBeNull();
      expect(dom.textContent).not.toContain('Active Job Posting');
    });

    it('shows the Best Fit card inside the App Job tab once a job and complete profile exist', async () => {
      mockHarness.store.local[PROFILE_KEY] = MOCK_SENIOR_PROFILE;
      mockHarness.store.local.activeJob = MOCK_SENIOR_BACKEND_JOB;
      const dom = await renderToDom(<App />);

      expect(dom.querySelector('[data-testid="best-fit-card"]')).not.toBeNull();
      expect(dom.textContent).toContain('Ledgerly');
    });
  });

  describe('2. Best Fit card in JobTab', () => {
    it('renders a strong fit with factor rows for the senior profile on the senior backend role', async () => {
      const dom = await renderJobTab(MOCK_SENIOR_BACKEND_JOB, MOCK_SENIOR_PROFILE);

      const card = dom.querySelector('[data-testid="best-fit-card"]');
      expect(card).not.toBeNull();
      const percent = parseInt(dom.querySelector('[data-testid="best-fit-percent"]')?.textContent || '0', 10);
      expect(percent).toBeGreaterThanOrEqual(75);
      expect(dom.querySelector('[data-testid="best-fit-confidence"]')?.textContent).toContain('High confidence');
      expect(dom.querySelector('[data-testid="best-fit-blocker"]')).toBeNull();
      expect(dom.textContent).toContain('Strengths');

      // Card sits above the ATS section.
      const html = dom.innerHTML;
      expect(html.indexOf('best-fit-card')).toBeLessThan(html.indexOf('RezBuilder ATS Match Score'));

      const toggle = dom.querySelector('[data-testid="best-fit-breakdown-toggle"]') as HTMLButtonElement;
      await act(async () => {
        toggle.click();
      });
      for (const key of ['skills', 'experience', 'education', 'certifications', 'story', 'preferences']) {
        expect(dom.querySelector(`[data-testid="fit-factor-${key}"]`)).not.toBeNull();
      }
    });

    it('renders a hard blocker row and caps the percent for the clearance role', async () => {
      const dom = await renderJobTab(MOCK_CLEARANCE_JOB, MOCK_SENIOR_PROFILE);

      const blockers = dom.querySelectorAll('[data-testid="best-fit-blocker"]');
      expect(blockers.length).toBeGreaterThan(0);
      expect(dom.textContent).toContain('Score capped at 35% because of a hard requirement');
      const percent = parseInt(dom.querySelector('[data-testid="best-fit-percent"]')?.textContent || '100', 10);
      expect(percent).toBeLessThanOrEqual(HARD_BLOCKER_CAP);
    });

    it('renders matched skill chips with rating dots and missing skill chips for the student on the internship', async () => {
      const dom = await renderJobTab(MOCK_INTERNSHIP_JOB, MOCK_STUDENT_PROFILE);

      const toggle = dom.querySelector('[data-testid="best-fit-breakdown-toggle"]') as HTMLButtonElement;
      await act(async () => {
        toggle.click();
      });

      const matched = dom.querySelectorAll('[data-testid^="fit-matched-skill-"]');
      expect(matched.length).toBeGreaterThan(0);
      const python = dom.querySelector('[data-testid="fit-matched-skill-Python"]');
      expect(python).not.toBeNull();
      // Python is rated 4/5 in the fixture: four lit dots out of five.
      expect(python?.querySelectorAll('.bg-emerald-400').length).toBe(4);
      expect(python?.querySelectorAll('.bg-emerald-900').length).toBe(1);

      const missing = dom.querySelectorAll('[data-testid^="fit-missing-skill-"]');
      expect(missing.length).toBeGreaterThan(0);
      expect(dom.textContent).toContain('Missing skills');
    });

    it('toggles a factor row to reveal its evidence and gaps', async () => {
      const dom = await renderJobTab(MOCK_SENIOR_BACKEND_JOB, MOCK_SENIOR_PROFILE);

      await act(async () => {
        (dom.querySelector('[data-testid="best-fit-breakdown-toggle"]') as HTMLButtonElement).click();
      });
      expect(dom.querySelector('[data-testid="fit-factor-skills-details"]')).toBeNull();

      const row = dom.querySelector('[data-testid="fit-factor-skills"] button') as HTMLButtonElement;
      await act(async () => {
        row.click();
      });
      const details = dom.querySelector('[data-testid="fit-factor-skills-details"]');
      expect(details).not.toBeNull();
      expect(details?.querySelectorAll('li').length).toBeGreaterThan(0);

      await act(async () => {
        row.click();
      });
      expect(dom.querySelector('[data-testid="fit-factor-skills-details"]')).toBeNull();
    });

    it('shows Low confidence and n/a weight chips for a thin posting', async () => {
      const dom = await renderJobTab(MOCK_THIN_JOB, MOCK_SENIOR_PROFILE);

      const confidence = dom.querySelector('[data-testid="best-fit-confidence"]');
      expect(confidence?.textContent).toContain('Low confidence');
      expect(confidence?.getAttribute('title')).toContain('Based on how much profile and posting data was available');

      await act(async () => {
        (dom.querySelector('[data-testid="best-fit-breakdown-toggle"]') as HTMLButtonElement).click();
      });
      expect(dom.textContent).toContain('n/a');
    });

    it('renders no Best Fit card when the profile is null', async () => {
      const dom = await renderJobTab(MOCK_SENIOR_BACKEND_JOB, null);

      expect(dom.querySelector('[data-testid="best-fit-card"]')).toBeNull();
      expect(dom.textContent).toContain('Senior Backend Engineer');
      expect(dom.textContent).toContain('RezBuilder ATS Match Score');
    });

    it('survives a malformed posting without crashing the tab', async () => {
      const malformed: any = {
        id: 'job_bad',
        title: '',
        company: '',
        description: undefined,
        requiredSkills: undefined,
        url: '',
        source: 'generic',
        scrapedAt: '2026-09-01T00:00:00.000Z',
      };
      const dom = await renderJobTab(malformed, MOCK_SENIOR_PROFILE);
      expect(dom.textContent).toContain('Active Job Posting');
    });
  });
});
