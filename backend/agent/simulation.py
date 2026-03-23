"""
SimulationManager — The Truth Guard engine for the Multiverse Scene Tester.

This module orchestrates the core simulation loop:
1. Build epistemic profiles for two characters from Neo4j
2. Construct the "Truth Guard" system prompt for each character
3. Run alternating Claude 3.5 Sonnet calls (Agent-A speaks, then Agent-B)
4. Validate each response for epistemic violations (paradox detection)
5. Identify natural decision points where the scene forks

ARCHITECTURE
────────────
The SimulationManager is a stateless service class — it doesn't hold
conversation history. All state lives in Neo4j (StateSnapshotNode) and
is passed in via method arguments. This makes it safe to use from both
Celery tasks (async) and Django views (sync).

The actual Celery tasks that call SimulationManager live in agent/tasks.py.

TRUTH GUARD MECHANISM
─────────────────────
The Truth Guard works by *epistemic injection*: we build two separate
system prompts, one per character, where the "You KNOW" and "You DO NOT
KNOW" sections are populated from Neo4j KNOWS_ABOUT relationships filtered
by the current StateSnapshot.

If Agent-A's response mentions anything from Agent-A's "DO NOT KNOW" list,
we flag it as a Structural Paradox. The detection is done by substring
matching on fact descriptions (fast, good enough for v1) with an optional
Claude-based semantic check for ambiguous cases.

IMPORTANT CONSTRAINTS
─────────────────────
- The simulation NEVER generates prose for the writer's novel. It only
  generates dialogue/action for the sandbox tester.
- The system measures plausibility and causality, never writing quality.
- Each simulation round produces 4-6 turns (configurable).
"""

import logging
import re
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone

from django.conf import settings

logger = logging.getLogger(__name__)


# ============================================================
# DATA CLASSES — Lightweight containers for simulation I/O
# ============================================================


@dataclass
class CharacterProfile:
    """A character's identity and knowledge envelope for prompt injection.

    Built from Neo4j CharacterNode + StateSnapshotNode data. This is
    the Python equivalent of the TypeScript EpistemicProfile type.
    """

    character_id: str
    character_name: str
    role_hint: str | None
    character_bio: str

    # Facts this character KNOWS at the current simulation point.
    # Each tuple is (fact_node_id, description, learned_at_beat).
    known_facts: list[tuple[str, str, int | None]] = field(default_factory=list)

    # Facts this character DOES NOT KNOW.
    # Same tuple structure as known_facts.
    unknown_facts: list[tuple[str, str, int | None]] = field(default_factory=list)


@dataclass
class DialogueTurn:
    """A single line of dialogue or action from one agent.

    This is the Python equivalent of the TypeScript DialogueTurn type.
    After generation, the validation pass may set is_paradox=True if
    the agent leaked information from the unknown_facts list.
    """

    id: str
    character_id: str
    character_name: str
    content: str
    is_paradox: bool = False
    paradox_detail: str | None = None
    generated_at: str = ""

    def __post_init__(self):
        if not self.generated_at:
            self.generated_at = datetime.now(timezone.utc).isoformat()

    def to_dict(self) -> dict:
        """Serialize to a dict matching the TypeScript DialogueTurn shape.

        This dict is stored in MultiverseSceneNode.dialogue_turns (JSON)
        and returned directly in API responses.
        """
        return {
            "id": self.id,
            "characterId": self.character_id,
            "characterName": self.character_name,
            "content": self.content,
            "isParadox": self.is_paradox,
            "paradoxDetail": self.paradox_detail,
            "generatedAt": self.generated_at,
        }


@dataclass
class SimulationResult:
    """The complete output of one simulation round.

    Returned by SimulationManager.run_simulation() and consumed by
    the Celery task to persist results into Neo4j.
    """

    turns: list[DialogueTurn]
    confidence_score: float
    is_paradox: bool
    paradox_count: int
    structural_pattern: str | None
    suggested_choices: list[dict]  # Potential decision branches


# ============================================================
# PROMPT TEMPLATES
# ============================================================

# The Truth Guard system prompt is the core of the epistemic injection.
# It's a template string with placeholders that get filled per-character.
#
# DESIGN NOTES:
# - The "CRITICAL" section uses emphatic language intentionally. In testing,
#   Claude respects constraints more reliably when they're marked as critical.
# - The "DO NOT KNOW" list is explicit rather than implied. Telling Claude
#   "you don't know X" is more reliable than "only use information from Y".
# - The interaction goal limits output length to prevent runaway generation.

