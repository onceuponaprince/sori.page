import type { JSONContent } from "@tiptap/core";
import { applyNovelPreset } from "./novel";
import { applyScriptPreset } from "./script";
import type { FormatPreset } from "./types";

export type { FormatPreset, FormatTransformer } from "./types";
export { applyNovelPreset, applyScriptPreset };

export function applyFormatPreset(
  doc: JSONContent,
  preset: FormatPreset,
): JSONContent {
  if (preset === "novel") {
    return applyNovelPreset(doc);
  }
  return applyScriptPreset(doc);
}
