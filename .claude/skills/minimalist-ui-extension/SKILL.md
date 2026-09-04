---
name: minimalist-ui-extension
description: Clean editorial-style interfaces for a Chrome extension side panel/popup. Warm monochrome palette, typographic contrast, compact bento blocks, muted pastels. No gradients, no heavy shadows, no marketing-page patterns.
---

# Protocol: Premium Utilitarian Minimalism UI Architect (Chrome Extension Edition)

## 1. Protocol Overview
Name: Premium Utilitarian Minimalism & Editorial UI — Extension Chrome
Description: An advanced frontend engineering directive for a Manifest V3 Chrome extension's side panel and popup surfaces — a fixed-width, always-mounted, information-dense "document-style" workspace, not a scrolling marketing site. It enforces the same high-contrast warm monochrome palette, bespoke typographic hierarchy, and ultra-flat component architecture as the source protocol, but every rule is re-scoped to a ~320–420px docked panel that is reopened dozens of times a session rather than visited once: no hero sections, no scroll-triggered reveals tied to page scroll, no marketing copy, no externally-hosted assets. Chrome's own window chrome is the only "browser chrome" in the picture — the extension must never simulate it.

## 2. Absolute Negative Constraints (Banned Elements)
- DO NOT use the "Inter", "Roboto", or "Open Sans" typefaces as the primary voice — see §3 for the extension-safe substitute.
- DO NOT use generic, thin-line icon libraries like "Lucide", "Feather", or standard "Heroicons".
- DO NOT use Tailwind's default heavy drop shadows (`shadow-md`, `shadow-lg`, `shadow-xl`). Shadows must be practically non-existent or ultra-diffuse and low opacity (< 0.05) — a docked panel sits flush against the browser edge and reads as part of the chrome, not a floating card.
- DO NOT use primary colored backgrounds for large elements (no bright blue/green/red panel headers or full-bleed sections).
- DO NOT use gradients, neon colors, or 3D glassmorphism.
- DO NOT use `rounded-full` (pill shapes) for large containers, cards, or primary buttons — reserve pill radius for small status badges only (§5).
- DO NOT use emojis anywhere in code, markup, text content, headings, or alt text. Replace with proper icons or clean SVG primitives.
- DO NOT use generic placeholder names like "John Doe", "Acme Corp", or "Lorem Ipsum" — use realistic content drawn from the extension's own domain (a real job title, a real skill name), never fabricated user data.
- DO NOT use AI copywriting clichés: "Elevate", "Seamless", "Unleash", "Next-Gen", "Game-changer", "Delve". Write plain, specific UI copy ("Import from resume", not "Seamlessly unleash your profile").
- DO NOT design hero sections, marketing headlines, testimonials, pricing tables, or any landing-page pattern — every screen is a working tool screen, opened mid-task.
- DO NOT load fonts, icon sprites, or images from a remote CDN (Google Fonts, cdnjs, etc.). Manifest V3's default CSP blocks remote script/style/font loads for extension pages unless explicitly relaxed, and a side panel must render correctly offline. Self-host every asset inside the extension bundle.
- DO NOT simulate OS or browser chrome (no faux traffic-light window controls, no fake address bar). The real Chrome window is already visible around the panel; doubling it wastes width and reads as noise.
- DO NOT rely on `:hover` alone to reveal necessary information or controls — a side panel is used with mouse, trackpad, and keyboard interchangeably, and `:focus-visible` must carry every interaction hover carries.

## 3. Typographic Architecture
A 320–420px panel has no room for the display-serif drama a landing page affords. Contrast comes from weight and size steps, not from swapping typefaces mid-layout.
- Primary Sans-Serif (all UI — body, nav, buttons, tables): a self-hosted geometric or system-native sans with real character, bundled as a variable font inside the extension. Target stack: `font-family: 'Geist Sans', 'SF Pro Display', -apple-system, 'Helvetica Neue', sans-serif`. Ship the woff2 under `src/assets/fonts/` and declare it via `@font-face` in the panel's own stylesheet — never a `<link>` to a Google Fonts URL.
- Editorial Serif (sparingly, for section titles and the Best-Fit headline number only — never body copy): `font-family: 'Newsreader', 'Instrument Serif', 'Times New Roman', serif`, tight tracking (`-0.01em` to `-0.02em`), line-height `1.15`. At panel scale this is a single "hero number" per screen (e.g. a 68% Best Fit score), not a full heading system.
- Monospace (keyboard shortcuts, credential-like text, raw JSON/preview panes): `font-family: 'Geist Mono', 'SF Mono', ui-monospace, monospace`.
- Base body size: `13px`–`14px`, not the 16px+ a website uses — the panel is read at arm's length from a keyboard, not across a room. Line-height `1.5`–`1.6` for paragraphs, tighter (`1.3`) for list rows and table cells where vertical density matters more than prose comfort.
- Text Colors: body text never absolute black — off-black/charcoal (`#111111` / `#2F3437`). Secondary/meta text muted gray (`#787774`). Both colors need dark-mode pairs (§4) since the panel must honor Chrome's `prefers-color-scheme`, unlike a marketing site that can force light mode.