TRUTH_GUARD_SYSTEM_PROMPT = """Role: You are acting as {character_name}. You are a participant \
in a narrative simulation designed to test structural plausibility.

Character Profile:
{character_bio}

Role in Story: {role_hint}

═══ The Truth Guard (CRITICAL) ═══

You only have access to information within your Epistemic State.

You KNOW:
{known_facts_formatted}

You DO NOT KNOW:
{unknown_facts_formatted}

Rule: If you mention, imply, or act upon information in the "DO NOT KNOW" \
list, the simulation will fail. This is the most important constraint.

═══ Interaction Goal ═══

Scene context: {scene_goal}

Exchange 1 line of dialogue or action to advance the current scene's \
dramatic question. Do not write for the other character. Act as \
{character_name} would based on their current goals and restricted knowledge.

Respond with ONLY your character's dialogue and/or brief action description. \
No narration, no stage directions for others, no meta-commentary."""


# The decision point detector prompt asks Claude to analyze the accumulated
# dialogue and identify natural fork points.

DECISION_DETECTOR_PROMPT = """You are a narrative structure analyst. Given the following \
simulated dialogue between two characters, identify if the scene has reached \
a natural decision point — a moment where the story could meaningfully branch \
in different directions.

Scene goal: {scene_goal}

Dialogue so far:
{dialogue_formatted}

Respond with a JSON object:
{{
  "is_decision_point": true/false,
  "reason": "brief explanation of why this is/isn't a fork point",
  "suggested_choices": [
    {{
      "label": "what happens if character chooses this path",
      "intent": "deception|confrontation|avoidance|truth|discovery|sacrifice"
    }}
  ]
}}

Only suggest 2-3 choices if is_decision_point is true. Each choice should \
represent a meaningfully different narrative direction, not minor variations."""


# ============================================================
# SIMULATION MANAGER
# ============================================================


