import { Resume } from '../../../types/resume';
import { PlatformAutofillAdapter, AutofillFieldResult, AutofillOptions } from './types';
import { setNativeValue } from '../domEvents';

export class WorkdayAdapter implements PlatformAutofillAdapter {
  public platformName = 'workday';

  public canHandle(document: Document, url: string = ''): boolean {
    const urlLower = url.toLowerCase();
    return (
      urlLower.includes('myworkdayjobs.com') ||
      !!document.querySelector('[data-automation-id*="legalNameSection"]') ||
      !!document.querySelector('[data-automation-id="applicationForm"]') ||
      !!document.querySelector('meta[name="workday-site"]') ||
      !!document.querySelector('[data-automation-id="jobPostingPage"]')
    );
  }

  public fill(document: Document, resume: Resume, options: AutofillOptions = { overwrite: true }): AutofillFieldResult[] {
    const results: AutofillFieldResult[] = [];
    const nameParts = (resume.sections?.contact?.name || resume.name || '').trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
    const location = resume.sections?.contact?.location || '';

    const mappings = [
      {
        fieldType: 'firstName',
        value: firstName,
        selectors: [
          'input[data-automation-id="legalNameSection_firstName"]',
          'input[name="legalNameSection_firstName"]',
        ],
      },
      {
        fieldType: 'lastName',
        value: lastName,
        selectors: [
          'input[data-automation-id="legalNameSection_lastName"]',
          'input[name="legalNameSection_lastName"]',
        ],
      },
      {
        fieldType: 'email',
        value: resume.sections?.contact?.email || '',
        selectors: ['input[data-automation-id="email"]', 'input[name="email"]'],
      },
      {
        fieldType: 'phone',
        value: resume.sections?.contact?.phone || '',
        selectors: [
          'input[data-automation-id="phone-number"]',
          'input[data-automation-id="phone"]',
          'input[name="phone"]',
        ],
      },
      {
        fieldType: 'address',
        value: location,
        selectors: ['input[data-automation-id="addressSection_addressLine1"]'],
      },
      {
        fieldType: 'city',
        value: location,
        selectors: ['input[data-automation-id="addressSection_city"]', 'input[name="city"]'],
      },
      {
        fieldType: 'state',
        value: location.includes(',') ? location.split(',')[1]?.trim() || '' : '',
        selectors: ['input[data-automation-id="addressSection_region"]', 'input[name="state"]'],
      },
      {
        fieldType: 'zip',
        value: '',
        selectors: ['input[data-automation-id="addressSection_postalCode"]', 'input[name="postalCode"]'],
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
        break;
      }
    }

    return results;
  }
}
