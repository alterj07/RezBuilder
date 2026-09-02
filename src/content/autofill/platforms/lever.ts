import { Resume } from '../../../types/resume';
import { PlatformAutofillAdapter, AutofillFieldResult, AutofillOptions } from './types';
import { setNativeValue } from '../domEvents';

export class LeverAdapter implements PlatformAutofillAdapter {
  public platformName = 'lever';

  public canHandle(document: Document, url: string = ''): boolean {
    const urlLower = url.toLowerCase();
    return (
      urlLower.includes('lever.co') ||
      !!document.querySelector('.application-form') ||
      !!document.querySelector('form[action*="lever.co"]') ||
      !!document.querySelector('input[name="org"]') ||
      !!document.querySelector('input[name="urls[LinkedIn]"]')
    );
  }

  public fill(document: Document, resume: Resume, options: AutofillOptions = { overwrite: true }): AutofillFieldResult[] {
    const results: AutofillFieldResult[] = [];
    const fullName = (resume.sections?.contact?.name || resume.name || '').trim();
    const currentCompany = resume.sections?.experience?.[0]?.company || '';
    const currentSummary = resume.sections?.summary || '';

    const mappings = [
      {
        fieldType: 'fullName',
        value: fullName,
        selectors: ['input[name="name"]', 'input[placeholder*="Full Name" i]'],
      },
      {
        fieldType: 'email',
        value: resume.sections?.contact?.email || '',
        selectors: ['input[name="email"]', 'input[placeholder*="Email" i]'],
      },
      {
        fieldType: 'phone',
        value: resume.sections?.contact?.phone || '',
        selectors: ['input[name="phone"]', 'input[placeholder*="Phone" i]'],
      },
      {
        fieldType: 'company',
        value: currentCompany,
        selectors: ['input[name="org"]', 'input[placeholder*="Current Company" i]', 'input[name="company"]'],
      },
      {
        fieldType: 'linkedin',
        value: resume.sections?.contact?.linkedin || '',
        selectors: ['input[name="urls[LinkedIn]"]', 'input[placeholder*="LinkedIn" i]'],
      },
      {
        fieldType: 'github',
        value: resume.sections?.contact?.github || '',
        selectors: ['input[name="urls[GitHub]"]', 'input[placeholder*="GitHub" i]'],
      },
      {
        fieldType: 'portfolio',
        value: resume.sections?.contact?.website || resume.sections?.contact?.github || '',
        selectors: ['input[name="urls[Portfolio]"]', 'input[placeholder*="Portfolio" i]', 'input[name="urls[Other]"]'],
      },
      {
        fieldType: 'coverLetter',
        value: currentSummary,
        selectors: ['textarea[name="comments"]', 'textarea[placeholder*="additional notes" i]', 'textarea[name="coverLetter"]'],
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
