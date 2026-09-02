import { Resume } from '../../src/types/resume';

export type AutofillPlatform = 'greenhouse' | 'lever' | 'workday' | 'generic';

export type AutofillFieldType =
  | 'first_name'
  | 'last_name'
  | 'full_name'
  | 'email'
  | 'phone'
  | 'linkedin'
  | 'github'
  | 'website'
  | 'location'
  | 'company'
  | 'title'
  | 'resume';

export interface AutofillFieldResult {
  name: string;
  fieldType: AutofillFieldType;
  selector: string;
  value: string;
  status: 'filled' | 'skipped' | 'error';
  reason?: string;
}

export interface AutofillResult {
  success: boolean;
  filledCount: number;
  totalFieldsDetected: number;
  platform: AutofillPlatform;
  fields: AutofillFieldResult[];
  message?: string;
}

export interface AutofillOptions {
  overwrite?: boolean;
}

/**
 * Dispatches realistic browser DOM events after setting input values
 * to ensure React/Vue/Angular/Vanilla state bindings update correctly.
 */
export function setInputValue(
  element: HTMLInputElement | HTMLTextAreaElement,
  value: string
): void {
  // If element prototype has native setter, use it for React 16+ synthetic event tracker
  const prototype = Object.getPrototypeOf(element);
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');

  if (descriptor && descriptor.set) {
    descriptor.set.call(element, value);
  } else {
    element.value = value;
  }

  element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
  element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
  element.dispatchEvent(new Event('blur', { bubbles: true, cancelable: true }));
}

/**
 * Splits a candidate's full name into first and last name safely.
 * Handles single names ("Cher"), hyphenated names, and middle names.
 */
export function splitCandidateName(fullName?: string): { firstName: string; lastName: string } {
  if (!fullName || !fullName.trim()) {
    return { firstName: '', lastName: '' };
  }
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' };
  }
  const firstName = parts[0];
  const lastName = parts.slice(1).join(' ');
  return { firstName, lastName };
}

/**
 * Form Auto-Fill Engine for RezBuilder.
 * Implements platform-specific mapping for Greenhouse, Lever, Workday,
 * and generic heuristic field matching.
 */
export class FormFiller {
  public detectPlatform(document: Document, url: string = ''): AutofillPlatform {
    const urlLower = url.toLowerCase();
    if (urlLower.includes('greenhouse.io') || document.querySelector('#application_form') || document.querySelector('[name*="job_application["]')) {
      return 'greenhouse';
    }
    if (urlLower.includes('lever.co') || document.querySelector('.application-form') || document.querySelector('input[name="org"]')) {
      return 'lever';
    }
    if (
      urlLower.includes('myworkdayjobs.com') ||
      document.querySelector('[data-automation-id*="legalNameSection"]') ||
      document.querySelector('[data-automation-id="applicationForm"]')
    ) {
      return 'workday';
    }
    return 'generic';
  }

