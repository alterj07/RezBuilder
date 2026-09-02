/**
 * Multi-Signal Form Field Detection Engine
 * Uses heuristic keyword matching across DOM attributes (autocomplete, name, id,
 * placeholder, aria-label, label text, container context) to classify input fields.
 */

export type AutofillFieldType =
  | 'firstName'
  | 'lastName'
  | 'fullName'
  | 'email'
  | 'phone'
  | 'address'
  | 'city'
  | 'state'
  | 'zip'
  | 'country'
  | 'location'
  | 'linkedin'
  | 'github'
  | 'portfolio'
  | 'website'
  | 'twitter'
  | 'summary'
  | 'coverLetter'
  | 'workExperience'
  | 'education'
  | 'skills'
  | 'salaryExpectation'
  | 'company'
  | 'title'
  | 'resume';

interface FieldPattern {
  type: AutofillFieldType;
  autocompletes: string[];
  namePatterns: RegExp[];
  labelPatterns: RegExp[];
  placeholderPatterns: RegExp[];
}

export const FIELD_PATTERNS: FieldPattern[] = [
  {
    type: 'firstName',
    autocompletes: ['given-name', 'fname', 'first-name'],
    namePatterns: [
      /\bfirst_?name\b/i,
      /\bfname\b/i,
      /\bgiven_?name\b/i,
      /\blegalNameSection_firstName\b/i,
      /job_application\[first_name\]/i,
    ],
    labelPatterns: [/\bfirst\s*name\b/i, /\bgiven\s*name\b/i, /\bfirst\b/i],
    placeholderPatterns: [/\bfirst\s*name\b/i, /\bgiven\s*name\b/i, /\bfirst\b/i],
  },
  {
    type: 'lastName',
    autocompletes: ['family-name', 'lname', 'last-name', 'surname'],
    namePatterns: [
      /\blast_?name\b/i,
      /\blname\b/i,
      /\bfamily_?name\b/i,
      /\bsurname\b/i,
      /\blegalNameSection_lastName\b/i,
      /job_application\[last_name\]/i,
    ],
    labelPatterns: [/\blast\s*name\b/i, /\bfamily\s*name\b/i, /\bsurname\b/i, /\blast\b/i],
    placeholderPatterns: [/\blast\s*name\b/i, /\bfamily\s*name\b/i, /\bsurname\b/i, /\blast\b/i],
  },
  {
    type: 'fullName',
    autocompletes: ['name'],
    namePatterns: [
      /^name$/i,
      /full_?name/i,
      /\bcandidate_?name\b/i,
      /\bapplicant_?name\b/i,
      /job_application\[name\]/i,
    ],
    labelPatterns: [/\bfull\s*name\b/i, /\bfull\s+\w+\s+name\b/i, /^name\b/i, /\byour\s*name\b/i, /\bapplicant\s*name\b/i, /\blegal\s*name\b/i],
    placeholderPatterns: [/\bfull\s*name\b/i, /^name\b/i, /\benter\s*(your\s*)?name\b/i],
  },
  {
    type: 'email',
    autocompletes: ['email'],
    namePatterns: [/\bemail\b/i, /\be-?mail\b/i, /job_application\[email\]/i],
    labelPatterns: [/\bemail\b/i, /\be-?mail\b/i, /\bemail\s*address\b/i, /\belectronic\s*mail\b/i, /\bmail\s*address\b/i],
    placeholderPatterns: [/\bemail\b/i, /\be-?mail\b/i, /@/i],
  },
  {
    type: 'phone',
    autocompletes: ['tel', 'tel-national', 'phone', 'mobile'],
    namePatterns: [
      /\bphone\b/i,
      /\bmobile\b/i,
      /\btel\b/i,
      /\btelephone\b/i,
      /\bphone-number\b/i,
      /job_application\[phone\]/i,
    ],
    labelPatterns: [/\bphone\b/i, /\bmobile\b/i, /\btelephone\b/i, /\bcell\b/i, /\bcontact\s*number\b/i],
    placeholderPatterns: [/\bphone\b/i, /\bmobile\b/i, /\(?[0-9]{3}\)?/i, /\+1/i],
  },
  {
    type: 'linkedin',
    autocompletes: [],
    namePatterns: [/\blinkedin\b/i, /urls\[LinkedIn\]/i, /job_application\[answers_attributes\].*linkedin/i],
    labelPatterns: [/\blinkedin\b/i, /\blinkedIn\s*profile\b/i, /\blinkedin\s*url\b/i],
    placeholderPatterns: [/linkedin\.com/i, /\blinkedin\b/i],
  },
  {
    type: 'github',
    autocompletes: [],
    namePatterns: [/\bgithub\b/i, /urls\[GitHub\]/i],
    labelPatterns: [/\bgithub\b/i, /\bgithub\s*profile\b/i, /\bgithub\s*url\b/i],
    placeholderPatterns: [/github\.com/i, /\bgithub\b/i],
  },
  {
    type: 'portfolio',
    autocompletes: [],
    namePatterns: [/\bportfolio\b/i, /urls\[Portfolio\]/i, /\bpersonal_?site\b/i],
    labelPatterns: [/\bportfolio\b/i, /\bportfolio\s*url\b/i, /\bpersonal\s*website\b/i],
    placeholderPatterns: [/portfolio/i, /https?:\/\//i],
  },
  {
    type: 'website',
    autocompletes: ['url'],
    namePatterns: [/\bwebsite\b/i, /\bweb_?page\b/i, /\bblog\b/i, /urls\[Other\]/i],
    labelPatterns: [/\bwebsite\b/i, /\bpersonal\s*site\b/i, /\bweb\s*site\b/i],
    placeholderPatterns: [/https?:\/\//i, /\bwebsite\b/i],
  },
  {
    type: 'twitter',
    autocompletes: [],
    namePatterns: [/\btwitter\b/i, /urls\[Twitter\]/i, /\bx_?handle\b/i],
    labelPatterns: [/\btwitter\b/i, /\btwitter\s*url\b/i, /\bx\s*handle\b/i],
    placeholderPatterns: [/twitter\.com/i, /x\.com/i, /@/i],
  },
  {
    type: 'city',
    autocompletes: ['address-level2'],
    namePatterns: [/\bcity\b/i, /\btown\b/i, /addressSection_city/i],
    labelPatterns: [/\bcity\b/i, /\btown\b/i],
    placeholderPatterns: [/\bcity\b/i, /\btown\b/i],
  },
  {
    type: 'state',
    autocompletes: ['address-level1'],
    namePatterns: [/\bstate\b/i, /\bprovince\b/i, /\bregion\b/i, /addressSection_region/i],
    labelPatterns: [/\bstate\b/i, /\bprovince\b/i, /\bregion\b/i],
    placeholderPatterns: [/\bstate\b/i, /\bprovince\b/i],
  },
  {
    type: 'zip',
    autocompletes: ['postal-code'],
    namePatterns: [/\bzip\b/i, /\bpostal\b/i, /\bpostcode\b/i, /addressSection_postalCode/i],
    labelPatterns: [/\bzip\s*(code)?\b/i, /\bpostal\s*code\b/i, /\bpost\s*code\b/i],
    placeholderPatterns: [/\bzip\b/i, /\bpostal\b/i, /\b12345\b/i],
  },
  {
    type: 'country',
    autocompletes: ['country', 'country-name'],
    namePatterns: [/\bcountry\b/i, /addressSection_country/i],
    labelPatterns: [/\bcountry\b/i],
    placeholderPatterns: [/\bcountry\b/i],
  },
  {
    type: 'address',
    autocompletes: ['street-address', 'address-line1'],
    namePatterns: [/\baddress\b/i, /\bstreet\b/i, /addressSection_addressLine1/i],
    labelPatterns: [/\baddress\b/i, /\bstreet\s*address\b/i],
    placeholderPatterns: [/\bstreet\s*address\b/i, /\baddress\b/i],
  },
  {
    type: 'location',
    autocompletes: [],
    namePatterns: [/\blocation\b/i, /job_application\[location\]/i],
    labelPatterns: [/\blocation\b/i, /\bcurrent\s*location\b/i, /\bcity,\s*state\b/i],
    placeholderPatterns: [/\bcity,\s*state\b/i, /\be\.g\.\s*san\s*francisco\b/i, /\blocation\b/i],
  },
  {
    type: 'company',
    autocompletes: ['organization'],
    namePatterns: [/\borg\b/i, /\bcompany\b/i, /\bcurrent_?company\b/i, /\bemployer\b/i],
    labelPatterns: [/\bcurrent\s*company\b/i, /\bemployer\b/i, /\bcompany\b/i, /\borganization\b/i],
    placeholderPatterns: [/\bcurrent\s*company\b/i, /\bcompany\b/i, /\bemployer\b/i],
  },
  {
    type: 'title',
    autocompletes: ['organization-title'],
    namePatterns: [/\btitle\b/i, /\bjob_?title\b/i, /\bcurrent_?title\b/i, /\bposition\b/i],
    labelPatterns: [/\bcurrent\s*title\b/i, /\bjob\s*title\b/i, /\bposition\b/i],
    placeholderPatterns: [/\bcurrent\s*title\b/i, /\bjob\s*title\b/i],
  },
  {
    type: 'summary',
    autocompletes: [],
    namePatterns: [/\bsummary\b/i, /\babout_?me\b/i, /\bbio\b/i, /\bprofile\b/i],
    labelPatterns: [/\bprofessional\s*summary\b/i, /\babout\s*you\b/i, /\bbio\b/i],
    placeholderPatterns: [/\btell\s*us\s*about\s*yourself\b/i, /\bsummary\b/i],
  },
  {
    type: 'coverLetter',
    autocompletes: [],
    namePatterns: [/\bcover_?letter\b/i, /\bcomments\b/i, /\badditional_?info\b/i, /\bnotes\b/i],
    labelPatterns: [/\bcover\s*letter\b/i, /\badditional\s*comments\b/i, /\bwhy\s*do\s*you\s*want\b/i],
    placeholderPatterns: [/\bcover\s*letter\b/i, /\badditional\s*notes\b/i],
  },
  {
    type: 'workExperience',
    autocompletes: [],
    namePatterns: [/\bexperience\b/i, /\bwork_?history\b/i, /\bemployment\b/i],
    labelPatterns: [/\bwork\s*experience\b/i, /\bexperience\b/i, /\bemployment\s*history\b/i],
    placeholderPatterns: [/\bdescribe\s*your\s*experience\b/i],
  },
  {
    type: 'education',
    autocompletes: [],
    namePatterns: [/\beducation\b/i, /\bschool\b/i, /\buniversity\b/i, /\bdegree\b/i],
    labelPatterns: [/\beducation\b/i, /\bhighest\s*degree\b/i, /\bschool\b/i, /\buniversity\b/i],
    placeholderPatterns: [/\bschool\s*or\s*university\b/i, /\bdegree\b/i],
  },
  {
    type: 'skills',
    autocompletes: [],
    namePatterns: [/\bskills\b/i, /\btechnologies\b/i, /\btech_?stack\b/i],
    labelPatterns: [/\bskills\b/i, /\btechnical\s*skills\b/i, /\bcore\s*technologies\b/i],
    placeholderPatterns: [/\blist\s*your\s*skills\b/i, /\bskills\b/i],
  },
  {
    type: 'salaryExpectation',
    autocompletes: [],
    namePatterns: [/\bsalary\b/i, /\bcompensation\b/i, /\bexpected_?pay\b/i, /\brate\b/i],
    labelPatterns: [/\bsalary\s*expectation\b/i, /\bdesired\s*compensation\b/i, /\bexpected\s*salary\b/i],
    placeholderPatterns: [/\be\.g\.\s*\$150k\b/i, /\bsalary\b/i],
  },
  {
    type: 'resume',
    autocompletes: [],
    namePatterns: [/\bresume\b/i, /\bcv\b/i, /\bresumeFile\b/i],
    labelPatterns: [/\bresume\b/i, /\bcv\b/i, /\bupload\s*resume\b/i],
    placeholderPatterns: [/\bupload\s*resume\b/i],
  },
];

/**
 * Finds the associated label text for an HTML element
 */
export function getElementLabelText(element: HTMLElement): string {
  const labels: string[] = [];

  // 1. Check aria-label and aria-labelledby
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel) labels.push(ariaLabel);

  const labelledBy = element.getAttribute('aria-labelledby');
  if (labelledBy && element.ownerDocument) {
    const labelEl = element.ownerDocument.getElementById(labelledBy);
    if (labelEl && labelEl.textContent) labels.push(labelEl.textContent);
  }

  // 2. Check <label for="element_id">
  if (element.id && element.ownerDocument) {
    const labelFor = element.ownerDocument.querySelector(`label[for="${element.id}"]`);
    if (labelFor && labelFor.textContent) labels.push(labelFor.textContent);
  }

  // 3. Check ancestor <label>
  const parentLabel = element.closest('label');
  if (parentLabel && parentLabel.textContent) {
    labels.push(parentLabel.textContent);
  }

  // 4. Check preceding sibling label or span
  const prev = element.previousElementSibling;
  if (prev && !prev.querySelector('input, textarea, select')) {
    if (prev.tagName === 'LABEL' || prev.tagName === 'SPAN' || (prev.tagName === 'DIV' && (prev.classList.contains('label') || prev.classList.contains('field-label')))) {
      if (prev.textContent && prev.textContent.trim().length < 50) {
        labels.push(prev.textContent);
      }
    }
  }

  // 5. Check parent container label/heading
  const parent = element.parentElement;
  if (parent && !['BODY', 'HTML', 'FORM'].includes(parent.tagName)) {
    if (parent.tagName === 'FIELDSET') {
      const legend = parent.querySelector('legend');
      if (legend && legend.textContent) {
        labels.push(legend.textContent);
      }
    } else {
      const parentLabelEl = parent.querySelector(':scope > label, :scope > .label, :scope > .field-label');
      if (parentLabelEl && parentLabelEl !== element && parentLabelEl.textContent) {
        labels.push(parentLabelEl.textContent);
      }
    }
  }

  // Deduplicate and clean up
  return Array.from(new Set(labels)).join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * Detects the field type and confidence score for an input / textarea element
 */
export function detectFieldType(
  element: HTMLElement
): { fieldType: AutofillFieldType; confidence: number } | null {
  const name = element.getAttribute('name') || '';
  const id = element.getAttribute('id') || '';
  const placeholder = element.getAttribute('placeholder') || '';
  const autocomplete = (element.getAttribute('autocomplete') || '').toLowerCase();
  const inputType = (element.getAttribute('type') || '').toLowerCase();
  const dataAutomationId = element.getAttribute('data-automation-id') || '';
  const labelText = getElementLabelText(element);

  let bestMatch: { fieldType: AutofillFieldType; confidence: number } | null = null;
  let highestScore = 0;

  for (const pattern of FIELD_PATTERNS) {
    let score = 0;

    // 1. Autocomplete match (strong signal)
    if (autocomplete && pattern.autocompletes.includes(autocomplete)) {
      score += 50;
    }

    // 2. HTML input type match
    if (pattern.type === 'email' && inputType === 'email') score += 40;
    if (pattern.type === 'phone' && inputType === 'tel') score += 40;
    if (pattern.type === 'resume' && inputType === 'file') score += 30;

    // 3. Name or DataAutomationId match
    const nameToTest = `${name} ${id} ${dataAutomationId}`.trim();
    for (const reg of pattern.namePatterns) {
      if (reg.test(nameToTest)) {
        score += 35;
        break;
      }
    }

    // 4. Label text match
    if (labelText) {
      for (const reg of pattern.labelPatterns) {
        if (reg.test(labelText)) {
          score += 30;
          break;
        }
      }
    }

    // 5. Placeholder match
    if (placeholder) {
      for (const reg of pattern.placeholderPatterns) {
        if (reg.test(placeholder)) {
          score += 25;
          break;
        }
      }
    }

    // Disambiguation penalties
    if (pattern.type === 'fullName') {
      if (/first\s*name/i.test(labelText) || /first_?name/i.test(nameToTest)) {
        score = 0;
      }
      if (/last\s*name/i.test(labelText) || /last_?name/i.test(nameToTest)) {
        score = 0;
      }
    }

    if (score > highestScore && score >= 25) {
      highestScore = score;
      bestMatch = {
        fieldType: pattern.type,
        confidence: Math.min(100, score),
      };
    }
  }

  return bestMatch;
}
