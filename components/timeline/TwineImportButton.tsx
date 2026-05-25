"use client";

import { useCallback, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";

const headerChipStyle: CSSProperties = {
  background: "#1a1a2a",
  border: "1px solid #3a3a6a",
  borderRadius: 4,
  padding: "3px 8px",
  color: "#6a8abf",
  fontSize: 10,
  cursor: "pointer",
};

interface Props {
  defaultStoryTitle?: string;
}

async function buildAuthHeaders(): Promise<Record<string, string>> {
  const supabase = createBrowserClient();
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData.session;

  const headers: Record<string, string> = {};
  const accessToken = session?.access_token;
  const tenantId =
    (session?.user?.user_metadata?.tenant_id as string | undefined) ||
    (session?.user?.app_metadata?.tenant_id as string | undefined);

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  if (tenantId) {
    headers["X-Tenant-Id"] = tenantId;
  }
  return headers;
}

export function TwineImportButton({ defaultStoryTitle = "Imported Story" }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [storyTitle, setStoryTitle] = useState(defaultStoryTitle);
  const [pasteText, setPasteText] = useState("");
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitImport = useCallback(
    async (file: File) => {
      setImporting(true);
      setError(null);

      try {
        const form = new FormData();
        form.append("file", file);
        form.append("storyTitle", storyTitle.trim() || defaultStoryTitle);

        const res = await fetch("/api/story/import/twine", {
          method: "POST",
          headers: await buildAuthHeaders(),
          body: form,
        });

        const data = (await res.json().catch(() => null)) as
          | { storyUid?: string; error?: string }
          | null;

        if (!res.ok) {
          throw new Error(data?.error ?? `Import failed (${res.status})`);
        }

        const storyUid = data?.storyUid;
        if (!storyUid) {
          throw new Error("Import succeeded but no story ID was returned.");
        }

        setOpen(false);
        setPasteText("");
        router.push(`/story/${storyUid}/timeline`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Import failed");
      } finally {
        setImporting(false);
      }
    },
    [storyTitle, defaultStoryTitle, router],
  );

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) void submitImport(file);
      event.target.value = "";
    },
    [submitImport],
  );

  const handlePasteImport = useCallback(() => {
    const text = pasteText.trim();
    if (!text) {
      setError("Paste Twine HTML or Twee content first.");
      return;
    }
    const isHtml = text.startsWith("<!DOCTYPE") || text.startsWith("<html");
    const file = new File(
      [text],
      isHtml ? "import.html" : "import.tw",
      { type: isHtml ? "text/html" : "text/plain" },
    );
    void submitImport(file);
  }, [pasteText, submitImport]);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        style={headerChipStyle}
        aria-label="Import from Twine"
      >
        Import from Twine
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept=".html,.tw,.twee,text/html,text/plain"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="twine-import-title"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.65)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
            padding: 24,
          }}
          onClick={() => !importing && setOpen(false)}
        >
          <div
            style={{
              background: "#12121e",
              border: "1px solid #2a2040",
              borderRadius: 8,
              padding: "20px 24px",
              width: "100%",
              maxWidth: 480,
              color: "#e8e0f8",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="twine-import-title"
              style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}
            >
              Import from Twine
            </h2>

            <label
              htmlFor="twine-import-title-input"
              style={{ display: "block", fontSize: 11, color: "#8a7aaa", marginBottom: 4 }}
            >
              Story title
            </label>
            <input
              id="twine-import-title-input"
              value={storyTitle}
              onChange={(e) => setStoryTitle(e.target.value)}
              disabled={importing}
              style={{
                width: "100%",
                background: "#0a0a12",
                border: "1px solid #3a2a5a",
                borderRadius: 4,
                padding: "6px 8px",
                color: "#e8e0f8",
                fontSize: 12,
                marginBottom: 12,
              }}
            />

            <button
              type="button"
              disabled={importing}
              onClick={() => fileInputRef.current?.click()}
              style={{
                ...headerChipStyle,
                width: "100%",
                padding: "8px 12px",
                marginBottom: 12,
              }}
            >
              Choose .html or .tw file
            </button>

            <label
              htmlFor="twine-import-paste"
              style={{ display: "block", fontSize: 11, color: "#8a7aaa", marginBottom: 4 }}
            >
              Or paste Twine export
            </label>
            <textarea
              id="twine-import-paste"
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              disabled={importing}
              placeholder="Paste Twine 2 HTML or Twee source…"
              rows={6}
              style={{
                width: "100%",
                background: "#0a0a12",
                border: "1px solid #3a2a5a",
                borderRadius: 4,
                padding: "8px",
                color: "#e8e0f8",
                fontSize: 11,
                fontFamily: "monospace",
                resize: "vertical",
                marginBottom: 12,
              }}
            />

            {error && (
              <p
                role="alert"
                style={{ color: "#bf6a6a", fontSize: 11, marginBottom: 12 }}
              >
                {error}
              </p>
            )}

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                type="button"
                disabled={importing}
                onClick={() => setOpen(false)}
                style={{
                  background: "none",
                  border: "1px solid #3a2a5a",
                  borderRadius: 4,
                  padding: "6px 12px",
                  color: "#8a7aaa",
                  fontSize: 11,
                  cursor: importing ? "default" : "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={importing || !pasteText.trim()}
                onClick={handlePasteImport}
                style={{
                  ...headerChipStyle,
                  padding: "6px 12px",
                  opacity: importing || !pasteText.trim() ? 0.5 : 1,
                }}
              >
                {importing ? "Importing…" : "Import pasted content"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
