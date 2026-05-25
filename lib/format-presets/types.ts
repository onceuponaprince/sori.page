import type { JSONContent } from "@tiptap/core";

export type FormatPreset = "novel" | "script";

export type FormatTransformer = (doc: JSONContent) => JSONContent;
