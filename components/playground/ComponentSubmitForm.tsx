"use client";

import { useRef, useState } from "react";

interface ComponentSubmitFormProps {
  onSubmit: (source: string, filename?: string) => Promise<unknown>;
}

export function ComponentSubmitForm({ onSubmit }: ComponentSubmitFormProps) {
  const [source, setSource] = useState("");
  const [filename, setFilename] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = source.trim();
    if (!trimmed || submitting) return;

    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      await onSubmit(trimmed, filename);
      setSource("");
      setFilename(undefined);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setSuccess("Component submitted for review.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setSubmitting(false);
    }
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setFilename(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setSource(typeof reader.result === "string" ? reader.result : "");
      setError(null);
      setSuccess(null);
    };
    reader.onerror = () => {
      setError("Could not read file");
    };
    reader.readAsText(file);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2 border-t border-border p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        _components/
      </p>
      <p className="text-xs text-muted-foreground">
        Paste or upload a TSX character component. Submissions enter contributor review.
      </p>

      <textarea
        value={source}
        onChange={(event) => {
          setSource(event.target.value);
          setSuccess(null);
        }}
        placeholder={'/**\n * @character id=oracle-sage name="The Oracle"\n */'}
        rows={6}
        className="w-full border border-border bg-transparent px-2 py-1.5 font-mono text-xs focus:border-accent focus:outline-none"
      />

      <div className="flex flex-wrap items-center gap-2">
        <label className="cursor-pointer border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground">
          Upload .tsx
          <input
            ref={fileInputRef}
            type="file"
            accept=".tsx,.jsx,.ts,.js"
            className="hidden"
            onChange={handleFileChange}
          />
        </label>
        {filename && (
          <span className="text-[10px] text-muted-foreground">{filename}</span>
        )}
      </div>

      {error && (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
      {success && (
        <p className="text-xs text-emerald-600" role="status">
          {success}
        </p>
      )}

      <button
        type="submit"
        disabled={!source.trim() || submitting}
        className="w-full border border-accent px-2 py-1.5 text-xs text-accent hover:bg-accent hover:text-white disabled:opacity-50"
      >
        {submitting ? "Submitting…" : "Submit component"}
      </button>
    </form>
  );
}
