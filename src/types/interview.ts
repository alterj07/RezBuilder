export interface CoreConceptItem {
  concept: string;
  explanation: string;
  category: string;
}

export interface TechnicalQuestionItem {
  question: string;
  category: string;
  suggestedTalkingPoints: string[];
  keyTermsToMention: string[];
}

export interface BehavioralQuestionItem {
  question: string;
  targetedValue: string;
  starFrameworkTip: string;
}

export interface InterviewerQuestionItem {
  question: string;
  purpose: string;
}

export interface InterviewPrepBriefing {
  id: string;
  jobId: string;
  jobTitle: string;
  companyName: string;
  createdAt: string; // ISO string
  roleSynthesis: string; // "What this role actually cares about"
  coreConcepts: CoreConceptItem[];
  technicalQuestions: TechnicalQuestionItem[];
  behavioralQuestions: BehavioralQuestionItem[];
  questionsToAskInterviewer: InterviewerQuestionItem[];
}
