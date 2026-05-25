"use client";

import type { Editor } from "@tiptap/react";
import type { JSONContent } from "@tiptap/core";
import { Button } from "@/components/ui/button";
import {
  applyFormatPreset,
  type FormatPreset,
} from "@/lib/format-presets";

interface FormatToolbarProps {
  editor: Editor | null;
  preset: FormatPreset;
  onPresetChange: (preset: FormatPreset) => void;
  onFormatted?: (doc: JSONContent) => void;
}

export function FormatToolbar({
  editor,
  preset,
  onPresetChange,
  onFormatted,
}: FormatToolbarProps) {
  function handleFormat() {
    if (!editor) return;

    const formatted = applyFormatPreset(editor.getJSON(), preset);
    editor.commands.setContent(formatted, false);
    onFormatted?.(formatted);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="sori-kicker m-0">format</span>
        <select
          value={preset}
          onChange={(event) =>
            onPresetChange(event.target.value as FormatPreset)
          }
          className="border border-border bg-background px-2 py-1 text-sm text-foreground"
        >
          <option value="novel">Novel</option>
          <option value="script">Script</option>
        </select>
      </label>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleFormat}
        disabled={!editor}
      >
        Format
      </Button>
    </div>
  );
}
