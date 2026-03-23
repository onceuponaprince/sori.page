/**
 * MultiverseTree — Branching node visualization for the Multiverse Sidebar.
 *
 * This component renders the multiverse as a vertical tree where each
 * node is a simulation round or decision point. Branches fan downward
 * from decision nodes, showing the different paths the writer has explored.
 *
 * VISUAL DESIGN
 * ─────────────
 * - Nodes are compact cards with the scene goal as label
 * - Active node has a highlighted border
 * - Canon nodes have a gold accent
 * - Paradox nodes have a red accent
 * - Connecting lines are SVG paths that animate in (branchDraw preset)
 * - The tree uses Framer Motion's layout animations so nodes smoothly
 *   reposition when siblings are added
 *
 * LAYOUT ALGORITHM
 * ────────────────
 * We use a simple vertical tree layout:
 * - Root at the top
 * - Each level is one simulation/decision depth
 * - Children are spaced horizontally within their parent's column
 *
 * This is a v1 layout. Future versions could use a force-directed graph
 * or dagre for more complex topologies.
 *
 * INTERACTION
 * ───────────
 * - Click a node → navigateTo(nodeId) — loads that node's dialogue
 * - Hover a node → shows the scene goal tooltip
 * - Click a choice card → selectChoice() — creates a new branch
 */

"use client";

import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { multiverseMotion } from "@/lib/sori-motion";
import type {
  MultiverseNode,
  MultiverseState,
  ChoiceEdge,
  ChoiceIntent,
  UITreeNodeLayout,
} from "@/types/multiverse";

// ============================================================
// PROPS
// ============================================================

interface MultiverseTreeProps {
  /** The full multiverse state from useMultiverse() */
  state: MultiverseState;

  /** Called when the writer clicks a node to view its dialogue */
  onNodeSelect: (nodeId: string) => void;

  /**
   * Called when the writer selects a choice at a decision point.
   * Triggers branch creation and navigation to the new node.
   */
  onChoiceSelect: (label: string, intent: ChoiceIntent) => void;
}

// ============================================================
// LAYOUT CONSTANTS
// ============================================================

/**
 * Horizontal spacing between sibling nodes (in pixels).
 * Controls how wide the tree spreads at each level.
 */
const NODE_HORIZONTAL_GAP = 140;

/**
 * Vertical spacing between tree levels (in pixels).
 * Controls how tall the tree grows per depth level.
 */
const NODE_VERTICAL_GAP = 90;

/**
 * Width of each node card (in pixels).
 * Used for centering calculations.
 */
const NODE_WIDTH = 120;

/**
 * Height of each node card (in pixels).
 * Used for line drawing calculations.
 */
const NODE_HEIGHT = 56;


// ============================================================
// TREE LAYOUT COMPUTATION
// ============================================================

/**
 * Compute the spatial layout of all nodes in the tree.
 *
 * This function takes the flat node map and produces positioned
 * UITreeNodeLayout objects for rendering. It's a simple recursive
 * layout that:
 * 1. Finds the root node
 * 2. Assigns depths via BFS
 * 3. Spreads siblings horizontally at each depth level
 *
 * The result is memoized in the component to avoid recalculating
 * on every render (only recomputes when the node map changes).
 *
 * @param nodes - The node map from MultiverseState
 * @param rootNodeId - The root node ID
 * @param activeNodeId - The currently selected node
 * @returns Array of positioned nodes for rendering
 */
function computeTreeLayout(
  nodes: Record<string, MultiverseNode>,
  rootNodeId: string,
  activeNodeId: string,
): UITreeNodeLayout[] {
  if (!rootNodeId || !nodes[rootNodeId]) return [];

  // Build the active path (root → active node) for highlighting.
  const activePath = new Set<string>();
  let walkId: string | null = activeNodeId;
  while (walkId) {
    activePath.add(walkId);
    walkId = nodes[walkId]?.parentNodeId ?? null;
  }

  // BFS to assign depths and collect children per node.
  const layouts: UITreeNodeLayout[] = [];
  const childrenByDepth: Map<number, string[]> = new Map();

  const queue: Array<{ nodeId: string; depth: number }> = [
    { nodeId: rootNodeId, depth: 0 },
  ];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const { nodeId, depth } = queue.shift()!;
    if (visited.has(nodeId)) continue;
    visited.add(nodeId);

    // Track nodes at each depth level for horizontal spacing.
    if (!childrenByDepth.has(depth)) {
      childrenByDepth.set(depth, []);
    }
    childrenByDepth.get(depth)!.push(nodeId);

    // Find children: nodes whose parentNodeId is this node.
    const children = Object.values(nodes).filter(
      (n) => n.parentNodeId === nodeId
    );

    for (const child of children) {
      queue.push({ nodeId: child.id, depth: depth + 1 });
    }
  }

  // Assign x, y positions based on depth and sibling index.
  for (const [depth, nodeIds] of childrenByDepth) {
    const totalWidth = (nodeIds.length - 1) * NODE_HORIZONTAL_GAP;
    const startX = -totalWidth / 2;

    for (let i = 0; i < nodeIds.length; i++) {
      const nodeId = nodeIds[i];
      const node = nodes[nodeId];
      if (!node) continue;

      layouts.push({
        node,
        x: startX + i * NODE_HORIZONTAL_GAP,
        y: depth * NODE_VERTICAL_GAP,
        depth,
        isOnActivePath: activePath.has(nodeId),
        isActive: nodeId === activeNodeId,
      });
    }
  }

  return layouts;
}


