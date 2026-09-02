import { describe, it, expect } from 'vitest';
import {
  formFiller as prodFormFiller,
  detectFieldType,
  getElementLabelText,
  setNativeValue,
  setNativeChecked,
  setSelectOption,
  GreenhouseAdapter,
  LeverAdapter,
  WorkdayAdapter,
  GenericAdapter,
} from '../src/content/autofill';
import {
  createDomDocument,
} from './helpers/domUtils';
import {
  GREENHOUSE_DOM_FIXTURE,
} from './fixtures/domFixtures';
import {
  MOCK_SENIOR_FULLSTACK_RESUME,
  MOCK_MINIMAL_RESUME,
  MOCK_DEGENERATE_RESUME,
} from './fixtures/mockResumes';
import { Resume } from '../src/types/resume';

describe('Adversarial Verification: Form Auto-Fill Engine (Gen 2)', () => {
  // ==========================================================================
  // Section 1: Tricky DOM Structures & Ambiguous Names / Labels
  // ==========================================================================
  describe('1. Tricky DOM Structures & Ambiguous Field Detection', () => {
    it('should correctly classify inputs with aria-labelledby and detached label elements', () => {
      const doc = createDomDocument(`
        <html><body>
          <div id="first_name_label">Candidate Legal First Name</div>
          <input type="text" id="fn_input" aria-labelledby="first_name_label" />

          <div id="email_label">Primary Electronic Mail Address</div>
          <input type="text" id="em_input" aria-labelledby="email_label" />

          <label for="phone_custom_id">Cellular Contact Number</label>
          <input type="text" id="phone_custom_id" />
        </body></html>
      `);

      const fnInput = doc.querySelector('#fn_input') as HTMLElement;
      const emInput = doc.querySelector('#em_input') as HTMLElement;
      const phoneInput = doc.querySelector('#phone_custom_id') as HTMLElement;

      const fnDetection = detectFieldType(fnInput);
      expect(fnDetection).not.toBeNull();
      expect(fnDetection?.fieldType).toBe('firstName');

      const emDetection = detectFieldType(emInput);
      expect(emDetection).not.toBeNull();
      expect(emDetection?.fieldType).toBe('email');

      const phoneDetection = detectFieldType(phoneInput);
      expect(phoneDetection).not.toBeNull();
      expect(phoneDetection?.fieldType).toBe('phone');
    });

    it('should disambiguate fullName vs firstName / lastName when both appear in labels or names', () => {
      const doc = createDomDocument(`
        <html><body>
          <form>
            <!-- Label says First Name but name is "name" -->
            <label>First Name <input type="text" name="name" id="field1" /></label>
            <!-- Label says Last Name but id is "applicant_name" -->
            <label>Last Name <input type="text" name="applicant_name" id="field2" /></label>
            <!-- Explicit Full Name -->
            <label>Full Legal Name <input type="text" name="applicant_fullname" id="field3" /></label>
          </form>
        </body></html>
      `);

      const field1 = doc.querySelector('#field1') as HTMLElement;
      const field2 = doc.querySelector('#field2') as HTMLElement;
      const field3 = doc.querySelector('#field3') as HTMLElement;

      const det1 = detectFieldType(field1);
      expect(det1?.fieldType).toBe('firstName');

      const det2 = detectFieldType(field2);
      expect(det2?.fieldType).toBe('lastName');

      const det3 = detectFieldType(field3);
      expect(det3?.fieldType).toBe('fullName');
    });

    it('should extract label text from various DOM hierarchies (ancestor, preceding sibling, aria-label, legend)', () => {
      const doc = createDomDocument(`
        <html><body>
          <fieldset>
            <legend>Professional Summary</legend>
            <textarea id="summary_input"></textarea>
          </fieldset>

          <div>
            <span class="label">LinkedIn Profile URL</span>
            <input type="text" id="linkedin_input" />
          </div>

          <input type="text" id="github_input" aria-label="GitHub Repository Profile" />
        </body></html>
      `);

      const summaryInput = doc.querySelector('#summary_input') as HTMLElement;
      const linkedinInput = doc.querySelector('#linkedin_input') as HTMLElement;
      const githubInput = doc.querySelector('#github_input') as HTMLElement;

      expect(getElementLabelText(summaryInput)).toContain('Professional Summary');
      expect(getElementLabelText(linkedinInput)).toContain('LinkedIn Profile URL');
      expect(getElementLabelText(githubInput)).toBe('GitHub Repository Profile');

      expect(detectFieldType(summaryInput)?.fieldType).toBe('summary');
      expect(detectFieldType(linkedinInput)?.fieldType).toBe('linkedin');
      expect(detectFieldType(githubInput)?.fieldType).toBe('github');
    });

    it('should not double-fill inputs when multiple rules or iterations match the same DOM node', () => {
      const doc = createDomDocument(`
        <html><body>
          <form id="dup_form">
            <input type="text" name="name" id="full_name" placeholder="Full Name" />
            <input type="text" name="first_name" id="first_name" placeholder="First Name" />
            <input type="text" name="last_name" id="last_name" placeholder="Last Name" />
            <input type="email" name="email" id="email" />
          </form>
        </body></html>
      `);

      const result = prodFormFiller.fill(doc, MOCK_SENIOR_FULLSTACK_RESUME);
      expect(result.success).toBe(true);

      const filledFields = result.fields.filter((f) => f.status === 'filled');
      const uniqueNames = new Set(filledFields.map((f) => f.name));
      expect(filledFields.length).toBe(uniqueNames.size);
    });

    it('should handle deeply nested, table-based or grid-based layout forms', () => {
      const doc = createDomDocument(`
        <html><body>
          <div class="table-container">
            <table>
              <tr>
                <td><label for="t_first">First Name:</label></td>
                <td><div><span><input type="text" id="t_first" name="user_fname" /></span></div></td>
              </tr>
              <tr>
                <td><label for="t_last">Last Name:</label></td>
                <td><div><span><input type="text" id="t_last" name="user_lname" /></span></div></td>
              </tr>
              <tr>
                <td><label for="t_email">Work Email:</label></td>
                <td><div><span><input type="email" id="t_email" name="user_email" /></span></div></td>
              </tr>
              <tr>
                <td><label for="t_phone">Phone:</label></td>
                <td><div><span><input type="tel" id="t_phone" name="user_tel" /></span></div></td>
              </tr>
            </table>
          </div>
        </body></html>
      `);

      const result = prodFormFiller.fill(doc, MOCK_SENIOR_FULLSTACK_RESUME);
      expect(result.success).toBe(true);
      expect(result.filledCount).toBe(4);

      expect((doc.querySelector('#t_first') as HTMLInputElement).value).toBe('Alex');
      expect((doc.querySelector('#t_last') as HTMLInputElement).value).toBe('Rivera');
      expect((doc.querySelector('#t_email') as HTMLInputElement).value).toBe('alex.rivera@example.com');
      expect((doc.querySelector('#t_phone') as HTMLInputElement).value).toBe('(555) 234-5678');
    });
  });

  // ==========================================================================
  // Section 2: Disabled, Readonly, Hidden & Ignored Non-Text Inputs
  // ==========================================================================
  describe('2. Disabled, Readonly, Hidden & Button Inputs Safety', () => {
    it('should skip disabled and readonly inputs across both adapters and generic filler', () => {
      const doc = createDomDocument(`
        <html><body>
          <form>
            <input type="text" name="first_name" value="LockedFirst" disabled />
            <input type="text" name="last_name" value="LockedLast" readonly />
            <input type="email" name="email" value="" />
          </form>
        </body></html>
      `);

      const result = prodFormFiller.fill(doc, MOCK_SENIOR_FULLSTACK_RESUME);
      expect(result.success).toBe(true);

      const firstInput = doc.querySelector('input[name="first_name"]') as HTMLInputElement;
      const lastInput = doc.querySelector('input[name="last_name"]') as HTMLInputElement;
      const emailInput = doc.querySelector('input[name="email"]') as HTMLInputElement;

      expect(firstInput.value).toBe('LockedFirst');
      expect(lastInput.value).toBe('LockedLast');
      expect(emailInput.value).toBe('alex.rivera@example.com');

      const skippedFirst = result.fields.find((f) => f.name === 'first_name');
      const skippedLast = result.fields.find((f) => f.name === 'last_name');
      expect(skippedFirst?.status).toBe('skipped');
      expect(skippedLast?.status).toBe('skipped');
    });

    it('should completely ignore hidden inputs, CSRF tokens, and submit/reset/button inputs', () => {
      const doc = createDomDocument(`
        <html><body>
          <form>
            <input type="hidden" name="csrfmiddlewaretoken" value="abc123secret" />
            <input type="hidden" name="authenticity_token" value="rails_token_999" />
            <input type="text" name="first_name" />
            <input type="submit" value="Submit Application" />
            <input type="reset" value="Reset Form" />
            <input type="button" value="Cancel" />
          </form>
        </body></html>
      `);

      const result = prodFormFiller.fill(doc, MOCK_SENIOR_FULLSTACK_RESUME);
      expect(result.success).toBe(true);
      expect(result.filledCount).toBe(1);

      const csrfInput = doc.querySelector('input[name="csrfmiddlewaretoken"]') as HTMLInputElement;
      const authInput = doc.querySelector('input[name="authenticity_token"]') as HTMLInputElement;
      const submitInput = doc.querySelector('input[type="submit"]') as HTMLInputElement;

      expect(csrfInput.value).toBe('abc123secret');
      expect(authInput.value).toBe('rails_token_999');
      expect(submitInput.value).toBe('Submit Application');

      expect(result.fields.some((f) => f.name.includes('csrf') || f.name.includes('authenticity'))).toBe(false);
    });

    it('should return safe empty result on completely blank or formless document', () => {
      const doc1 = createDomDocument('<html><body></body></html>');
      const res1 = prodFormFiller.fill(doc1, MOCK_SENIOR_FULLSTACK_RESUME);
      expect(res1.success).toBe(false);
      expect(res1.filledCount).toBe(0);
      expect(res1.totalFieldsDetected).toBe(0);

      const doc2 = createDomDocument('<html><body><div><h1>Job Application</h1><p>No inputs here</p></div></body></html>');
      const res2 = prodFormFiller.fill(doc2, MOCK_SENIOR_FULLSTACK_RESUME);
      expect(res2.success).toBe(false);
      expect(res2.filledCount).toBe(0);
    });
  });

  // ==========================================================================
  // Section 3: Partial, Incomplete, Missing & Degenerate Resume Data
  // ==========================================================================
  describe('3. Partial, Missing & Malformed Resume Resilience', () => {
    it('should safely handle missing contact object or empty contact fields', () => {
      const partialResume: Resume = {
        ...MOCK_MINIMAL_RESUME,
        name: 'SingleNameCandidate',
        sections: {
          ...MOCK_MINIMAL_RESUME.sections,
          contact: {
            name: 'SingleNameCandidate',
            email: 'candidate@example.com',
            // All other contact fields omitted
          },
        },
      };

      const doc = createDomDocument(`
        <html><body>
          <form>
            <input type="text" name="first_name" />
            <input type="text" name="last_name" />
            <input type="email" name="email" />
            <input type="tel" name="phone" />
            <input type="text" name="linkedin" />
            <input type="text" name="website" />
          </form>
        </body></html>
      `);

      const result = prodFormFiller.fill(doc, partialResume);
      expect(result.success).toBe(true);

      const fn = doc.querySelector('input[name="first_name"]') as HTMLInputElement;
      const ln = doc.querySelector('input[name="last_name"]') as HTMLInputElement;
      const em = doc.querySelector('input[name="email"]') as HTMLInputElement;
      const ph = doc.querySelector('input[name="phone"]') as HTMLInputElement;
      const li = doc.querySelector('input[name="linkedin"]') as HTMLInputElement;

      expect(fn.value).toBe('SingleNameCandidate');
      expect(ln.value).toBe('');
      expect(em.value).toBe('candidate@example.com');
      expect(ph.value).toBe('');
      expect(li.value).toBe('');

      // Check skipped statuses
      const skippedPhone = result.fields.find((f) => f.name === 'phone');
      expect(skippedPhone?.status).toBe('skipped');
    });

    it('should handle completely degenerate empty resume without exceptions', () => {
      const doc = createDomDocument(GREENHOUSE_DOM_FIXTURE);
      const result = prodFormFiller.fill(doc, MOCK_DEGENERATE_RESUME);

      expect(result.success).toBe(false);
      expect(result.filledCount).toBe(0);
      expect(result.message).toContain('No fields were populated');
    });

    it('should handle resume with undefined/null experience or education sections', () => {
      const resumeWithoutExpOrEdu: Resume = {
        id: 'res_ts_test',
        name: 'Taylor Swift',
        tag: 'Music',
        fileName: 'taylor.pdf',
        fileType: 'pdf',
        uploadedAt: new Date().toISOString(),
        rawText: 'Taylor Swift',
        sections: {
          contact: {
            name: 'Taylor Swift',
            email: 'taylor@example.com',
            phone: '123-456-7890',
          },
          summary: 'Creative songwriter and performer.',
          experience: undefined as any,
          education: undefined as any,
          skills: undefined as any,
          projects: [],
        },
      };

      const doc = createDomDocument(`
        <html><body>
          <form>
            <input type="text" name="first_name" />
            <input type="text" name="last_name" />
            <input type="email" name="email" />
            <textarea name="summary"></textarea>
            <textarea name="experience"></textarea>
            <textarea name="education"></textarea>
          </form>
        </body></html>
      `);

      const result = prodFormFiller.fill(doc, resumeWithoutExpOrEdu);
      expect(result.success).toBe(true);

      const fn = doc.querySelector('input[name="first_name"]') as HTMLInputElement;
      const sum = doc.querySelector('textarea[name="summary"]') as HTMLTextAreaElement;
      expect(fn.value).toBe('Taylor');
      expect(sum.value).toBe('Creative songwriter and performer.');
    });

    it('should preserve international Unicode characters and emojis in resume data', () => {
      const unicodeResume: Resume = {
        id: 'res_unicode',
        name: '山田 太郎 (Tarō Yamada) 🚀',
        tag: 'Fullstack',
        fileName: 'yamada.pdf',
        fileType: 'pdf',
        uploadedAt: '2026-08-30T00:00:00.000Z',
        rawText: '山田 太郎 (Tarō Yamada) 🚀',
        sections: {
          contact: {
            name: '山田 太郎 (Tarō Yamada) 🚀',
            email: 'taro.yamada@tokyo.jp',
            phone: '+81 90-1234-5678',
            location: '東京都千代田区, Japan 🇯🇵',
            website: 'https://yamada.dev/東京',
          },
          summary: 'フルスタックエンジニア 10年以上の経験 ✨',
          experience: [
            {
              id: 'exp_unicode_1',
              company: 'テクノロジー株式会社',
              title: 'シニアエンジニア 💻',
              bullets: ['クラウド基盤の構築', 'マイクロサービスアーキテクチャの設計'],
            },
          ],
          education: [],
          skills: ['TypeScript', 'Go', 'Kubernetes'],
          projects: [],
        },
      };

      const doc = createDomDocument(`
        <html><body>
          <form>
            <input type="text" name="first_name" />
            <input type="text" name="last_name" />
            <input type="email" name="email" />
            <input type="tel" name="phone" />
            <input type="text" name="location" />
            <textarea name="summary"></textarea>
          </form>
        </body></html>
      `);

      const result = prodFormFiller.fill(doc, unicodeResume);
      expect(result.success).toBe(true);

      const fn = doc.querySelector('input[name="first_name"]') as HTMLInputElement;
      const loc = doc.querySelector('input[name="location"]') as HTMLInputElement;
      const sum = doc.querySelector('textarea[name="summary"]') as HTMLTextAreaElement;

      expect(fn.value).toBe('山田');
      expect(loc.value).toBe('東京都千代田区, Japan 🇯🇵');
      expect(sum.value).toBe('フルスタックエンジニア 10年以上の経験 ✨');
    });
  });

  // ==========================================================================
  // Section 4: Select Dropdowns & Radio / Checkbox Groups
  // ==========================================================================
  describe('4. Select Dropdowns & Radio / Checkbox Group Handling', () => {
    it('should set select option matching by value or textContent case-insensitively', () => {
      const select = document.createElement('select');
      select.innerHTML = `
        <option value="">-- Please Select Country --</option>
        <option value="US">United States</option>
        <option value="CA">Canada</option>
        <option value="GB">United Kingdom</option>
        <option value="DE">Germany</option>
      `;

      // Match by exact text
      const matchedText = setSelectOption(select, 'United States');
      expect(matchedText).toBe(true);
      expect(select.selectedIndex).toBe(1);
      expect(select.value).toBe('US');

      // Match by lowercase value
      const matchedVal = setSelectOption(select, 'ca');
      expect(matchedVal).toBe(true);
      expect(select.selectedIndex).toBe(2);
      expect(select.value).toBe('CA');

      // Match by substring
      const matchedSub = setSelectOption(select, 'kingdom');
      expect(matchedSub).toBe(true);
      expect(select.selectedIndex).toBe(3);
      expect(select.value).toBe('GB');

      // No match
      const matchedNone = setSelectOption(select, 'Atlantis');
      expect(matchedNone).toBe(false);
      expect(select.selectedIndex).toBe(3); // Unchanged
    });

    it('should properly autofill <select> country / state fields in Generic adapter', () => {
      const doc = createDomDocument(`
        <html><body>
          <form>
            <label for="country_sel">Country</label>
            <select id="country_sel" name="country">
              <option value="">Select country...</option>
              <option value="US">United States</option>
              <option value="MX">Mexico</option>
            </select>
          </form>
        </body></html>
      `);

      const result = prodFormFiller.fill(doc, MOCK_SENIOR_FULLSTACK_RESUME);
      expect(result.success).toBe(true);

      const selectEl = doc.querySelector('#country_sel') as HTMLSelectElement;
      expect(selectEl.selectedIndex).toBe(1);
      expect(selectEl.value).toBe('US');
    });

    it('should invoke setNativeChecked on radio and checkbox inputs and trigger events', () => {
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = false;

      const events: string[] = [];
      ['focus', 'click', 'input', 'change', 'blur'].forEach((evt) => {
        checkbox.addEventListener(evt, () => events.push(evt));
      });

      setNativeChecked(checkbox, true);
      expect(checkbox.checked).toBe(true);
      expect(events).toEqual(['focus', 'click', 'input', 'change', 'blur']);

      setNativeChecked(checkbox, false);
      expect(checkbox.checked).toBe(false);
    });

    it('should respect prototype descriptor for checked property on radio / checkboxes', () => {
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'authorized_to_work';
      radio.value = 'yes';

      let nativeSetterCalled = false;
      const originalDescriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'checked');

      // Spy on checked setter
      if (originalDescriptor && originalDescriptor.set) {
        const originalSet = originalDescriptor.set;
        Object.defineProperty(HTMLInputElement.prototype, 'checked', {
          set(val) {
            nativeSetterCalled = true;
            originalSet.call(this, val);
          },
          get() {
            return originalDescriptor.get?.call(this);
          },
          configurable: true,
        });
      }

      setNativeChecked(radio, true);
      expect(radio.checked).toBe(true);
      expect(nativeSetterCalled).toBe(true);

      // Restore original descriptor
      if (originalDescriptor) {
        Object.defineProperty(HTMLInputElement.prototype, 'checked', originalDescriptor);
      }
    });
  });

  // ==========================================================================
  // Section 5: React Synthetic Events & Native Value Setter Overrides
  // ==========================================================================
  describe('5. React Synthetic Event Dispatching & Value Tracker Bypass', () => {
    it('should dispatch focus, input, change, and blur with bubble and cancelable flags', () => {
      const input = document.createElement('input');
      input.type = 'text';

      const firedEvents: { type: string; bubbles: boolean; cancelable: boolean }[] = [];
      ['focus', 'input', 'change', 'blur'].forEach((type) => {
        input.addEventListener(type, (e) => {
          firedEvents.push({ type: e.type, bubbles: e.bubbles, cancelable: e.cancelable });
        });
      });

      setNativeValue(input, 'Adversarial Value Test');

      expect(input.value).toBe('Adversarial Value Test');
      expect(firedEvents).toHaveLength(4);
      for (const evt of firedEvents) {
        expect(evt.bubbles).toBe(true);
        expect(evt.cancelable).toBe(true);
      }
    });

    it('should allow parent container event delegation to capture bubbled synthetic events', () => {
      const container = document.createElement('div');
      const form = document.createElement('form');
      const input = document.createElement('input');
      input.type = 'text';

      form.appendChild(input);
      container.appendChild(form);

      const capturedEvents: string[] = [];
      container.addEventListener('input', () => capturedEvents.push('container-input'));
      container.addEventListener('change', () => capturedEvents.push('container-change'));
      container.addEventListener('focus', () => capturedEvents.push('container-focus'), true); // Capture phase for focus
      container.addEventListener('blur', () => capturedEvents.push('container-blur'), true);

      setNativeValue(input, 'Bubbled Value');

      expect(input.value).toBe('Bubbled Value');
      expect(capturedEvents).toContain('container-input');
      expect(capturedEvents).toContain('container-change');
    });

    it('should bypass React _valueTracker and update internal tracker state directly', () => {
      const input = document.createElement('input');
      input.type = 'text';

      let internalTrackerValue = '';
      (input as any)._valueTracker = {
        getValue() {
          return internalTrackerValue;
        },
        setValue(val: string) {
          internalTrackerValue = val;
        },
        stop() {},
      };

      setNativeValue(input, 'React Tracker Value 2026');

      expect(input.value).toBe('React Tracker Value 2026');
      expect(internalTrackerValue).toBe('React Tracker Value 2026');
    });

    it('should gracefully handle elements without _valueTracker or non-standard prototypes', () => {
      const plainInput = document.createElement('input');
      expect(() => setNativeValue(plainInput, 'Plain Value')).not.toThrow();
      expect(plainInput.value).toBe('Plain Value');

      const plainTextarea = document.createElement('textarea');
      expect(() => setNativeValue(plainTextarea, 'Textarea Value')).not.toThrow();
      expect(plainTextarea.value).toBe('Textarea Value');
    });
  });

  // ==========================================================================
  // Section 6: Platform Adapters Direct Adversarial Verification
  // ==========================================================================
  describe('6. Platform Adapters Direct Verification (Greenhouse, Lever, Workday, Generic)', () => {
    it('GreenhouseAdapter should detect and fill Greenhouse forms with custom questions', () => {
      const adapter = new GreenhouseAdapter();
      const doc = createDomDocument(`
        <html><body>
          <form id="application_form" action="https://boards.greenhouse.io/stripe/jobs/123/apply">
            <input type="text" id="first_name" name="job_application[first_name]" />
            <input type="text" id="last_name" name="job_application[last_name]" />
            <input type="email" id="email" name="job_application[email]" />
            <input type="tel" id="phone" name="job_application[phone]" />
            <input type="text" id="job_application_location" />
            <input type="text" name="job_application[answers_attributes][0][text_value]" placeholder="LinkedIn Profile" />
            <input type="text" id="website" />
          </form>
        </body></html>
      `);

      expect(adapter.canHandle(doc, 'https://boards.greenhouse.io/stripe/jobs/123')).toBe(true);

      const results = adapter.fill(doc, MOCK_SENIOR_FULLSTACK_RESUME);
      const filled = results.filter((r) => r.status === 'filled');
      expect(filled.length).toBeGreaterThanOrEqual(5);

      expect((doc.querySelector('#first_name') as HTMLInputElement).value).toBe('Alex');
      expect((doc.querySelector('#last_name') as HTMLInputElement).value).toBe('Rivera');
      expect((doc.querySelector('#email') as HTMLInputElement).value).toBe('alex.rivera@example.com');
      expect((doc.querySelector('#phone') as HTMLInputElement).value).toBe('(555) 234-5678');
    });

    it('LeverAdapter should detect and fill Lever forms with custom fields and coverLetter', () => {
      const adapter = new LeverAdapter();
      const doc = createDomDocument(`
        <html><body>
          <form class="application-form">
            <input type="text" name="name" placeholder="Full Name" />
            <input type="email" name="email" placeholder="Email" />
            <input type="text" name="phone" placeholder="Phone" />
            <input type="text" name="org" placeholder="Current Company" />
            <input type="text" name="urls[LinkedIn]" placeholder="LinkedIn" />
            <input type="text" name="urls[GitHub]" placeholder="GitHub" />
            <input type="text" name="urls[Portfolio]" placeholder="Portfolio" />
            <textarea name="comments" placeholder="Additional notes"></textarea>
          </form>
        </body></html>
      `);

      expect(adapter.canHandle(doc, 'https://jobs.lever.co/example/123')).toBe(true);

      const results = adapter.fill(doc, MOCK_SENIOR_FULLSTACK_RESUME);
      const filled = results.filter((r) => r.status === 'filled');
      expect(filled.length).toBeGreaterThanOrEqual(6);

      expect((doc.querySelector('input[name="name"]') as HTMLInputElement).value).toBe('Alex Rivera');
      expect((doc.querySelector('input[name="org"]') as HTMLInputElement).value).toBe('CloudScale Inc');
      expect((doc.querySelector('textarea[name="comments"]') as HTMLTextAreaElement).value).toContain('Results-driven Senior Full Stack');
    });

    it('WorkdayAdapter should detect and fill Workday forms with data-automation-id', () => {
      const adapter = new WorkdayAdapter();
      const doc = createDomDocument(`
        <html><body>
          <div data-automation-id="applicationForm">
            <input data-automation-id="legalNameSection_firstName" />
            <input data-automation-id="legalNameSection_lastName" />
            <input data-automation-id="email" />
            <input data-automation-id="phone-number" />
            <input data-automation-id="addressSection_city" />
            <input data-automation-id="addressSection_region" />
          </div>
        </body></html>
      `);

      expect(adapter.canHandle(doc, 'https://acme.wd5.myworkdayjobs.com/apply')).toBe(true);

      const results = adapter.fill(doc, MOCK_SENIOR_FULLSTACK_RESUME);
      const filled = results.filter((r) => r.status === 'filled');
      expect(filled.length).toBeGreaterThanOrEqual(5);

      expect((doc.querySelector('input[data-automation-id="legalNameSection_firstName"]') as HTMLInputElement).value).toBe('Alex');
      expect((doc.querySelector('input[data-automation-id="legalNameSection_lastName"]') as HTMLInputElement).value).toBe('Rivera');
      expect((doc.querySelector('input[data-automation-id="email"]') as HTMLInputElement).value).toBe('alex.rivera@example.com');
      expect((doc.querySelector('input[data-automation-id="addressSection_city"]') as HTMLInputElement).value).toBe('San Francisco, CA');
      expect((doc.querySelector('input[data-automation-id="addressSection_region"]') as HTMLInputElement).value).toBe('CA');
    });

    it('GenericAdapter should detect and fill arbitrary generic application forms with heuristic detection', () => {
      const adapter = new GenericAdapter();
      const doc = createDomDocument(`
        <html><body>
          <form id="custom_careers_form">
            <input type="text" name="candidate_firstname" placeholder="Enter first name" />
            <input type="text" name="candidate_lastname" placeholder="Enter last name" />
            <input type="email" name="candidate_email_address" placeholder="you@domain.com" />
            <input type="tel" name="candidate_mobile_number" placeholder="(123) 456-7890" />
            <input type="text" name="user_linkedin_url" placeholder="https://linkedin.com/in/..." />
            <input type="text" name="user_github_url" placeholder="https://github.com/..." />
            <textarea name="professional_summary" placeholder="Summary"></textarea>
            <textarea name="work_history" placeholder="Work history"></textarea>
            <textarea name="education_history" placeholder="Education"></textarea>
            <input type="text" name="candidate_skills" placeholder="Skills list" />
          </form>
        </body></html>
      `);

      expect(adapter.canHandle(doc, 'https://startup.io/careers/apply')).toBe(true);

      const results = adapter.fill(doc, MOCK_SENIOR_FULLSTACK_RESUME);
      const filled = results.filter((r) => r.status === 'filled');
      expect(filled.length).toBeGreaterThanOrEqual(8);

      expect((doc.querySelector('input[name="candidate_firstname"]') as HTMLInputElement).value).toBe('Alex');
      expect((doc.querySelector('input[name="candidate_lastname"]') as HTMLInputElement).value).toBe('Rivera');
      expect((doc.querySelector('input[name="candidate_email_address"]') as HTMLInputElement).value).toBe('alex.rivera@example.com');
      expect((doc.querySelector('input[name="candidate_skills"]') as HTMLInputElement).value).toContain('TypeScript');
    });
  });

  // ==========================================================================
  // Section 7: Overwrite Policies & Idempotency
  // ==========================================================================
  describe('7. Overwrite Policies & Idempotency', () => {
    it('should respect overwrite=false by preserving existing non-empty values', () => {
      const doc = createDomDocument(`
        <html><body>
          <form>
            <input type="text" name="first_name" value="AlreadyFilledFirst" />
            <input type="text" name="last_name" value="" />
            <input type="email" name="email" value="existing@domain.com" />
          </form>
        </body></html>
      `);

      const result = prodFormFiller.fill(doc, MOCK_SENIOR_FULLSTACK_RESUME, { overwrite: false });
      expect(result.success).toBe(true);

      const fn = doc.querySelector('input[name="first_name"]') as HTMLInputElement;
      const ln = doc.querySelector('input[name="last_name"]') as HTMLInputElement;
      const em = doc.querySelector('input[name="email"]') as HTMLInputElement;

      expect(fn.value).toBe('AlreadyFilledFirst');
      expect(ln.value).toBe('Rivera');
      expect(em.value).toBe('existing@domain.com');

      const skippedFirst = result.fields.find((f) => f.name === 'first_name');
      expect(skippedFirst?.status).toBe('skipped');
    });

    it('should overwrite all fields when overwrite=true (default behavior)', () => {
      const doc = createDomDocument(`
        <html><body>
          <form>
            <input type="text" name="first_name" value="OldFirst" />
            <input type="text" name="last_name" value="OldLast" />
            <input type="email" name="email" value="old@domain.com" />
          </form>
        </body></html>
      `);

      const result = prodFormFiller.fill(doc, MOCK_SENIOR_FULLSTACK_RESUME, { overwrite: true });
      expect(result.success).toBe(true);

      const fn = doc.querySelector('input[name="first_name"]') as HTMLInputElement;
      const ln = doc.querySelector('input[name="last_name"]') as HTMLInputElement;
      const em = doc.querySelector('input[name="email"]') as HTMLInputElement;

      expect(fn.value).toBe('Alex');
      expect(ln.value).toBe('Rivera');
      expect(em.value).toBe('alex.rivera@example.com');
    });

    it('should be idempotent when fill() is called multiple times consecutively', () => {
      const doc = createDomDocument(GREENHOUSE_DOM_FIXTURE);

      const res1 = prodFormFiller.fill(doc, MOCK_SENIOR_FULLSTACK_RESUME, { overwrite: true });
      expect(res1.success).toBe(true);
      const count1 = res1.filledCount;

      const res2 = prodFormFiller.fill(doc, MOCK_SENIOR_FULLSTACK_RESUME, { overwrite: true });
      expect(res2.success).toBe(true);
      expect(res2.filledCount).toBe(count1);

      const fn = doc.querySelector('#first_name') as HTMLInputElement;
      expect(fn.value).toBe('Alex');
    });
  });
});
