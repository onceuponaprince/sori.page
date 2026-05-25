import { describe, it, expect } from "vitest";
import { applyScriptPreset } from "@/lib/format-presets/script";
import type { JSONContent } from "@tiptap/core";

function paragraph(text: string): JSONContent {
  return {
    type: "paragraph",
    content: [{ type: "text", text }],
  };
}

describe("applyScriptPreset", () => {
  it("parses screenplay lines into script nodes", () => {
    const input: JSONContent = {
      type: "doc",
      content: [
        paragraph("INT. WAREHOUSE - NIGHT"),
        paragraph(""),
        paragraph("MAYA:"),
        paragraph("(whispering)"),
        paragraph("We need to move."),
      ],
    };

    const output = applyScriptPreset(input);
    const types = (output.content || []).map((node) => node.type);

    expect(types).toEqual([
      "scriptSceneHeading",
      "scriptCharacter",
      "scriptParenthetical",
      "scriptDialogue",
    ]);

    const heading = output.content?.[0];
    expect(heading?.content?.[0]?.text).toBe("INT. WAREHOUSE - NIGHT");

    const dialogue = output.content?.[3];
    expect(dialogue?.content?.[0]?.text).toBe("We need to move.");
  });

  it("treats non-dialogue lines as action", () => {
    const input: JSONContent = {
      type: "doc",
      content: [paragraph("Rain hammers the roof.")],
    };

    const output = applyScriptPreset(input);
    expect(output.content?.[0]?.type).toBe("scriptAction");
  });
});