class SimulationManager:
    """Orchestrates agent-to-agent dialogue simulation with epistemic constraints.

    USAGE:
        manager = SimulationManager()
        result = manager.run_simulation(
            scene_goal="Maya tries to steal the key",
            character_a=CharacterProfile(...),
            character_b=CharacterProfile(...),
            max_turns=6,
        )

    The manager is stateless — create a new instance per call or reuse it.
    All mutable state passes through method arguments.
    """

    def __init__(self):
        """Initialize the Anthropic client.

        The client is created lazily on first use so that importing this
        module doesn't require ANTHROPIC_API_KEY to be set (useful for
        testing and migrations).
        """
        self._client = None

    @property
    def client(self):
        """Lazy-initialize the Anthropic client on first access.

        We defer initialization because:
        1. Module-level imports shouldn't have side effects
        2. Tests may mock the client before the first call
        3. The API key might not be available at import time (e.g. CI)
        """
        if self._client is None:
            import anthropic

            self._client = anthropic.Anthropic(
                api_key=settings.ANTHROPIC_API_KEY
            )
        return self._client

    # ────────────────────────────────────────────────────────
    # PROMPT BUILDING
    # ────────────────────────────────────────────────────────

    def build_system_prompt(
        self,
        profile: CharacterProfile,
        scene_goal: str,
    ) -> str:
        """Construct the Truth Guard system prompt for a single character.

        This is where epistemic injection happens. The method takes a
        CharacterProfile (built from Neo4j data) and formats it into
        the system prompt template.

        Args:
            profile: The character's identity and knowledge envelope.
            scene_goal: The writer's scene description, e.g.
                       "Maya tries to steal the key without Elias noticing."

        Returns:
            A fully formatted system prompt string ready for Claude.
        """

        # Format the KNOWS list as a bulleted list.
        # Each fact includes its description and when the character learned it.
        # The beat information helps Claude understand temporal context.
        known_lines = []
        for _fact_id, description, learned_at in profile.known_facts:
            if learned_at is not None:
                known_lines.append(f"  - {description} (learned at beat {learned_at})")
            else:
                known_lines.append(f"  - {description} (known from the start)")

        # If the character knows nothing yet, say so explicitly.
        # An empty list might cause Claude to assume it can make things up.
        known_facts_formatted = (
            "\n".join(known_lines) if known_lines else "  (No specific facts established yet.)"
        )

        # Format the DO NOT KNOW list the same way.
        # This explicit listing is what makes the Truth Guard work —
        # Claude sees exactly what's off-limits.
        unknown_lines = []
        for _fact_id, description, _learned_at in profile.unknown_facts:
            unknown_lines.append(f"  - {description}")

        unknown_facts_formatted = (
            "\n".join(unknown_lines)
            if unknown_lines
            else "  (No restricted information at this point.)"
        )

        return TRUTH_GUARD_SYSTEM_PROMPT.format(
            character_name=profile.character_name,
            character_bio=profile.character_bio,
            role_hint=profile.role_hint or "unspecified",
            known_facts_formatted=known_facts_formatted,
            unknown_facts_formatted=unknown_facts_formatted,
            scene_goal=scene_goal,
        )

    # ────────────────────────────────────────────────────────
    # SINGLE AGENT CALL
    # ────────────────────────────────────────────────────────

    def generate_turn(
        self,
        system_prompt: str,
        conversation_history: list[dict],
        character_name: str,
    ) -> str:
        """Call Claude to generate a single dialogue turn for one character.

        This method handles the actual Anthropic API call. It's separated
        from run_simulation() so it can be individually mocked in tests.

        Args:
            system_prompt: The Truth Guard prompt for this character.
            conversation_history: Prior turns formatted as Claude messages.
                Each message is {"role": "user"|"assistant", "content": str}.
                We alternate roles: the *other* character's lines are "user"
                messages, and this character's prior lines are "assistant".
            character_name: For logging and error messages.

        Returns:
            The generated dialogue text (stripped of any meta-commentary).

        Raises:
            anthropic.APIError: If the Claude API call fails.
        """
        logger.info(
            "Generating turn for %s (history length: %d)",
            character_name,
            len(conversation_history),
        )

        # Claude's message API requires alternating user/assistant messages.
        # If the conversation is empty (first turn), we send a minimal user
        # message to kick things off.
        messages = conversation_history if conversation_history else [
            {"role": "user", "content": "(The scene begins. You speak first.)"}
        ]

        response = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=300,
            system=system_prompt,
            messages=messages,
        )

        # Extract just the text content, stripping any tool-use blocks
        # (Claude shouldn't use tools here, but defensive coding).
        raw_text = ""
        for block in response.content:
            if hasattr(block, "text"):
                raw_text += block.text

        # Clean up common artifacts: remove character name prefixes,
        # asterisk-wrapped actions, and excess whitespace.
        cleaned = raw_text.strip()

        # Remove lines that look like stage directions for the other character
        # (e.g. "*Elias reaches for the door*"). We want each agent to only
        # describe their own character's actions.
        lines = cleaned.split("\n")
        filtered = [
            line
            for line in lines
            if not self._is_other_character_action(line, character_name)
        ]

        return "\n".join(filtered).strip()

    def _is_other_character_action(self, line: str, own_name: str) -> bool:
        """Check if a line is a stage direction for a different character.

        Detects patterns like "*Elias nods slowly*" when the current
        character is Maya. We strip these because each agent should only
        control their own character.
        """
        # Match asterisk-wrapped actions: *Name does something*
        match = re.match(r"^\*(\w+)\s", line.strip())
        if match:
            name_in_line = match.group(1).lower()
            if name_in_line != own_name.lower().split()[0]:
                return True
        return False

    # ────────────────────────────────────────────────────────
    # PARADOX DETECTION
    # ────────────────────────────────────────────────────────

    def check_for_paradox(
        self,
        turn_content: str,
        profile: CharacterProfile,
    ) -> tuple[bool, str | None]:
        """Check if an agent's dialogue leaks information they shouldn't know.

        This is the v1 paradox detector. It uses substring matching on
        the unknown facts' descriptions. This is fast but imperfect —
        it can miss semantic paraphrases and can false-positive on
        coincidental word overlap.

        Future v2 could use a separate Claude call to do semantic
        paradox detection, but the latency cost isn't worth it for v1.

        Args:
            turn_content: The raw dialogue text from the agent.
            profile: The character's epistemic profile, including
                    the list of facts they should NOT know.

        Returns:
            A tuple of (is_paradox, detail_string).
            If no paradox: (False, None)
            If paradox: (True, "Character referenced 'the hidden will'...")
        """
        # Normalize the turn content for matching.
        # We lowercase and strip punctuation so "The Hidden Will" matches
        # "the hidden will" in the facts list.
        normalized_content = turn_content.lower()

        for _fact_id, description, _learned_at in profile.unknown_facts:
            # Extract key phrases from the fact description.
            # We split on common delimiters and check each phrase fragment.
            key_phrases = self._extract_key_phrases(description)

            for phrase in key_phrases:
                if phrase.lower() in normalized_content:
                    detail = (
                        f"{profile.character_name} referenced '{description}' "
                        f"which is in their DO NOT KNOW list"
                    )
                    logger.warning("Paradox detected: %s", detail)
                    return True, detail

        return False, None

    def _extract_key_phrases(self, fact_description: str) -> list[str]:
        """Extract matchable phrases from a fact description.

        We break the description into meaningful chunks for substring
        matching. Single common words are excluded to reduce false
        positives (e.g. "the", "was", "and").

        Args:
            fact_description: e.g. "Maya has the stolen letter from the attic"

        Returns:
            e.g. ["stolen letter", "letter from the attic", "stolen letter from the attic"]
        """
        # Remove very common words that would cause false positives
        stop_words = {
            "the", "a", "an", "is", "was", "are", "were", "be", "been",
            "has", "had", "have", "do", "does", "did", "will", "would",
            "could", "should", "may", "might", "can", "shall", "that",
            "this", "it", "its", "and", "or", "but", "in", "on", "at",
            "to", "for", "of", "with", "by", "from", "not", "no",
        }

        words = fact_description.lower().split()
        content_words = [w for w in words if w not in stop_words and len(w) > 2]

        phrases = []

        # Individual significant words (3+ chars, not stop words)
        # Only include if the word is distinctive enough (5+ chars)
        for word in content_words:
            if len(word) >= 5:
                phrases.append(word)

        # Bigrams of content words (most useful for matching)
        for i in range(len(content_words) - 1):
            phrases.append(f"{content_words[i]} {content_words[i + 1]}")

        return phrases

    # ────────────────────────────────────────────────────────
    # DECISION POINT DETECTION
    # ────────────────────────────────────────────────────────

    def detect_decision_point(
        self,
        scene_goal: str,
        turns: list[DialogueTurn],
    ) -> dict:
        """Ask Claude to analyze the dialogue and identify natural fork points.

        After the simulation generates 4-6 turns, we pass the accumulated
        dialogue to a separate Claude call that acts as a narrative analyst.
        It determines whether the scene has reached a moment where the
        story could meaningfully branch.

        Args:
            scene_goal: The writer's original scene description.
            turns: The dialogue turns generated so far.

        Returns:
            A dict with shape:
            {
                "is_decision_point": bool,
                "reason": str,
                "suggested_choices": [
                    {"label": str, "intent": str}, ...
                ]
            }
        """
        # Format the dialogue for the analyst prompt.
        dialogue_lines = []
        for turn in turns:
            dialogue_lines.append(f"{turn.character_name}: {turn.content}")

        dialogue_formatted = "\n".join(dialogue_lines)

        prompt = DECISION_DETECTOR_PROMPT.format(
            scene_goal=scene_goal,
            dialogue_formatted=dialogue_formatted,
        )

        response = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=500,
            messages=[{"role": "user", "content": prompt}],
        )

        raw_text = ""
        for block in response.content:
            if hasattr(block, "text"):
                raw_text += block.text

        # Parse the JSON response. Claude usually returns valid JSON when
        # asked for it explicitly, but we handle malformed responses gracefully.
        import json

        try:
            result = json.loads(raw_text.strip())
        except json.JSONDecodeError:
            # If Claude didn't return valid JSON, try to extract it from
            # a markdown code block (Claude sometimes wraps JSON in ```).
            json_match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", raw_text, re.DOTALL)
            if json_match:
                result = json.loads(json_match.group(1))
            else:
                logger.warning(
                    "Decision detector returned non-JSON: %s", raw_text[:200]
                )
                result = {
                    "is_decision_point": False,
                    "reason": "Could not parse analyst response",
                    "suggested_choices": [],
                }

        return result

    # ────────────────────────────────────────────────────────
    # MAIN SIMULATION LOOP
    # ────────────────────────────────────────────────────────

    def run_simulation(
        self,
        scene_goal: str,
        character_a: CharacterProfile,
        character_b: CharacterProfile,
        max_turns: int = 6,
        intent: str | None = None,
    ) -> SimulationResult:
        """Execute a full simulation round between two character agents.

        This is the main entry point. It:
        1. Builds Truth Guard prompts for both characters
        2. Alternates between Agent-A and Agent-B for max_turns
        3. Checks each turn for epistemic violations
        4. After all turns, asks the decision detector for fork points
        5. Returns a SimulationResult with everything the caller needs

        TURN ALTERNATION:
        Turn 0 → Agent-A speaks (role: assistant, Agent-B sees it as: user)
        Turn 1 → Agent-B speaks (role: assistant, Agent-A sees it as: user)
        Turn 2 → Agent-A speaks ...and so on.

        Each agent only sees the conversation from their own perspective.
        When Agent-A speaks, that text becomes a "user" message in Agent-B's
        conversation history (and vice versa).

        Args:
            scene_goal: The writer's scene description.
            character_a: First character's epistemic profile.
            character_b: Second character's epistemic profile.
            max_turns: Maximum dialogue turns (4-6 recommended).
            intent: Optional intent from a parent ChoiceEdge. Appended
                   to the scene_goal to bias the simulation direction.

        Returns:
            SimulationResult with all turns, metadata, and suggested choices.
        """
        # Optionally append the choice intent to the scene goal.
        # e.g. scene_goal="Maya enters the study" + intent="deception"
        # becomes "Maya enters the study. The dominant dramatic intent is deception."
        effective_goal = scene_goal
        if intent:
            effective_goal += f" The dominant dramatic intent is {intent}."

        # Build the Truth Guard system prompts for both characters.
        prompt_a = self.build_system_prompt(character_a, effective_goal)
        prompt_b = self.build_system_prompt(character_b, effective_goal)

        # Conversation histories — separate for each agent.
        # Agent-A's history has their own lines as "assistant" and B's as "user".
        # Agent-B's history is the mirror.
        history_a: list[dict] = []
        history_b: list[dict] = []

        turns: list[DialogueTurn] = []
        total_paradox_count = 0

        for turn_index in range(max_turns):
            # Determine which agent speaks this turn.
            # Even turns → Agent-A, Odd turns → Agent-B.
            is_agent_a_turn = turn_index % 2 == 0
            current_profile = character_a if is_agent_a_turn else character_b
            current_prompt = prompt_a if is_agent_a_turn else prompt_b
            current_history = history_a if is_agent_a_turn else history_b

            # Generate the dialogue turn.
            content = self.generate_turn(
                system_prompt=current_prompt,
                conversation_history=current_history,
                character_name=current_profile.character_name,
            )

            # Check for epistemic violations (paradox detection).
            is_paradox, paradox_detail = self.check_for_paradox(
                content, current_profile
            )

            if is_paradox:
                total_paradox_count += 1

            # Create the DialogueTurn object.
            turn = DialogueTurn(
                id=str(uuid.uuid4()),
                character_id=current_profile.character_id,
                character_name=current_profile.character_name,
                content=content,
                is_paradox=is_paradox,
                paradox_detail=paradox_detail,
            )
            turns.append(turn)

            # Update BOTH conversation histories.
            # For the agent that just spoke: their line is "assistant".
            # For the other agent: this line becomes "user" input.
            if is_agent_a_turn:
                history_a.append({"role": "assistant", "content": content})
                history_b.append({"role": "user", "content": content})
            else:
                history_b.append({"role": "assistant", "content": content})
                history_a.append({"role": "user", "content": content})

            logger.info(
                "Turn %d/%d: %s said: %s",
                turn_index + 1,
                max_turns,
                current_profile.character_name,
                content[:80],
            )

        # After all turns, detect decision points.
        decision_analysis = self.detect_decision_point(scene_goal, turns)

        # Compute confidence score.
        # Start at 1.0 and deduct for paradoxes.
        # Each paradox costs 0.2 confidence (so 5+ paradoxes = 0.0).
        confidence = max(0.0, 1.0 - (total_paradox_count * 0.2))

        return SimulationResult(
            turns=turns,
            confidence_score=confidence,
            is_paradox=total_paradox_count > 0,
            paradox_count=total_paradox_count,
            structural_pattern=None,  # v2: classify with knowledge graph
            suggested_choices=decision_analysis.get("suggested_choices", []),
        )
