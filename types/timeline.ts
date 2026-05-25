/**
 * types/timeline.ts — Plan-shaped view model for the Multiverse Timeline.
 *
 * The canonical state shape lives in `types/multiverse.ts` (flat
 * `MultiverseState` with edges embedded as `node.choices`). The
 * Multiverse Timeline plan describes a graph-shaped projection
 * (`{rootUid, nodes, edges}`) that is more convenient for layout and
 * SVG rendering.
 *
 * Rather than reshape the underlying state machine, this module
 * defines a thin adapter projection. The `useMultiverseTree` hook
 * (lib/use-multiverse-tree.ts) is the only producer of these types.
 *
 * Field rename map (canonical → projection):
 *   MultiverseNode.id                          → TimelineNodeData.uid
 *   MultiverseNode.sceneGoal                   → TimelineNodeData.summary
 *   MultiverseNode.metadata.structuralPattern  → TimelineNodeData.structuralPattern
 *   MultiverseNode.metadata.confidenceScore    → TimelineNodeData.confidence
 *   MultiverseNode.metadata.isParadox          → TimelineNodeData.hasParadox
 *   MultiverseNode.choices[i]                  → TimelineEdgeData (denormalised)
 */

import type {
  ChoiceIntent,
  DialogueTurn,
  EpistemicProfile,
} from "@/types/multiverse";

export interface TimelineNodeData {
  /** Stable identifier; matches MultiverseNode.id. */
  uid: string;

  type: "simulation" | "decision" | "canon";

  /** Human-readable label rendered in the timeline card. */
  summary: string;

  /** Optional narrative pattern; null when the backend could not classify. */
  structuralPattern: string | null;

  /** 0..1 confidence pip score. */
  confidence: number;

  /** Surfaces the paradox badge when true. */
  hasParadox: boolean;

  /** Pulled through for tooltip / Oracle preview rendering. */
  dialogueTurns: DialogueTurn[];

  /** Story UID is duplicated onto every node so consumers can navigate. */
  storyUid: string;

  /** Pair of profiles cached at simulation time; empty until a run lands. */
  epistemicProfiles: EpistemicProfile[];
}

export interface TimelineEdgeData {
  uid: string;
  fromUid: string;
  toUid: string;
  label: string;
  intent: ChoiceIntent;
  order: number;
}

export interface TimelineTree {
  rootUid: string;
  nodes: Record<string, TimelineNodeData>;
  edges: TimelineEdgeData[];
}
