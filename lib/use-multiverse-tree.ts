"use client";

/**
 * useMultiverseTree() — adapter hook that projects the canonical
 * `MultiverseState` (flat nodes + embedded choices) into the timeline
 * view's preferred graph shape (`{rootUid, nodes, edges}`).
 *
 * The MultiverseTimeline / TimelineNode / TimelineEdge components live
 * on this projection so they stay decoupled from the underlying state
 * machine. Adding new fields to `MultiverseNode` does NOT require a
 * timeline rewrite — only the adapter changes.
 *
 * The adapter is intentionally a thin wrapper around `useMultiverse`
 * so it inherits its loading, error, and navigation surface. We do
 * NOT instantiate a second copy of the state machine.
 */

import { useMemo } from "react";
import { useMultiverse } from "@/lib/use-multiverse";
import type { MultiverseNode } from "@/types/multiverse";
import type {
  TimelineEdgeData,
  TimelineNodeData,
  TimelineTree,
} from "@/types/timeline";

interface UseMultiverseTreeOptions {
  storyUid: string;
}

export interface UseMultiverseTreeReturn {
  /** The projected tree, or null when the underlying state is empty. */
  tree: TimelineTree | null;

  /** The currently active node UID (may be "" before first load). */
  activeUid: string;

  /** True while the backend is simulating or branching. */
  loading: boolean;

  /** Latest error from the underlying hook, if any. */
  error: string | null;

  /** Pass-through navigation so the timeline can set the active node. */
  navigateTo: (uid: string) => void;
}

function projectNode(node: MultiverseNode, storyUid: string): TimelineNodeData {
  return {
    uid: node.id,
    type: node.type,
    summary: node.sceneGoal,
    structuralPattern: node.metadata.structuralPattern,
    confidence: node.metadata.confidenceScore,
    hasParadox: node.metadata.isParadox,
    dialogueTurns: node.dialogueTurns,
    storyUid,
    epistemicProfiles: node.epistemicProfiles,
  };
}

function collectEdges(node: MultiverseNode): TimelineEdgeData[] {
  const edges: TimelineEdgeData[] = [];
  node.choices.forEach((choice, idx) => {
    if (!choice.targetNodeId) return;
    edges.push({
      uid: choice.id,
      fromUid: node.id,
      toUid: choice.targetNodeId,
      label: choice.label,
      intent: choice.intent,
      order: idx,
    });
  });
  return edges;
}

export function projectMultiverseState(
  state: {
    rootNodeId: string;
    nodes: Record<string, MultiverseNode>;
  },
  storyUid: string,
): TimelineTree | null {
  if (!state.rootNodeId) return null;
  if (Object.keys(state.nodes).length === 0) return null;

  const nodes: Record<string, TimelineNodeData> = {};
  const edges: TimelineEdgeData[] = [];

  Object.values(state.nodes).forEach((node) => {
    nodes[node.id] = projectNode(node, storyUid);
    edges.push(...collectEdges(node));
  });

  return {
    rootUid: state.rootNodeId,
    nodes,
    edges,
  };
}

export function useMultiverseTree({
  storyUid,
}: UseMultiverseTreeOptions): UseMultiverseTreeReturn {
  const multiverse = useMultiverse({ storyUid });

  const tree = useMemo(
    () => projectMultiverseState(multiverse.state, storyUid),
    [multiverse.state, storyUid],
  );

  return {
    tree,
    activeUid: multiverse.state.activeNodeId,
    loading: multiverse.state.isSimulating || multiverse.state.isBranching,
    error: multiverse.state.error,
    navigateTo: multiverse.navigateTo,
  };
}
