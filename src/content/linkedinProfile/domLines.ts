/**
 * Turns an element into the list of visible text lines a person would read,
 * in document order — the same thing `innerText` gives in Chrome, computed by
 * walking the DOM so that tests (happy-dom's `innerText` merges spans and
 * ignores `<br>`) and real pages agree.
 *
 * Rules: block elements and `<br>`/`<hr>` break lines; `<span>`/`<a>` and other
 * inline elements break lines only when their parent holds no text of its
 * own (LinkedIn styles such spans as blocks: one span per paragraph); newlines
 * inside a text node break lines (descriptions are rendered `pre-line`).
 * Screen-reader-only copies and hidden subtrees are skipped.
 */

const BLOCK_TAGS = new Set([
  'ADDRESS', 'ARTICLE', 'ASIDE', 'BLOCKQUOTE', 'BR', 'BUTTON', 'DD', 'DETAILS', 'DIALOG', 'DIV', 'DL', 'DT',
  'FIELDSET', 'FIGCAPTION', 'FIGURE', 'FOOTER', 'FORM', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HEADER', 'HR',
  'LABEL', 'LI', 'MAIN', 'NAV', 'OL', 'P', 'PRE', 'SECTION', 'SUMMARY', 'TABLE', 'TBODY', 'TD', 'TFOOT', 'TH',
  'THEAD', 'TR', 'UL',
]);

const INLINE_BREAKERS = new Set(['SPAN', 'A', 'STRONG', 'EM', 'B', 'I', 'SMALL', 'TIME', 'LABEL', 'CODE']);

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'SVG', 'NOSCRIPT', 'TEMPLATE', 'SELECT', 'OPTION', 'INPUT', 'TEXTAREA', 'IFRAME', 'CANVAS', 'VIDEO', 'AUDIO', 'IMG', 'USE', 'PATH']);

const TEXT_NODE = 3;
const ELEMENT_NODE = 1;

function normalize(text: string): string {
  return text.replace(/[\u00a0\u2009\u202f]/g, ' ').replace(/\s+/g, ' ').trim();
}

function isSkipped(el: Element): boolean {
  if (SKIP_TAGS.has(el.tagName)) return true;
  if (el.hasAttribute('hidden')) return true;
  const className = typeof el.className === 'string' ? el.className : '';
  if (/(?:^|\s)(?:visually-hidden|a11y-text|sr-only)(?:\s|$)/.test(className)) return true;
  const style = el.getAttribute('style') || '';
  if (/display\s*:\s*none|visibility\s*:\s*hidden/i.test(style)) return true;
  return false;
}

function parentHasOwnText(el: Element): boolean {
  const parent = el.parentNode;
  if (!parent) return false;
  const nodes = parent.childNodes;
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (node.nodeType === TEXT_NODE && normalize(node.textContent || '')) return true;
  }
  return false;
}

/** Visible text lines of `root`, trimmed, empties dropped. Never throws. */
export function elementLines(root: Element | Document | null | undefined): string[] {
  const lines: string[] = [];
  if (!root) return lines;

  let buffer = '';
  const flush = () => {
    const line = normalize(buffer);
    if (line) lines.push(line);
    buffer = '';
  };

  const visit = (node: Node, depth: number): void => {
    if (depth > 200) return;
    if (node.nodeType === TEXT_NODE) {
      const text = node.textContent || '';
      const pieces = text.split(/\r?\n/);
      for (let i = 0; i < pieces.length; i++) {
        if (i > 0) flush();
        buffer += pieces[i];
      }
      return;
    }
    if (node.nodeType !== ELEMENT_NODE) {
      // Document / fragment: descend.
      const children = node.childNodes;
      for (let i = 0; i < children.length; i++) visit(children[i], depth + 1);
      return;
    }
    const el = node as Element;
    if (isSkipped(el)) return;
    const breaks =
      BLOCK_TAGS.has(el.tagName) || (INLINE_BREAKERS.has(el.tagName) && !parentHasOwnText(el));
    if (breaks) flush();
    const children = el.childNodes;
    for (let i = 0; i < children.length; i++) visit(children[i], depth + 1);
    if (breaks) flush();
  };

  try {
    visit(root as Node, 0);
    flush();
  } catch {
    // return what was collected
  }

  // Re-attach separator fragments split across inline elements ("· Internship").
  const merged: string[] = [];
  for (const line of lines) {
    if (merged.length > 0 && /^[·•]\s+\S/.test(line)) {
      merged[merged.length - 1] += ' ' + line;
    } else {
      merged.push(line);
    }
  }
  return merged;
}

/** Total visible text length, used to detect whether lazy content is still arriving. */
export function visibleTextLength(el: Element | null | undefined): number {
  if (!el) return 0;
  try {
    const inner = (el as HTMLElement).innerText;
    if (typeof inner === 'string' && inner.length > 0) return inner.length;
    return (el.textContent || '').length;
  } catch {
    return 0;
  }
}
