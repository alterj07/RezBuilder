import { useState, useEffect, useMemo } from 'react';
import { Briefcase, ChatCircleText, FileText, Gear, IconContext, Lightning, ShieldCheck, Sparkle, UserCircle } from '@phosphor-icons/react';
import { JobPosting } from '../types/job';
import { Resume, TailoredResume } from '../types/resume';
import { UserProfile } from '../types/profile';
import { resumeStorage } from '../services/storage/resumeStorage';
import { profileStorage, PROFILE_STORAGE_KEY } from '../services/storage/profileStorage';
import { checkProfileCompleteness } from '../services/profile/completeness';
import { ProfileGateCard } from '../components/profile/ProfileGateCard';
import { ProfileTab } from './tabs/ProfileTab';
import { JobTab } from './tabs/JobTab';
import { ResumesTab } from './tabs/ResumesTab';
import { TailorTab } from './tabs/TailorTab';
import { InterviewTab } from './tabs/InterviewTab';
import { SettingsTab } from './tabs/SettingsTab';

export type TabType = 'profile' | 'job' | 'resumes' | 'tailor' | 'interview' | 'settings';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('job');
  const [job, setJob] = useState<JobPosting | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [activeResumeId, setActiveResumeId] = useState<string | null>(null);
  const [tailoredResume, setTailoredResume] = useState<TailoredResume | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [scrapeNotice, setScrapeNotice] = useState<string | null>(null);

  // Load initial data
  const loadData = async () => {
    // 0. Candidate Profile — decides whether the panel opens on onboarding.
    const storedProfile = await profileStorage.getProfile();
    setProfile(storedProfile);
    if (!checkProfileCompleteness(storedProfile).isComplete) {
      setActiveTab('profile');
    }

    // 1. Resumes
    const storedResumes = await resumeStorage.getAllResumes();
    setResumes(storedResumes);

    const activeId = await resumeStorage.getActiveResumeId();
    if (activeId && storedResumes.some((r) => r.id === activeId)) {
      setActiveResumeId(activeId);
    } else if (storedResumes.length > 0) {
      setActiveResumeId(storedResumes[0].id);
      await resumeStorage.setActiveResume(storedResumes[0].id);
    }

    // 2. Active Job from storage (immediate paint)
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      const stored = await chrome.storage.local.get(['activeJob', 'activeTailoredResume']);
      setJob(stored.activeJob || null);
      if (stored.activeTailoredResume) {
        setTailoredResume(stored.activeTailoredResume);
      }
    }

    // 3. Reconcile against the tab actually in view. The panel outlives any one
    // tab, so a stored job may belong to a tab the user has since left.
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      try {
        const response: any = await chrome.runtime.sendMessage({ type: 'GET_ACTIVE_TAB_JOB' });
        if (response && 'job' in response) {
          setJob(response.job || null);
        }
      } catch {
        // Background worker asleep or unavailable; storage value stands.
      }
    }
  };

  useEffect(() => {
    loadData();

    // Listen for storage changes from Content Script or Background
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
      const listener = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
        if (areaName === 'local') {
          if (changes.activeJob) {
            setJob(changes.activeJob.newValue || null);
            setScrapeNotice(null);
          }
          if (changes.rezbuilder_resumes) {
            setResumes(changes.rezbuilder_resumes.newValue || []);
          }
          if (changes.activeTailoredResume) {
            setTailoredResume(changes.activeTailoredResume.newValue || null);
          }
          if (changes[PROFILE_STORAGE_KEY]) {
            const next = changes[PROFILE_STORAGE_KEY].newValue;
            setProfile(next && typeof next === 'object' ? (next as UserProfile) : null);
          }
        }
      };

      chrome.storage.onChanged.addListener(listener);
      return () => {
        chrome.storage.onChanged.removeListener(listener);
      };
    }
  }, []);

  // Handlers
  const handleSelectResume = async (id: string) => {
    setActiveResumeId(id);
    await resumeStorage.setActiveResume(id);
  };

  const handleSaveResume = async (newResume: Resume) => {
    await resumeStorage.saveResume(newResume);
    const all = await resumeStorage.getAllResumes();
    setResumes(all);
    setActiveResumeId(newResume.id);
  };

  const handleDeleteResume = async (id: string) => {
    await resumeStorage.deleteResume(id);
    const all = await resumeStorage.getAllResumes();
    setResumes(all);
    const active = await resumeStorage.getActiveResume();
    setActiveResumeId(active?.id || null);
  };

  const handleSetDefault = async (id: string) => {
    await resumeStorage.setDefaultResume(id);
    const all = await resumeStorage.getAllResumes();
    setResumes(all);
  };

  const handleRefreshScrape = () => {
    setIsLoading(true);
    setScrapeNotice(null);

    if (typeof chrome === 'undefined' || !chrome.tabs) {
      setTimeout(() => setIsLoading(false), 500);
      return;
    }

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]?.id) {
        setIsLoading(false);
        setScrapeNotice('No active tab to scan.');
        return;
      }

      chrome.tabs.sendMessage(tabs[0].id, { type: 'SCRAPE_CURRENT_PAGE' }, (response) => {
        setIsLoading(false);

        // No content script in the tab: restricted page, or the tab was open
        // before the extension loaded and needs a refresh.
        if (chrome.runtime?.lastError) {
          setJob(null);
          setScrapeNotice('Cannot read this tab. Reload the page and try again.');
          return;
        }

        if (response && response.success && response.job) {
          setJob(response.job);
          return;
        }

        // An explicit scan that finds nothing must clear the panel, otherwise a
        // previous tab's posting looks like the current page's.
        setJob(null);
        setScrapeNotice(response?.error || 'No job posting found on this page.');
      });
    });
  };

  const handleManualJobSave = async (manualJob: JobPosting) => {
    setJob(manualJob);
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      await chrome.storage.local.set({ activeJob: manualJob });
    }
  };

  const handleSaveTailoredResume = async (tailored: TailoredResume) => {
    setTailoredResume(tailored);
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      await chrome.storage.local.set({ activeTailoredResume: tailored });
    }
  };

  const handleDataCleared = () => {
    setJob(null);
    setProfile(null);
    setResumes([]);
    setActiveResumeId(null);
    setTailoredResume(null);
  };

  const activeResume = resumes.find((r) => r.id === activeResumeId) || resumes[0] || null;
  const completeness = useMemo(() => checkProfileCompleteness(profile), [profile]);
  const profileGate = !completeness.isComplete;
  const gate = <ProfileGateCard completeness={completeness} onGoToProfile={() => setActiveTab('profile')} />;

  const navItemClass = (tab: TabType) =>
    `relative flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-surface-500 focus-visible:ring-offset-1 focus-visible:ring-offset-surface-900 ${
      activeTab === tab
        ? 'bg-surface-800 text-white border border-surface-700/60'
        : 'text-surface-400 hover:text-surface-200 hover:bg-surface-800/60'
    }`;

  return (
    <IconContext.Provider value={{ weight: 'bold' }}>
    <div className="flex flex-col h-screen w-full bg-surface-950 text-surface-100 overflow-hidden font-sans select-none">
      {/* Extension Header */}
      <header className="px-4 py-3 bg-surface-900/95 border-b border-surface-800 flex items-center justify-between shrink-0 backdrop-blur-sm z-10">
        <div className="flex items-center space-x-2.5">
          <div className="w-7 h-7 rounded-md bg-brand-600 flex items-center justify-center">
            <Lightning className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-xs font-bold text-white tracking-tight flex items-center gap-1.5 leading-none">
              RezBuilder
              <span className="text-[9px] uppercase font-mono px-1.5 py-0.5 rounded bg-brand-500/10 text-brand-400 border border-brand-500/20 font-semibold tracking-wide">
                v1.0
              </span>
            </h1>
            <p className="text-[10px] text-surface-400 font-mono mt-0.5">Local Job-Application Copilot</p>
          </div>
        </div>

        {/* Status Indicator */}
        <div className="flex items-center gap-2">
          {job && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-surface-800 text-surface-300 border border-surface-700 max-w-[110px] truncate">
              {job.company}
            </span>
          )}
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Extension Active" />
        </div>
      </header>

      {/* Navigation Bar */}
      <nav className="flex items-center px-2 py-1.5 bg-surface-900 border-b border-surface-800 shrink-0 gap-1">
        <button
          onClick={() => setActiveTab('profile')}
          data-testid="nav-profile"
          className={navItemClass('profile')}
        >
          <UserCircle className="w-3.5 h-3.5" />
          <span>Profile</span>
          {profileGate && (
            <span
              data-testid="profile-incomplete-badge"
              className="absolute top-1 right-1.5 w-1.5 h-1.5 rounded-full bg-amber-400"
              title="Profile incomplete"
            />
          )}
        </button>

        <button onClick={() => setActiveTab('job')} className={navItemClass('job')}>
          <Briefcase className="w-3.5 h-3.5" />
          <span>Job</span>
        </button>

        <button onClick={() => setActiveTab('resumes')} className={navItemClass('resumes')}>
          <FileText className="w-3.5 h-3.5" />
          <span>Resumes</span>
          {resumes.length > 0 && (
            <span className="text-[9px] font-mono px-1 rounded-full bg-surface-700 text-surface-300">
              {resumes.length}
            </span>
          )}
        </button>

        <button onClick={() => setActiveTab('tailor')} className={navItemClass('tailor')}>
          <Sparkle className="w-3.5 h-3.5 text-brand-400" />
          <span>Tailor</span>
        </button>

        <button onClick={() => setActiveTab('interview')} className={navItemClass('interview')}>
          <ChatCircleText className="w-3.5 h-3.5" />
          <span>Prep</span>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`p-1.5 rounded-md text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-surface-500 focus-visible:ring-offset-1 focus-visible:ring-offset-surface-900 ${
            activeTab === 'settings'
              ? 'bg-surface-800 text-white border border-surface-700/60'
              : 'text-surface-400 hover:text-surface-200 hover:bg-surface-800/60'
          }`}
          title="Settings & Privacy"
        >
          <Gear className="w-3.5 h-3.5" />
        </button>
      </nav>

      {/* Main Tab Content Area */}
      <main className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        <div key={activeTab} className="motion-safe:animate-tab-enter">
        {activeTab === 'profile' && (
          <ProfileTab profile={profile} resumes={resumes} onProfileSaved={setProfile} />
        )}

        {activeTab === 'job' && profileGate && gate}
        {activeTab === 'job' && !profileGate && (
          <JobTab
            job={job}
            profile={profile}
            resumes={resumes}
            activeResume={activeResume}
            onSelectResume={handleSelectResume}
            onRefreshScrape={handleRefreshScrape}
            onManualJobSave={handleManualJobSave}
            onNavigateToTailor={() => setActiveTab('tailor')}
            isLoading={isLoading}
            scrapeNotice={scrapeNotice}
          />
        )}

        {activeTab === 'resumes' && (
          <ResumesTab
            resumes={resumes}
            activeResume={activeResume}
            onSelectResume={handleSelectResume}
            onSaveResume={handleSaveResume}
            onDeleteResume={handleDeleteResume}
            onSetDefault={handleSetDefault}
          />
        )}

        {activeTab === 'tailor' && profileGate && gate}
        {activeTab === 'tailor' && !profileGate && (
          <TailorTab
            job={job}
            resumes={resumes}
            activeResume={activeResume}
            onSelectResume={handleSelectResume}
            tailoredResume={tailoredResume}
            onSaveTailoredResume={handleSaveTailoredResume}
            profile={profile}
          />
        )}

        {activeTab === 'interview' && profileGate && gate}
        {activeTab === 'interview' && !profileGate && (
          <InterviewTab job={job} activeResume={activeResume} />
        )}

        {activeTab === 'settings' && (
          <SettingsTab onDataCleared={handleDataCleared} />
        )}
        </div>
      </main>

      {/* Footer Trust Badge */}
      <footer className="px-4 py-1.5 bg-surface-950 border-t border-surface-900 flex items-center justify-between text-[10px] text-surface-500 font-mono shrink-0">
        <span className="flex items-center gap-1">
          <ShieldCheck className="w-3 h-3 text-brand-400" />
          <span>Local Client-Side Storage</span>
        </span>
        <span>RezBuilder v1.0</span>
      </footer>
    </div>
    </IconContext.Provider>
  );
}
