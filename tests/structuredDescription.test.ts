import { describe, it, expect } from 'vitest';
import {
  extractStructuredDescription,
  extractStructuredDescriptionFromHtml,
  extractStructuredDescriptionFromText,
  MAX_ITEMS,
} from '../src/content/scrapers/structuredDescription';
import { classifyHeading, isHeadingLike } from '../src/services/fit/sectionHeaders';

function root(html: string): Element {
  const doc = new DOMParser().parseFromString(`<html><body><div id="root">${html}</div></body></html>`, 'text/html');
  return doc.getElementById('root')!;
}

describe('sectionHeaders', () => {
  it('classifies common headings', () => {
    expect(classifyHeading('Requirements')).toBe('required');
    expect(classifyHeading('Minimum Qualifications')).toBe('required');
    expect(classifyHeading('What you bring')).toBe('required');
    expect(classifyHeading('Preferred Qualifications')).toBe('preferred');
    expect(classifyHeading('Nice to have')).toBe('preferred');
    expect(classifyHeading('Bonus points')).toBe('preferred');
    expect(classifyHeading("What you'll do")).toBe('responsibilities');
    expect(classifyHeading('Responsibilities')).toBe('responsibilities');
    expect(classifyHeading('About Us')).toBe('about');
    expect(classifyHeading('Benefits & Perks')).toBe('benefits');
    expect(classifyHeading('Equal Opportunity Employer')).toBe('eeo');
    expect(classifyHeading('Our interview process')).toBe('unknown');
  });

  it('treats short unpunctuated lines as heading-like', () => {
    expect(isHeadingLike('Requirements:')).toBe(true);
    expect(isHeadingLike('Strong proficiency in TypeScript and Node.js.')).toBe(false);
    expect(isHeadingLike('Experience with a very long list of technologies that goes on and on forever')).toBe(false);
  });
});

describe('extractStructuredDescription', () => {
  it('splits h3 + ul/li into labelled sections with one item per line', () => {
    const r = extractStructuredDescription(
      root(`
        <p>Ledgerly builds payment infrastructure</p>
        <h3>Requirements</h3>
        <ul><li>5+ years building backend systems</li><li>Strong proficiency in TypeScript and Node.js</li></ul>
        <h3>Preferred Qualifications</h3>
        <ul><li>Experience with Kafka</li><li>Familiarity with GraphQL</li></ul>
      `),
    );
    expect(r.sections.map((s) => s.kind)).toEqual(['unknown', 'required', 'preferred']);
    expect(r.sections[1].items).toEqual(['5+ years building backend systems', 'Strong proficiency in TypeScript and Node.js']);
    expect(r.sections[2].heading).toBe('Preferred Qualifications');
    expect(r.sections[2].kindSource).toBe('heading');
    expect(r.text).toContain('Preferred Qualifications\nExperience with Kafka\nFamiliarity with GraphQL');
  });

  it('recognises <p><strong>Heading</strong></p>, ALL CAPS and colon headings', () => {
    const r = extractStructuredDescription(
      root(`
        <p><strong>Basic Qualifications</strong></p>
        <p>Bachelor's degree in Computer Science</p>
        <div>PREFERRED SKILLS</div>
        <p>Kubernetes</p>
        <p>Responsibilities:</p>
        <p>Ship features</p>
      `),
    );
    expect(r.sections.map((s) => [s.heading, s.kind])).toEqual([
      ['Basic Qualifications', 'required'],
      ['PREFERRED SKILLS', 'preferred'],
      ['Responsibilities:', 'responsibilities'],
    ]);
    expect(r.sections[0].items).toEqual(["Bachelor's degree in Computer Science"]);
  });

  it('splits <br>-separated runs into separate items', () => {
    const r = extractStructuredDescription(root(`<h4>Requirements</h4><p>Python<br>Django<br/>SQL</p>`));
    expect(r.sections[0].items).toEqual(['Python', 'Django', 'SQL']);
  });

  it('keeps nested lists and li-with-heading structure', () => {
    const r = extractStructuredDescription(
      root(`<ul><li><strong>Requirements</strong><ul><li>Go</li><li>Rust</li></ul></li><li>Standalone item</li></ul>`),
    );
    expect(r.sections[0].heading).toBe('Requirements');
    expect(r.sections[0].items).toEqual(['Go', 'Rust', 'Standalone item']);
  });

  it('ignores hidden, aria-hidden, script and nav content', () => {
    const r = extractStructuredDescription(
      root(`
        <nav>Home Jobs</nav><script>var x = 1;</script>
        <h3>Requirements</h3>
        <ul><li>Java</li><li aria-hidden="true">Duplicate Java</li><li hidden>Hidden</li><li style="display:none">Gone</li></ul>
      `),
    );
    expect(r.sections).toHaveLength(1);
    expect(r.sections[0].items).toEqual(['Java']);
    expect(r.text).not.toContain('Home Jobs');
  });

  it('treats an unmatched heading as unknown with default source', () => {
    const r = extractStructuredDescription(root(`<h3>Our interview process</h3><p>Three rounds</p>`));
    expect(r.sections[0]).toMatchObject({ heading: 'Our interview process', kind: 'unknown', kindSource: 'default' });
  });

  it('handles null root and empty content', () => {
    expect(extractStructuredDescription(null)).toEqual({ text: '', sections: [] });
    expect(extractStructuredDescription(root('<div></div>'))).toEqual({ text: '', sections: [] });
  });

  it('caps the number of items', () => {
    const lis = Array.from({ length: MAX_ITEMS + 50 }, (_, i) => `<li>Item number ${i}</li>`).join('');
    const r = extractStructuredDescription(root(`<ul>${lis}</ul>`));
    expect(r.sections[0].items).toHaveLength(MAX_ITEMS);
  });
});

describe('extractStructuredDescriptionFromHtml / FromText', () => {
  it('parses a JSON-LD HTML description', () => {
    const r = extractStructuredDescriptionFromHtml(
      `<p>About us</p><h3>What we&#39;re looking for</h3><ul><li>React &amp; TypeScript</li></ul><h3>Nice to have</h3><ul><li>Next.js</li></ul>`,
    );
    expect(r.sections.map((s) => s.kind)).toEqual(['unknown', 'required', 'preferred']);
    expect(r.sections[1].items).toEqual(['React & TypeScript']);
  });

  it('falls back to newline-delimited plain text', () => {
    const r = extractStructuredDescriptionFromText(`Requirements\n- Python\n• SQL\nNice to have\n- Spark`);
    expect(r.sections.map((s) => s.kind)).toEqual(['required', 'preferred']);
    expect(r.sections[0].items).toEqual(['Python', 'SQL']);
    expect(r.sections[1].items).toEqual(['Spark']);
  });

  it('returns empty for empty input', () => {
    expect(extractStructuredDescriptionFromHtml('')).toEqual({ text: '', sections: [] });
  });
});
