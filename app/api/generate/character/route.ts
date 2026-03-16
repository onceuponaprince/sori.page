import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import {
  CHARACTER_ARCHETYPES,
  GENRES,
  TEMPLATE_SCENES,
} from "@/lib/narrative-concepts";

const anthropic = new Anthropic();

export async function POST(req: NextRequest) {
  try {
    const { archetype_id, genre, traits, scene_id } = await req.json();

    const selectedArchetype = CHARACTER_ARCHETYPES.find(
      (a) => a.id === archetype_id,
    );
    const selectedGenre = GENRES.find((g) => g.id === genre);

    if (!selectedArchetype || !selectedGenre) {
      return NextResponse.json(
        { error: "Invalid archetype or genre" },
        { status: 400 },
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

After the profile, provide "Structural Notes" explaining which narrative concepts shaped the character and why.`;

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

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const content =
      message.content[0].type === "text" ? message.content[0].text : "";

    const notesIndex = content.indexOf("Structural Notes");
    const profile = notesIndex > -1 ? content.slice(0, notesIndex).trim() : content;
    const notes = notesIndex > -1 ? content.slice(notesIndex).trim() : "";

    return NextResponse.json({
      profile,
      structural_notes: notes,
      metadata: {
        archetype: selectedArchetype,
        genre: selectedGenre,
        template_scene: templateScene || null,
        concepts_used: [
          selectedArchetype.name,
          ...selectedArchetype.typical_traits,
          selectedGenre.structural_tendency,
        ],
      },
    });
  } catch (error) {
    console.error("Character generation error:", error);
    return NextResponse.json(
      { error: "Generation failed. Check your ANTHROPIC_API_KEY." },
      { status: 500 },
    );
  }
}
