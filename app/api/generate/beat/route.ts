import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { STORY_BEATS, GENRES } from "@/lib/narrative-concepts";

const anthropic = new Anthropic();

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { genre, beat_id, context, user_id } = await req.json();

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

          // Save to Supabase if user is authenticated
          if (user_id) {
            try {
              const { createServerClient } = await import("@/lib/supabase");
              const supabase = createServerClient();
              await supabase.from("generations").insert({
                user_id,
                generation_type: "beat",
                input_params: { genre, beat_id, context },
                output_text: scene,
                structural_notes: notes,
                metadata,
                credits_used: 1,
              });
              // Deduct credit
              await supabase.rpc("deduct_credits", {
                p_user_id: user_id,
                p_amount: 1,
              });
            } catch (e) {
              console.error("Failed to save generation:", e);
            }
          }

          controller.close();
        });

        stream.on("error", (error) => {
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
      },
    });
  } catch (error) {
    console.error("Beat generation error:", error);
    return new Response(
      JSON.stringify({
        error: "Generation failed. Check your ANTHROPIC_API_KEY.",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
