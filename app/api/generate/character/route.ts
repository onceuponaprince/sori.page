import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import {
  CHARACTER_ARCHETYPES,
  GENRES,
  TEMPLATE_SCENES,
} from "@/lib/narrative-concepts";

const anthropic = new Anthropic();

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { archetype_id, genre, traits, scene_id, user_id } = await req.json();

    const selectedArchetype = CHARACTER_ARCHETYPES.find(
      (a) => a.id === archetype_id,
    );
    const selectedGenre = GENRES.find((g) => g.id === genre);

    if (!selectedArchetype || !selectedGenre) {
      return new Response(
        JSON.stringify({ error: "Invalid archetype or genre" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const templateScene = scene_id
      ? TEMPLATE_SCENES.find((s) => s.id === scene_id)
      : null;

    const systemPrompt = `You are sori.page's character engine. You generate characters that are structurally grounded — meaning they exist to serve a specific narrative function, not just to be interesting.

A good character is defined by their role in the story's architecture:
- What narrative function do they serve?
- How do they relate to other archetypes?
- What is their arc potential?
- What makes them fit THIS genre specifically?

Generate a character profile with:
1. Name and brief physical impression (2 sentences max)
2. Core wound / internal conflict
3. Narrative function (what they DO for the story structurally)
4. Key traits (5-6 specific traits, not generic)
5. Voice sample (a paragraph of how they speak/think)
6. Arc potential (where they start → where they could end)
7. Relationship dynamics (how they interact with other archetypes)

${templateScene ? `Then write a short scene (300-500 words) inserting this character into the template scene provided. Show how they inhabit the archetype while being unique.` : ""}

After the profile and scene (if applicable), output the exact marker "---STRUCTURAL_NOTES---" on its own line, then explain which narrative concepts shaped the character and why.`;

    const userPrompt = `Generate a character:

ARCHETYPE: ${selectedArchetype.name}
Function: ${selectedArchetype.narrative_function}
Typical traits (as starting point, not requirements): ${selectedArchetype.typical_traits.join(", ")}
Relationship dynamics: ${selectedArchetype.relationships.map((r) => `${r.archetype}: ${r.dynamic}`).join("; ")}

GENRE: ${selectedGenre.name} (tone: ${selectedGenre.tone})

${traits ? `WRITER'S TRAITS/DIRECTION: ${traits}` : "Create a fresh, surprising take on this archetype."}

${
  templateScene
    ? `TEMPLATE SCENE: "${templateScene.scene_name}" from ${templateScene.work}
Scene context: ${templateScene.description}
Character slot: ${templateScene.character_slots.find((s) => s.archetype === archetype_id)?.description || "Adapt to fit"}
After the character profile, write them INTO this scene.`
    : ""
}`;

    const metadata = {
      archetype: selectedArchetype,
      genre: selectedGenre,
      template_scene: templateScene || null,
      concepts_used: [
        selectedArchetype.name,
        ...selectedArchetype.typical_traits,
        selectedGenre.structural_tendency,
      ],
    };

    // Stream the response
    const stream = anthropic.messages.stream({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const encoder = new TextEncoder();
    let fullText = "";

    const readable = new ReadableStream({
      async start(controller) {
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
          const marker = "---STRUCTURAL_NOTES---";
          const markerIdx = fullText.indexOf(marker);
          const profile =
            markerIdx > -1 ? fullText.slice(0, markerIdx).trim() : fullText;
          const notes =
            markerIdx > -1
              ? fullText.slice(markerIdx + marker.length).trim()
              : "";

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "done", profile_length: profile.length, has_notes: !!notes })}\n\n`,
            ),
          );

          if (user_id) {
            try {
              const { createServerClient } = await import("@/lib/supabase");
              const supabase = createServerClient();
              await supabase.from("generations").insert({
                user_id,
                generation_type: "character",
                input_params: { archetype_id, genre, traits, scene_id },
                output_text: profile,
                structural_notes: notes,
                metadata,
                credits_used: 1,
              });
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
    console.error("Character generation error:", error);
    return new Response(
      JSON.stringify({
        error: "Generation failed. Check your ANTHROPIC_API_KEY.",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
