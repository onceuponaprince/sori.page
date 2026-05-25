/**
 * Reducer unit tests for the epistemic-profile propagation contract.
 *
 * Verifies that when the backend emits `epistemicProfiles` on a
 * MultiverseNode (via SIMULATION_COMPLETE or INIT_TREE), the reducer
 * stores them on the node so MultiverseSidebar can derive its
 * `profiles` prop without ever falling back to the hardcoded null.
 */

import { describe, it, expect } from "vitest";
import { multiverseReducer, createInitialState } from "@/lib/use-multiverse";
import type { EpistemicProfile, MultiverseNode } from "@/types/multiverse";

const maya: EpistemicProfile = {
  characterId: "char-maya",
  characterName: "Maya",
  roleHint: "protagonist",
  characterBio: "Maya — protagonist",
  knownFacts: [
    { factNodeId: "f1", description: "The letter is hidden", learnedAtBeat: 0 },
  ],
  unknownFacts: [
    { factNodeId: "f2", description: "Elias is her cousin", learnedAtBeat: null },
  ],
};

const elias: EpistemicProfile = {
  characterId: "char-elias",
  characterName: "Elias",
  roleHint: "foil",
  characterBio: "Elias — foil",
  knownFacts: [
    { factNodeId: "f2", description: "Elias is her cousin", learnedAtBeat: 0 },
  ],
  unknownFacts: [
    { factNodeId: "f1", description: "The letter is hidden", learnedAtBeat: null },
  ],
};

function buildNode(overrides: Partial<MultiverseNode> = {}): MultiverseNode {
  return {
    id: "n1",
    type: "simulation",
    sceneGoal: "Maya confronts Elias",
    dialogueTurns: [],
    stateSnapshotId: "snap-1",
    activeCharacterIds: ["char-maya", "char-elias"],
    choices: [],
    metadata: {
      confidenceScore: 0.9,
      structuralPattern: null,
      isParadox: false,
      paradoxCount: 0,
    },
    epistemicProfiles: [maya, elias],
    parentNodeId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("multiverseReducer epistemic-profile propagation", () => {
  it("SIMULATION_COMPLETE stores the node with its profiles", () => {
    const initial = createInitialState();
    const node = buildNode();

    const next = multiverseReducer(initial, {
      type: "SIMULATION_COMPLETE",
      payload: { node },
    });

    expect(next.nodes[node.id]).toBeDefined();
    expect(next.nodes[node.id].epistemicProfiles).toHaveLength(2);
    expect(next.nodes[node.id].epistemicProfiles[0].characterId).toBe("char-maya");
    expect(next.nodes[node.id].epistemicProfiles[1].characterId).toBe("char-elias");
  });

  it("INIT_TREE preserves epistemicProfiles on every node", () => {
    const initial = createInitialState();
    const root = buildNode({ id: "root" });
    const leaf = buildNode({ id: "leaf", parentNodeId: "root", epistemicProfiles: [] });

    const next = multiverseReducer(initial, {
      type: "INIT_TREE",
      payload: {
        rootNodeId: "root",
        nodes: { root, leaf },
      },
    });

    expect(next.nodes.root.epistemicProfiles).toHaveLength(2);
    expect(next.nodes.leaf.epistemicProfiles).toHaveLength(0);
  });

  it("decision-only nodes can carry an empty profiles array", () => {
    const initial = createInitialState();
    const decision = buildNode({
      id: "d1",
      type: "decision",
      dialogueTurns: [],
      epistemicProfiles: [],
    });

    const next = multiverseReducer(initial, {
      type: "SIMULATION_COMPLETE",
      payload: { node: decision },
    });

    expect(next.nodes.d1.epistemicProfiles).toEqual([]);
  });
});
