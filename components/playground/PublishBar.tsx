"use client";

interface PublishBarProps {
  dirty: boolean;
  isPublished: boolean;
  saving: boolean;
  publishing: boolean;
  error: string | null;
  staleRevision?: boolean;
  onSave: () => void;
  onPublish: () => void;
  onDiscard: () => void;
  onReload?: () => void;
}

export function PublishBar({
  dirty,
  isPublished,
  saving,
  publishing,
  error,
  staleRevision = false,
  onSave,
  onPublish,
  onDiscard,
  onReload,
}: PublishBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-border bg-card px-4 py-3">
      <button
        type="button"
        onClick={onSave}
        disabled={!dirty || saving || staleRevision}
        className="border border-border px-4 py-2 text-sm disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save draft"}
      </button>
      <button
        type="button"
        onClick={onPublish}
        disabled={publishing || staleRevision}
        className="border border-accent bg-accent px-4 py-2 text-sm text-white disabled:opacity-50"
      >
        {publishing ? "Publishing…" : "Publish to graph"}
      </button>
      {isPublished && (
        <button
          type="button"
          onClick={onDiscard}
          disabled={staleRevision}
          className="border border-border px-4 py-2 text-sm text-muted-foreground disabled:opacity-50"
        >
          Discard draft changes
        </button>
      )}
      {dirty && !staleRevision && (
        <span className="text-xs text-amber-600">Unsaved changes</span>
      )}
      {staleRevision && (
        <div className="flex flex-wrap items-center gap-2" role="alert">
          <span className="text-xs text-red-600">
            This draft changed elsewhere. Reload the latest version before saving or publishing.
          </span>
          {onReload && (
            <button
              type="button"
              onClick={onReload}
              className="border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
            >
              Reload character
            </button>
          )}
        </div>
      )}
      {error && !staleRevision && (
        <span className="text-xs text-red-600" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
