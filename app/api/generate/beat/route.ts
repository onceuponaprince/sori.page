import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { STORY_BEATS, GENRES, type GenreId } from "@/lib/narrative-concepts";

const anthropic = new Anthropic();

export async function POST(req: NextRequest) {
  try {
    const { genre, beat_id, context } = await req.json();

    // Validate inputs
    const selectedGenre = GENRES.find((g) => g.id === genre);
    const selectedBeat = STORY_BEATS.find((b) => b.id === beat_id);

    if (!selectedGenre || !selectedBeat) {
      return NextResponse.json(
        { error: "Invalid genre or beat selection" },
        { status: 400 },
      );
    }

    // Find preceding beat for structural context
    const precedingBeats = selectedBeat.follows
      .map((id) => STORY_BEATS.find((b) => b.id === id))
      .filter(Boolean);

    // Find the next beat for forward momentum
    const nextBeat = STORY_BEATS.find((b) => b.follows.includes(beat_id));

    const systemPrompt = `You are sori.page's narrative engine. You generate story scenes that are structurally grounded in verified narrative concepts.

You understand that stories work because of structural patterns, not random creativity. Every scene you generate must serve a specific narrative function within the story's architecture.

When generating a scene, you must:
1. Honor the structural function of the story beat
2. Match the emotional range of the beat
3. Reference relevant tropes naturally (don't name them, embody them)
4. Create forward momentum toward the next beat
5. Ground the scene in the genre's tonal expectations

After the scene, provide a "Structural Notes" section that explains:
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

Generate the scene (500-800 words of prose) followed by the Structural Notes analysis.`;

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const content =
      message.content[0].type === "text" ? message.content[0].text : "";

    // Split scene from structural notes
    const notesIndex = content.indexOf("Structural Notes");
    const scene = notesIndex > -1 ? content.slice(0, notesIndex).trim() : content;
    const notes =
      notesIndex > -1 ? content.slice(notesIndex).trim() : "";

    return NextResponse.json({
      scene,
      structural_notes: notes,
      metadata: {
        genre: selectedGenre,
        beat: selectedBeat,
        preceding_beats: precedingBeats,
        next_beat: nextBeat || null,
        concepts_used: [
          selectedBeat.name,
          ...selectedBeat.typical_tropes,
          selectedGenre.structural_tendency,
        ],
      },
    });
  } catch (error) {
    console.error("Beat generation error:", error);
    return NextResponse.json(
      { error: "Generation failed. Check your ANTHROPIC_API_KEY." },
      { status: 500 },
    );
  }
}