## 4. Color Palette (Warm Monochrome + Spot Pastels)
Color stays a scarce, semantic resource — but the extension needs both a light and a dark palette, since users leave Chrome's theme on system default far more often than they would a bookmarked website.
- Canvas / Background (light): Warm Bone `#FBFBFA` or `#F7F6F3`. (dark): Warm Charcoal `#17171599`-adjacent solid `#1B1A18`, never pure `#000000`.
- Primary Surface / Cards (light): `#FFFFFF` or `#F9F9F8`. (dark): `#211F1C`.
- Structural Borders / Dividers (light): `#EAEAEA` or `rgba(0,0,0,0.08)`. (dark): `rgba(255,255,255,0.10)`.
- Accent Colors — identical desaturated pastels in both themes for tags, inline badges, and section icon backgrounds (dark mode: keep the pastel background but lift its opacity via `color-mix`/CSS variables rather than inverting it, so a "pale green" success chip stays recognizably green, not neon):
  - Pale Red: `#FDEBEC` / text `#9F2F2D`
  - Pale Blue: `#E1F3FE` / text `#1F6C9F`
  - Pale Green: `#EDF3EC` / text `#346538`
  - Pale Yellow: `#FBF3DB` / text `#956400`
- Define every color as a CSS custom property (or a Tailwind `theme.extend.colors` token) so the panel can flip themes via `prefers-color-scheme` in one place instead of duplicating className logic per component.

