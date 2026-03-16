"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import Link from "next/link";

const SOURCE_TYPES = [
  { value: "screenplay", label: "Screenplay" },
  { value: "novel", label: "Novel" },
  { value: "short_story", label: "Short Story" },
  { value: "script", label: "Script" },
  { value: "analysis", label: "Analysis / Essay" },
  { value: "other", label: "Other" },
];

interface PreviewChunk {
  index: number;
  text: string;
  word_count: number;
}

export default function UploadPage() {
  const [title, setTitle] = useState("");
  const [sourceType, setSourceType] = useState("screenplay");
  const [sourceUrl, setSourceUrl] = useState("");
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<PreviewChunk[] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  function generatePreview() {
    if (!text.trim()) return;
    // Split by double newlines (paragraphs/scenes)
    const chunks = text
      .split(/\n{2,}/)
      .map((t) => t.trim())
      .filter(Boolean)
      .map((t, i) => ({
        index: i,
        text: t,
        word_count: t.split(/\s+/).length,
      }));
    setPreview(chunks);
    setResult(null);
  }

  async function handleSubmit() {
    if (!title.trim() || !text.trim()) return;
    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          text,
          source_type: sourceType,
          source_url: sourceUrl || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult({
          success: true,
          message: `Created source node and ${data.instance_count ?? 0} instance nodes.`,
        });
        setTitle("");
        setText("");
        setSourceUrl("");
        setPreview(null);
      } else {
        setResult({
          success: false,
          message: data.error || "Upload failed.",
        });
      }
    } catch {
      setResult({ success: false, message: "Network error. Is the server running?" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto flex flex-col gap-6">
      <div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
          <Link href="/admin" className="hover:underline">
            Admin
          </Link>
          <span>/</span>
          <span>Upload</span>
        </div>
        <h1 className="text-2xl font-bold">Upload Script / Document</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Paste a script or story text to create SourceNode and InstanceNodes in
          the knowledge graph.
        </p>
      </div>

      {/* Result banner */}
      {result && (
        <div
          className={`rounded-md border px-4 py-3 text-sm ${
            result.success
              ? "border-green-300 bg-green-50 text-green-800 dark:bg-green-950/20 dark:text-green-200"
              : "border-red-300 bg-red-50 text-red-800 dark:bg-red-950/20 dark:text-red-200"
          }`}
        >
          {result.message}
        </div>
      )}

      {/* Form */}
      <div className="rounded-lg border border-input p-6 flex flex-col gap-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. The Dark Knight — Opening Scene"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Source Type</label>
            <select
              value={sourceType}
              onChange={(e) => setSourceType(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {SOURCE_TYPES.map((st) => (
                <option key={st.value} value={st.value}>
                  {st.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Source URL (optional)</label>
          <Input
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="https://..."
            type="url"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Text Content</label>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste the full script or story text here. Separate scenes/paragraphs with blank lines."
            rows={12}
            required
          />
          <span className="text-xs text-muted-foreground">
            {text.split(/\s+/).filter(Boolean).length} words
          </span>
        </div>

        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={generatePreview}
            disabled={!text.trim()}
          >
            Preview Chunks
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !title.trim() || !text.trim()}
          >
            {submitting ? "Uploading..." : "Submit"}
          </Button>
        </div>
      </div>

      {/* Preview */}
      {preview && preview.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">
            Preview: {preview.length} chunk{preview.length !== 1 ? "s" : ""}{" "}
            will be created
          </h2>
          <div className="rounded-lg border border-input divide-y divide-input max-h-96 overflow-auto">
            {preview.map((chunk) => (
              <div key={chunk.index} className="p-4 text-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-xs text-muted-foreground">
                    Chunk {chunk.index + 1}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {chunk.word_count} words
                  </span>
                </div>
                <p className="text-muted-foreground line-clamp-3">
                  {chunk.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
