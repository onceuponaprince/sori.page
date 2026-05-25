"use client";

interface CharacterEditorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function CharacterEditor({ value, onChange, disabled }: CharacterEditorProps) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      spellCheck={false}
      className="h-full min-h-[420px] w-full resize-none border border-border bg-background p-4 font-mono text-sm leading-relaxed text-foreground focus:border-accent focus:outline-none disabled:opacity-50"
      placeholder="---&#10;id: character-id&#10;name: Character Name&#10;tags: []&#10;---&#10;&#10;Character bio..."
    />
  );
}
