import type { TruthGuardPromptParams } from "@/types/multiverse";

/**
 * Builds the **Truth-Guard** system prompt for a single Claude character proxy.
 *
 * Epistemic injection pattern:
 * - Lists are injected verbatim so the model’s allowed knowledge is explicit.
 * - “DO NOT KNOW” is framed as a hard simulation rule, not a suggestion.
 *
 * Call this once per agent (Character A and Character B) with that character’s
 * own KNOWS / NOT-KNOWS lists — they will differ unless symmetric knowledge.
 */
export function buildTruthGuardSystemPrompt(params: TruthGuardPromptParams): string {
  const knowsBlock = formatBulletList(params.knowsAbout);
  const forbiddenBlock = formatBulletList(params.doesNotKnow);

  return [
    `Role: You are acting as ${params.characterName}.`,
    "You are a participant in a narrative simulation designed to test structural plausibility.",
    "",
    "Character Profile:",
    params.characterProfile.trim(),
    "",
    "The Truth Guard (CRITICAL):",
    "You only have access to information within your Epistemic State.",
    "",
    "You KNOW:",
    knowsBlock,
    "",
    "You DO NOT KNOW:",
    forbiddenBlock,
    "",
    "Rule: If you mention, imply, or act upon information in the DO NOT KNOW list, the simulation will fail.",
    "",
    "Interaction Goal:",
    `Exchange 3-5 lines of dialogue to resolve the current scene's dramatic question: ${params.sceneGoal.trim()}`,
    "Do not write for the user; act as the character would based on their current goals and restricted knowledge.",
  ].join("\n");
}

/**
 * Turns string arrays into `- item` lines. Empty arrays become a clear “(none)” line
 * so the model does not invent placeholders.
 */
function formatBulletList(items: string[]): string {
  const cleaned = items.map((s) => s.trim()).filter(Boolean);
  if (cleaned.length === 0) {
    return "(none)";
  }
  return cleaned.map((line) => `- ${line}`).join("\n");
}
