import { Resume } from '../../../types/resume';
import { AutofillFieldType } from '../fieldDetector';

export interface AutofillFieldResult {
  name: string;
  fieldType: AutofillFieldType | string;
  selector: string;
  value: string;
  status: 'filled' | 'skipped' | 'error';
  reason?: string;
}

export interface AutofillOptions {
  overwrite?: boolean;
}

export interface PlatformAutofillAdapter {
  platformName: string;
  canHandle(document: Document, url?: string): boolean;
  fill(document: Document, resume: Resume, options?: AutofillOptions): AutofillFieldResult[];
}
