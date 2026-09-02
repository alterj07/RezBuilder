import { Resume } from '../../../types/resume';
import { PlatformAutofillAdapter, AutofillFieldResult, AutofillOptions } from './types';
import { detectFieldType, AutofillFieldType } from '../fieldDetector';
import { setNativeValue, setSelectOption } from '../domEvents';

export class GenericAdapter implements PlatformAutofillAdapter {
  public platformName = 'generic';

  public canHandle(_document: Document, _url: string = ''): boolean {
    return true; // Universal fallback
  }

  public fill(
    document: Document,
    resume: Resume,
    options: AutofillOptions = { overwrite: true }
  ): AutofillFieldResult[] {
    const results: AutofillFieldResult[] = [];
    const nameParts = (resume.sections?.contact?.name || resume.name || '').trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
    const location = resume.sections?.contact?.location || '';

    const candidateValues: Record<AutofillFieldType, string> = {
      firstName,
      lastName,
      fullName: (resume.sections?.contact?.name || resume.name || '').trim(),
      email: resume.sections?.contact?.email || '',
      phone: resume.sections?.contact?.phone || '',
      address: location,
      city: location.includes(',') ? location.split(',')[0]?.trim() || location : location,
      state: location.includes(',') ? location.split(',')[1]?.trim() || '' : '',
      zip: '',
      country: 'United States',
      location,
      linkedin: resume.sections?.contact?.linkedin || '',
      github: resume.sections?.contact?.github || '',
      portfolio: resume.sections?.contact?.website || resume.sections?.contact?.github || '',
      website: resume.sections?.contact?.website || '',
      twitter: '',
      summary: resume.sections?.summary || '',
      coverLetter: resume.sections?.summary || '',
      workExperience: (resume.sections?.experience || [])
        .map((e) => `${e.title} at ${e.company} (${e.startDate || ''} - ${e.endDate || 'Present'})\n${e.bullets.map((b) => `• ${b}`).join('\n')}`)
        .join('\n\n'),
      education: (resume.sections?.education || [])
        .map((ed) => `${ed.degree || ''} in ${ed.fieldOfStudy || ''} from ${ed.institution} (${ed.graduationYear || ''})`)
        .join('\n'),
      skills: (resume.sections?.skills || []).join(', '),
      salaryExpectation: '',
      company: resume.sections?.experience?.[0]?.company || '',
      title: resume.sections?.experience?.[0]?.title || '',
      resume: '',
    };

    const inputs = Array.from(
      document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
        'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"]), textarea, select'
      )
    );

    const filledElements = new Set<Element>();

    for (const el of inputs) {
      if (filledElements.has(el)) continue;

      const detection = detectFieldType(el);
      if (!detection) continue;

      filledElements.add(el);
      const fieldType = detection.fieldType;
      const valToSet = candidateValues[fieldType] || '';
      const fieldIdentifier = el.getAttribute('name') || el.getAttribute('id') || fieldType;

      if ((el as HTMLInputElement).disabled || (el as HTMLInputElement).readOnly) {
        results.push({
          name: fieldIdentifier,
          fieldType,
          selector: el.id ? `#${el.id}` : el.getAttribute('name') ? `[name="${el.getAttribute('name')}"]` : el.tagName.toLowerCase(),
          value: (el as any).value || '',
          status: 'skipped',
          reason: 'Element is disabled or readonly',
        });
        continue;
      }

      if (el.value && el.value.trim() !== '' && options.overwrite === false) {
        results.push({
          name: fieldIdentifier,
          fieldType,
          selector: el.id ? `#${el.id}` : el.getAttribute('name') ? `[name="${el.getAttribute('name')}"]` : el.tagName.toLowerCase(),
          value: el.value,
          status: 'skipped',
          reason: 'Field already populated and overwrite=false',
        });
        continue;
      }

      if (valToSet) {
        if (el.tagName === 'SELECT') {
          setSelectOption(el as HTMLSelectElement, valToSet);
        } else {
          setNativeValue(el as HTMLInputElement | HTMLTextAreaElement, valToSet);
        }

        results.push({
          name: fieldIdentifier,
          fieldType,
          selector: el.id ? `#${el.id}` : el.getAttribute('name') ? `[name="${el.getAttribute('name')}"]` : el.tagName.toLowerCase(),
          value: valToSet,
          status: 'filled',
        });
      } else {
        results.push({
          name: fieldIdentifier,
          fieldType,
          selector: el.id ? `#${el.id}` : el.getAttribute('name') ? `[name="${el.getAttribute('name')}"]` : el.tagName.toLowerCase(),
          value: '',
          status: 'skipped',
          reason: `No candidate resume data available for ${fieldType}`,
        });
      }
    }

    return results;
  }
}
