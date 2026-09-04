/**
 * Shared Tailwind class strings for the profile forms so every step looks the
 * same as the rest of the side panel (dark surface palette, text-xs sizing).
 */
export const inputClass =
  'w-full bg-surface-950 border border-surface-800 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-surface-600 outline-none focus:border-brand-500';

export const inputErrorClass = 'border-rose-500/60 focus:border-rose-400';

export const selectClass =
  'w-full bg-surface-950 border border-surface-800 rounded-lg px-2 py-1.5 text-xs text-white outline-none focus:border-brand-500';

export const textareaClass =
  'w-full bg-surface-950 border border-surface-800 rounded-lg px-2.5 py-2 text-xs text-white placeholder-surface-600 outline-none focus:border-brand-500 leading-relaxed resize-y min-h-[72px]';

export const labelClass = 'text-[11px] text-surface-400 block mb-1';

export const sectionTitleClass = 'text-[10px] font-mono uppercase text-surface-500 font-semibold tracking-wider';

export const cardClass = 'p-3 rounded-xl border border-surface-800 bg-surface-900/50 space-y-2.5';

export const primaryButtonClass =
  'px-3 py-1.5 rounded-md bg-brand-600 hover:bg-brand-500 active:scale-[0.98] text-white text-xs font-semibold flex items-center gap-1.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-950 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-brand-600 disabled:active:scale-100';

export const secondaryButtonClass =
  'px-3 py-1.5 rounded-md border border-surface-800 bg-surface-950 text-surface-300 hover:text-white hover:border-surface-700 active:scale-[0.98] text-xs font-medium flex items-center gap-1.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-surface-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-950 disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100';

export const ghostButtonClass =
  'px-2 py-1 rounded-md text-[11px] text-surface-400 hover:text-white hover:bg-surface-800 flex items-center gap-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-surface-500 focus-visible:ring-offset-1 focus-visible:ring-offset-surface-950';

export const dangerButtonClass =
  'px-3 py-1.5 rounded-md border border-rose-700/50 bg-rose-900/30 text-rose-300 hover:bg-rose-900/50 active:scale-[0.98] text-xs font-medium flex items-center gap-1.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-950 disabled:opacity-40 disabled:active:scale-100';

export const errorTextClass = 'text-[11px] text-rose-300 flex items-center gap-1';

export const hintTextClass = 'text-[11px] text-surface-500 leading-snug';
