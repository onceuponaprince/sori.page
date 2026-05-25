import type { TimelineNodeData, TimelineTree } from "@/types/timeline";

/**
 * Walk the tree from root, always following the first canon child at each
 * branch (edge order preserved). Returns the deepest node on that path —
 * the "canon leaf" where the next beat would attach.
 */
export function findCanonLeaf(tree: TimelineTree): TimelineNodeData {
  const edgesByFrom = new Map<string, typeof tree.edges>();
  tree.edges.forEach((edge) => {
    const list = edgesByFrom.get(edge.fromUid) ?? [];
    list.push(edge);
    edgesByFrom.set(edge.fromUid, list);
  });

  let currentUid = tree.rootUid;

  while (true) {
    const outEdges = (edgesByFrom.get(currentUid) ?? []).sort(
      (a, b) => a.order - b.order,
    );
    const canonChild = outEdges.find(
      (e) => tree.nodes[e.toUid]?.type === "canon",
    );
    if (!canonChild) break;
    currentUid = canonChild.toUid;
  }

  return tree.nodes[currentUid]!;
}

/** Suggest a scene-goal prompt continuing from the canon leaf summary. */
export function suggestNextBeatGoal(leaf: TimelineNodeData): string {
  const summary = leaf.summary.trim();
  if (!summary) return "What happens in the next beat?";
  return `What happens next after "${summary}"?`;
}
