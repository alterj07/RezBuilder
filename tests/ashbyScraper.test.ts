import { describe, it, expect } from 'vitest';
import { AshbyScraper } from '../src/content/scrapers/ashbyScraper';

describe('AshbyScraper', () => {
  const parser = new DOMParser();
  const scraper = new AshbyScraper();

  it('should identify Ashby URLs and DOM structures', () => {
    const url = 'https://jobs.ashbyhq.com/linear/1234-abcd';
    const doc = parser.parseFromString('<html><body></body></html>', 'text/html');

    expect(scraper.canHandle(url, doc)).toBe(true);
  });

  it('should parse Ashby DOM structure and extract job details accurately', () => {
    const url = 'https://jobs.ashbyhq.com/openai/12345678-abcd-ef01-2345-6789abcdef01';
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Research Scientist - AI Alignment - OpenAI</title>
        </head>
        <body>
          <div class="_container_1abc2">
            <div class="_header_1abc2">
              <h1 data-testid="job-posting-title">Research Scientist - AI Alignment</h1>
              <div class="_details_1abc2">
                <span data-testid="job-location">San Francisco, CA</span> · <span>Hybrid</span>
              </div>
              <div data-testid="job-department">Alignment Research</div>
              <div data-testid="job-employment-type">Full-time</div>
            </div>
            <div data-testid="job-description">
              <h3>About the Role</h3>
              <p>Conduct foundational research in reinforcement learning from human feedback (RLHF) and scalable oversight.</p>
              <h3>Qualifications</h3>
              <p>Strong background in machine learning, PyTorch, Python, and distributed LLM training with Kubernetes.</p>
            </div>
            <a href="#application-form" class="_applyButton_1abc2">Apply for this role</a>
          </div>
        </body>
      </html>
    `;
    const doc = parser.parseFromString(html, 'text/html');
    const result = scraper.scrape(url, doc);

    expect(result).not.toBeNull();
    expect(result?.title).toBe('Research Scientist - AI Alignment');
    expect(result?.company).toBe('OpenAI');
    expect(result?.location).toContain('San Francisco');
    expect(result?.remoteStatus).toBe('Hybrid');
    expect(result?.source).toBe('ashby');
    expect(result?.qualifications).toContain('Department: Alignment Research');
    expect(result?.qualifications).toContain('Employment Type: Full-time');
    expect(result?.requiredSkills).toContain('python');
    expect(result?.requiredSkills).toContain('pytorch');
    expect(result?.requiredSkills).toContain('machine learning');
    expect(result?.requiredSkills).toContain('kubernetes');
  });

  it('should extract company name from Ashby URL slug', () => {
    const url = 'https://jobs.ashbyhq.com/retool/987654';
    const html = `
      <!DOCTYPE html>
      <html>
        <head><title>Senior Frontend Engineer</title></head>
        <body>
          <h1 class="JobPostingHeader_title">Senior Frontend Engineer</h1>
          <div data-testid="job-location">New York, NY (Remote)</div>
          <div data-testid="job-description">
            Build developer tools with React, TypeScript, GraphQL, and WebSockets. Experience with performance optimization required.
          </div>
        </body>
      </html>
    `;
    const doc = parser.parseFromString(html, 'text/html');
    const result = scraper.scrape(url, doc);

    expect(result).not.toBeNull();
    expect(result?.title).toBe('Senior Frontend Engineer');
    expect(result?.company).toBe('Retool');
    expect(result?.remoteStatus).toBe('Remote');
    expect(result?.requiredSkills).toContain('react');
    expect(result?.requiredSkills).toContain('typescript');
    expect(result?.requiredSkills).toContain('graphql');
    expect(result?.requiredSkills).toContain('websockets');
  });
});
