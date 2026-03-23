import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const {
      story_uid,
      scene_uid,
      title,
      outline_text,
      editor_json,
      analyzer_snapshot,
      user_id,
    } = (await req.json()) as {
      story_uid?: string;
      scene_uid?: string;
      title?: string;
      outline_text?: string;
      editor_json?: Record<string, unknown>;
      analyzer_snapshot?: Record<string, unknown>;
      user_id?: string | null;
    };

    if (!story_uid || !scene_uid) {
      return jsonError("story_uid and scene_uid are required", 400);
    }

    const supabase = createServerClient();
    const payload = {
      user_id: user_id ?? null,
      story_uid,
      scene_uid,
      title: title?.trim() || "Untitled treehouse draft",
      outline_text: outline_text ?? "",
      editor_json: editor_json ?? {},
      analyzer_snapshot: analyzer_snapshot ?? {},
      last_analysis_at:
        analyzer_snapshot && Object.keys(analyzer_snapshot).length > 0
          ? new Date().toISOString()
          : null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("story_drafts")
      .upsert(payload, { onConflict: "story_uid" })
      .select("story_uid, scene_uid, updated_at")
      .single();

    if (error) {
      return jsonError(error.message, 500);
    }

    return new Response(JSON.stringify({ draft: data }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to save draft",
      500,
    );
  }
}

function jsonError(error: string, status: number) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
