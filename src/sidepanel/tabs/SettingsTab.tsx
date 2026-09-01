import React, { useState, useEffect } from 'react';
import {
  Settings,
  Key,
  Eye,
  EyeOff,
  Save,
  Trash2,
  CheckCircle2,
  Shield,
  Sliders,
  Sparkles,
  AlertTriangle,
  Zap,
} from 'lucide-react';
import { UserSettings, DEFAULT_SETTINGS, AIProviderType } from '../../types/settings';
import { settingsStorage } from '../../services/storage/settingsStorage';
import { ATS_PRESETS } from '../../services/scoring/atsEngine';

interface SettingsTabProps {
  onDataCleared: () => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({ onDataCleared }) => {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [showApiKey, setShowApiKey] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  useEffect(() => {
    settingsStorage.getSettings().then((s) => setSettings(s));
  }, []);

  const handleSave = async () => {
    await settingsStorage.saveSettings(settings);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const handleClearAll = async () => {
    setIsClearing(true);
    try {
      await settingsStorage.clearAllRezBuilderData();
      setSettings(DEFAULT_SETTINGS);
      setShowClearModal(false);
      onDataCleared();
    } finally {
      setIsClearing(false);
    }
  };

  const currentWeights = settings.customWeights || ATS_PRESETS[settings.atsPreset];

  return (
    <div className="space-y-5 pb-8">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Settings className="w-4 h-4 text-brand-400" />
        <h2 className="text-xs font-semibold text-white tracking-tight">Extension Settings & Engine Mode</h2>
      </div>

      {saveSuccess && (
        <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-1.5 animate-fadeIn">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Settings saved successfully!</span>
        </div>
      )}

      {/* Engine Status Banner */}
      <div className="p-4 rounded-xl bg-brand-950/30 border border-brand-500/30 space-y-2">
        <div className="flex items-center gap-2 text-brand-300 text-xs font-semibold">
          <Zap className="w-4 h-4 text-brand-400" />
          <span>100% Local Deterministic Engine (Active)</span>
        </div>
        <p className="text-[11px] text-brand-200/80 leading-relaxed">
          RezBuilder is configured to operate completely client-side. Resume tailoring, ATS scoring, and interview briefings run instantly without any LLM API keys or cloud dependencies.
        </p>
      </div>

      {/* Optional AI Provider Config Card */}
      <div className="p-4 rounded-xl bg-surface-900 border border-surface-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold text-surface-200">
            <Sparkles className="w-4 h-4 text-surface-400" />
            <span>Optional LLM Integration</span>
          </div>
          <span className="text-[10px] text-surface-500 font-mono">Optional</span>
        </div>

        <p className="text-[11px] text-surface-400 leading-snug">
          You can optionally connect an AI model key if you wish to experiment with cloud LLM responses. If omitted, the local rule-based engine is used automatically.
        </p>

        <div>
          <label className="text-[11px] text-surface-400 block mb-1">Provider Choice</label>
          <div className="grid grid-cols-3 gap-1.5">
            {(['anthropic', 'openai', 'gemini'] as AIProviderType[]).map((provider) => (
              <button
                key={provider}
                type="button"
                onClick={() => setSettings({ ...settings, aiProvider: provider })}
                className={`py-1.5 px-2 rounded-lg text-xs font-medium capitalize border transition-all ${
                  settings.aiProvider === provider
                    ? 'bg-brand-500/20 border-brand-500/50 text-brand-300 shadow-sm'
                    : 'bg-surface-950 border-surface-800 text-surface-400 hover:text-surface-200'
                }`}
              >
                {provider === 'anthropic' ? 'Claude' : provider}
              </button>
            ))}
          </div>
        </div>

        {/* Anthropic API Key */}
        {settings.aiProvider === 'anthropic' && (
          <div className="space-y-3 pt-1">
            <div>
              <label className="text-[11px] text-surface-400 flex items-center justify-between mb-1">
                <span className="flex items-center gap-1">
                  <Key className="w-3 h-3 text-brand-400" />
                  <span>Anthropic API Key (Optional)</span>
                </span>
                <span className="text-[10px] text-surface-500 font-mono">Stored locally</span>
              </label>
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  placeholder="sk-ant-api03-... (leave empty for local engine)"
                  value={settings.anthropicApiKey}
                  onChange={(e) => setSettings({ ...settings, anthropicApiKey: e.target.value })}
                  className="w-full bg-surface-950 border border-surface-800 rounded-lg px-3 py-1.5 pr-8 text-xs text-white placeholder-surface-600 outline-none focus:border-brand-500 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2.5 top-2 text-surface-500 hover:text-surface-300"
                >
                  {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-[11px] text-surface-400 block mb-1">Model Selection</label>
              <select
                value={settings.anthropicModel}
                onChange={(e) => setSettings({ ...settings, anthropicModel: e.target.value })}
                className="w-full bg-surface-950 border border-surface-800 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-brand-500"
              >
                <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</option>
                <option value="claude-3-5-haiku-20241022">Claude 3.5 Haiku</option>
                <option value="claude-3-opus-20240229">Claude 3 Opus</option>
              </select>
            </div>
          </div>
        )}

        {/* OpenAI Config */}
        {settings.aiProvider === 'openai' && (
          <div className="space-y-3 pt-1">
            <div>
              <label className="text-[11px] text-surface-400 flex items-center justify-between mb-1">
                <span>OpenAI API Key (Optional)</span>
                <span className="text-[10px] text-surface-500 font-mono">Stored locally</span>
              </label>
              <input
                type={showApiKey ? 'text' : 'password'}
                placeholder="sk-proj-... (leave empty for local engine)"
                value={settings.openaiApiKey || ''}
                onChange={(e) => setSettings({ ...settings, openaiApiKey: e.target.value })}
                className="w-full bg-surface-950 border border-surface-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-surface-600 outline-none focus:border-brand-500 font-mono"
              />
            </div>
            <div>
              <label className="text-[11px] text-surface-400 block mb-1">Model Selection</label>
              <select
                value={settings.openaiModel || 'gpt-4o'}
                onChange={(e) => setSettings({ ...settings, openaiModel: e.target.value })}
                className="w-full bg-surface-950 border border-surface-800 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-brand-500"
              >
                <option value="gpt-4o">GPT-4o</option>
                <option value="gpt-4o-mini">GPT-4o Mini</option>
              </select>
            </div>
          </div>
        )}

        {/* Gemini Config */}
        {settings.aiProvider === 'gemini' && (
          <div className="space-y-3 pt-1">
            <div>
              <label className="text-[11px] text-surface-400 flex items-center justify-between mb-1">
                <span>Gemini API Key (Optional)</span>
                <span className="text-[10px] text-surface-500 font-mono">Stored locally</span>
              </label>
              <input
                type={showApiKey ? 'text' : 'password'}
                placeholder="AIzaSy... (leave empty for local engine)"
                value={settings.geminiApiKey || ''}
                onChange={(e) => setSettings({ ...settings, geminiApiKey: e.target.value })}
                className="w-full bg-surface-950 border border-surface-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-surface-600 outline-none focus:border-brand-500 font-mono"
              />
            </div>
            <div>
              <label className="text-[11px] text-surface-400 block mb-1">Model Selection</label>
              <select
                value={settings.geminiModel || 'gemini-1.5-pro'}
                onChange={(e) => setSettings({ ...settings, geminiModel: e.target.value })}
                className="w-full bg-surface-950 border border-surface-800 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-brand-500"
              >
                <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* ATS Scoring Weights Customizer */}
      <div className="p-4 rounded-xl bg-surface-900 border border-surface-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold text-surface-200">
            <Sliders className="w-4 h-4 text-brand-400" />
            <span>ATS Engine Scoring Weights</span>
          </div>
          <span className="text-[10px] font-mono text-surface-400 capitalize">{settings.atsPreset}</span>
        </div>

        <div className="space-y-2 text-xs">
          <div className="flex justify-between text-[11px] text-surface-400">
            <span>Keyword Match (W1):</span>
            <span className="font-mono text-white">{currentWeights.keywordMatch}%</span>
          </div>
          <div className="flex justify-between text-[11px] text-surface-400">
            <span>Placement Multiplier (W2):</span>
            <span className="font-mono text-white">{currentWeights.placement}%</span>
          </div>
          <div className="flex justify-between text-[11px] text-surface-400">
            <span>Section Completeness (W3):</span>
            <span className="font-mono text-white">{currentWeights.sectionCompleteness}%</span>
          </div>
          <div className="flex justify-between text-[11px] text-surface-400">
            <span>Parse Success (W4):</span>
            <span className="font-mono text-white">{currentWeights.parseSuccess}%</span>
          </div>
          <div className="flex justify-between text-[11px] text-surface-400">
            <span>Relevance Boost (W5):</span>
            <span className="font-mono text-white">{currentWeights.relevance}%</span>
          </div>
        </div>
      </div>

      {/* Privacy & Transparency Manifest */}
      <div className="p-4 rounded-xl bg-surface-900/60 border border-surface-800 space-y-2">
        <div className="flex items-center gap-2 text-brand-300 text-xs font-semibold">
          <Shield className="w-4 h-4 text-brand-400" />
          <span>Local-Only Privacy Policy</span>
        </div>
        <p className="text-[11px] text-surface-400 leading-relaxed">
          RezBuilder does not own any external servers or databases. All scraped jobs, uploaded resumes, ATS scores,
          and settings are stored exclusively on your device in <code className="font-mono text-surface-300">chrome.storage.local</code>.
        </p>
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        className="w-full py-2.5 px-4 rounded-xl bg-brand-500 hover:bg-brand-400 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-lg shadow-brand-500/20 transition-all active:scale-[0.99]"
      >
        <Save className="w-4 h-4" />
        <span>Save Settings</span>
      </button>

      {/* Danger Zone */}
      <div className="pt-2 border-t border-surface-800">
        <button
          onClick={() => setShowClearModal(true)}
          className="w-full py-2 px-3 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Clear All RezBuilder Data</span>
        </button>
      </div>

      {/* Clear Confirmation Modal */}
      {showClearModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-900 border border-rose-500/30 rounded-2xl w-full max-w-sm p-4 space-y-3 shadow-2xl">
            <div className="flex items-center gap-2 text-rose-400">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="text-sm font-semibold">Delete All Extension Data?</h3>
            </div>
            <p className="text-xs text-surface-300 leading-relaxed">
              This will permanently delete all stored resumes, job history, active drafts, and cached interview briefings from your browser.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowClearModal(false)}
                className="px-3 py-1.5 rounded-lg text-xs text-surface-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                disabled={isClearing}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-md shadow-rose-600/30"
              >
                {isClearing ? 'Clearing...' : 'Yes, Delete Everything'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