## 5. Layout & Panel Constraints (replaces website "macro-whitespace" rules)
- Design for a fixed viewport, not a fluid one: assume `320px`–`420px` wide, unconstrained height (the panel scrolls vertically, never horizontally). There is no `max-w-4xl` content column to center — the content *is* the column.
- Structure every screen as: a slim fixed header (title + primary action, ~40–48px tall) → a scrollable content region → an optional sticky footer action bar for a single primary CTA (e.g. "Save profile"). This is the extension's equivalent of the website's hero-then-sections flow.
- Replace "massive vertical padding between sections" with disciplined but modest rhythm: `12px`–`20px` between stacked cards, `16px`–`24px` internal card padding (not `24px`–`40px` — that's website-hero scale and would push most content off-screen).
- Tab/section navigation (Profile, Job, Resumes, Tailor, Prep, Settings) is a persistent top strip, not a page-per-URL — treat each tab body as an independently-animating region (§7) rather than a full page transition.
- Never let a component assume it owns the full browser viewport — always render inside the panel's own scroll container so nested lists (skills, bullet points, job requirements) scroll independently of the header/footer chrome.

## 6. Component Specifications
- Bento-Style Summary Blocks (replaces "Bento Box Feature Grids"): a 2-column stat grid at most (e.g. Best Fit % + Confidence tier side by side) — a panel is too narrow for the asymmetrical multi-column bento layouts a landing page uses. Cards: `border: 1px solid var(--border)`, radius `8px`–`10px` (not `12px` — smaller components read cleaner at panel scale), internal padding `16px`–`20px`.
- Primary Call-to-Action (Buttons): solid `#111111` (dark mode: `#F5F4F1` background / `#171614` text — invert, don't dim), text on light `#FFFFFF`. Radius `4px`–`6px`, no box-shadow. In a sticky footer bar the primary button is full-width; inline buttons stay content-width. Hover: subtle color shift; `:active` and keyboard `:focus-visible` both get `transform: scale(0.98)` plus a visible focus ring (`2px` offset outline in the accent color) — a panel used via keyboard needs focus states a hover-only site can skip.
- Tags & Status Badges: pill-shaped (`border-radius: 9999px`), `text-xs`, uppercase, `letter-spacing: 0.05em`, background from the Muted Pastels — this is where the source protocol's pill ban is intentionally lifted, since small status pills (profile completeness, Best Fit tier, ATS keyword hit/miss) are exactly the compact semantic signal a dense panel needs.
- Expandable Detail Rows (replaces "Accordions (FAQ)"): used for a job's full requirement list, a resume's raw text, or a tailored-bullet diff — strip container boxes, separate rows with `border-bottom: 1px solid var(--border)`, sharp `+`/`−` or chevron toggle. No accordion should default open across more than one row at a time in a panel this narrow.
- Keystroke Micro-UIs: unchanged in spirit — `<kbd>` tags, `border: 1px solid var(--border)`, radius `4px`, background `var(--surface)`, monospace — used for the extension's own keyboard shortcuts (e.g. the command to reopen the panel), not decorative.
- Extension Chrome (replaces "Faux-OS Window Chrome"): the panel header bar *is* the extension's real chrome — keep it a flat surface with the extension name/icon at 16–20px and the current tab's primary action at the trailing edge. Never draw a second, fake window frame inside it. A toolbar-icon badge (unread count, import-in-progress dot) should reuse the same pastel accent colors as in-panel badges so the two stay visually one system.

## 7. Iconography & Visual Accents (replaces "Iconography & Imagery Directives")
- System Icons: "Phosphor Icons" (Bold/Fill weight) or "Radix UI Icons", imported as React components or inlined SVG and bundled at build time — never fetched from a CDN at runtime (blocked by MV3 CSP and unavailable offline). Standardize stroke width and a single icon size scale (e.g. 16 / 20px) across the whole panel.
- Illustration/Empty-State Accents: a single small monochrome line sketch or geometric glyph filled with one muted pastel, used sparingly for empty states ("No resumes yet") — never a full-width decorative illustration; there's no width budget for it.
- Photography: generally out of scope. If a screen ever needs an image (e.g. a company logo pulled from a scraped job posting), render it small, desaturate/tone-match with a subtle overlay if it clashes with the palette, and always provide a monochrome fallback glyph — never block layout on a network image load.
- No hero/section background imagery, no ambient radial-gradient light spots — a docked panel has no "background" distinct from its card surfaces; depth comes from the border + tone-shift between canvas and card, not from imagery.

## 8. Subtle Motion & Micro-Animations
The panel is reopened constantly, so motion must never slow down a returning user — quiet, fast, and skippable.
- Tab/Section Entry (replaces "Scroll Entry"): when switching between Profile/Job/Resumes/etc., fade + `translateY(6px)` the incoming tab body over `150ms`–`200ms` with `cubic-bezier(0.16, 1, 0.3, 1)` — shorter and smaller than a website's scroll-reveal, since this fires on every tab click, not once per page visit.
- Hover/Focus States: cards get an ultra-subtle border or tone shift (not a shadow lift, which reads oddly on a flush-docked panel) over `150ms`. Buttons: `scale(0.98)` on `:active`/`:focus-visible`.
- Staggered Reveals: reserve for short in-panel lists only (skill chips, a 3–6 item requirement list) with a small cascade (`~40ms` per item, not `80ms`) — a long list (resume history, job history) should not stagger, since it's re-rendered often and staggering it every time reads as sluggish.
- Loading/async states: extension operations (scraping a page, importing LinkedIn, tailoring a resume) take visible time — use a skeleton/shimmer or an inline progress line ("Reading experience… 2/7") instead of a spinner-only state, and keep it in the same monochrome+pastel language rather than a generic spinner color.
- No ambient background motion — there is no idle hero for a blob to drift behind.
- Respect `prefers-reduced-motion`: collapse all of the above to instant opacity swaps.
- Performance: animate only `transform` and `opacity`; `will-change: transform` only while actively animating, since the panel's own process budget is shared with the content script and background worker.

## 9. Execution Protocol
When tasked with writing this extension's frontend code (React + Tailwind, side panel or popup):
1. Start from the panel's fixed-header / scrollable-body / optional sticky-footer skeleton (§5) — there is no macro-whitespace pass to do first, because there's no page to lay out.
2. Work within the panel's real width (320–420px) from the first draft; never design at desktop width and "make it responsive" down.
3. Apply the typographic scale and CSS-variable color tokens (§3–§4) immediately, including both light and dark values — don't ship a light-only draft and retrofit dark mode.
4. Keep every card, divider, and border at the flat `1px solid var(--border)` rule; no shadows standing in for structure.
5. Add the tab-entry and hover/focus micro-animations (§8) — never a scroll-reveal, since the panel doesn't have a scroll-triggered landing flow.
6. Bundle every font, icon, and image inside the extension; verify nothing depends on a network request to render (open the panel offline as a smoke test).
7. Verify keyboard operability (`:focus-visible` states, tab order through the header/body/footer) — a side panel is a tool used with a keyboard as often as a mouse.
8. Provide code that reflects this high-end, uncluttered, editorial aesthetic natively within the panel's constraints, without requiring a follow-up pass to "make it fit."
