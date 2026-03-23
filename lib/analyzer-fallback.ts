import { getAnalyzerDemo } from "@/lib/analyzer-demos";
import type {
  AnalyzerResult,
  ConfidenceBand,
  EpistemicState,
} from "@/lib/analyzer-types";

interface RetrievalMatch {
  uid: string;
  name: string;
  description?: string | null;
  depth_score?: number | null;
  confidence?: number | null;
  relevance_score?: number | null;
}

interface RetrievalStory {
  title: string;
  description?: string | null;
  matched_patterns?: string[];
}

export interface RetrievalEpistemicState {
  characters?: Array<{ name: string; role_hint?: string | null }>;
  facts?: Array<{
    description: string;
    introduced_at_beat: number;
    known_by?: Array<{ character: string; beat_index?: number }>;
    acted_on_by?: Array<{ character: string; beat_index?: number }>;
  }>;
  violations?: Array<{
    character: string;
    fact: string;
    acts_at_beat: number;
    severity?: "low" | "medium" | "high";
  }>;
}

export interface RetrievalContext {
  title?: string;
  current_arc?: string;
  concept_matches?: RetrievalMatch[];
  function_matches?: RetrievalMatch[];
  similar_stories?: RetrievalStory[];
  timeline_warnings?: Array<{
    label: string;
    detail: string;
    severity: "low" | "medium" | "high";
  }>;
  epistemic_state?: RetrievalEpistemicState;
  retrieval_notes?: string[];
  confidence_signal?: {
    retrieval_coverage?: number;
    graph_hits?: number;
    instance_hits?: number;
  };
}

export function confidenceBandFromCoverage(coverage = 0): {
  band: ConfidenceBand;
  label: string;
  score: number;
} {
  // These thresholds intentionally map retrieval richness to a warm UI band.
  // They are product heuristics, not ML-calibrated probabilities.
  if (coverage >= 0.78) {
    return {
      band: "resonant",
      label: "Resonant foundation",
      score: 84,
    };
  }

  if (coverage >= 0.52) {
    return {
      band: "steady",
      label: "Steady structural pull",
      score: 73,
    };
  }

  return {
    band: "emergent",
    label: "Emergent structure",
    score: 61,
  };
}

export function buildFallbackAnalysis(params: {
  outline: string;
  title?: string;
  retrieval?: RetrievalContext | null;
  demoId?: string;
}): AnalyzerResult {
  if (params.demoId) {
    return getAnalyzerDemo(params.demoId).analysis;
  }

  // The fallback keeps the analyzer route usable during partial outages and also
  // gives us a stable schema for frontend development before the live backend is
  // fully populated with richer graph data.
  const retrieval = params.retrieval ?? {};
  const conceptMatches = retrieval.concept_matches ?? [];
  const functionMatches = retrieval.function_matches ?? [];
  const stories = retrieval.similar_stories ?? [];
  const coverage = retrieval.confidence_signal?.retrieval_coverage ?? 0.46;
  const confidence = confidenceBandFromCoverage(coverage);
  const outlineLines = params.outline
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const title =
    retrieval.title ||
    params.title ||
    "A story outline with clear structural pressure";

  return {
    title,
    summary:
      "This outline already shows structural pressure and consequence. The next step is clarifying which pattern is dominant, then making sure the character's decisions and knowledge flow sharpen that pattern instead of diffusing it.",
    confidenceBand: confidence.band,
    confidenceLabel: confidence.label,
    coherenceScore: confidence.score,
    currentArc: retrieval.current_arc || "Pressure building through consequence",
    patternMatches: [...conceptMatches, ...functionMatches].slice(0, 4).map((match) => ({
      id: match.uid,
      label: match.name,
      whyItFits:
        match.description ||
        "This pattern appears to be part of the outline's current structural center of gravity.",
      confidence: Math.min(0.92, Math.max(0.52, match.confidence ?? 0.7)),
      depthScore: match.depth_score,
    })),
    crossGenreComparisons: stories.slice(0, 2).map((story) => ({
      title: story.title,
      medium: "graph reference",
      resonance:
        story.description ||
        "The retrieval layer found overlap in structural pressure rather than shared genre labels.",
      takeaway:
        story.matched_patterns?.length
          ? `Shared motifs: ${story.matched_patterns.join(", ")}.`
          : "Use this match to compare pacing, escalation, and emotional turns.",
    })),
    similarStories: stories.slice(2, 5).map((story) => ({
      title: story.title,
      medium: "graph reference",
      resonance:
        story.description ||
        "This work surfaced because its story logic resembles the outline's emerging pattern.",
      takeaway: "Compare how it manages payoff, secrecy, and irreversible decisions.",
    })),
    timelineWarnings:
      retrieval.timeline_warnings && retrieval.timeline_warnings.length > 0
        ? retrieval.timeline_warnings
        : [
            {
              label: "Knowledge order still fuzzy",
              detail:
                "The outline would benefit from naming when each major character learns the fact that changes their next decision.",
              severity: "low",
            },
          ],
    gentleQuestions: [
      {
        id: "fallback-q1",
        prompt:
          "Which decision in this outline most clearly changes the story's moral or emotional direction?",
      },
      {
        id: "fallback-q2",
        prompt:
          outlineLines.length > 2
            ? `What new pressure arrives after: "${outlineLines[Math.min(1, outlineLines.length - 1)]}"?`
            : "What new pressure should arrive immediately after the opening premise?",
      },
    ],
    retrievalNotes:
      retrieval.retrieval_notes && retrieval.retrieval_notes.length > 0
        ? retrieval.retrieval_notes
        : ["Fallback structural shaping used because live analyzer context was partial."],
    epistemicState: transformEpistemicState(retrieval.epistemic_state),
  };
}

function transformEpistemicState(
  raw?: RetrievalEpistemicState,
): EpistemicState | undefined {
  if (!raw) return undefined;

  return {
    characters: (raw.characters ?? []).map((c) => ({
      name: c.name,
      roleHint: c.role_hint ?? null,
    })),
    facts: (raw.facts ?? []).map((f) => ({
      description: f.description,
      introducedAtBeat: f.introduced_at_beat,
      knownBy: (f.known_by ?? []).map((e) => ({
        character: e.character,
        beatIndex: e.beat_index ?? f.introduced_at_beat,
      })),
      actedOnBy: (f.acted_on_by ?? []).map((e) => ({
        character: e.character,
        beatIndex: e.beat_index ?? f.introduced_at_beat,
      })),
    })),
    violations: (raw.violations ?? []).map((v) => ({
      character: v.character,
      fact: v.fact,
      actsAtBeat: v.acts_at_beat,
      severity: v.severity ?? "medium",
    })),
  };
}
