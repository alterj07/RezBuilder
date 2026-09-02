import { useState, useEffect } from 'react';
import {
  Briefcase,
  FileText,
  Sparkles,
  MessageSquare,
  Settings,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { JobPosting } from '../types/job';
import { Resume, TailoredResume } from '../types/resume';
import { resumeStorage } from '../services/storage/resumeStorage';
import { JobTab } from './tabs/JobTab';
import { ResumesTab } from './tabs/ResumesTab';
import { TailorTab } from './tabs/TailorTab';
import { InterviewTab } from './tabs/InterviewTab';
import { SettingsTab } from './tabs/SettingsTab';

export type TabType = 'job' | 'resumes' | 'tailor' | 'interview' | 'settings';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('job');
  const [job, setJob] = useState<JobPosting | null>(null);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [activeResumeId, setActiveResumeId] = useState<string | null>(null);
  const [tailoredResume, setTailoredResume] = useState<TailoredResume | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [scrapeNotice, setScrapeNotice] = useState<string | null>(null);

  // Load initial data
  const loadData = async () => {
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
    setResumes([]);
    setActiveResumeId(null);
    setTailoredResume(null);
  };

  const activeResume = resumes.find((r) => r.id === activeResumeId) || resumes[0] || null;

  return (
    <div className="flex flex-col h-screen w-full bg-surface-950 text-surface-100 overflow-hidden font-sans select-none">
      {/* Extension Header */}
      <header className="px-4 py-3 bg-surface-900/95 border-b border-surface-800 flex items-center justify-between shrink-0 backdrop-blur-sm z-10">
        <div className="flex items-center space-x-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-brand-600 to-brand-400 flex items-center justify-center shadow-lg shadow-brand-500/20">
            <Zap className="w-4 h-4 text-white fill-white" />
          </div>
          <div>
            <h1 className="text-xs font-bold text-white tracking-tight flex items-center gap-1.5 leading-none">
              RezBuilder
              <span className="text-[9px] uppercase font-mono px-1.5 py-0.5 rounded bg-brand-500/10 text-brand-400 border border-brand-500/20 font-semibold">
                v1.0
              </span>
            </h1>
            <p className="text-[10px] text-surface-400 font-mono mt-0.5">AI Job-Application Copilot</p>
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

      {/* Modern 5-Tab Navigation Bar */}
      <nav className="flex items-center px-2 py-1.5 bg-surface-900 border-b border-surface-800 shrink-0 gap-1">
        <button
          onClick={() => setActiveTab('job')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-medium transition-all ${
            activeTab === 'job'
              ? 'bg-surface-800 text-white shadow-sm border border-surface-700/60'
              : 'text-surface-400 hover:text-surface-200 hover:bg-surface-850'
          }`}
        >
          <Briefcase className="w-3.5 h-3.5" />
          <span>Job</span>
        </button>

        <button
          onClick={() => setActiveTab('resumes')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-medium transition-all ${
            activeTab === 'resumes'
              ? 'bg-surface-800 text-white shadow-sm border border-surface-700/60'
              : 'text-surface-400 hover:text-surface-200 hover:bg-surface-850'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Resumes</span>
          {resumes.length > 0 && (
            <span className="text-[9px] font-mono px-1 rounded-full bg-surface-700 text-surface-300">
              {resumes.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('tailor')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-medium transition-all ${
            activeTab === 'tailor'
              ? 'bg-surface-800 text-white shadow-sm border border-surface-700/60'
              : 'text-surface-400 hover:text-surface-200 hover:bg-surface-850'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-brand-400" />
          <span>Tailor</span>
        </button>

        <button
          onClick={() => setActiveTab('interview')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-medium transition-all ${
            activeTab === 'interview'
              ? 'bg-surface-800 text-white shadow-sm border border-surface-700/60'
              : 'text-surface-400 hover:text-surface-200 hover:bg-surface-850'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Prep</span>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`p-1.5 rounded-lg text-xs font-medium transition-all ${
            activeTab === 'settings'
              ? 'bg-surface-800 text-white shadow-sm border border-surface-700/60'
              : 'text-surface-400 hover:text-surface-200 hover:bg-surface-850'
          }`}
          title="Settings & Privacy"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>
      </nav>

      {/* Main Tab Content Area */}
      <main className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {activeTab === 'job' && (
          <JobTab
            job={job}
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

        {activeTab === 'tailor' && (
          <TailorTab
            job={job}
            resumes={resumes}
            activeResume={activeResume}
            onSelectResume={handleSelectResume}
            tailoredResume={tailoredResume}
            onSaveTailoredResume={handleSaveTailoredResume}
          />
        )}

        {activeTab === 'interview' && (
          <InterviewTab job={job} activeResume={activeResume} />
        )}

        {activeTab === 'settings' && (
          <SettingsTab onDataCleared={handleDataCleared} />
        )}
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
  );
}
