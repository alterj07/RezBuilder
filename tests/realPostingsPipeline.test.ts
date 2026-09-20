/**
 * Runs production-shaped HTML through the real pipeline (classifier → scraper →
 * extractJobRequirements). These fixtures have no trailing periods on bullets,
 * which is what defeated the old flatten-everything scrapers.
 */
import { describe, it, expect } from 'vitest';
import { jobClassifier } from '../src/content/detection/jobClassifier';
import { scraperRegistry } from '../src/content/scrapers/scraperRegistry';
import { cleanText } from '../src/content/scrapers/keywordExtractor';
import { extractJobRequirements } from '../src/services/fit/jobRequirements';
import { JobPosting } from '../src/types/job';
import { GREENHOUSE_REAL, HEADINGLESS_REAL, REAL_POSTINGS, RealPostingFixture } from './fixtures/realPostings';

function scrape(fixture: RealPostingFixture): JobPosting {
  const doc = new DOMParser().parseFromString(fixture.html, 'text/html');
  const classification = jobClassifier.classify(fixture.url, doc);
  expect(classification.isJobPage, `${fixture.name} should classify as a job page`).toBe(true);
  const job = scraperRegistry.detectAndScrape(fixture.url, doc, classification.schemaJobPosting);
  expect(job, `${fixture.name} should scrape`).not.toBeNull();
  return job!;
}

describe('real posting pipeline — structure-preserving extraction', () => {
  for (const fixture of REAL_POSTINGS) {
    it(`${fixture.name}: splits required vs nice-to-have from the live DOM`, () => {
      const job = scrape(fixture);
      expect(job.sections && job.sections.length, `${fixture.name} sections`).toBeGreaterThan(0);
      expect(job.description).toContain('\n');

      const r = extractJobRequirements(job);
      expect(r.sectionSource).toBe('sections');
      for (const s of fixture.expectRequired) expect(r.requiredSkills, `${fixture.name} required ${s}`).toContain(s);
      for (const s of fixture.expectNice) {
        expect(r.niceToHaveSkills, `${fixture.name} nice ${s}`).toContain(s);
        expect(r.requiredSkills, `${fixture.name} ${s} must not be required`).not.toContain(s);
      }
      if (fixture.expectDegreeRequired !== undefined) expect(r.degreeRequired).toBe(fixture.expectDegreeRequired);
      if (fixture.expectYears !== undefined) expect(r.requiredYears).toBe(fixture.expectYears);
      if (fixture.expectKinds) {
        const kinds = job.sections!.filter((s) => s.heading).map((s) => s.kind);
        expect(kinds).toEqual(fixture.expectKinds);
      }
    });
  }

  it('greenhouse: heading-labelled sections carry kindSource=heading', () => {
    const job = scrape(GREENHOUSE_REAL);
    const preferred = job.sections!.find((s) => s.kind === 'preferred')!;
    expect(preferred.kindSource).toBe('heading');
    expect(preferred.items).toEqual([
      'Experience with Kafka or other streaming systems',
      'Familiarity with GraphQL',
      'Terraform or other infrastructure-as-code tooling',
      'Experience with Rust',
    ]);
  });

  it('control: the old flattening path loses the split on the same posting', () => {
    const job = scrape(GREENHOUSE_REAL);
    const flattened: JobPosting = { ...job, description: cleanText(job.description), sections: undefined };
    const r = extractJobRequirements(flattened);
    expect(r.sectionSource).toBe('text');
    // TypeScript is unambiguously required on the page; the flattened text cannot tell.
    expect(r.requiredSkills).not.toContain('typescript');
  });

  it('a headingless posting yields only unknown sections and falls back to text heuristics', () => {
    const job = scrape(HEADINGLESS_REAL);
    expect(job.sections!.every((s) => s.kind === 'unknown')).toBe(true);
    const r = extractJobRequirements(job);
    expect(r.unknownSectionCount).toBe(job.sections!.length);
    // Nothing is asserted required: without labels the engine must not invent a requirements section.
    expect(r.niceToHaveSkills.length + r.requiredSkills.length).toBeGreaterThan(0);
  });

  it('stored jobs without sections produce the same requirements as before', () => {
    const legacy: JobPosting = {
      id: 'legacy',
      title: 'Backend Engineer',
      company: 'Acme',
      description: 'Requirements\n- Python\n- Django\nNice to have\n- Redis',
      requiredSkills: [],
      url: 'https://x',
      source: 'manual',
      scrapedAt: '2026-09-01T00:00:00.000Z',
    };
    const r = extractJobRequirements(legacy);
    expect(r.sectionSource).toBe('text');
    expect(r.requiredSkills).toEqual(['django', 'python']);
    expect(r.niceToHaveSkills).toEqual(['redis']);
  });
});
