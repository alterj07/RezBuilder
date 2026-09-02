import { Resume } from '../../types/resume';
import {
  PlatformAutofillAdapter,
  AutofillFieldResult,
  AutofillOptions,
} from './platforms/types';
import { GreenhouseAdapter } from './platforms/greenhouse';
import { LeverAdapter } from './platforms/lever';
import { WorkdayAdapter } from './platforms/workday';
import { GenericAdapter } from './platforms/generic';

export interface AutofillResult {
  success: boolean;
  filledCount: number;
  totalFieldsDetected: number;
  platform: string;
  fields: AutofillFieldResult[];
  message?: string;
  error?: string;
}

export class FormFiller {
  private adapters: PlatformAutofillAdapter[];
  private fallbackAdapter: PlatformAutofillAdapter;

  constructor() {
    this.adapters = [
      new GreenhouseAdapter(),
      new LeverAdapter(),
      new WorkdayAdapter(),
    ];
    this.fallbackAdapter = new GenericAdapter();
  }

  /**
   * Detects which platform adapter handles the current document / URL
   */
  public detectPlatform(document: Document, url: string = ''): string {
    const activeUrl = url || (typeof window !== 'undefined' ? window.location?.href || '' : '');
    for (const adapter of this.adapters) {
      if (adapter.canHandle(document, activeUrl)) {
        return adapter.platformName;
      }
    }
    return this.fallbackAdapter.platformName;
  }

  /**
   * Primary form filling entry point
   */
  public fill(
    document: Document,
    resume: Resume,
    options: AutofillOptions = { overwrite: true }
  ): AutofillResult {
    const activeUrl = typeof window !== 'undefined' ? window.location?.href || '' : '';
    let selectedAdapter = this.fallbackAdapter;

    for (const adapter of this.adapters) {
      if (adapter.canHandle(document, activeUrl)) {
        selectedAdapter = adapter;
        break;
      }
    }

    try {
      const fieldResults = selectedAdapter.fill(document, resume, options);
      const filledCount = fieldResults.filter((f) => f.status === 'filled').length;
      const allInputs = document.querySelectorAll(
        'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]), textarea, select'
      );

      return {
        success: filledCount > 0,
        filledCount,
        totalFieldsDetected: allInputs.length,
        platform: selectedAdapter.platformName,
        fields: fieldResults,
        message: filledCount > 0
          ? `Successfully filled ${filledCount} field${filledCount === 1 ? '' : 's'} via ${selectedAdapter.platformName} adapter.`
          : 'No fields were populated.',
      };
    } catch (err: any) {
      console.error('[FormFiller] Error during auto-fill execution:', err);
      return {
        success: false,
        filledCount: 0,
        totalFieldsDetected: 0,
        platform: selectedAdapter.platformName,
        fields: [],
        error: err?.message || 'Form auto-fill failed',
      };
    }
  }

  /**
   * Alias method for interface contract compatibility
   */
  public fillForm(
    document: Document,
    resume: Resume,
    options: AutofillOptions = { overwrite: true }
  ): AutofillResult {
    return this.fill(document, resume, options);
  }
}

export const formFiller = new FormFiller();
