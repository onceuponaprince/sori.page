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

interface MultiverseTreeProps {
  state: MultiverseState;
  onNodeSelect: (nodeId: string) => void;
  onChoiceSelect: (label: string, intent: ChoiceIntent) => void;
}

const NODE_HORIZONTAL_GAP = 140;
const NODE_VERTICAL_GAP = 90;
const NODE_WIDTH = 120;
const NODE_HEIGHT = 56;

function computeTreeLayout(
  nodes: Record<string, MultiverseNode>,
  rootNodeId: string,
  activeNodeId: string,
): UITreeNodeLayout[] {
  if (!rootNodeId || !nodes[rootNodeId]) return [];

  const activePath = new Set<string>();
  let walkId: string | null = activeNodeId;
  while (walkId) {
    activePath.add(walkId);
    walkId = nodes[walkId]?.parentNodeId ?? null;
  }

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

    if (!childrenByDepth.has(depth)) {
      childrenByDepth.set(depth, []);
    }
    childrenByDepth.get(depth)!.push(nodeId);

    const children = Object.values(nodes).filter(
      (n) => n.parentNodeId === nodeId
    );

    for (const child of children) {
      queue.push({ nodeId: child.id, depth: depth + 1 });
    }
  }

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

export function MultiverseTree({
  state,
  onNodeSelect,
  onChoiceSelect,
}: MultiverseTreeProps) {
  const layouts = useMemo(
    () =>
      computeTreeLayout(
        state.nodes,
        state.rootNodeId,
        state.activeNodeId,
      ),
    [state.nodes, state.rootNodeId, state.activeNodeId],
  );

  const minX = Math.min(...layouts.map((l) => l.x), 0) - NODE_WIDTH;
  const maxX = Math.max(...layouts.map((l) => l.x), 0) + NODE_WIDTH * 2;
  const maxY = Math.max(...layouts.map((l) => l.y), 0) + NODE_HEIGHT * 2;
  const viewBoxWidth = maxX - minX + NODE_WIDTH;
  const viewBoxHeight = maxY + NODE_VERTICAL_GAP;

  const activeNode = state.activeNodeId
    ? state.nodes[state.activeNodeId]
    : null;

  if (layouts.length === 0) {
    return (
      <div className="flex items-center justify-center px-4 py-8">
        <p style={{ fontFamily: "var(--font-body)", fontSize: "0.78rem", color: "#8A857E" }} className="text-center">
          No branches yet. Start a simulation to grow the multiverse tree.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="hide-scrollbar overflow-x-auto px-2">
        <svg
          viewBox={`${minX} -10 ${viewBoxWidth} ${viewBoxHeight}`}
          className="mx-auto w-full"
          style={{ minHeight: `${Math.min(viewBoxHeight, 400)}px` }}
        >
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

          {layouts.map((layout) => (
            <TreeNode
              key={layout.node.id}
              layout={layout}
              onSelect={() => onNodeSelect(layout.node.id)}
            />
          ))}
        </svg>
      </div>

      {activeNode && activeNode.choices.length > 0 && (
        <div className="px-4">
          <p className="sori-kicker mb-2">available branches</p>
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

function TreeNode({
  layout,
  onSelect,
}: {
  layout: UITreeNodeLayout;
  onSelect: () => void;
}) {
  const { node, x, y, isActive } = layout;

  const borderColor = node.metadata.isParadox
    ? "#C8635A"
    : node.type === "canon"
      ? "#1C1A18"
      : isActive
        ? "#C8635A"
        : "rgba(28, 26, 24, 0.12)";

  const fillColor = isActive ? "#FFFFFF" : "#FAF8F5";

  const label =
    node.sceneGoal.length > 18
      ? node.sceneGoal.slice(0, 18) + "…"
      : node.sceneGoal;

  const typeLabel =
    node.type === "canon"
      ? "●"
      : node.type === "decision"
        ? "◇"
        : "○";

  return (
    <g onClick={onSelect} style={{ cursor: "pointer" }}>
      <rect
        x={x}
        y={y}
        width={NODE_WIDTH}
        height={NODE_HEIGHT}
        rx={0}
        fill={fillColor}
        stroke={borderColor}
        strokeWidth={isActive ? 2 : 1}
        strokeDasharray={node.type === "decision" ? "4 3" : undefined}
      />

      <text x={x + 8} y={y + 14} fontSize={10} fill={borderColor}>
        {typeLabel}
      </text>

      <text
        x={x + NODE_WIDTH / 2}
        y={y + NODE_HEIGHT / 2 + 2}
        textAnchor="middle"
        fontSize={10}
        fill="#1C1A18"
        fontFamily="var(--font-body)"
      >
        {label}
      </text>

      <text
        x={x + NODE_WIDTH - 8}
        y={y + NODE_HEIGHT - 8}
        textAnchor="end"
        fontSize={8}
        fill="#8A857E"
        fontFamily="var(--font-body)"
      >
        {Math.round(node.metadata.confidenceScore * 100)}%
      </text>

      {node.metadata.isParadox && (
        <circle
          cx={x + NODE_WIDTH - 6}
          cy={y + 6}
          r={4}
          fill="#C8635A"
        />
      )}
    </g>
  );
}

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
  const midY = fromY + (toY - fromY) * 0.5;
  const d = `M ${fromX} ${fromY} C ${fromX} ${midY}, ${toX} ${midY}, ${toX} ${toY}`;

  return (
    <motion.path
      d={d}
      fill="none"
      stroke={isOnActivePath ? "rgba(200, 99, 90, 0.6)" : "rgba(28, 26, 24, 0.12)"}
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

function ChoiceCard({
  choice,
  onSelect,
}: {
  choice: ChoiceEdge;
  onSelect: () => void;
}) {
  const intentColors: Record<string, string> = {
    deception: "#8A857E",
    confrontation: "#C8635A",
    avoidance: "#8A857E",
    truth: "#1C1A18",
    discovery: "#C8635A",
    sacrifice: "#C8635A",
  };

  const intentColor = intentColors[choice.intent] || "#8A857E";

  return (
    <motion.button
      onClick={onSelect}
      {...multiverseMotion.choiceHover}
      className="w-full border border-border bg-card p-3 text-left transition-colors hover:border-foreground cursor-pointer"
    >
      <div className="flex items-center justify-between gap-2">
        <p style={{ fontFamily: "var(--font-body)", fontSize: "0.78rem" }} className="m-0 flex-1 text-foreground">
          {choice.label}
        </p>
        <span
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "0.58rem",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: intentColor,
          }}
          className="shrink-0 border px-2 py-0.5 font-medium"
        >
          {choice.intent}
        </span>
      </div>
    </motion.button>
  );
}
