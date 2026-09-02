import { describe, it, expect } from 'vitest';
import { formFiller } from '../src/content/autofill/formFiller';
import { detectFieldType } from '../src/content/autofill/fieldDetector';
import { setNativeValue, setSelectOption } from '../src/content/autofill/domEvents';
import {
  GREENHOUSE_DOM_FIXTURE,
  LEVER_DOM_FIXTURE,
  WORKDAY_DOM_FIXTURE,
  SCHEMA_ORG_DOM_FIXTURE,
  DISABLED_FIELDS_FORM_DOM_FIXTURE,
} from './fixtures/domFixtures';
import {
  MOCK_SENIOR_FULLSTACK_RESUME,
  MOCK_PRODUCT_MANAGER_RESUME,
  MOCK_MINIMAL_RESUME,
} from './fixtures/mockResumes';
import { createDomDocument } from './helpers/domUtils';

describe('Form Auto-Fill Engine', () => {
  describe('Synthetic DOM Event & Value Setters', () => {
    it('should set input value and dispatch focus, input, change, and blur events', () => {
      const input = document.createElement('input');
      input.type = 'text';

      const eventsFired: string[] = [];
      input.addEventListener('focus', () => eventsFired.push('focus'));
      input.addEventListener('input', () => eventsFired.push('input'));
      input.addEventListener('change', () => eventsFired.push('change'));
      input.addEventListener('blur', () => eventsFired.push('blur'));

      setNativeValue(input, 'Jane Doe');

      expect(input.value).toBe('Jane Doe');
      expect(eventsFired).toContain('focus');
      expect(eventsFired).toContain('input');
      expect(eventsFired).toContain('change');
      expect(eventsFired).toContain('blur');
    });

    it('should select matching option in <select> dropdown and trigger change events', () => {
      const select = document.createElement('select');
      const opt1 = document.createElement('option');
      opt1.value = 'us';
      opt1.textContent = 'United States';
      const opt2 = document.createElement('option');
      opt2.value = 'ca';
      opt2.textContent = 'Canada';

      select.appendChild(opt1);
      select.appendChild(opt2);

      let changeFired = false;
      select.addEventListener('change', () => {
        changeFired = true;
      });

      const matched = setSelectOption(select, 'Canada');
      expect(matched).toBe(true);
      expect(select.value).toBe('ca');
      expect(changeFired).toBe(true);
    });
  });

  describe('Multi-Signal Field Detector', () => {
    it('should accurately detect first name and last name inputs from name, id, and autocomplete', () => {
      const fnInput = document.createElement('input');
      fnInput.setAttribute('name', 'user_first_name');
      fnInput.setAttribute('autocomplete', 'given-name');

      const lnInput = document.createElement('input');
      lnInput.setAttribute('id', 'candidate_last_name');
      lnInput.setAttribute('placeholder', 'Enter last name');

      expect(detectFieldType(fnInput)?.fieldType).toBe('firstName');
      expect(detectFieldType(lnInput)?.fieldType).toBe('lastName');
    });

    it('should detect email, phone, linkedin, and github fields', () => {
      const emailInput = document.createElement('input');
      emailInput.type = 'email';

      const phoneInput = document.createElement('input');
      phoneInput.type = 'tel';

      const linkedinInput = document.createElement('input');
      linkedinInput.name = 'urls[LinkedIn]';

      const githubInput = document.createElement('input');
      githubInput.placeholder = 'https://github.com/username';

      expect(detectFieldType(emailInput)?.fieldType).toBe('email');
      expect(detectFieldType(phoneInput)?.fieldType).toBe('phone');
      expect(detectFieldType(linkedinInput)?.fieldType).toBe('linkedin');
      expect(detectFieldType(githubInput)?.fieldType).toBe('github');
    });
  });

  describe('Platform-Specific Form Filling', () => {
    it('should detect and fill Greenhouse job application form', () => {
      const doc = createDomDocument(GREENHOUSE_DOM_FIXTURE);
      const result = formFiller.fill(doc, MOCK_SENIOR_FULLSTACK_RESUME);

      expect(result.success).toBe(true);
      expect(result.platform).toBe('greenhouse');
      expect(result.filledCount).toBeGreaterThanOrEqual(4);

      const fn = doc.querySelector('#first_name') as HTMLInputElement;
      const ln = doc.querySelector('#last_name') as HTMLInputElement;
      const email = doc.querySelector('#email') as HTMLInputElement;
      const phone = doc.querySelector('#phone') as HTMLInputElement;

      expect(fn.value).toBe('Alex');
      expect(ln.value).toBe('Rivera');
      expect(email.value).toBe('alex.rivera@example.com');
      expect(phone.value).toBe('(555) 234-5678');
    });

    it('should detect and fill Lever job application form', () => {
      const doc = createDomDocument(LEVER_DOM_FIXTURE);
      const result = formFiller.fill(doc, MOCK_PRODUCT_MANAGER_RESUME);

      expect(result.success).toBe(true);
      expect(result.platform).toBe('lever');
      expect(result.filledCount).toBeGreaterThanOrEqual(4);

      const nameEl = doc.querySelector('input[name="name"]') as HTMLInputElement;
      const emailEl = doc.querySelector('input[name="email"]') as HTMLInputElement;
      const orgEl = doc.querySelector('input[name="org"]') as HTMLInputElement;
      const linkedinEl = doc.querySelector('input[name="urls[LinkedIn]"]') as HTMLInputElement;

      expect(nameEl.value).toBe('Morgan Vance');
      expect(emailEl.value).toBe('morgan.vance@example.com');
      expect(orgEl.value).toBe('SaaS Metrics Co');
      expect(linkedinEl.value).toBe('https://linkedin.com/in/morgan-vance');
    });

    it('should detect and fill Workday application wizard inputs', () => {
      const doc = createDomDocument(WORKDAY_DOM_FIXTURE);
      const result = formFiller.fill(doc, MOCK_SENIOR_FULLSTACK_RESUME);

      expect(result.success).toBe(true);
      expect(result.platform).toBe('workday');
      expect(result.filledCount).toBeGreaterThanOrEqual(4);

      const fn = doc.querySelector('[data-automation-id="legalNameSection_firstName"]') as HTMLInputElement;
      const ln = doc.querySelector('[data-automation-id="legalNameSection_lastName"]') as HTMLInputElement;
      const email = doc.querySelector('[data-automation-id="email"]') as HTMLInputElement;
      const phone = doc.querySelector('[data-automation-id="phone-number"]') as HTMLInputElement;
      const city = doc.querySelector('[data-automation-id="addressSection_city"]') as HTMLInputElement;

      expect(fn.value).toBe('Alex');
      expect(ln.value).toBe('Rivera');
      expect(email.value).toBe('alex.rivera@example.com');
      expect(phone.value).toBe('(555) 234-5678');
      expect(city.value).toBe('San Francisco, CA');
    });

    it('should fill generic custom application form using heuristic engine', () => {
      const doc = createDomDocument(SCHEMA_ORG_DOM_FIXTURE);
      const result = formFiller.fill(doc, MOCK_SENIOR_FULLSTACK_RESUME);

      expect(result.success).toBe(true);
      expect(result.platform).toBe('generic');
      expect(result.filledCount).toBeGreaterThanOrEqual(3);

      const fn = doc.querySelector('input[name="first_name"]') as HTMLInputElement;
      const ln = doc.querySelector('input[name="last_name"]') as HTMLInputElement;
      const email = doc.querySelector('input[name="email"]') as HTMLInputElement;

      expect(fn.value).toBe('Alex');
      expect(ln.value).toBe('Rivera');
      expect(email.value).toBe('alex.rivera@example.com');
    });
  });

  describe('Edge Cases & Defensive Handling', () => {
    it('should skip disabled and readonly fields gracefully', () => {
      const doc = createDomDocument(DISABLED_FIELDS_FORM_DOM_FIXTURE);
      const result = formFiller.fill(doc, MOCK_SENIOR_FULLSTACK_RESUME);

      expect(result.success).toBe(true);
      const skippedFields = result.fields.filter((f) => f.status === 'skipped');
      expect(skippedFields.length).toBeGreaterThanOrEqual(2);
      expect(skippedFields.some((f) => f.reason?.includes('disabled or readonly'))).toBe(true);

      const emailEl = doc.querySelector('input[name="email"]') as HTMLInputElement;
      expect(emailEl.value).toBe('alex.rivera@example.com');
    });

    it('should handle minimal resume profile with missing contact information', () => {
      const doc = createDomDocument(GREENHOUSE_DOM_FIXTURE);
      const result = formFiller.fill(doc, MOCK_MINIMAL_RESUME);

      expect(result.platform).toBe('greenhouse');
      const emailEl = doc.querySelector('#email') as HTMLInputElement;
      expect(emailEl.value).toBe('cher@example.com');

      const phoneResult = result.fields.find((f) => f.fieldType === 'phone');
      expect(phoneResult?.status).toBe('skipped');
    });

    it('should respect overwrite=false option and not overwrite existing values', () => {
      const doc = createDomDocument(GREENHOUSE_DOM_FIXTURE);
      const emailInput = doc.querySelector('#email') as HTMLInputElement;
      emailInput.value = 'prefilled@example.com';

      const result = formFiller.fill(doc, MOCK_SENIOR_FULLSTACK_RESUME, { overwrite: false });
      expect(emailInput.value).toBe('prefilled@example.com');
      const emailResult = result.fields.find((f) => f.fieldType === 'email');
      expect(emailResult?.status).toBe('skipped');
      expect(emailResult?.reason).toContain('overwrite=false');
    });
  });
});
