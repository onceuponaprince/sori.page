"use client";

/**
 * TimelineNode — a single card in the Multiverse Timeline.
 *
 * Three visual variants driven by `node.type`:
 *   - decision   → purple outline, "DECISION" chip
 *   - canon      → gold outline, "CANON" chip + ★ marker (non-clickable)
 *   - simulation → red outline, "EXPLORED" chip (clickable to resume)
 *
 * Always renders:
 *   - structural pattern chip (when set)
 *   - paradox badge (when hasParadox)
 *   - 5-pip confidence row
 *
 * Click semantics: canon nodes are committed and not re-enterable, so
 * they ignore clicks; all other types call `onClick(node)`.
 */

import { motion } from "framer-motion";
import { multiverseMotion } from "@/lib/sori-motion";
import type { TimelineNodeData } from "@/types/timeline";

interface Props {
  node: TimelineNodeData;
  isActive: boolean;
  onClick: (node: TimelineNodeData) => void;
}

interface VariantStyle {
  border: string;
  bg: string;
  chipColor: string;
  chipBg: string;
  label: string;
}

const STYLE: Record<TimelineNodeData["type"], VariantStyle> = {
  decision: {
    border: "#8a6abf",
    bg: "#1a1530",
    chipColor: "#a98fd4",
    chipBg: "#2a1a50",
    label: "DECISION",
  },
  canon: {
    border: "#c8a840",
    bg: "#1a1a0e",
    chipColor: "#f5d060",
    chipBg: "#2a200a",
    label: "CANON",
  },
  simulation: {
    border: "#3a2020",
    bg: "#120e0e",
    chipColor: "#bf6a6a",
    chipBg: "#200a0a",
    label: "EXPLORED",
  },
};

export function TimelineNode({ node, isActive, onClick }: Props) {
  const s = STYLE[node.type] ?? STYLE.simulation;
  const isCanon = node.type === "canon";
  const filledPips = Math.round(Math.max(0, Math.min(1, node.confidence ?? 0)) * 5);

  return (
    <motion.div
      {...multiverseMotion.nodePopIn}
      data-node-uid={node.uid}
      onClick={() => {
        if (!isCanon) onClick(node);
      }}
      style={{
        background: s.bg,
        border: `2px solid ${isActive ? "#ffffff" : s.border}`,
        borderRadius: 10,
        padding: "10px 12px",
        width: 160,
        cursor: isCanon ? "default" : "pointer",
        opacity: node.type === "simulation" ? 0.65 : 1,
        boxShadow: isActive ? `0 0 16px ${s.border}66` : undefined,
        userSelect: "none",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 6,
        }}
      >
        <span
          style={{
            background: s.chipBg,
            border: `1px solid ${s.border}`,
            borderRadius: 3,
            padding: "1px 5px",
            fontSize: 9,
            color: s.chipColor,
            fontFamily: "monospace",
          }}
        >
          {s.label}
        </span>
        <div style={{ display: "flex", gap: 4 }}>
          {isCanon && (
            <span style={{ color: "#f5d060", fontSize: 10 }} aria-label="canon">
              ★
            </span>
          )}
          {node.hasParadox && (
            <span
              style={{ color: "#bf4040", fontSize: 10 }}
              title="Paradox detected"
              aria-label="paradox"
            >
              ⚠
            </span>
          )}
        </div>
      </div>

      <div
        style={{
          color: "#e8e0f8",
          fontSize: 11,
          fontWeight: 600,
          lineHeight: 1.3,
          marginBottom: 4,
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {node.summary}
      </div>

      <div
        style={{
          borderTop: "1px solid #2a2040",
          paddingTop: 6,
          marginTop: 6,
          display: "flex",
          flexDirection: "column",
          gap: 3,
        }}
      >
        {node.structuralPattern && (
          <span
            style={{
              background: "#1e1040",
              borderRadius: 2,
              padding: "1px 4px",
              fontSize: 8,
              color: "#7a6aaa",
              fontFamily: "monospace",
              alignSelf: "flex-start",
            }}
          >
            {node.structuralPattern}
          </span>
        )}
        {node.hasParadox && (
          <span
            style={{
              background: "#3a0a0a",
              borderRadius: 2,
              padding: "1px 4px",
              fontSize: 8,
              color: "#bf4040",
              fontFamily: "monospace",
              alignSelf: "flex-start",
            }}
          >
            ⚠ paradox
          </span>
        )}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span style={{ fontSize: 9, color: "#5a5070" }}>confidence</span>
          <div style={{ display: "flex", gap: 2 }}>
            {Array.from({ length: 5 }, (_, i) => (
              <div
                key={i}
                data-pip={i < filledPips ? "filled" : "empty"}
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 1,
                  background: i < filledPips ? "#6abf8c" : "#2a2040",
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
