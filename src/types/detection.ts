export type ConfidenceTier = 'high' | 'medium' | 'low' | 'none';

export interface SchemaJobPosting {
  title?: string;
  hiringOrganization?: string;
  description?: string;
  datePosted?: string;
  validThrough?: string;
  employmentType?: string | string[];
  jobLocation?: {
    addressLocality?: string;
    addressRegion?: string;
    addressCountry?: string;
    streetAddress?: string;
  };
  baseSalary?: {
    currency?: string;
    minValue?: number;
    maxValue?: number;
    unitText?: string;
    value?: number;
  };
  directApply?: boolean;
}

export interface SignalDetail {
  id: string;
  name: string;
  weight: number;
  matched: boolean;
  evidence?: string;
}

export interface ClassificationResult {
  isJobPage: boolean;
  score: number;
  confidence: ConfidenceTier;
  positiveSignals: string[];
  negativeSignals: string[];
  matchedPlatform?: string;
  schemaJobPosting?: SchemaJobPosting;
  details: SignalDetail[];
}
