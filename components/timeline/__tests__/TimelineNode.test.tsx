import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TimelineNode } from "@/components/timeline/TimelineNode";
import type { TimelineNodeData } from "@/types/timeline";

function buildNode(overrides: Partial<TimelineNodeData> = {}): TimelineNodeData {
  return {
    uid: "n1",
    type: "canon",
    summary: "She finds the letter",
    structuralPattern: "Revelation",
    confidence: 0.9,
    hasParadox: false,
    dialogueTurns: [],
    storyUid: "story-abc",
    epistemicProfiles: [],
    ...overrides,
  };
}

const canon = buildNode();
const explored = buildNode({
  uid: "n2",
  type: "simulation",
  summary: "She stays silent",
  structuralPattern: "Avoidance",
  confidence: 0.4,
  hasParadox: true,
});

describe("TimelineNode", () => {
  it("renders the beat summary", () => {
    render(<TimelineNode node={canon} isActive={false} onClick={vi.fn()} />);
    expect(screen.getByText("She finds the letter")).toBeInTheDocument();
  });

  it("renders the structural pattern chip", () => {
    render(<TimelineNode node={canon} isActive={false} onClick={vi.fn()} />);
    expect(screen.getByText("Revelation")).toBeInTheDocument();
  });

  it("does not call onClick when the node is canon", () => {
    const onClick = vi.fn();
    const { container } = render(
      <TimelineNode node={canon} isActive={false} onClick={onClick} />,
    );
    const card = container.querySelector('[data-node-uid="n1"]');
    expect(card).not.toBeNull();
    fireEvent.click(card!);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("calls onClick with the node on non-canon click", () => {
    const onClick = vi.fn();
    const { container } = render(
      <TimelineNode node={explored} isActive={false} onClick={onClick} />,
    );
    const card = container.querySelector('[data-node-uid="n2"]');
    expect(card).not.toBeNull();
    fireEvent.click(card!);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onClick).toHaveBeenCalledWith(explored);
  });

  it("shows the paradox badge when hasParadox is true", () => {
    render(
      <TimelineNode node={explored} isActive={false} onClick={vi.fn()} />,
    );
    expect(screen.getByText("⚠ paradox")).toBeInTheDocument();
  });

  it("renders exactly 5 pips with Math.round(confidence*5) filled", () => {
    render(<TimelineNode node={canon} isActive={false} onClick={vi.fn()} />);
    const pips = document.querySelectorAll("[data-pip]");
    expect(pips).toHaveLength(5);
    // 0.9 * 5 = 4.5 → Math.round → 5 filled
    expect(document.querySelectorAll('[data-pip="filled"]')).toHaveLength(5);
  });

  it("renders 2 filled pips for confidence=0.4", () => {
    render(
      <TimelineNode node={explored} isActive={false} onClick={vi.fn()} />,
    );
    // 0.4 * 5 = 2.0 → Math.round → 2 filled
    expect(document.querySelectorAll('[data-pip="filled"]')).toHaveLength(2);
    expect(document.querySelectorAll('[data-pip="empty"]')).toHaveLength(3);
  });

  it("clamps confidence above 1 and below 0", () => {
    const { rerender } = render(
      <TimelineNode
        node={buildNode({ uid: "over", confidence: 1.5 })}
        isActive={false}
        onClick={vi.fn()}
      />,
    );
    expect(document.querySelectorAll('[data-pip="filled"]')).toHaveLength(5);

    rerender(
      <TimelineNode
        node={buildNode({ uid: "under", confidence: -0.2 })}
        isActive={false}
        onClick={vi.fn()}
      />,
    );
    expect(document.querySelectorAll('[data-pip="filled"]')).toHaveLength(0);
  });
});
