import React, { useCallback, useEffect, useState } from 'react';
import { Cpu, DownloadSimple, Trash, WarningCircle } from '@phosphor-icons/react';
import { LABELLER_STATE_KEY, LabellerStatus } from '../../services/labeller/types';
import { MODEL_ID, MODEL_SIZE_BYTES } from '../../services/labeller/labelset';

interface LocalLabellerCardProps {
  /** Mirrors the enabled flag into the Settings tab's draft so "Save" cannot clobber it. */
  onEnabledChange: (enabled: boolean) => void;
}

const FALLBACK_STATUS: LabellerStatus = { enabled: false, state: 'absent', modelId: MODEL_ID, sizeBytes: MODEL_SIZE_BYTES };

function formatMb(bytes: number): string {
  return `${Math.round(bytes / 1_000_000)} MB`;
}

async function send<T>(message: Record<string, unknown>): Promise<T | null> {
  if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return null;
  try {
    return (await chrome.runtime.sendMessage(message)) as T;
  } catch {
    return null;
  }
}

/**
 * Opt-in on-device section labeller: one-time ~90 MB download, runs entirely
 * in the browser, labels only the posting sections the heuristics cannot place.
 */
export const LocalLabellerCard: React.FC<LocalLabellerCardProps> = ({ onEnabledChange }) => {
  const [status, setStatus] = useState<LabellerStatus>(FALLBACK_STATUS);
  const [busy, setBusy] = useState(false);
  const [showConsent, setShowConsent] = useState(false);

  const refresh = useCallback(async () => {
    const s = await send<LabellerStatus>({ type: 'LABELLER_STATUS' });
    if (s && typeof s === 'object' && 'state' in s) {
      setStatus(s);
      onEnabledChange(!!s.enabled);
    }
  }, [onEnabledChange]);

  useEffect(() => {
    refresh();
    if (typeof chrome === 'undefined' || !chrome.storage?.onChanged) return;
    const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === 'local' && changes[LABELLER_STATE_KEY]) refresh();
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, [refresh]);

  const apply = async (message: Record<string, unknown>) => {
    setBusy(true);
    try {
      const s = await send<LabellerStatus>(message);
      if (s && 'state' in s) {
        setStatus(s);
        onEnabledChange(!!s.enabled);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleToggle = async () => {
    if (status.enabled) {
      await apply({ type: 'LABELLER_SET_ENABLED', enabled: false });
      return;
    }
    if (status.state === 'ready') {
      await apply({ type: 'LABELLER_SET_ENABLED', enabled: true });
      return;
    }
    setShowConsent(true);
  };

  const handleDownload = async () => {
    setShowConsent(false);
    await apply({ type: 'LABELLER_DOWNLOAD' });
  };

  const stateLine = (() => {
    switch (status.state) {
      case 'ready':
        return `Ready · ${formatMb(status.sizeBytes)} on disk`;
      case 'downloading':
        return `Downloading ${Math.round((status.progress || 0) * 100)}%`;
      case 'unsupported':
        return 'Unsupported on this device (WebAssembly unavailable)';
      case 'error':
        return `Download failed${status.error ? `: ${status.error}` : ''}`;
      default:
        return 'Not downloaded';
    }
  })();

  return (
    <div data-testid="local-labeller-card" className="p-4 rounded-xl bg-surface-900 border border-surface-800 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold text-surface-200">
          <Cpu className="w-4 h-4 text-brand-400" />
          <span>On-device section labelling</span>
        </div>
        <span className="text-[10px] text-surface-500 font-mono">Beta · Opt-in</span>
      </div>

      <p className="text-[11px] text-surface-400 leading-snug">
        A small classifier ({formatMb(status.sizeBytes)}, downloaded once from Hugging Face) labels posting sections the
        heading rules cannot place — e.g. a "You might be a fit if" block — as required, preferred, responsibilities
        or other. It runs entirely in your browser and never generates text or scores; the deterministic engine still
        computes every number.
      </p>

      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] text-surface-300" data-testid="local-labeller-state">
          {stateLine}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={status.enabled}
          data-testid="local-labeller-toggle"
          disabled={busy || status.state === 'downloading' || status.state === 'unsupported'}
          onClick={handleToggle}
          className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors disabled:opacity-50 ${
            status.enabled ? 'bg-brand-500/40 border-brand-500/60' : 'bg-surface-950 border-surface-700'
          }`}
        >
          <span
            className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
              status.enabled ? 'translate-x-4' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>

      {status.state === 'downloading' && (
        <div className="h-1 rounded-full bg-surface-800 overflow-hidden">
          <div className="h-full bg-brand-500 transition-all" style={{ width: `${Math.round((status.progress || 0) * 100)}%` }} />
        </div>
      )}

      {status.state === 'ready' && (
        <button
          type="button"
          data-testid="local-labeller-remove"
          disabled={busy}
          onClick={() => apply({ type: 'LABELLER_REMOVE' })}
          className="text-[11px] text-surface-400 hover:text-rose-300 flex items-center gap-1 disabled:opacity-50"
        >
          <Trash className="w-3 h-3" />
          <span>Remove model and disable</span>
        </button>
      )}

      {showConsent && (
        <div data-testid="local-labeller-consent" className="p-3 rounded-lg border border-brand-500/30 bg-brand-950/30 space-y-2">
          <div className="flex items-start gap-2 text-[11px] text-brand-100 leading-snug">
            <WarningCircle className="w-3.5 h-3.5 shrink-0 mt-px text-brand-300" />
            <span>
              This downloads <span className="font-mono">{status.modelId}</span> ({formatMb(status.sizeBytes)}) from
              huggingface.co once and caches it in your browser. No page text or profile data is ever sent anywhere.
            </span>
          </div>
          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={() => setShowConsent(false)} className="px-2.5 py-1 rounded-lg text-[11px] text-surface-400 hover:text-white">
              Cancel
            </button>
            <button
              type="button"
              data-testid="local-labeller-download"
              onClick={handleDownload}
              className="px-3 py-1 rounded-md bg-brand-600 hover:bg-brand-500 text-white text-[11px] font-semibold flex items-center gap-1"
            >
              <DownloadSimple className="w-3 h-3" />
              <span>Download & enable</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
