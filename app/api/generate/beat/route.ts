import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { STORY_BEATS, GENRES } from "@/lib/narrative-concepts";
import { reserveCredits, finalizeCreditReservation } from "@/lib/credits";
import { requireRequestContext } from "@/lib/request-context";
import { checkRateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { createAdminClient } from "@/lib/supabase/admin";

const anthropic = new Anthropic();

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let operationKey: string | null = null;
  let requestId: string | null = null;
  try {
    const contextInfo = await requireRequestContext(req);
    operationKey = `${contextInfo.idempotencyKey}:beat`;
    requestId = contextInfo.requestId;

    const rate = checkRateLimit(
      `beat:${contextInfo.tenantId ?? "user"}:${contextInfo.tenantId ?? contextInfo.userId}`,
    );
    if (!rate.allowed) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded" }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(rate.retryAfterSec),
            "X-Request-Id": contextInfo.requestId,
          },
        },
      );
    }

    const creditResult = await reserveCredits({
      userId: contextInfo.userId,
      tenantId: contextInfo.tenantId,
      cost: 1,
      operationKey,
      reason: "beat_generation",
    });
    if (!creditResult.allowed) {
      return new Response(
        JSON.stringify({ error: creditResult.error || "Not enough credits" }),
        {
          status: 402,
          headers: {
            "Content-Type": "application/json",
            "X-Request-Id": contextInfo.requestId,
          },
        },
      );
    }

    const { genre, beat_id, context } = await req.json();

    const selectedGenre = GENRES.find((g) => g.id === genre);
    const selectedBeat = STORY_BEATS.find((b) => b.id === beat_id);

    if (!selectedGenre || !selectedBeat) {
      return new Response(
        JSON.stringify({ error: "Invalid genre or beat selection" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const precedingBeats = selectedBeat.follows
      .map((id) => STORY_BEATS.find((b) => b.id === id))
      .filter(Boolean);
    const nextBeat = STORY_BEATS.find((b) => b.follows.includes(beat_id));

    const systemPrompt = `You are sori.page's narrative engine. You generate story scenes that are structurally grounded in verified narrative concepts.

You understand that stories work because of structural patterns, not random creativity. Every scene you generate must serve a specific narrative function within the story's architecture.

When generating a scene, you must:
1. Honor the structural function of the story beat
2. Match the emotional range of the beat
3. Reference relevant tropes naturally (don't name them, embody them)
4. Create forward momentum toward the next beat
5. Ground the scene in the genre's tonal expectations

After the scene, output the exact marker "---STRUCTURAL_NOTES---" on its own line, then provide structural notes explaining:
- Which narrative concepts drove the scene
- The emotional temperature and why
- What this scene sets up for the next beat
- Any trope warnings (structural gravity pulling toward clichés)

This transparency is what makes sori.page different — writers see the WHY, not just the output.`;

    const userPrompt = `Generate a scene for this story beat:

GENRE: ${selectedGenre.name} (tone: ${selectedGenre.tone}, structural tendency: ${selectedGenre.structural_tendency})

BEAT: ${selectedBeat.name} (${selectedBeat.act})
Function: ${selectedBeat.description}
Emotional range: ${selectedBeat.emotional_range[0]} to ${selectedBeat.emotional_range[1]} (scale: -1 despair to +1 triumph)
Associated tropes: ${selectedBeat.typical_tropes.join(", ")}

${precedingBeats.length > 0 ? `PRECEDING BEAT: ${precedingBeats.map((b) => `${b!.name} — ${b!.description}`).join("; ")}` : "This is the opening beat."}

${nextBeat ? `NEXT BEAT: ${nextBeat.name} — ${nextBeat.description}` : "This is the final beat."}

${context ? `WRITER'S CONTEXT: ${context}` : "No additional context provided. Generate a fresh scenario that demonstrates this beat's narrative function."}

Generate the scene (500-800 words of prose) followed by the structural notes.`;

    // Stream the response
    const stream = anthropic.messages.stream({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const metadata = {
      genre: selectedGenre,
      beat: selectedBeat,
      preceding_beats: precedingBeats,
      next_beat: nextBeat || null,
      concepts_used: [
        selectedBeat.name,
        ...selectedBeat.typical_tropes,
        selectedGenre.structural_tendency,
      ],
    };

    // Create a ReadableStream that sends SSE events
    const encoder = new TextEncoder();
    let fullText = "";

    const readable = new ReadableStream({
      async start(controller) {
        // Send metadata first
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "metadata", metadata })}\n\n`,
          ),
        );

        stream.on("text", (text) => {
          fullText += text;
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "text", text })}\n\n`,
            ),
          );
        });

        stream.on("end", async () => {
          // Parse scene vs notes using the marker
          const marker = "---STRUCTURAL_NOTES---";
          const markerIdx = fullText.indexOf(marker);
          const scene =
            markerIdx > -1 ? fullText.slice(0, markerIdx).trim() : fullText;
          const notes =
            markerIdx > -1 ? fullText.slice(markerIdx + marker.length).trim() : "";

          // Send completion event with parsed data
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "done", scene_length: scene.length, has_notes: !!notes })}\n\n`,
            ),
          );

          let generationId: number | null = null;
          try {
            const supabase = createAdminClient();
            const { data: generationRow, error: generationError } = await supabase
              .from("generations")
              .insert({
                user_id: contextInfo.userId,
                generation_type: "beat",
                input_params: { genre, beat_id, context, tenant_id: contextInfo.tenantId },
                output_text: scene,
                structural_notes: notes,
                metadata,
                credits_used: 1,
              })
              .select("id")
              .single();

            if (generationError) {
              throw generationError;
            }
            generationId = generationRow?.id ?? null;
            await finalizeCreditReservation({
              operationKey: operationKey!,
              success: true,
              generationId,
              requestId: contextInfo.requestId,
            });
            logAudit("beat_generation_success", {
              user_id: contextInfo.userId,
              tenant_id: contextInfo.tenantId,
              credits_delta: -1,
              endpoint: "/api/generate/beat",
              request_id: contextInfo.requestId,
            });
          } catch (e) {
            await finalizeCreditReservation({
              operationKey: operationKey!,
              success: false,
              generationId,
              requestId: contextInfo.requestId,
            });
            console.error("Failed to save generation:", e);
          }

          controller.close();
        });

        stream.on("error", (error) => {
          void finalizeCreditReservation({
            operationKey: operationKey!,
            success: false,
            requestId: contextInfo.requestId,
          });
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "error", error: String(error) })}\n\n`,
            ),
          );
          controller.close();
        });
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Request-Id": contextInfo.requestId,
      },
    });
  } catch (error) {
    if (operationKey && requestId) {
      try {
        await finalizeCreditReservation({
          operationKey,
          success: false,
          requestId,
        });
      } catch {
        // Ignore cleanup errors.
      }
    }
    console.error("Beat generation error:", error);
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error &&
          (error.message === "Authentication required" ||
            error.message === "Invalid auth token" ||
            error.message === "Tenant access denied")
            ? error.message
            : "Generation failed. Check your ANTHROPIC_API_KEY.",
      }),
      {
        status:
          error instanceof Error &&
          (error.message === "Authentication required" ||
            error.message === "Invalid auth token" ||
            error.message === "Tenant access denied")
            ? 401
            : 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
