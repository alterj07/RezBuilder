/**
 * Waits for a LinkedIn profile page to finish rendering before it is scraped.
 *
 * 1. Poll (every 250 ms, up to `timeoutMs`) until the page's section has
 *    content beyond its heading/pills — or, on the main page, the top card
 *    has a name.
 * 2. Scroll the inner scroller (`main` is the only scroll container on
 *    LinkedIn) to the bottom repeatedly until the text stops growing, so
 *    lazily rendered entries appear.
 * 3. Click every `… more` expandable-text button so descriptions are complete.
 *
 * Safe in happy-dom: every DOM API is guarded, nothing throws, and the
 * function never runs past its deadline.
 */

import { LinkedInPageKind } from './pageKind';
import { isNotFoundPage, pageHasRenderedContent } from './linkedinProfileScraper';
import { visibleTextLength } from './domLines';

export interface SettleOptions {
  /** Overall budget, default 8000 ms. */
  timeoutMs?: number;
}

const POLL_INTERVAL_MS = 250;
const SCROLL_INTERVAL_MS = 400;
const MAX_SCROLL_ROUNDS = 12;
const EXPAND_WAIT_MS = 300;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isScrollable(el: Element, view: Window | null): boolean {
  try {
    if (el.scrollHeight <= el.clientHeight + 10) return false;
    if (!view || typeof view.getComputedStyle !== 'function') return true;
    const overflow = view.getComputedStyle(el).overflowY;
    return overflow === 'auto' || overflow === 'scroll' || overflow === '' || overflow === undefined;
  } catch {
    return false;
  }
}

/** `main` when it scrolls, else the largest scrolling element under it, else the document scroller. */
function findScroller(document: Document): Element | null {
  try {
    const view = document.defaultView;
    const main = document.querySelector('main');
    if (main && isScrollable(main, view)) return main;

    let best: Element | null = null;
    let bestHeight = 0;
    const candidates = Array.from(document.querySelectorAll('main, main *, body > *')).slice(0, 600);
    for (const candidate of candidates) {
      if (!isScrollable(candidate, view)) continue;
      if (candidate.scrollHeight > bestHeight) {
        best = candidate;
        bestHeight = candidate.scrollHeight;
      }
    }
    if (best) return best;

    const scrolling = document.scrollingElement || document.documentElement;
    if (scrolling && scrolling.scrollHeight > scrolling.clientHeight + 10) return scrolling;
  } catch {
    // no scroller
  }
  return null;
}

function scrollToBottom(document: Document, el: Element): void {
  try {
    el.scrollTop = el.scrollHeight;
    if (el === document.scrollingElement || el === document.documentElement) {
      document.defaultView?.scrollTo?.(0, el.scrollHeight);
    }
  } catch {
    // ignore
  }
}

/** Resolves once the page looks fully rendered, or when the budget runs out. Never rejects. */
export async function settleLinkedInPage(
  document: Document,
  page: LinkedInPageKind,
  opts: SettleOptions = {}
): Promise<void> {
  const timeoutMs = typeof opts.timeoutMs === 'number' && opts.timeoutMs >= 0 ? opts.timeoutMs : 8000;
  const deadline = Date.now() + timeoutMs;
  const timeLeft = () => deadline - Date.now();

  try {
    if (!document || page === 'unknown') return;

    // Phase 1: wait for content.
    while (!pageHasRenderedContent(document, page)) {
      if (isNotFoundPage(document)) return;
      if (timeLeft() <= 0) return;
      await sleep(Math.min(POLL_INTERVAL_MS, Math.max(timeLeft(), 0)));
    }

    // Phase 2: scroll until the text stops growing (only when something scrolls).
    const scroller = findScroller(document);
    const main = document.querySelector('main') || document.body;
    if (scroller && main) {
      let last = -1;
      let stableRounds = 0;
      for (let round = 0; round < MAX_SCROLL_ROUNDS && timeLeft() > 0; round++) {
        scrollToBottom(document, scroller);
        await sleep(Math.min(SCROLL_INTERVAL_MS, Math.max(timeLeft(), 0)));
        const length = visibleTextLength(main);
        if (length === last) {
          stableRounds += 1;
          if (stableRounds >= 2) break;
        } else {
          stableRounds = 0;
          last = length;
        }
      }
    }

    // Phase 3: expand truncated descriptions.
    const scope = document.querySelector('main') || document.body;
    const buttons = scope ? Array.from(scope.querySelectorAll('[data-testid="expandable-text-button"]')) : [];
    let clicked = 0;
    for (const button of buttons) {
      try {
        (button as HTMLElement).click?.();
        clicked += 1;
      } catch {
        // ignore
      }
    }
    if (clicked > 0 && timeLeft() > 0) {
      await sleep(Math.min(EXPAND_WAIT_MS, timeLeft()));
    }
  } catch {
    // settling is best effort
  }
}
