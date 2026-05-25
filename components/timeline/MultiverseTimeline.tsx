"use client";

/**
 * MultiverseTimeline — full-page horizontal flow visualization of the
 * multiverse tree.
 *
 * Layout strategy: BFS from the root assigns each node to a column
 * (depth in the tree). Within a column, nodes stack vertically. The
 * SVG edge layer draws cubic-bezier connectors between columns using
 * the column/row offsets computed at render time.
 *
 * Consumes the `TimelineTree` projection from `useMultiverseTree`.
 * The plan's `state.tree` shape lives in `types/timeline.ts`.
 */

import { motion } from "framer-motion";
import { multiverseMotion } from "@/lib/sori-motion";
import { TimelineNode } from "./TimelineNode";
import { TimelineEdge } from "./TimelineEdge";
import type { TimelineNodeData, TimelineTree } from "@/types/timeline";

const NODE_W = 160;
const NODE_H = 122;
const COL_GAP = 44;
const ROW_GAP = 12;

interface Props {
  tree: TimelineTree | null;
  activeUid: string | null;
  onNodeClick: (node: TimelineNodeData) => void;
  onSimulateNextBeat?: () => void;
}

export function buildColumns(tree: TimelineTree): TimelineNodeData[][] {
  const childMap = new Map<string, string[]>();
  Object.values(tree.nodes).forEach((n) => childMap.set(n.uid, []));
  tree.edges.forEach((e) => {
    const arr = childMap.get(e.fromUid);
    if (arr && !arr.includes(e.toUid)) arr.push(e.toUid);
  });

  const columns: TimelineNodeData[][] = [];
  const visited = new Set<string>();
  let queue = [tree.rootUid];

  while (queue.length > 0) {
    const col: TimelineNodeData[] = [];
    const next: string[] = [];
    for (const uid of queue) {
      if (visited.has(uid)) continue;
      visited.add(uid);
      const node = tree.nodes[uid];
      if (node) col.push(node);
      next.push(...(childMap.get(uid) ?? []));
    }
    if (col.length > 0) columns.push(col);
    queue = next;
  }
  return columns;
}

interface NodePos {
  x: number;
  y: number;
}

function buildPositionMap(
  columns: TimelineNodeData[][],
): Map<string, NodePos> {
  const map = new Map<string, NodePos>();
  columns.forEach((col, ci) => {
    col.forEach((node, ri) => {
      map.set(node.uid, {
        x: ci * (NODE_W + COL_GAP),
        y: ri * (NODE_H + ROW_GAP),
      });
    });
  });
  return map;
}

export function MultiverseTimeline({
  tree,
  activeUid,
  onNodeClick,
  onSimulateNextBeat,
}: Props) {
  if (!tree) {
    return (
      <div style={{ padding: 48, color: "#6a5a8a", textAlign: "center" }}>
        No multiverse nodes yet — run a simulation from the editor to see
        branches here.
      </div>
    );
  }

  const columns = buildColumns(tree);
  const posMap = buildPositionMap(columns);

  const totalW =
    columns.length > 0 ? columns.length * (NODE_W + COL_GAP) - COL_GAP : 0;
  const maxH =
    columns.length > 0
      ? Math.max(...columns.map((col) => col.length * (NODE_H + ROW_GAP)))
      : NODE_H;

  return (
    <div
      style={{
        position: "relative",
        overflowX: "auto",
        padding: "24px 32px",
        minHeight: maxH + 48,
      }}
    >
      <svg
        style={{
          position: "absolute",
          inset: "24px 32px",
          width: totalW,
          height: maxH,
          pointerEvents: "none",
        }}
      >
        {tree.edges.map((edge) => {
          const from = posMap.get(edge.fromUid);
          const to = posMap.get(edge.toUid);
          if (!from || !to) return null;
          const fromNode = tree.nodes[edge.fromUid];
          const toNode = tree.nodes[edge.toUid];
          const isCanon =
            (fromNode && fromNode.type === "canon") ||
            (toNode && toNode.type === "canon");
          return (
            <TimelineEdge
              key={edge.uid}
              fromX={from.x + NODE_W}
              fromY={from.y + NODE_H / 2}
              toX={to.x}
              toY={to.y + NODE_H / 2}
              isCanon={Boolean(isCanon)}
            />
          );
        })}
      </svg>

      <motion.div
        {...multiverseMotion.treeStagger}
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: COL_GAP,
          position: "relative",
        }}
      >
        {columns.map((col, ci) => (
          <div
            key={ci}
            data-timeline-col={ci}
            style={{ display: "flex", flexDirection: "column", gap: ROW_GAP }}
          >
            {col.map((node) => (
              <TimelineNode
                key={node.uid}
                node={node}
                isActive={node.uid === activeUid}
                onClick={onNodeClick}
              />
            ))}
          </div>
        ))}

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            minHeight: NODE_H,
          }}
        >
          <button
            type="button"
            data-timeline-simulate-next
            onClick={onSimulateNextBeat}
            disabled={!onSimulateNextBeat}
            aria-label="Simulate next beat"
            style={{
              border: "2px dashed #3a2a5a",
              borderRadius: 10,
              padding: "10px 12px",
              width: 100,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              cursor: onSimulateNextBeat ? "pointer" : "default",
              opacity: onSimulateNextBeat ? 1 : 0.5,
              background: "transparent",
              color: "inherit",
            }}
          >
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: "50%",
                border: "2px dashed #5a4a8a",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#7a6aaa",
                fontSize: 16,
              }}
            >
              +
            </div>
            <span
              style={{ color: "#5a4a7a", fontSize: 9, textAlign: "center" }}
            >
              Simulate next beat
            </span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
