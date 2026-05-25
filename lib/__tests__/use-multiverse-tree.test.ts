/**
 * Pure unit tests for the canonical → timeline projection.
 *
 * The adapter is exposed via `projectMultiverseState` so we can test
 * the field-rename + edge-denormalisation logic without instantiating
 * the hook (which depends on Supabase auth and the multiverse state
 * machine).
 */

import { describe, it, expect } from "vitest";
import { projectMultiverseState } from "@/lib/use-multiverse-tree";
import type {
  ChoiceEdge,
  EpistemicProfile,
  MultiverseNode,
} from "@/types/multiverse";

const emptyProfiles: EpistemicProfile[] = [];

function buildNode(overrides: Partial<MultiverseNode> = {}): MultiverseNode {
  return {
    id: "n1",
    type: "simulation",
    sceneGoal: "Default goal",
    dialogueTurns: [],
    stateSnapshotId: "snap-1",
    activeCharacterIds: [],
    choices: [],
    metadata: {
      confidenceScore: 0.8,
      structuralPattern: null,
      isParadox: false,
      paradoxCount: 0,
    },
    epistemicProfiles: emptyProfiles,
    parentNodeId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function buildEdge(overrides: Partial<ChoiceEdge> = {}): ChoiceEdge {
  return {
    id: "e1",
    label: "Default label",
    targetNodeId: "n2",
    intent: "truth",
    relatedBeatId: null,
    ...overrides,
  };
}

describe("projectMultiverseState", () => {
  it("returns null when there is no root", () => {
    const tree = projectMultiverseState(
      { rootNodeId: "", nodes: {} },
      "story-1",
    );
    expect(tree).toBeNull();
  });

  it("renames canonical fields to plan-shaped fields", () => {
    const node = buildNode({
      id: "node-a",
      type: "canon",
      sceneGoal: "She opens the letter",
      metadata: {
        confidenceScore: 0.95,
        structuralPattern: "revelation",
        isParadox: false,
        paradoxCount: 0,
      },
    });

    const tree = projectMultiverseState(
      { rootNodeId: "node-a", nodes: { "node-a": node } },
      "story-1",
    );

    expect(tree).not.toBeNull();
    const projected = tree!.nodes["node-a"];
    expect(projected.uid).toBe("node-a");
    expect(projected.summary).toBe("She opens the letter");
    expect(projected.confidence).toBe(0.95);
    expect(projected.structuralPattern).toBe("revelation");
    expect(projected.hasParadox).toBe(false);
    expect(projected.storyUid).toBe("story-1");
    expect(projected.type).toBe("canon");
  });

  it("denormalises embedded choices into a flat edge array", () => {
    const root = buildNode({
      id: "root",
      choices: [
        buildEdge({ id: "e1", targetNodeId: "n1", label: "truth path", intent: "truth" }),
        buildEdge({ id: "e2", targetNodeId: "n2", label: "lie path", intent: "deception" }),
      ],
    });
    const n1 = buildNode({ id: "n1", parentNodeId: "root", type: "canon" });
    const n2 = buildNode({ id: "n2", parentNodeId: "root", type: "simulation" });

    const tree = projectMultiverseState(
      { rootNodeId: "root", nodes: { root, n1, n2 } },
      "story-1",
    );

    expect(tree!.edges).toHaveLength(2);
    expect(tree!.edges[0]).toEqual({
      uid: "e1",
      fromUid: "root",
      toUid: "n1",
      label: "truth path",
      intent: "truth",
      order: 0,
    });
    expect(tree!.edges[1].toUid).toBe("n2");
    expect(tree!.edges[1].order).toBe(1);
  });

  it("skips choices that have no resolved target", () => {
    const root = buildNode({
      id: "root",
      choices: [
        buildEdge({ id: "e1", targetNodeId: "" }), // unresolved
        buildEdge({ id: "e2", targetNodeId: "n1" }),
      ],
    });
    const n1 = buildNode({ id: "n1" });

    const tree = projectMultiverseState(
      { rootNodeId: "root", nodes: { root, n1 } },
      "story-1",
    );

    expect(tree!.edges).toHaveLength(1);
    expect(tree!.edges[0].uid).toBe("e2");
  });

  it("propagates epistemicProfiles unchanged", () => {
    const profiles: EpistemicProfile[] = [
      {
        characterId: "c1",
        characterName: "Maya",
        roleHint: null,
        characterBio: "",
        knownFacts: [],
        unknownFacts: [],
      },
      {
        characterId: "c2",
        characterName: "Elias",
        roleHint: null,
        characterBio: "",
        knownFacts: [],
        unknownFacts: [],
      },
    ];
    const node = buildNode({ id: "n1", epistemicProfiles: profiles });

    const tree = projectMultiverseState(
      { rootNodeId: "n1", nodes: { n1: node } },
      "story-1",
    );

    expect(tree!.nodes.n1.epistemicProfiles).toHaveLength(2);
    expect(tree!.nodes.n1.epistemicProfiles[0].characterName).toBe("Maya");
  });
});
