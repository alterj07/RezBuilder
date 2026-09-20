/**
 * Pure planning/merging for on-device section labelling. Decides which
 * segments need the model (heading text when a heading exists but matched no
 * regex; individual items only for headingless blocks) and applies the
 * model's answers back onto `JobPosting.sections`. No chrome, no I/O.
 */
import { JobPosting, JobSection, JobSectionKind } from '../../types/job';
import { LabelRequest, LabelSegment, SegmentLabel } from './types';

export interface LabelPlan {
  /** Segments to send to the model (after cache hits are removed by the caller). */
  segments: LabelSegment[];
  /** Section index → segment ids that decide it. */
  sectionSegments: Map<number, string[]>;
  pageCheck?: LabelRequest['pageCheck'];
}

export function needsPageCheck(job: JobPosting): boolean {
  return job.detection?.confidence === 'medium';
}

/** Sections the heuristics could not place. */
export function unknownSections(job: JobPosting): number[] {
  return (job.sections || []).map((s, i) => (s.kind === 'unknown' ? i : -1)).filter((i) => i >= 0);
}

export function planLabelling(job: JobPosting): LabelPlan {
  const segments: LabelSegment[] = [];
  const sectionSegments = new Map<number, string[]>();
  const sections = job.sections || [];

  for (const idx of unknownSections(job)) {
    const section = sections[idx];
    const ids: string[] = [];
    if (section.heading) {
      // One cheap call per heading; the heading names the block.
      const id = `s${idx}:h`;
      segments.push({ id, text: section.heading });
      ids.push(id);
    } else {
      section.items.forEach((item, j) => {
        const id = `s${idx}:i${j}`;
        segments.push({ id, text: item });
        ids.push(id);
      });
    }
    sectionSegments.set(idx, ids);
  }

  const pageCheck = needsPageCheck(job)
    ? { title: job.title || '', excerpt: (job.description || '').slice(0, 600) }
    : undefined;

  return { segments, sectionSegments, pageCheck };
}

/** A headingless block whose items disagree is split so each item keeps its own kind. */
export function applyLabels(job: JobPosting, plan: LabelPlan, labels: Record<string, SegmentLabel>): JobSection[] {
  const sections = job.sections || [];
  const out: JobSection[] = [];

  sections.forEach((section, idx) => {
    const ids = plan.sectionSegments.get(idx);
    if (!ids || ids.length === 0) {
      out.push(section);
      return;
    }

    if (section.heading) {
      const label = labels[ids[0]];
      out.push(label ? { ...section, kind: label.kind, kindSource: 'model', confidence: label.confidence } : section);
      return;
    }

    // Headingless block: group consecutive items that share a kind.
    let current: JobSection | null = null;
    section.items.forEach((item, j) => {
      const label = labels[ids[j]];
      const kind: JobSectionKind = label ? label.kind : 'unknown';
      const source = label ? 'model' : 'default';
      if (!current || current.kind !== kind) {
        current = {
          heading: '',
          kind,
          kindSource: source,
          items: [],
          confidence: label?.confidence,
        };
        out.push(current);
      } else if (label && current.confidence !== undefined) {
        current.confidence = Math.min(current.confidence, label.confidence);
      }
      current.items.push(item);
    });
  });

  return out;
}

export function countModelLabelled(sections: JobSection[]): number {
  return sections.filter((s) => s.kindSource === 'model').length;
}
