import type {
  ChoiceEdge,
  MultiverseNode,
  MultiverseState,
} from "@/types/multiverse";

/**
 * Creates the minimal valid {@link MultiverseState} pointing at an existing root id.
 * Use when hydrating from the server or after {@link createSeedMultiverseTree}.
 */
export function createMultiverseState(rootNodeId: string): MultiverseState {
  return {
    rootNodeId,
    activeNodeId: rootNodeId,
    history: [rootNodeId],
    isSimulating: false,
  };
}

/**
 * Returns a new state with `activeNodeId` moved along the chosen edge.
 * If the choice id is unknown or the target node is missing, returns the original state.
 */
export function applyChoice(
  state: MultiverseState,
  nodes: Record<string, MultiverseNode>,
  choiceId: string,
): MultiverseState {
  const current = nodes[state.activeNodeId];
  if (!current) {
    return state;
  }

  const edge = current.choices.find((c) => c.id === choiceId);
  if (!edge || !nodes[edge.targetNodeId]) {
    return state;
  }

  return {
    ...state,
    activeNodeId: edge.targetNodeId,
    history: [...state.history, edge.targetNodeId],
  };
}

/**
 * Walks parent links implicitly via `history`: returns nodes from root → active.
 * Useful for rendering breadcrumbs or a vertical timeline in the Oracle view.
 */
export function nodesAlongHistory(
  state: MultiverseState,
  nodes: Record<string, MultiverseNode>,
): MultiverseNode[] {
  return state.history
    .map((id) => nodes[id])
    .filter((n): n is MultiverseNode => Boolean(n));
}

/**
 * Marks a node as canon in-memory (UI badge). Persisting to Neo4j/editor is a
 * separate pipeline step (Django BranchManager).
 */
export function markNodeCanon(node: MultiverseNode): MultiverseNode {
  return {
    ...node,
    type: "canon",
    metadata: { ...node.metadata, isParadox: node.metadata.isParadox },
  };
}

/**
 * Builds the payload writers see in the structural sidebar / beat insertion flow.
 * This is **metadata only** — it does not ghostwrite novel prose.
 */
export function buildBranchToBeatSummary(params: {
  choice: ChoiceEdge;
  node: MultiverseNode;
}): { headline: string; body: string } {
  return {
    headline: `Branch: ${params.choice.label}`,
    body: params.node.content,
  };
}

/**
 * **Study / dev stub** for “Structural Paradox” detection.
 *
 * Production path: Django compares agent output against Neo4j KNOWS_ABOUT and a
 * forbidden set; may use a small classifier or LLM judge. Here we only do a
 * naive substring check so the UI can demonstrate the flag.
 */
export function naiveParadoxScan(text: string, doesNotKnow: string[]): string[] {
  const lower = text.toLowerCase();
  const hits: string[] = [];
  for (const secret of doesNotKnow) {
    const s = secret.trim();
    if (s.length > 2 && lower.includes(s.toLowerCase())) {
      hits.push(s);
    }
  }
  return hits;
}

/**
 * Seeds a tiny demo tree so the Multiverse lab is usable before Celery/Neo4j
 * wiring. Replace `stateSnapshotId` values with real IDs from the graph API.
 */
export function createSeedMultiverseTree(sceneGoal: string): {
  nodes: Record<string, MultiverseNode>;
  state: MultiverseState;
} {
  const snapshotRoot = "snap-seed-root";
  const snapshotA = "snap-seed-a";
  const snapshotB = "snap-seed-b";

  const rootId = "node-root";
  const branchSuccessId = "node-success";
  const branchFailId = "node-caught";

  const root: MultiverseNode = {
    id: rootId,
    type: "decision",
    content:
      `Scene goal: ${sceneGoal}\n\n` +
      "[Lab] Decision point reached after the first exchange. Pick a branch to stress-test causality.",
    stateSnapshotId: snapshotRoot,
    choices: [
      {
        id: "choice-success",
        label: "Maya succeeds — lifts the key unseen",
        targetNodeId: branchSuccessId,
        intent: "avoidance",
      },
      {
        id: "choice-caught",
        label: "Elias catches the motion",
        targetNodeId: branchFailId,
        intent: "confrontation",
      },
    ],
    metadata: {
      confidenceScore: 0.72,
      structuralPattern: "Rising Action",
      isParadox: false,
    },
  };

  const success: MultiverseNode = {
    id: branchSuccessId,
    type: "simulation",
    content:
      "Maya: (barely breathing) I'll trade you a story for that cup.\n" +
      "Elias: You always think you can talk your way through a locked door.\n" +
      "[Outcome] The key slides — knowledge of the hiding place stays with Maya only.",
    stateSnapshotId: snapshotA,
    activeCharacterId: "char-maya",
    choices: [],
    metadata: {
      confidenceScore: 0.81,
      isParadox: false,
    },
  };

  const caught: MultiverseNode = {
    id: branchFailId,
    type: "simulation",
    content:
      "Elias: Your hand moved toward my pocket. Try that again and we're done pretending.\n" +
      "Maya: I was reaching for the railing.\n" +
      "[Outcome] Trust fractures; Elias now suspects intent.",
    stateSnapshotId: snapshotB,
    activeCharacterId: "char-elias",
    choices: [],
    metadata: {
      confidenceScore: 0.77,
      isParadox: false,
    },
  };

  const nodes: Record<string, MultiverseNode> = {
    [rootId]: root,
    [branchSuccessId]: success,
    [branchFailId]: caught,
  };

  return { nodes, state: createMultiverseState(rootId) };
}
