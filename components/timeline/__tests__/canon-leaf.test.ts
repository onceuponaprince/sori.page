import { describe, it, expect } from "vitest";
import { findCanonLeaf, suggestNextBeatGoal } from "@/components/timeline/canon-leaf";
import type { TimelineNodeData, TimelineTree } from "@/types/timeline";

function buildNode(overrides: Partial<TimelineNodeData> = {}): TimelineNodeData {
  return {
    uid: "n",
    type: "simulation",
    summary: "summary",
    structuralPattern: null,
    confidence: 0.8,
    hasParadox: false,
    dialogueTurns: [],
    storyUid: "s1",
    epistemicProfiles: [],
    ...overrides,
  };
}

describe("findCanonLeaf", () => {
  it("follows the canon path to the deepest canon node", () => {
    const tree: TimelineTree = {
      rootUid: "root",
      nodes: {
        root: buildNode({ uid: "root", type: "decision", summary: "Opening" }),
        truth: buildNode({ uid: "truth", type: "canon", summary: "Truth" }),
        lie: buildNode({ uid: "lie", type: "simulation", summary: "Lie" }),
        aftermath: buildNode({ uid: "aftermath", type: "canon", summary: "Aftermath" }),
      },
      edges: [
        { uid: "e1", fromUid: "root", toUid: "truth", label: "truth", intent: "truth", order: 0 },
        { uid: "e2", fromUid: "root", toUid: "lie", label: "lie", intent: "deception", order: 1 },
        { uid: "e3", fromUid: "truth", toUid: "aftermath", label: "next", intent: "truth", order: 0 },
      ],
    };

    expect(findCanonLeaf(tree).uid).toBe("aftermath");
  });

  it("returns root when no canon nodes exist", () => {
    const tree: TimelineTree = {
      rootUid: "root",
      nodes: {
        root: buildNode({ uid: "root", type: "decision", summary: "Opening" }),
      },
      edges: [],
    };

    expect(findCanonLeaf(tree).uid).toBe("root");
  });
});

describe("suggestNextBeatGoal", () => {
  it("builds a continuation prompt from the leaf summary", () => {
    const leaf = buildNode({ summary: "She opens the letter" });
    expect(suggestNextBeatGoal(leaf)).toBe(
      'What happens next after "She opens the letter"?',
    );
  });
});
