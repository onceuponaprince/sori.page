import { describe, it, expect } from "vitest";
import { applyNovelPreset } from "@/lib/format-presets/novel";
import type { JSONContent } from "@tiptap/core";

function paragraph(text: string): JSONContent {
  return {
    type: "paragraph",
    content: [{ type: "text", text }],
  };
}

function heading(level: number, text: string): JSONContent {
  return {
    type: "heading",
    attrs: { level },
    content: [{ type: "text", text }],
  };
}

describe("applyNovelPreset", () => {
  it("inserts scene breaks before headings and normalizes hash lines", () => {
    const input: JSONContent = {
      type: "doc",
      content: [
        paragraph("Opening beat."),
        heading(2, "Scene 2"),
        paragraph("Second scene action."),
        paragraph("# Scene 3"),
        paragraph("Third scene."),
      ],
    };

    const output = applyNovelPreset(input);
    const types = (output.content || []).map((node) => node.type);

    expect(types).toContain("sceneBreak");
    expect(types.filter((t) => t === "sceneBreak").length).toBeGreaterThanOrEqual(2);

    const boldLabels = (output.content || [])
      .filter((node) => node.type === "paragraph")
      .map((node) =>
        (node.content || [])
          .map((part) => part.text || "")
          .join(""),
      );

    expect(boldLabels).toContain("Scene 2");
    expect(boldLabels).toContain("Scene 3");
    expect(boldLabels).not.toContain("# Scene 3");
  });

  it("treats horizontal rules and --- markers as scene breaks", () => {
    const input: JSONContent = {
      type: "doc",
      content: [
        paragraph("Act one."),
        { type: "horizontalRule" },
        paragraph("Act two."),
        paragraph("---"),
        paragraph("Act three."),
      ],
    };

    const output = applyNovelPreset(input);
    const sceneBreaks = (output.content || []).filter(
      (node) => node.type === "sceneBreak",
    );

    expect(sceneBreaks.length).toBe(2);
  });
});
