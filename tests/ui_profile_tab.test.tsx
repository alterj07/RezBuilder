import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import ReactDOM from 'react-dom/client';
import { ProfileTab } from '../src/sidepanel/tabs/ProfileTab';
import { UserProfile, ProfileImport } from '../src/types/profile';
import { MOCK_SENIOR_PROFILE, MOCK_STUDENT_PROFILE } from './fixtures/mockProfiles';
import { MOCK_SENIOR_FULLSTACK_RESUME } from './fixtures/mockResumes';
import { setupMockChrome } from './helpers/mockChrome';

const STORAGE_KEY = 'rezbuilder_profile';

function changeInputValue(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const nativeSetter = Object.getOwnPropertyDescriptor(
    element instanceof HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype,
    'value'
  )?.set;
  nativeSetter?.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('ProfileTab — Candidate Profile wizard, editor and imports', () => {
  let container: HTMLDivElement;
  let root: ReactDOM.Root | null = null;
  let mockHarness: ReturnType<typeof setupMockChrome>;

  beforeEach(() => {
    mockHarness = setupMockChrome();
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
      root = null;
    }
    container.parentNode?.removeChild(container);
    mockHarness.resetStore();
    vi.restoreAllMocks();
  });

  const flush = async (ms = 30) => {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, ms));
    });
  };

  const renderTab = async (profile: UserProfile | null, resumes = [] as typeof MOCK_SENIOR_FULLSTACK_RESUME[]) => {
    const onProfileSaved = vi.fn();
    if (profile) mockHarness.store.local[STORAGE_KEY] = profile;
    root = ReactDOM.createRoot(container);
    await act(async () => {
      root?.render(<ProfileTab profile={profile} resumes={resumes} onProfileSaved={onProfileSaved} />);
    });
    await flush();
    return { dom: container, onProfileSaved };
  };

  const q = <T extends Element = HTMLElement>(testId: string): T => {
    const el = container.querySelector(`[data-testid="${testId}"]`);
    if (!el) throw new Error(`Missing [data-testid="${testId}"]`);
    return el as unknown as T;
  };

  const click = async (el: Element) => {
    await act(async () => {
      (el as HTMLElement).click();
    });
    await flush();
  };

  const type = async (el: HTMLInputElement | HTMLTextAreaElement, value: string) => {
    await act(async () => {
      changeInputValue(el, value);
    });
  };

  const stored = (): UserProfile => mockHarness.store.local[STORAGE_KEY];

  const addSkill = async (name: string) => {
    await type(q<HTMLInputElement>('skill-input'), name);
    await click(q('skill-add'));
  };

  const chipNames = () =>
    Array.from(container.querySelectorAll('[data-testid^="skill-chip-"]')).map((el) => el.getAttribute('data-testid')!.replace('skill-chip-', ''));

  // Profile that is valid through the education step but has no skills or experiences.
  const PROFILE_NO_SKILLS: UserProfile = { ...MOCK_STUDENT_PROFILE, skills: [], experiences: [] };
  const PROFILE_NO_EXPERIENCE: UserProfile = { ...MOCK_STUDENT_PROFILE, experiences: [] };

  // ---------------------------------------------------------------------------

  it('renders the onboarding wizard on the Basics step for a null profile', async () => {
    const { dom } = await renderTab(null);
    expect(q('profile-wizard').getAttribute('data-step')).toBe('basics');
    expect(dom.querySelector('[data-testid="profile-editor"]')).toBeNull();
    expect(q('completeness-score').textContent).toBe('0%');
    expect(q('wizard-back')).toHaveProperty('disabled', true);
  });

  it('requires a name before Next is enabled on the Basics step', async () => {
    const { dom, onProfileSaved } = await renderTab(null);
    const next = q<HTMLButtonElement>('wizard-next');
    expect(next.disabled).toBe(true);
    expect(dom.textContent).toContain('Add your name');

    await click(next);
    expect(q('profile-wizard').getAttribute('data-step')).toBe('basics');
    expect(onProfileSaved).not.toHaveBeenCalled();

    await type(q<HTMLInputElement>('basics-name'), 'Jane Doe');
    expect(q<HTMLButtonElement>('wizard-next').disabled).toBe(false);
  });

  it('persists the Basics step on Next and keeps state when navigating Back', async () => {
    const { onProfileSaved } = await renderTab(null);
    await type(q<HTMLInputElement>('basics-name'), 'Jane Doe');
    await type(q<HTMLInputElement>('basics-email'), 'jane@example.com');
    await click(q('wizard-next'));

    expect(q('profile-wizard').getAttribute('data-step')).toBe('education');
    expect(stored().contact.name).toBe('Jane Doe');
    expect(stored().contact.email).toBe('jane@example.com');
    expect(onProfileSaved).toHaveBeenCalledTimes(1);
    expect(onProfileSaved.mock.calls[0][0].contact.name).toBe('Jane Doe');

    await click(q('wizard-back'));
    expect(q('profile-wizard').getAttribute('data-step')).toBe('basics');
    expect(q<HTMLInputElement>('basics-name').value).toBe('Jane Doe');
  });

  it('requires a graduating class year on the Education step', async () => {
    const { dom } = await renderTab({ ...MOCK_STUDENT_PROFILE, education: [], skills: [], experiences: [] });
    expect(q('profile-wizard').getAttribute('data-step')).toBe('education');
    expect(q<HTMLButtonElement>('wizard-next').disabled).toBe(true);

    await click(q('education-add'));
    await type(q<HTMLInputElement>('education-institution-0'), 'UT Austin');
    expect(q<HTMLButtonElement>('wizard-next').disabled).toBe(true);
    expect(dom.textContent).toContain('Graduating class year is required');

    await type(q<HTMLInputElement>('education-year-0'), '2027');
    expect(q<HTMLButtonElement>('wizard-next').disabled).toBe(false);

    await click(q('wizard-next'));
    expect(q('profile-wizard').getAttribute('data-step')).toBe('skills');
    expect(stored().education[0].institution).toBe('UT Austin');
    expect(stored().education[0].graduationYear).toBe(2027);
  });

  it('adds skills with ratings and persists the chosen rating on Next', async () => {
    const { onProfileSaved } = await renderTab(PROFILE_NO_SKILLS);
    expect(q('profile-wizard').getAttribute('data-step')).toBe('skills');

    await addSkill('TypeScript');
    await addSkill('React');
    await addSkill('Kubernetes');
    await click(container.querySelector('[aria-label="Rate TypeScript 5 of 5"]')!);
    await click(container.querySelector('[aria-label="Rate Kubernetes 1 of 5"]')!);
    expect(q('skill-rating-TypeScript').getAttribute('data-rating')).toBe('5');

    await click(q('wizard-next'));
    const skills = stored().skills;
    expect(skills.find((s) => s.name === 'TypeScript')?.rating).toBe(5);
    expect(skills.find((s) => s.name === 'React')?.rating).toBe(3);
    expect(skills.find((s) => s.name === 'Kubernetes')?.rating).toBe(1);
    expect(onProfileSaved).toHaveBeenCalled();
  });

  it('sorts skill chips by rating descending', async () => {
    await renderTab(PROFILE_NO_SKILLS);
    await addSkill('Alpha');
    await addSkill('Beta');
    await addSkill('Gamma');
    await click(container.querySelector('[aria-label="Rate Alpha 2 of 5"]')!);
    await click(container.querySelector('[aria-label="Rate Beta 5 of 5"]')!);
    await click(container.querySelector('[aria-label="Rate Gamma 4 of 5"]')!);
    expect(chipNames()).toEqual(['Beta', 'Gamma', 'Alpha']);
  });

  it('enforces the minimum of three skills before continuing', async () => {
    const { dom } = await renderTab(PROFILE_NO_SKILLS);
    await addSkill('Python');
    await addSkill('SQL');
    expect(q<HTMLButtonElement>('wizard-next').disabled).toBe(true);
    expect(dom.textContent).toContain('Add at least 3 skills (you have 2)');
    expect(q('skill-count-hint').textContent).toContain('add 1 more to continue');

    await addSkill('Docker');
    expect(q<HTMLButtonElement>('wizard-next').disabled).toBe(false);
  });

  it('autocompletes skills from the dictionary and dedupes case-insensitively', async () => {
    const { dom } = await renderTab(PROFILE_NO_SKILLS);
    await type(q<HTMLInputElement>('skill-input'), 'kuber');
    expect(dom.querySelector('[data-testid="skill-suggestions"]')).not.toBeNull();
    await click(q('skill-suggestion-Kubernetes'));
    expect(chipNames()).toEqual(['Kubernetes']);

    await addSkill('kubernetes');
    expect(chipNames()).toEqual(['Kubernetes']);
  });

  it('finishes the wizard, stamping completedAt and switching to the editor', async () => {
    const { dom, onProfileSaved } = await renderTab(PROFILE_NO_EXPERIENCE);
    expect(q('profile-wizard').getAttribute('data-step')).toBe('experiences');

    await click(q('experience-add'));
    await type(q<HTMLInputElement>('experience-company-0'), 'Campus Labs');
    await type(q<HTMLInputElement>('experience-title-0'), 'Software Engineering Intern');
    await type(q<HTMLTextAreaElement>('experience-bullets-0'), 'Built a Flask API\nWrote tests');
    await click(q('wizard-next'));
    expect(q('profile-wizard').getAttribute('data-step')).toBe('certifications');

    await click(q('wizard-next'));
    expect(q('profile-wizard').getAttribute('data-step')).toBe('story');
    await click(q('wizard-next'));
    expect(q('profile-wizard').getAttribute('data-step')).toBe('review');
    expect(dom.textContent).toContain('All required sections are filled in.');

    const finish = q<HTMLButtonElement>('wizard-finish');
    expect(finish.disabled).toBe(false);
    await click(finish);

    expect(dom.querySelector('[data-testid="profile-editor"]')).not.toBeNull();
    expect(stored().completedAt).toBeTruthy();
    expect(stored().experiences[0].bullets).toEqual(['Built a Flask API', 'Wrote tests']);
    const last = onProfileSaved.mock.calls[onProfileSaved.mock.calls.length - 1][0] as UserProfile;
    expect(last.completedAt).toBeTruthy();
  });

  it('renders the editor with a 100% completeness badge for a complete profile', async () => {
    const { dom } = await renderTab(MOCK_SENIOR_PROFILE);
    expect(dom.querySelector('[data-testid="profile-wizard"]')).toBeNull();
    q('profile-editor');
    expect(q('completeness-score').textContent).toBe('100%');
    expect(dom.textContent).toContain('Alex Rivera');
    expect(dom.textContent).toContain('UC Berkeley');
    expect(dom.textContent).toContain('CloudScale Inc');
    expect(dom.textContent).toContain('Entered manually on');
  });

  it('persists an inline skill rating change from the editor', async () => {
    const { onProfileSaved } = await renderTab(MOCK_SENIOR_PROFILE);
    expect(stored().skills.find((s) => s.name === 'Go')?.rating).toBe(3);
    await click(container.querySelector('[aria-label="Rate Go 5 of 5"]')!);
    expect(stored().skills.find((s) => s.name === 'Go')?.rating).toBe(5);
    expect(onProfileSaved).toHaveBeenCalledTimes(1);
    expect(onProfileSaved.mock.calls[0][0].skills.find((s: { name: string }) => s.name === 'Go').rating).toBe(5);
    // Chips are re-sorted: Go now sits with the other 5s.
    expect(chipNames().indexOf('Go')).toBeLessThan(chipNames().indexOf('React'));
  });

  it('edits a section in place and cancels without persisting', async () => {
    await renderTab(MOCK_SENIOR_PROFILE);
    await click(q('edit-basics'));
    await type(q<HTMLInputElement>('basics-name'), 'Someone Else');
    await click(q('cancel-basics'));
    expect(container.textContent).toContain('Alex Rivera');
    expect(stored().contact.name).toBe('Alex Rivera');

    await click(q('edit-basics'));
    await type(q<HTMLInputElement>('basics-phone'), '555-0100');
    await click(q('save-basics'));
    expect(stored().contact.phone).toBe('555-0100');
  });

  it('imports a stored resume into an empty profile', async () => {
    const { dom, onProfileSaved } = await renderTab(null, [MOCK_SENIOR_FULLSTACK_RESUME]);
    expect(q<HTMLButtonElement>('import-resume').disabled).toBe(false);
    await click(q('import-resume'));
    expect(q<HTMLSelectElement>('import-resume-select').value).toBe(MOCK_SENIOR_FULLSTACK_RESUME.id);
    await click(q('import-resume-confirm'));

    expect(stored().experiences.length).toBeGreaterThan(0);
    expect(stored().skills.length).toBeGreaterThan(0);
    expect(stored().sources.some((s) => s.kind === 'resume' && s.resumeId === MOCK_SENIOR_FULLSTACK_RESUME.id)).toBe(true);
    expect(onProfileSaved).toHaveBeenCalled();
    expect(q('import-status-message').textContent).toMatch(/^Imported \d+ experiences?, \d+ schools?, \d+ skills?/);
    // The wizard stays put with the imported data loaded into its forms.
    expect(dom.querySelector('[data-testid="profile-wizard"]')).not.toBeNull();
    expect(q<HTMLInputElement>('basics-name').value).toBe('Alex Rivera');
  });

  it('disables resume import with a hint when there are no resumes', async () => {
    const { dom } = await renderTab(null, []);
    expect(q<HTMLButtonElement>('import-resume').disabled).toBe(true);
    expect(dom.textContent).toContain('Upload a resume in the Resumes tab first');
  });

  it('imports from LinkedIn via the background and surfaces the skills warning', async () => {
    const linkedin: ProfileImport = {
      source: 'linkedin_page',
      contact: { name: 'Priya Natarajan', linkedinUrl: 'https://www.linkedin.com/in/priya' },
      experiences: [{ company: 'Campus Labs', title: 'Software Engineering Intern', bullets: ['Built an API'] }],
      education: [{ institution: 'UT Austin', degreeLevel: 'bachelor', status: 'in_progress', graduationYear: 2027 }],
      skills: [{ name: 'Python' }, { name: 'Java' }, { name: 'SQL' }, { name: 'React' }],
      warnings: ['Only 4 skills visible; open /details/skills/ for the full list'],
    };
    mockHarness.mockChrome.runtime.sendMessage.mockResolvedValue({ success: true, profile: linkedin, tabId: 1000 });

    const { dom, onProfileSaved } = await renderTab(null);
    await click(q('import-linkedin'));

    expect(mockHarness.mockChrome.runtime.sendMessage).toHaveBeenCalledWith({ type: 'IMPORT_LINKEDIN_PROFILE' });
    expect(q('import-status-message').textContent).toBe('Imported 1 experience, 1 school, 4 skills.');
    expect(dom.textContent).toContain('Only 4 skills visible');
    expect(stored().contact.name).toBe('Priya Natarajan');
    expect(stored().skills.length).toBe(4);
    expect(stored().sources[0].kind).toBe('linkedin_page');
    expect(onProfileSaved).toHaveBeenCalled();

    await click(q('open-linkedin-skills'));
    expect(mockHarness.mockChrome.tabs.create).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://www.linkedin.com/in/me/details/skills/' })
    );
  });

  it('shows the background error when the LinkedIn import fails', async () => {
    mockHarness.mockChrome.runtime.sendMessage.mockResolvedValue({
      success: false,
      error: 'Please sign in to LinkedIn, then try again.',
    });
    const { dom, onProfileSaved } = await renderTab(null);
    await click(q('import-linkedin'));
    expect(q('import-status-message').textContent).toBe('Please sign in to LinkedIn, then try again.');
    expect(dom.querySelector('[data-testid="profile-wizard"]')).not.toBeNull();
    expect(onProfileSaved).not.toHaveBeenCalled();
  });

  it('guards the LinkedIn import when chrome APIs are unavailable', async () => {
    delete (globalThis as any).chrome;
    await renderTab(null);
    await click(q('import-linkedin'));
    expect(q('import-status-message').textContent).toContain('only available inside the extension');
  });

  it('imports LinkedIn data-export CSV files', async () => {
    const skillsCsv = 'Name\nTypeScript\nReact\nGo\n';
    const positionsCsv =
      'Company Name,Title,Description,Location,Started On,Finished On\n' +
      'CloudScale Inc,Lead Backend Engineer,"Built services.\nLed a team.",San Francisco,Jan 2021,\n';
    const files = [new File([skillsCsv], 'Skills.csv'), new File([positionsCsv], 'Positions.csv')];

    const { dom, onProfileSaved } = await renderTab(null);
    const input = q<HTMLInputElement>('import-export-input');
    expect(input.multiple).toBe(true);
    Object.defineProperty(input, 'files', { value: files, configurable: true });
    await act(async () => {
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await flush(60);

    expect(stored().skills.map((s) => s.name)).toEqual(['TypeScript', 'React', 'Go']);
    expect(stored().experiences[0].company).toBe('CloudScale Inc');
    expect(stored().experiences[0].isCurrent).toBe(true);
    expect(stored().sources[0].kind).toBe('linkedin_export');
    expect(onProfileSaved).toHaveBeenCalled();
    expect(q('import-status-message').textContent).toBe('Imported 1 experience, 0 schools, 3 skills.');
    expect(dom.textContent).toContain('Profile.csv was not found in the export.');
  });

  it('captures story drives from suggestions and free text', async () => {
    await renderTab({ ...MOCK_SENIOR_PROFILE, story: { ...MOCK_SENIOR_PROFILE.story, drives: [] } });
    await click(q('edit-story'));
    await click(q('story-drives-suggestion-impact'));
    const input = q<HTMLInputElement>('story-drives');
    await type(input, 'mentorship');
    await act(async () => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
    expect(container.querySelector('[data-testid="story-drives-tag-impact"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="story-drives-tag-mentorship"]')).not.toBeNull();

    await click(q('story-remote-hybrid'));
    await click(q('story-authorized-yes'));
    await click(q('save-story'));
    expect(stored().story.drives).toEqual(['impact', 'mentorship']);
    expect(stored().story.remotePreference).toBe('hybrid');
    expect(stored().story.authorizedToWork).toBe(true);
  });

  it('clears the profile after confirmation and returns to the wizard', async () => {
    const { dom, onProfileSaved } = await renderTab(MOCK_SENIOR_PROFILE);
    await click(q('clear-profile'));
    expect(dom.textContent).toContain('This cannot be undone');
    await click(q('clear-profile-confirm'));

    expect(dom.querySelector('[data-testid="profile-wizard"]')).not.toBeNull();
    expect(q('profile-wizard').getAttribute('data-step')).toBe('basics');
    expect(stored().contact.name).toBe('');
    expect(stored().skills).toEqual([]);
    expect(onProfileSaved).toHaveBeenCalledTimes(1);
    expect(onProfileSaved.mock.calls[0][0].contact.name).toBe('');
  });

  it('re-runs the wizard from the editor and returns after Finish', async () => {
    const { dom } = await renderTab(MOCK_SENIOR_PROFILE);
    await click(q('rerun-wizard'));
    expect(q('profile-wizard').getAttribute('data-step')).toBe('basics');
    expect(q<HTMLInputElement>('basics-name').value).toBe('Alex Rivera');

    // Jump straight to review via the step indicator (all earlier steps are valid).
    await click(q('wizard-step-review'));
    await click(q('wizard-finish'));
    expect(dom.querySelector('[data-testid="profile-editor"]')).not.toBeNull();
  });
});
