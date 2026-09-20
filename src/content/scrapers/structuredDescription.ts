/**
 * Turns a job-description container into heading-delimited sections while
 * keeping one line per list item / paragraph. The scrapers used to flatten
 * the whole container into a single line, which made "Preferred
 * Qualifications" indistinguishable from "Requirements" downstream.
 *
 * Walks DOM nodes rather than reading `innerText`, so collapsed or hidden
 * containers (LinkedIn "See more") still yield their structure.
 */
import { JobSection, JobSectionKind } from '../../types/job';
import { classifyHeading, isHeadingLike } from '../../services/fit/sectionHeaders';

export interface StructuredDescription {
  /** Heading + items, one per line; sections separated by a blank line. */
  text: string;
  sections: JobSection[];
}

export const MAX_ITEMS = 400;
export const MAX_TEXT_CHARS = 20000;

const SKIP_TAGS = new Set([
  'SCRIPT', 'STYLE', 'NOSCRIPT', 'SVG', 'TEMPLATE', 'IFRAME', 'NAV', 'FOOTER', 'HEADER', 'BUTTON',
  'SELECT', 'OPTION', 'INPUT', 'TEXTAREA', 'CANVAS', 'VIDEO', 'AUDIO', 'PICTURE', 'IMG',
]);
const HEADING_TAGS = new Set(['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'DT', 'SUMMARY', 'TH']);
const ITEM_TAGS = new Set(['P', 'LI', 'DD', 'TD', 'BLOCKQUOTE', 'PRE']);
const BLOCK_TAGS = new Set([
  'DIV', 'SECTION', 'ARTICLE', 'MAIN', 'ASIDE', 'UL', 'OL', 'DL', 'TABLE', 'TBODY', 'THEAD', 'TR',
  'FIGURE', 'FIELDSET', 'FORM', 'DETAILS', 'BODY', 'HTML', 'SPAN', 'B', 'STRONG', 'EM', 'I', 'U', 'A',
  'LABEL', 'SMALL', 'FONT', 'CENTER',
]);
const EMPHASIS_TAGS = new Set(['STRONG', 'B', 'U']);
const INLINE_TAGS = new Set(['SPAN', 'B', 'STRONG', 'EM', 'I', 'U', 'A', 'LABEL', 'SMALL', 'FONT', 'CODE', 'MARK', 'SUB', 'SUP', 'ABBR', 'TIME']);

/** Collapses whitespace within a single line; never crosses line boundaries. */
export function cleanLine(text: string | null | undefined): string {
  if (!text) return '';
  return text.replace(/\u00a0/g, ' ').replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
}

class SectionBuilder {
  sections: JobSection[] = [];
  private current: JobSection | null = null;
  private itemCount = 0;
  private chars = 0;

  get full(): boolean {
    return this.itemCount >= MAX_ITEMS || this.chars >= MAX_TEXT_CHARS;
  }

  heading(text: string): void {
    const heading = cleanLine(text);
    if (!heading || this.full) return;
    const kind: JobSectionKind = classifyHeading(heading);
    this.current = { heading, kind, kindSource: kind === 'unknown' ? 'default' : 'heading', items: [] };
    this.sections.push(this.current);
    this.chars += heading.length + 1;
  }

  item(text: string): void {
    const item = cleanLine(text);
    if (item.length < 2 || this.full) return;
    if (!this.current) {
      this.current = { heading: '', kind: 'unknown', kindSource: 'default', items: [] };
      this.sections.push(this.current);
    }
    this.current.items.push(item);
    this.itemCount += 1;
    this.chars += item.length + 1;
  }

  finish(): StructuredDescription {
    const sections = this.sections.filter((s) => s.items.length > 0 || s.heading);
    const text = sections
      .map((s) => [s.heading, ...s.items].filter(Boolean).join('\n'))
      .join('\n\n')
      .slice(0, MAX_TEXT_CHARS);
    return { text, sections };
  }
}

function isHidden(el: Element): boolean {
  if (el.hasAttribute('hidden') || el.getAttribute('aria-hidden') === 'true') return true;
  const style = el.getAttribute('style') || '';
  return /display\s*:\s*none|visibility\s*:\s*hidden/i.test(style);
}

function directText(el: Element): string {
  return cleanLine(el.textContent);
}

/** A block whose only meaningful content is a single emphasised run reads as a heading. */
function isEmphasisOnlyBlock(el: Element): boolean {
  const children = Array.from(el.childNodes).filter((n) => {
    if (n.nodeType === 3) return (n.textContent || '').trim().length > 0;
    return n.nodeType === 1 && (n as Element).tagName !== 'BR';
  });
  if (children.length !== 1 || children[0].nodeType !== 1) return false;
  const only = children[0] as Element;
  return EMPHASIS_TAGS.has(only.tagName) && directText(only).length > 0;
}

function nextMeaningfulSibling(el: Element): Element | null {
  let n = el.nextElementSibling;
  while (n && (SKIP_TAGS.has(n.tagName) || directText(n).length === 0)) n = n.nextElementSibling;
  return n;
}

/** Heading-shaped block followed by content (list, paragraph or another block). */
function looksLikeHeadingBlock(el: Element, text: string): boolean {
  if (!isHeadingLike(text)) return false;
  const emphasised = isEmphasisOnlyBlock(el);
  const allCaps = text.length >= 4 && text === text.toUpperCase() && /[A-Z]/.test(text);
  const colon = /:$/.test(text);
  if (!emphasised && !allCaps && !colon) return false;
  const next = nextMeaningfulSibling(el);
  return !!next;
}

/** Splits an element's inline content on <br> into separate lines. */
function inlineLines(el: Element): string[] {
  const lines: string[] = [];
  let buf = '';
  const flush = () => {
    const line = cleanLine(buf);
    if (line) lines.push(line);
    buf = '';
  };
  const walk = (node: Node) => {
    if (node.nodeType === 3) {
      buf += node.textContent || '';
      return;
    }
    if (node.nodeType !== 1) return;
    const e = node as Element;
    if (SKIP_TAGS.has(e.tagName) || isHidden(e)) return;
    if (e.tagName === 'BR') {
      flush();
      return;
    }
    e.childNodes.forEach(walk);
  };
  el.childNodes.forEach(walk);
  flush();
  return lines;
}

function hasBlockDescendant(el: Element): boolean {
  return !!el.querySelector('p, li, ul, ol, dl, table, h1, h2, h3, h4, h5, h6, div, section, article, blockquote, pre');
}

function walk(el: Element, b: SectionBuilder): void {
  if (b.full || SKIP_TAGS.has(el.tagName) || isHidden(el)) return;
  const tag = el.tagName;

  if (HEADING_TAGS.has(tag)) {
    b.heading(directText(el));
    return;
  }

  if (ITEM_TAGS.has(tag)) {
    const text = directText(el);
    if (!text) return;
    if (tag !== 'PRE' && hasBlockDescendant(el)) {
      // e.g. <li><p>Heading</p><ul>…</ul></li> — descend so nested structure is kept.
      const lead = leadingInlineText(el);
      if (lead) {
        if (looksLikeHeadingBlock(el, lead) || (isHeadingLike(lead) && el.querySelector('ul, ol'))) b.heading(lead);
        else b.item(lead);
      }
      // Inline children were consumed by the lead text; only descend into blocks.
      Array.from(el.children)
        .filter((c) => !(INLINE_TAGS.has(c.tagName) && !hasBlockDescendant(c)) && c.tagName !== 'BR')
        .forEach((c) => walk(c, b));
      return;
    }
    if (looksLikeHeadingBlock(el, text)) {
      b.heading(text);
      return;
    }
    inlineLines(el).forEach((line) => b.item(line));
    return;
  }

  if (BLOCK_TAGS.has(tag) || tag.includes('-')) {
    if (!hasBlockDescendant(el)) {
      // Leaf block (div/span with only inline content): treat like a paragraph.
      const text = directText(el);
      if (!text) return;
      if (looksLikeHeadingBlock(el, text)) b.heading(text);
      else inlineLines(el).forEach((line) => b.item(line));
      return;
    }
    // Mixed container: inline runs between block children become their own lines.
    let inlineBuf: Node[] = [];
    const flushInline = () => {
      if (inlineBuf.length === 0) return;
      const holder = { childNodes: inlineBuf } as unknown as Element;
      const lines = inlineLines(holder);
      const first = inlineBuf.find((n) => n.nodeType === 1) as Element | undefined;
      for (const line of lines) {
        const emphasised = !!first && EMPHASIS_TAGS.has(first.tagName) && cleanLine(first.textContent) === line;
        if (isHeadingLike(line) && (emphasised || /:$/.test(line))) b.heading(line);
        else b.item(line);
      }
      inlineBuf = [];
    };
    el.childNodes.forEach((n) => {
      if (n.nodeType === 3) {
        if ((n.textContent || '').trim()) inlineBuf.push(n);
        return;
      }
      if (n.nodeType !== 1) return;
      const c = n as Element;
      if (SKIP_TAGS.has(c.tagName) || isHidden(c)) return;
      const inlineRun = c.tagName === 'BR' || INLINE_TAGS.has(c.tagName) && !hasBlockDescendant(c);
      if (inlineRun) {
        inlineBuf.push(c);
        return;
      }
      flushInline();
      walk(c, b);
    });
    flushInline();
    return;
  }

  // Unknown element: recurse.
  Array.from(el.children).forEach((c) => walk(c, b));
}

/** Text of the element's leading inline content, before its first block child. */
function leadingInlineText(el: Element): string {
  let buf = '';
  for (const n of Array.from(el.childNodes)) {
    if (n.nodeType === 3) {
      buf += n.textContent || '';
      continue;
    }
    if (n.nodeType !== 1) continue;
    const c = n as Element;
    if (hasBlockDescendant(c) || ITEM_TAGS.has(c.tagName) || HEADING_TAGS.has(c.tagName) || ['UL', 'OL', 'DL', 'TABLE', 'DIV', 'SECTION'].includes(c.tagName)) break;
    buf += c.textContent || '';
  }
  return cleanLine(buf);
}

export function extractStructuredDescription(root: Element | null | undefined): StructuredDescription {
  const b = new SectionBuilder();
  if (!root) return b.finish();
  walk(root, b);
  return b.finish();
}

/** Several sibling containers (Lever's `.section-wrapper`s) read as one description. */
export function extractStructuredDescriptionFromAll(roots: Iterable<Element>): StructuredDescription {
  const b = new SectionBuilder();
  for (const root of roots) walk(root, b);
  return b.finish();
}

/**
 * Same walk over an HTML string (Schema.org JSON-LD descriptions are usually
 * HTML). Falls back to tag→newline replacement when DOMParser is unavailable.
 */
export function extractStructuredDescriptionFromHtml(html: string): StructuredDescription {
  if (!html) return { text: '', sections: [] };
  const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(html);
  if (looksLikeHtml && typeof DOMParser !== 'undefined') {
    try {
      const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
      const result = extractStructuredDescription(doc.body);
      if (result.text) return result;
    } catch {
      // fall through to the text path
    }
  }
  return extractStructuredDescriptionFromText(
    looksLikeHtml
      ? decodeEntities(
          html
            .replace(/<\s*br\s*\/?>/gi, '\n')
            .replace(/<\/\s*(?:p|li|h[1-6]|div|tr|dd|dt|blockquote)\s*>/gi, '\n')
            .replace(/<[^>]*>/g, ' '),
        )
      : html,
  );
}

/** Plain text with newlines: every short unpunctuated line is a heading candidate. */
export function extractStructuredDescriptionFromText(text: string): StructuredDescription {
  const b = new SectionBuilder();
  const lines = text
    .split(/\r?\n+/)
    .map((l) => cleanLine(l.replace(/^\s*[•·●▪‣◦∙\-–—*]\s*/, '')))
    .filter(Boolean);
  for (const line of lines) {
    if (isHeadingLike(line) && (classifyHeading(line) !== 'unknown' || /:$/.test(line))) b.heading(line);
    else b.item(line);
  }
  return b.finish();
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)));
}
