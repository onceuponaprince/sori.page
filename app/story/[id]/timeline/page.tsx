"use client";

/**
 * /story/[id]/timeline — full-page Multiverse Timeline view.
 *
 * Pulls the canonical state via useMultiverseTree (which composes
 * useMultiverse internally) and hands the projected tree to
 * MultiverseTimeline. Click semantics:
 *
 *   - canon nodes are NOT clickable (TimelineNode enforces this)
 *   - any other node click → router.push('/story/<id>?resumeNode=<uid>')
 *
 * The editor reads `?resumeNode=` on mount and restores the active
 * node so the writer lands inside the same branch they clicked.
 */

import { use } from "react";
import { useRouter } from "next/navigation";
import { useMultiverseTree } from "@/lib/use-multiverse-tree";
import { MultiverseTimeline } from "@/components/timeline/MultiverseTimeline";
import type { TimelineNodeData } from "@/types/timeline";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function TimelinePage({ params }: PageProps) {
  // Next.js 15 hands params as a Promise; `use` unwraps it client-side.
  const { id: storyUid } = use(params);
  const router = useRouter();
  const { tree, activeUid, loading, error } = useMultiverseTree({ storyUid });

  const nodeCount = tree ? Object.keys(tree.nodes).length : 0;
  const canonCount = tree
    ? Object.values(tree.nodes).filter((n) => n.type === "canon").length
    : 0;

  const handleNodeClick = (node: TimelineNodeData) => {
    router.push(`/story/${storyUid}?resumeNode=${encodeURIComponent(node.uid)}`);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a12", color: "#e8e0f8" }}>
      <div
        style={{
          background: "#12121e",
          borderBottom: "1px solid #2a2040",
          padding: "8px 24px",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <button
          onClick={() => router.push(`/story/${storyUid}`)}
          style={{
            background: "none",
            border: "none",
            color: "#5a4a7a",
            fontSize: 12,
            cursor: "pointer",
          }}
          aria-label="Back to editor"
        >
          ← Back to editor
        </button>
        <span style={{ color: "#4a3a6a" }}>|</span>
        <span style={{ color: "#c4b8e8", fontWeight: 600 }}>
          Multiverse Timeline
        </span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <span
            style={{
              background: "#1a1530",
              border: "1px solid #3a2a5a",
              borderRadius: 4,
              padding: "3px 8px",
              color: "#8a7aaa",
              fontSize: 10,
            }}
          >
            {nodeCount} nodes
          </span>
          <span
            style={{
              background: "#2a200a",
              border: "1px solid #6a5020",
              borderRadius: 4,
              padding: "3px 8px",
              color: "#c8a840",
              fontSize: 10,
            }}
          >
            ★ {canonCount} canon
          </span>
          <a
            href={`/api/story/${storyUid}/export/twine`}
            style={{
              background: "#1a2a1a",
              border: "1px solid #3a6a3a",
              borderRadius: 4,
              padding: "3px 8px",
              color: "#6abf8c",
              fontSize: 10,
              textDecoration: "none",
            }}
            download
          >
            Export to Twine
          </a>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          style={{
            padding: "8px 24px",
            background: "#2a0a0a",
            borderBottom: "1px solid #6a2020",
            color: "#bf6a6a",
            fontSize: 12,
          }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ padding: 48, color: "#6a5a8a", textAlign: "center" }}>
          Loading timeline…
        </div>
      ) : (
        <MultiverseTimeline
          tree={tree}
          activeUid={activeUid || null}
          onNodeClick={handleNodeClick}
        />
      )}
    </div>
  );
}
