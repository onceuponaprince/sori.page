import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  MultiverseTimeline,
  buildColumns,
} from "@/components/timeline/MultiverseTimeline";
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

const sampleTree: TimelineTree = {
  rootUid: "root",
  nodes: {
    root: buildNode({
      uid: "root",
      type: "decision",
      summary: "Root scene",
      structuralPattern: "opening",
      confidence: 1,
    }),
    n1: buildNode({
      uid: "n1",
      type: "canon",
      summary: "Truth path",
      structuralPattern: "truth",
      confidence: 1,
    }),
    n2: buildNode({
      uid: "n2",
      type: "simulation",
      summary: "Lie path",
      structuralPattern: "deception",
      confidence: 0.4,
      hasParadox: true,
    }),
  },
  edges: [
    { uid: "e1", fromUid: "root", toUid: "n1", label: "tells truth", intent: "truth", order: 0 },
    { uid: "e2", fromUid: "root", toUid: "n2", label: "tells a lie", intent: "deception", order: 1 },
  ],
};

describe("MultiverseTimeline", () => {
  it("renders empty-state message when tree is null", () => {
    render(<MultiverseTimeline tree={null} activeUid={null} onNodeClick={() => {}} />);
    expect(screen.getByText(/No multiverse nodes yet/i)).toBeInTheDocument();
  });

  it("renders every node in the tree", () => {
    render(
      <MultiverseTimeline
        tree={sampleTree}
        activeUid={null}
        onNodeClick={() => {}}
      />,
    );
    expect(screen.getByText("Root scene")).toBeInTheDocument();
    expect(screen.getByText("Truth path")).toBeInTheDocument();
    expect(screen.getByText("Lie path")).toBeInTheDocument();
  });

  it("groups root in column 0 and children in column 1", () => {
    render(
      <MultiverseTimeline
        tree={sampleTree}
        activeUid={null}
        onNodeClick={() => {}}
      />,
    );
    const cols = document.querySelectorAll("[data-timeline-col]");
    expect(cols).toHaveLength(2);
    expect(cols[0].querySelectorAll("[data-node-uid]")).toHaveLength(1);
    expect(cols[1].querySelectorAll("[data-node-uid]")).toHaveLength(2);
  });

  it("renders the 'Simulate next beat' action at the end", () => {
    render(
      <MultiverseTimeline
        tree={sampleTree}
        activeUid={null}
        onNodeClick={() => {}}
        onSimulateNextBeat={() => {}}
      />,
    );
    expect(
      document.querySelector("[data-timeline-simulate-next]"),
    ).not.toBeNull();
    expect(screen.getByText(/Simulate next beat/i)).toBeInTheDocument();
  });

  it("calls onSimulateNextBeat when the action is clicked", () => {
    const onSimulateNextBeat = vi.fn();
    render(
      <MultiverseTimeline
        tree={sampleTree}
        activeUid={null}
        onNodeClick={() => {}}
        onSimulateNextBeat={onSimulateNextBeat}
      />,
    );
    screen.getByRole("button", { name: /Simulate next beat/i }).click();
    expect(onSimulateNextBeat).toHaveBeenCalledOnce();
  });
});

describe("buildColumns", () => {
  it("assigns nodes to depth-based columns", () => {
    const cols = buildColumns(sampleTree);
    expect(cols).toHaveLength(2);
    expect(cols[0].map((n) => n.uid)).toEqual(["root"]);
    expect(cols[1].map((n) => n.uid).sort()).toEqual(["n1", "n2"]);
  });

  it("skips orphan nodes not reachable from root", () => {
    const treeWithOrphan: TimelineTree = {
      rootUid: "root",
      nodes: {
        root: buildNode({ uid: "root" }),
        orphan: buildNode({ uid: "orphan", summary: "Unreachable" }),
      },
      edges: [],
    };
    const cols = buildColumns(treeWithOrphan);
    expect(cols).toHaveLength(1);
    expect(cols[0]).toHaveLength(1);
    expect(cols[0][0].uid).toBe("root");
  });

  it("handles a node appearing on multiple parent edges only once", () => {
    const diamondTree: TimelineTree = {
      rootUid: "root",
      nodes: {
        root: buildNode({ uid: "root" }),
        left: buildNode({ uid: "left" }),
        right: buildNode({ uid: "right" }),
        merge: buildNode({ uid: "merge" }),
      },
      edges: [
        { uid: "e1", fromUid: "root", toUid: "left", label: "l", intent: "truth", order: 0 },
        { uid: "e2", fromUid: "root", toUid: "right", label: "r", intent: "truth", order: 1 },
        { uid: "e3", fromUid: "left", toUid: "merge", label: "m1", intent: "truth", order: 0 },
        { uid: "e4", fromUid: "right", toUid: "merge", label: "m2", intent: "truth", order: 0 },
      ],
    };
    const cols = buildColumns(diamondTree);
    // merge should appear exactly once across all columns.
    const allUids = cols.flat().map((n) => n.uid);
    expect(allUids.filter((u) => u === "merge")).toHaveLength(1);
  });
});
