export interface AtsWeights {
  keywordMatch: number;      // default: 45 (40-50%)
  placement: number;         // default: 15 (10-15%)
  sectionCompleteness: number;// default: 15 (15-20%)
  parseSuccess: number;      // default: 15 (10-20%)
  relevance: number;         // default: 10 (5-15%)
}

export type AtsPresetName = 'standard' | 'enterprise' | 'modern' | 'custom';

export interface KeywordMatchDetail {
  keyword: string;
  foundInResume: boolean;
  frequencyInJob: number;
  frequencyInResume: number;
  placements: ('title' | 'experience' | 'summary' | 'skills')[];
  category?: 'hard_skill' | 'tool' | 'methodology' | 'soft_skill' | 'domain';
}

export interface SectionCheckItem {
  name: string;
  present: boolean;
  qualityScore: number; // 0-100
  feedback?: string;
}

export interface ParseIssue {
  type: 'date_inconsistency' | 'missing_header' | 'unstructured_bullet' | 'special_characters' | 'unknown_layout';
  severity: 'warning' | 'error' | 'info';
  message: string;
}

export interface RelevanceBreakdown {
  score: number; // 0-100
  tenureYearsInResume: number;
  tenureYearsRequired?: number;
  titleMatchScore: number; // 0-100
  educationMatchScore: number; // 0-100
  notes: string[];
}

export interface PlacementBreakdown {
  score: number; // 0-100
  titleKeywordsCount: number;
  experienceKeywordsCount: number;
  summaryKeywordsCount: number;
  skillsKeywordsCount: number;
  details: string[];
}

export interface AtsScoreResult {
  overallScore: number; // 0-100
  presetUsed: AtsPresetName;
  weights: AtsWeights;
  
  // 5 component scores (0-100)
  keywordScore: number;
  placementScore: number;
  sectionScore: number;
  parseScore: number;
  relevanceScore: number;

  // Detailed breakdowns
  keywordDetails: {
    totalKeywords: number;
    matchedKeywords: number;
    missingKeywords: number;
    items: KeywordMatchDetail[];
  };
  placementDetails: PlacementBreakdown;
  sectionDetails: {
    items: SectionCheckItem[];
  };
  parseDetails: {
    issues: ParseIssue[];
    cleanlinessRating: 'Excellent' | 'Good' | 'Fair' | 'Poor';
  };
  relevanceDetails: RelevanceBreakdown;
  
  // High-level summary & action items
  recommendations: string[];
  calculatedAt: string; // ISO string
}

export interface ResumeComparisonItem {
  resumeId: string;
  resumeName: string;
  resumeTag: string;
  scoreResult: AtsScoreResult;
  isRecommended: boolean;
  recommendationReason: string;
}