  public fillForm(
    document: Document,
    resume: Resume,
    options: AutofillOptions = { overwrite: true }
  ): AutofillResult {
    const platform = this.detectPlatform(document, typeof window !== 'undefined' ? window.location?.href : '');
    const fields: AutofillFieldResult[] = [];
    const { firstName, lastName } = splitCandidateName(resume.sections.contact.name || resume.name);

    const candidateValues: Record<AutofillFieldType, string> = {
      first_name: firstName,
      last_name: lastName,
      full_name: (resume.sections.contact.name || resume.name || '').trim(),
      email: resume.sections.contact.email || '',
      phone: resume.sections.contact.phone || '',
      linkedin: resume.sections.contact.linkedin || '',
      github: resume.sections.contact.github || '',
      website: resume.sections.contact.website || '',
      location: resume.sections.contact.location || '',
      company: resume.sections.experience[0]?.company || '',
      title: resume.sections.experience[0]?.title || '',
      resume: '',
    };

    // Candidate mappings by platform
    const platformFieldRules: Record<AutofillPlatform, { fieldType: AutofillFieldType; selectors: string[] }[]> = {
      greenhouse: [
        { fieldType: 'first_name', selectors: ['#first_name', 'input[name="job_application[first_name]"]', 'input[autocomplete="given-name"]'] },
        { fieldType: 'last_name', selectors: ['#last_name', 'input[name="job_application[last_name]"]', 'input[autocomplete="family-name"]'] },
        { fieldType: 'email', selectors: ['#email', 'input[name="job_application[email]"]', 'input[autocomplete="email"]'] },
        { fieldType: 'phone', selectors: ['#phone', 'input[name="job_application[phone]"]', 'input[autocomplete="tel"]'] },
        { fieldType: 'location', selectors: ['#job_application_location', 'input[name="job_application[location]"]'] },
        { fieldType: 'linkedin', selectors: ['#linkedin', 'input[name*="linkedin" i]', 'input[name*="answers_attributes"][name*="text_value"]'] },
      ],
      lever: [
        { fieldType: 'full_name', selectors: ['input[name="name"]', 'input[placeholder*="Full Name" i]'] },
        { fieldType: 'email', selectors: ['input[name="email"]'] },
        { fieldType: 'phone', selectors: ['input[name="phone"]'] },
        { fieldType: 'company', selectors: ['input[name="org"]', 'input[placeholder*="Current Company" i]'] },
        { fieldType: 'linkedin', selectors: ['input[name="urls[LinkedIn]"]', 'input[placeholder*="LinkedIn" i]'] },
        { fieldType: 'github', selectors: ['input[name="urls[GitHub]"]', 'input[placeholder*="GitHub" i]'] },
      ],
      workday: [
        { fieldType: 'first_name', selectors: ['input[data-automation-id="legalNameSection_firstName"]', 'input[name="legalNameSection_firstName"]'] },
        { fieldType: 'last_name', selectors: ['input[data-automation-id="legalNameSection_lastName"]', 'input[name="legalNameSection_lastName"]'] },
        { fieldType: 'email', selectors: ['input[data-automation-id="email"]', 'input[name="email"]'] },
        { fieldType: 'phone', selectors: ['input[data-automation-id="phone-number"]', 'input[name="phone"]'] },
        { fieldType: 'location', selectors: ['input[data-automation-id="addressSection_city"]', 'input[name="city"]'] },
      ],
      generic: [
        { fieldType: 'first_name', selectors: ['input[name*="first_name" i]', 'input[name*="firstname" i]', 'input[id*="first_name" i]', 'input[placeholder*="first name" i]'] },
        { fieldType: 'last_name', selectors: ['input[name*="last_name" i]', 'input[name*="lastname" i]', 'input[id*="last_name" i]', 'input[placeholder*="last name" i]'] },
        { fieldType: 'full_name', selectors: ['input[name="name" i]', 'input[name*="fullname" i]', 'input[placeholder*="full name" i]'] },
        { fieldType: 'email', selectors: ['input[type="email"]', 'input[name*="email" i]', 'input[id*="email" i]'] },
        { fieldType: 'phone', selectors: ['input[type="tel"]', 'input[name*="phone" i]', 'input[id*="phone" i]'] },
        { fieldType: 'linkedin', selectors: ['input[name*="linkedin" i]', 'input[id*="linkedin" i]', 'input[placeholder*="linkedin" i]'] },
        { fieldType: 'github', selectors: ['input[name*="github" i]', 'input[id*="github" i]', 'input[placeholder*="github" i]'] },
        { fieldType: 'location', selectors: ['input[name*="location" i]', 'input[name*="city" i]', 'input[id*="location" i]'] },
      ],
    };

    const rules = platformFieldRules[platform] || platformFieldRules.generic;
    let filledCount = 0;
    const matchedElements = new Set<Element>();

    for (const rule of rules) {
      for (const sel of rule.selectors) {
        const el = document.querySelector(sel) as HTMLInputElement | HTMLTextAreaElement | null;
        if (!el || matchedElements.has(el)) continue;

        matchedElements.add(el);
        const valToSet = candidateValues[rule.fieldType] || '';

        // Check if disabled or readonly
        if (el.disabled || el.readOnly) {
          fields.push({
            name: el.name || el.id || rule.fieldType,
            fieldType: rule.fieldType,
            selector: sel,
            value: el.value,
            status: 'skipped',
            reason: 'Element is disabled or readonly',
          });
          break;
        }

        // Check overwrite policy
        if (el.value && el.value.trim() !== '' && options.overwrite === false) {
          fields.push({
            name: el.name || el.id || rule.fieldType,
            fieldType: rule.fieldType,
            selector: sel,
            value: el.value,
            status: 'skipped',
            reason: 'Field already contains value and overwrite=false',
          });
          break;
        }

        if (valToSet) {
          setInputValue(el, valToSet);
          filledCount++;
          fields.push({
            name: el.name || el.id || rule.fieldType,
            fieldType: rule.fieldType,
            selector: sel,
            value: valToSet,
            status: 'filled',
          });
        } else {
          fields.push({
            name: el.name || el.id || rule.fieldType,
            fieldType: rule.fieldType,
            selector: sel,
            value: '',
            status: 'skipped',
            reason: `No value in candidate resume for ${rule.fieldType}`,
          });
        }
        break; // Match first matching selector for this rule
      }
    }

    const allInputs = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea');

    return {
      success: filledCount > 0,
      filledCount,
      totalFieldsDetected: allInputs.length,
      platform,
      fields,
      message: filledCount > 0 ? `Successfully filled ${filledCount} fields` : 'No fields were populated',
    };
  }
}

export const formFiller = new FormFiller();

/**
 * Creates a standard DOM Document from an HTML string using DOMParser.
 */
export function createDomDocument(html: string): Document {
  const parser = new DOMParser();
  return parser.parseFromString(html, 'text/html');
}
