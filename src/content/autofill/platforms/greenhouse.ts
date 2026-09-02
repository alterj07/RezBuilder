import { Resume } from '../../../types/resume';
import { PlatformAutofillAdapter, AutofillFieldResult, AutofillOptions } from './types';
import { setNativeValue } from '../domEvents';

export class GreenhouseAdapter implements PlatformAutofillAdapter {
  public platformName = 'greenhouse';

  public canHandle(document: Document, url: string = ''): boolean {
    const urlLower = url.toLowerCase();
    return (
      urlLower.includes('greenhouse.io') ||
      !!document.querySelector('#application_form') ||
      !!document.querySelector('[name*="job_application["]') ||
      !!document.querySelector('form[action*="greenhouse.io"]')
    );
  }

  public fill(document: Document, resume: Resume, options: AutofillOptions = { overwrite: true }): AutofillFieldResult[] {
    const results: AutofillFieldResult[] = [];
    const nameParts = (resume.sections?.contact?.name || resume.name || '').trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

    const mappings = [
      {
        fieldType: 'firstName',
        value: firstName,
        selectors: ['#first_name', 'input[name="job_application[first_name]"]', 'input[autocomplete="given-name"]'],
      },
      {
        fieldType: 'lastName',
        value: lastName,
        selectors: ['#last_name', 'input[name="job_application[last_name]"]', 'input[autocomplete="family-name"]'],
      },
      {
        fieldType: 'email',
        value: resume.sections?.contact?.email || '',
        selectors: ['#email', 'input[name="job_application[email]"]', 'input[autocomplete="email"]'],
      },
      {
        fieldType: 'phone',
        value: resume.sections?.contact?.phone || '',
        selectors: ['#phone', 'input[name="job_application[phone]"]', 'input[autocomplete="tel"]'],
      },
      {
        fieldType: 'location',
        value: resume.sections?.contact?.location || '',
        selectors: ['#job_application_location', 'input[name="job_application[location]"]', 'input[id*="location"]'],
      },
      {
        fieldType: 'linkedin',
        value: resume.sections?.contact?.linkedin || '',
        selectors: [
          '#linkedin',
          'input[name*="linkedin" i]',
          'input[name*="answers_attributes"][name*="text_value"]',
          'input[placeholder*="linkedin" i]',
        ],
      },
      {
        fieldType: 'website',
        value: resume.sections?.contact?.website || resume.sections?.contact?.github || '',
        selectors: ['#website', 'input[name*="website" i]', 'input[placeholder*="website" i]'],
      },
    ];

    const filledElements = new Set<Element>();

    for (const mapping of mappings) {
      for (const sel of mapping.selectors) {
        const el = document.querySelector(sel) as HTMLInputElement | HTMLTextAreaElement | null;
        if (!el || filledElements.has(el)) continue;

        filledElements.add(el);

        if (el.disabled || el.readOnly) {
          results.push({
            name: el.name || el.id || mapping.fieldType,
            fieldType: mapping.fieldType,
            selector: sel,
            value: el.value,
            status: 'skipped',
            reason: 'Element is disabled or readonly',
          });
          break;
        }

        if (el.value && el.value.trim() !== '' && options.overwrite === false) {
          results.push({
            name: el.name || el.id || mapping.fieldType,
            fieldType: mapping.fieldType,
            selector: sel,
            value: el.value,
            status: 'skipped',
            reason: 'Field already populated and overwrite=false',
          });
          break;
        }

        if (mapping.value) {
          setNativeValue(el, mapping.value);
          results.push({
            name: el.name || el.id || mapping.fieldType,
            fieldType: mapping.fieldType,
            selector: sel,
            value: mapping.value,
            status: 'filled',
          });
        } else {
          results.push({
            name: el.name || el.id || mapping.fieldType,
            fieldType: mapping.fieldType,
            selector: sel,
            value: '',
            status: 'skipped',
            reason: `No candidate data available for ${mapping.fieldType}`,
          });
        }
        break; // Match first matching element for this field type
      }
    }

    return results;
  }
}
