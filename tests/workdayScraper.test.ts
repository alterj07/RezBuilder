import { describe, it, expect } from 'vitest';
import { WorkdayScraper } from '../src/content/scrapers/workdayScraper';

describe('WorkdayScraper', () => {
  const parser = new DOMParser();
  const scraper = new WorkdayScraper();

  it('should identify Workday URLs and DOM structures', () => {
    const url = 'https://adobe.wd5.myworkdayjobs.com/en-US/external_experienced/job/San-Jose-CA/Software-Engineer_R123';
    const doc = parser.parseFromString('<html><body></body></html>', 'text/html');

    expect(scraper.canHandle(url, doc)).toBe(true);
  });

  it('should parse Workday DOM structure and extract job details accurately', () => {
    const url = 'https://nvidia.wd5.myworkdayjobs.com/en-US/NVIDIAExternalCareerSite/job/US-CA-Santa-Clara/Senior-Deep-Learning-Software-Engineer_JR1987654';
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Senior Deep Learning Software Engineer - NVIDIA Careers</title>
        </head>
        <body>
          <div data-automation-id="jobPostingHeader">
            <h2>Senior Deep Learning Software Engineer</h2>
          </div>
          <div data-automation-id="companyName">NVIDIA Corporation</div>
          <div data-automation-id="jobPostingLocation">US, CA, Santa Clara (Hybrid)</div>
          <div data-automation-id="timeType">Full time</div>
          <div data-automation-id="jobPostingId">JR1987654</div>
          <div data-automation-id="postedOn">Posted 3 Days Ago</div>
          <div data-automation-id="jobPostingDescription">
            <p>We are seeking a Senior Deep Learning Engineer to optimize CUDA, PyTorch, and TensorRT neural networks.</p>
            <h3>What you will be doing:</h3>
            <p>Develop high-performance GPU kernels in C++ and CUDA. Build scalable machine learning models with Python and Docker.</p>
            <h3>What we need to see:</h3>
            <p>5+ years experience in C++, Python, PyTorch, and CUDA. Deep understanding of distributed systems and Kubernetes.</p>
          </div>
          <a data-automation-id="applyButton" href="#apply">Apply</a>
        </body>
      </html>
    `;
    const doc = parser.parseFromString(html, 'text/html');
    const result = scraper.scrape(url, doc);

    expect(result).not.toBeNull();
    expect(result?.title).toBe('Senior Deep Learning Software Engineer');
    expect(result?.company).toBe('NVIDIA Corporation');
    expect(result?.location).toContain('Santa Clara');
    expect(result?.remoteStatus).toBe('Hybrid');
    expect(result?.source).toBe('workday');
    expect(result?.qualifications).toContain('Requisition ID: JR1987654');
    expect(result?.qualifications).toContain('Posted: Posted 3 Days Ago');
    expect(result?.requiredSkills).toContain('cuda');
    expect(result?.requiredSkills).toContain('pytorch');
    expect(result?.requiredSkills).toContain('c++');
    expect(result?.requiredSkills).toContain('python');
    expect(result?.requiredSkills).toContain('docker');
    expect(result?.requiredSkills).toContain('kubernetes');
  });

  it('should extract company name from subdomain when DOM meta is absent', () => {
    const url = 'https://target.myworkdayjobs.com/en-US/targetcareers/job/Lead-Engineer_R0001234';
    const html = `
      <!DOCTYPE html>
      <html>
        <head><title>Lead Engineer</title></head>
        <body>
          <h1 data-automation-id="jobPostingHeader">Lead Engineer</h1>
          <div data-automation-id="jobPostingLocation">Minneapolis, MN</div>
          <div data-automation-id="jobPostingDescription">
            We are looking for a Lead Engineer proficient in Java, Spring Boot, and AWS cloud architectures.
          </div>
        </body>
      </html>
    `;
    const doc = parser.parseFromString(html, 'text/html');
    const result = scraper.scrape(url, doc);

    expect(result).not.toBeNull();
    expect(result?.title).toBe('Lead Engineer');
    expect(result?.company).toBe('Target');
    expect(result?.requiredSkills).toContain('java');
    expect(result?.requiredSkills).toContain('spring boot');
    expect(result?.requiredSkills).toContain('aws');
  });
});