// ============================================================
// COMPONENT
// ============================================================

export function MultiverseTree({
  state,
  onNodeSelect,
  onChoiceSelect,
}: MultiverseTreeProps) {
  // Memoize the tree layout to avoid O(n) recomputation on every render.
  // Only recalculates when the node map, root, or active node changes.
  const layouts = useMemo(
    () =>
      computeTreeLayout(
        state.nodes,
        state.rootNodeId,
        state.activeNodeId,
      ),
    [state.nodes, state.rootNodeId, state.activeNodeId],
  );

  // Calculate SVG viewBox dimensions to contain all nodes.
  const minX = Math.min(...layouts.map((l) => l.x), 0) - NODE_WIDTH;
  const maxX = Math.max(...layouts.map((l) => l.x), 0) + NODE_WIDTH * 2;
  const maxY = Math.max(...layouts.map((l) => l.y), 0) + NODE_HEIGHT * 2;
  const viewBoxWidth = maxX - minX + NODE_WIDTH;
  const viewBoxHeight = maxY + NODE_VERTICAL_GAP;

  // Get the active node for choice rendering.
  const activeNode = state.activeNodeId
    ? state.nodes[state.activeNodeId]
    : null;

  if (layouts.length === 0) {
    return (
      <div className="flex items-center justify-center px-4 py-8">
        <p className="text-center text-sm text-[var(--sori-text-muted)]">
          No branches yet. Start a simulation to grow the multiverse tree.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* ── Tree Visualization ── */}
      <div className="hide-scrollbar overflow-x-auto px-2">
        <svg
          viewBox={`${minX} -10 ${viewBoxWidth} ${viewBoxHeight}`}
          className="mx-auto w-full"
          style={{ minHeight: `${Math.min(viewBoxHeight, 400)}px` }}
        >
          {/* Render connecting lines first (below nodes) */}
          {layouts.map((layout) => {
            if (!layout.node.parentNodeId) return null;
            const parentLayout = layouts.find(
              (l) => l.node.id === layout.node.parentNodeId
            );
            if (!parentLayout) return null;

            return (
              <BranchLine
                key={`line-${layout.node.id}`}
                fromX={parentLayout.x + NODE_WIDTH / 2}
                fromY={parentLayout.y + NODE_HEIGHT}
                toX={layout.x + NODE_WIDTH / 2}
                toY={layout.y}
                isOnActivePath={
                  layout.isOnActivePath && parentLayout.isOnActivePath
                }
              />
            );
          })}

          {/* Render nodes */}
          {layouts.map((layout) => (
            <TreeNode
              key={layout.node.id}
              layout={layout}
              onSelect={() => onNodeSelect(layout.node.id)}
            />
          ))}
        </svg>
      </div>

      {/* ── Choice Cards (below the tree) ── */}
      {activeNode && activeNode.choices.length > 0 && (
        <div className="px-4">
          <p className="sori-kicker mb-2 text-[10px]">available branches</p>
          <div className="space-y-2">
            {activeNode.choices.map((choice) => (
              <ChoiceCard
                key={choice.id}
                choice={choice}
                onSelect={() =>
                  onChoiceSelect(choice.label, choice.intent as ChoiceIntent)
                }
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


// ============================================================
// TREE NODE — SVG card for a single node
// ============================================================

/**
 * Renders a single node in the SVG tree.
 *
 * Node types have different visual treatments:
 * - simulation → neutral border, teal accent
 * - decision   → dotted border, amber accent
 * - canon      → solid gold border + glow
 * - paradox    → red border + pulse
 */
function TreeNode({
  layout,
  onSelect,
}: {
  layout: UITreeNodeLayout;
  onSelect: () => void;
}) {
  const { node, x, y, isActive } = layout;

  // Determine border color based on node state.
  const borderColor = node.metadata.isParadox
    ? "oklch(0.62 0.185 26)" // destructive
    : node.type === "canon"
      ? "oklch(0.82 0.1 78)" // gold (sori-accent-amber)
      : isActive
        ? "oklch(0.68 0.158 33)" // primary (sori-accent-coral)
        : "oklch(0.885 0.018 78)"; // border default

  // Determine fill color.
  const fillColor = isActive
    ? "oklch(0.995 0.004 82 / 0.98)"
    : "oklch(0.993 0.006 84 / 0.92)";

  // Truncate the scene goal for the node label.
  const label =
    node.sceneGoal.length > 18
      ? node.sceneGoal.slice(0, 18) + "…"
      : node.sceneGoal;

  // Node type indicator.
  const typeLabel =
    node.type === "canon"
      ? "✦"
      : node.type === "decision"
        ? "◇"
        : "○";

  return (
    <g
      onClick={onSelect}
      style={{ cursor: "pointer" }}
    >
      <rect
        x={x}
        y={y}
        width={NODE_WIDTH}
        height={NODE_HEIGHT}
        rx={12}
        fill={fillColor}
        stroke={borderColor}
        strokeWidth={isActive ? 2 : 1}
        strokeDasharray={node.type === "decision" ? "4 3" : undefined}
      />

      {/* Type indicator (top-left) */}
      <text
        x={x + 8}
        y={y + 14}
        fontSize={10}
        fill={borderColor}
      >
        {typeLabel}
      </text>

      {/* Scene goal label */}
      <text
        x={x + NODE_WIDTH / 2}
        y={y + NODE_HEIGHT / 2 + 2}
        textAnchor="middle"
        fontSize={10}
        fill="oklch(0.282 0.03 42)"
        fontFamily="var(--font-body)"
      >
        {label}
      </text>

      {/* Confidence score (bottom-right) */}
      <text
        x={x + NODE_WIDTH - 8}
        y={y + NODE_HEIGHT - 8}
        textAnchor="end"
        fontSize={8}
        fill="oklch(0.57 0.025 55)"
        fontFamily="var(--font-mono)"
      >
        {Math.round(node.metadata.confidenceScore * 100)}%
      </text>

      {/* Paradox badge */}
      {node.metadata.isParadox && (
        <circle
          cx={x + NODE_WIDTH - 6}
          cy={y + 6}
          r={4}
          fill="oklch(0.62 0.185 26)"
        />
      )}
    </g>
  );
}


// ============================================================
// BRANCH LINE — SVG path connecting parent to child
// ============================================================

/**
 * Draws a curved line from a parent node to a child node.
 *
 * Uses a cubic bezier curve that drops straight down from the parent,
 * then curves horizontally to reach the child. This creates a clean
 * "dripping" branch aesthetic.
 *
 * The line animates in using the branchDraw preset (pathLength animation).
 */
function BranchLine({
  fromX,
  fromY,
  toX,
  toY,
  isOnActivePath,
}: {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  isOnActivePath: boolean;
}) {
  // Compute the cubic bezier control points.
  // The midY ensures the curve has a nice vertical drop before
  // curving horizontally.
  const midY = fromY + (toY - fromY) * 0.5;

  const d = `M ${fromX} ${fromY} C ${fromX} ${midY}, ${toX} ${midY}, ${toX} ${toY}`;

  return (
    <motion.path
      d={d}
      fill="none"
      stroke={
        isOnActivePath
          ? "oklch(0.68 0.158 33 / 0.6)" // primary, semi-transparent
          : "oklch(0.885 0.018 78 / 0.5)" // border, lighter
      }
      strokeWidth={isOnActivePath ? 2 : 1}
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{ pathLength: 1, opacity: 1 }}
      transition={{
        pathLength: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
        opacity: { duration: 0.15 },
      }}
    />
  );
}


// ============================================================
// CHOICE CARD — Clickable branch option
// ============================================================

/**
 * A card representing one available choice at a decision point.
 *
 * Shows the choice label, the intent badge, and lifts on hover
 * using the choiceHover animation preset.
 */
function ChoiceCard({
  choice,
  onSelect,
}: {
  choice: ChoiceEdge;
  onSelect: () => void;
}) {
  // Map intent values to display colors.
  const intentColors: Record<string, string> = {
    deception: "var(--sori-accent-lavender)",
    confrontation: "var(--sori-accent-coral)",
    avoidance: "var(--sori-accent-sky)",
    truth: "var(--sori-accent-sage)",
    discovery: "var(--sori-accent-amber)",
    sacrifice: "var(--sori-accent-coral)",
  };

  const intentColor = intentColors[choice.intent] || "var(--sori-text-muted)";

  return (
    <motion.button
      onClick={onSelect}
      {...multiverseMotion.choiceHover}
      className="w-full rounded-[1rem] border border-[var(--sori-border)] bg-[var(--sori-bg-surface)] p-3 text-left transition-colors hover:border-[var(--sori-accent-coral)]/30"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="m-0 flex-1 text-sm text-[var(--sori-text-primary)]">
          {choice.label}
        </p>
        <span
          className="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.14em]"
          style={{
            color: intentColor,
            backgroundColor: `color-mix(in oklch, ${intentColor} 12%, transparent)`,
          }}
        >
          {choice.intent}
        </span>
      </div>
    </motion.button>
  );
}
