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
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-8">
      <div>
        <div className="mb-1 flex items-center gap-2" style={{ fontFamily: "var(--font-body)", fontSize: "0.78rem", color: "#8A857E" }}>
          <Link href="/admin" className="underline underline-offset-2 hover:text-foreground transition-colors">
            Admin
          </Link>
          <span>/</span>
          <span>Upload</span>
        </div>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", fontWeight: 500 }} className="text-foreground">
          Upload Script / Document
        </h1>
        <p style={{ fontFamily: "var(--font-body)", fontSize: "0.78rem", color: "#8A857E" }} className="mt-1">
          Paste a script or story text to create SourceNode and InstanceNodes in
          the knowledge graph.
        </p>
      </div>

      {result && (
        <div
          className={`border px-4 py-3 text-sm ${
            result.success
              ? "border-foreground/30 bg-secondary text-foreground"
              : "border-accent/30 bg-accent/10 text-accent"
          }`}
        >
          {result.message}
        </div>
      )}

      <div className="border border-border bg-card flex flex-col gap-4 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label style={{ fontFamily: "var(--font-body)", fontSize: "0.78rem", fontWeight: 500 }}>Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. The Dark Knight — Opening Scene"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label style={{ fontFamily: "var(--font-body)", fontSize: "0.78rem", fontWeight: 500 }}>Source Type</label>
            <select
              value={sourceType}
              onChange={(e) => setSourceType(e.target.value)}
              style={{ fontFamily: "var(--font-body)", fontSize: "0.78rem" }}
              className="flex h-10 w-full border border-border bg-transparent px-3 py-2 text-foreground focus-visible:outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/35"
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
          <label style={{ fontFamily: "var(--font-body)", fontSize: "0.78rem", fontWeight: 500 }}>Source URL (optional)</label>
          <Input
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="https://..."
            type="url"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label style={{ fontFamily: "var(--font-body)", fontSize: "0.78rem", fontWeight: 500 }}>Text Content</label>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste the full script or story text here. Separate scenes/paragraphs with blank lines."
            rows={12}
            required
          />
          <span style={{ fontFamily: "var(--font-body)", fontSize: "0.68rem" }} className="text-muted-foreground">
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

      {preview && preview.length > 0 && (
        <div>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.15rem", fontWeight: 500 }} className="mb-3 text-foreground">
            Preview: {preview.length} chunk{preview.length !== 1 ? "s" : ""}{" "}
            will be created
          </h2>
          <div className="border border-border bg-card max-h-96 overflow-auto divide-y divide-border">
            {preview.map((chunk) => (
              <div key={chunk.index} className="p-4 text-sm">
                <div className="flex items-center justify-between mb-1">
                  <span style={{ fontFamily: "var(--font-body)", fontSize: "0.68rem", fontWeight: 500, color: "#8A857E" }}>
                    Chunk {chunk.index + 1}
                  </span>
                  <span style={{ fontFamily: "var(--font-body)", fontSize: "0.68rem", color: "#8A857E" }}>
                    {chunk.word_count} words
                  </span>
                </div>
                <p style={{ fontFamily: "var(--font-body)", fontSize: "0.78rem", color: "#8A857E" }} className="line-clamp-3">
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
