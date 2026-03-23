export type ConfidenceBand = "emergent" | "steady" | "resonant";

export interface PatternMatch {
  id: string;
  label: string;
  whyItFits: string;
  confidence: number;
  depthScore?: number | null;
}

export interface SimilarStory {
  title: string;
  medium: string;
  resonance: string;
  takeaway: string;
}

export interface TimelineWarning {
  label: string;
  detail: string;
  severity: "low" | "medium" | "high";
}

export interface StructuralQuestion {
  id: string;
  prompt: string;
}

export interface EpistemicCharacter {
  name: string;
  roleHint: string | null;
}

export interface EpistemicFact {
  description: string;
  introducedAtBeat: number;
  knownBy: { character: string; beatIndex: number }[];
  actedOnBy: { character: string; beatIndex: number }[];
}

export interface EpistemicViolation {
  character: string;
  fact: string;
  actsAtBeat: number;
  severity: "low" | "medium" | "high";
}

export interface EpistemicState {
  characters: EpistemicCharacter[];
  facts: EpistemicFact[];
  violations: EpistemicViolation[];
}

export interface AnalyzerResult {
  title: string;
  summary: string;
  confidenceBand: ConfidenceBand;
  confidenceLabel: string;
  coherenceScore: number;
  currentArc: string;
  patternMatches: PatternMatch[];
  crossGenreComparisons: SimilarStory[];
  similarStories: SimilarStory[];
  timelineWarnings: TimelineWarning[];
  gentleQuestions: StructuralQuestion[];
  retrievalNotes: string[];
  epistemicState?: EpistemicState;
}

export interface AnalyzerDemo {
  id: string;
  label: string;
  genre: string;
  outline: string;
  analysis: AnalyzerResult;
}
