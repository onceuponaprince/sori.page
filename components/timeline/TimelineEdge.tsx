"use client";

/**
 * TimelineEdge — a single SVG cubic-bezier connector between two nodes
 * in the Multiverse Timeline.
 *
 * Canon edges (edges that touch a `canon` node on either end) render
 * solid + gold + thicker so the canonical narrative spine is visually
 * dominant. Other edges render dashed + muted purple so they read as
 * "explored alternatives".
 */

interface Props {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  isCanon: boolean;
}

export function TimelineEdge({ fromX, fromY, toX, toY, isCanon }: Props) {
  const cx = (fromX + toX) / 2;
  const d = `M ${fromX} ${fromY} C ${cx} ${fromY}, ${cx} ${toY}, ${toX} ${toY}`;
  return (
    <path
      d={d}
      stroke={isCanon ? "#f5d060" : "#3a3050"}
      strokeWidth={isCanon ? 2 : 1.5}
      fill="none"
      strokeDasharray={isCanon ? undefined : "4 3"}
    />
  );
}
