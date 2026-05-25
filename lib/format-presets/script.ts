import type { JSONContent } from "@tiptap/core";
import type { FormatTransformer } from "./types";

function textNode(text: string): JSONContent {
  return { type: "text", text };
}

function nodePlainText(node: JSONContent): string {
  if (node.type === "text" && node.text) return node.text;
  return (node.content || []).map(nodePlainText).join("");
}

/** Extract non-empty lines from doc blocks (one paragraph → one or more lines). */
function extractLines(doc: JSONContent): string[] {
  const lines: string[] = [];
  for (const block of doc.content || []) {
    const text = nodePlainText(block).trim();
    if (!text) continue;
    text.split("\n").forEach((line) => {
      const trimmed = line.trim();
      if (trimmed) lines.push(trimmed);
    });
  }
  return lines;
}

const SCENE_HEADING = /^(INT\.|EXT\.|INT\/EXT\.|I\/E\.|EST\.)/i;
const CHARACTER = /^([A-Z][A-Z0-9 .'\-()]{0,40}):$/;
const PARENTHETICAL = /^\(.+\)$/;

/**
 * Script preset: parse line-oriented screenplay text into custom TipTap nodes.
 */
export const applyScriptPreset: FormatTransformer = (doc) => {
  const lines = extractLines(doc);
  const content: JSONContent[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (SCENE_HEADING.test(line)) {
      content.push({
        type: "scriptSceneHeading",
        content: [textNode(line.toUpperCase())],
      });
      i += 1;
      continue;
    }

    const charMatch = line.match(CHARACTER);
    if (charMatch) {
      const name = charMatch[1].trim();
      content.push({
        type: "scriptCharacter",
        content: [textNode(name)],
      });
      i += 1;

      if (i < lines.length && PARENTHETICAL.test(lines[i])) {
        content.push({
          type: "scriptParenthetical",
          content: [textNode(lines[i])],
        });
        i += 1;
      }

      const dialogueLines: string[] = [];
      while (i < lines.length) {
        const next = lines[i];
        if (
          SCENE_HEADING.test(next) ||
          CHARACTER.test(next) ||
          PARENTHETICAL.test(next)
        ) {
          break;
        }
        dialogueLines.push(next);
        i += 1;
      }

      if (dialogueLines.length > 0) {
        content.push({
          type: "scriptDialogue",
          content: [textNode(dialogueLines.join(" "))],
        });
      }
      continue;
    }

    content.push({
      type: "scriptAction",
      content: [textNode(line)],
    });
    i += 1;
  }

  return { type: "doc", content };
};
