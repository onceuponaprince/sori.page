import type { JSONContent } from "@tiptap/core";
import type { FormatTransformer } from "./types";

function textNode(text: string): JSONContent {
  return { type: "text", text };
}

function paragraph(...parts: JSONContent[]): JSONContent {
  return { type: "paragraph", content: parts.length ? parts : undefined };
}

function sceneBreak(): JSONContent {
  return { type: "sceneBreak" };
}

function nodePlainText(node: JSONContent): string {
  if (node.type === "text" && node.text) return node.text;
  return (node.content || []).map(nodePlainText).join("");
}

/**
 * Novel preset: insert scene breaks before headings and horizontal rules,
 * normalize headings to paragraph + strong scene labels.
 */
export const applyNovelPreset: FormatTransformer = (doc) => {
  const blocks = doc.content || [];
  const next: JSONContent[] = [];
  let sawContent = false;

  for (const block of blocks) {
    if (block.type === "horizontalRule") {
      if (sawContent) next.push(sceneBreak());
      continue;
    }

    if (block.type === "heading") {
      const label = nodePlainText(block).trim();
      if (label) {
        if (sawContent) next.push(sceneBreak());
        next.push(
          paragraph({
            type: "text",
            text: label,
            marks: [{ type: "bold" }],
          }),
        );
        sawContent = true;
      }
      continue;
    }

    if (block.type === "paragraph") {
      const raw = nodePlainText(block).trim();
      if (!raw) continue;

      // Scene break marker in plain text: --- or *** on its own line
      if (/^(-{3,}|\*{3,})$/.test(raw)) {
        if (sawContent) next.push(sceneBreak());
        continue;
      }

      // # Scene title lines pasted as paragraph
      const hashMatch = raw.match(/^#{1,3}\s+(.+)$/);
      if (hashMatch) {
        if (sawContent) next.push(sceneBreak());
        next.push(
          paragraph({
            type: "text",
            text: hashMatch[1],
            marks: [{ type: "bold" }],
          }),
        );
        sawContent = true;
        continue;
      }

      next.push(block);
      sawContent = true;
      continue;
    }

    if (block.type === "sceneBreak") {
      if (sawContent) next.push(sceneBreak());
      continue;
    }

    next.push(block);
    sawContent = true;
  }

  return { type: "doc", content: next };
};
