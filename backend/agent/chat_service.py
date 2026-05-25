"""Solo character chat — sync SSE streaming for Talk tab."""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Iterator

logger = logging.getLogger(__name__)

MAX_HISTORY = 20


def _sse(event: dict) -> str:
    return f"data: {json.dumps(event)}\n\n"


def character_profile_from_node(char_node, profile_dict: dict):
    from agent.simulation import CharacterProfile

    known = [
        (f.get("factNodeId", ""), f.get("description", ""), f.get("learnedAtBeat"))
        for f in profile_dict.get("knownFacts", [])
    ]
    unknown = [
        (f.get("factNodeId", ""), f.get("description", ""), f.get("learnedAtBeat"))
        for f in profile_dict.get("unknownFacts", [])
    ]
    return CharacterProfile(
        character_id=char_node.uid,
        character_name=char_node.name,
        role_hint=char_node.role_hint,
        character_bio=profile_dict.get("characterBio", char_node.name),
        known_facts=known,
        unknown_facts=unknown,
    )


def stream_character_chat(
    *,
    char_node,
    profile_dict: dict,
    user_message: str,
    prior_messages: list[dict],
) -> Iterator[str]:
    """Yield SSE chunks for a single in-character reply."""
    if not char_node.published_at:
        yield _sse({"type": "error", "error": "CHARACTER_NOT_PUBLISHED"})
        return

    profile = character_profile_from_node(char_node, profile_dict)
    from agent.simulation import SimulationManager

    manager = SimulationManager()

    history = prior_messages[-MAX_HISTORY:]
    claude_messages = []
    for msg in history:
        role = "assistant" if msg.get("role") == "assistant" else "user"
        claude_messages.append({"role": role, "content": msg.get("content", "")})
    claude_messages.append({"role": "user", "content": user_message})

    system_prompt = manager.build_system_prompt(
        profile,
        scene_goal="Respond in character to the writer's message. Stay in dialogue and action — do not write novel prose for the writer.",
    )

    try:
        stream = manager.client.messages.stream(
            model="claude-sonnet-4-20250514",
            max_tokens=400,
            system=system_prompt,
            messages=claude_messages,
        )
        full_text = ""
        with stream as s:
            for event in s:
                if event.type == "content_block_delta" and hasattr(event.delta, "text"):
                    chunk = event.delta.text
                    full_text += chunk
                    yield _sse({"type": "text", "text": chunk})
    except Exception as exc:
        logger.exception("Chat stream failed")
        yield _sse({"type": "error", "error": str(exc)})
        return

    yield _sse({
        "type": "done",
        "assistantMessage": full_text.strip(),
        "at": datetime.now(timezone.utc).isoformat(),
    })


def append_thread_messages(thread, user_message: str, assistant_message: str) -> None:
    messages = list(thread.messages or [])
    now = datetime.now(timezone.utc).isoformat()
    messages.append({"role": "user", "content": user_message, "at": now})
    messages.append({"role": "assistant", "content": assistant_message, "at": now})
    thread.messages = messages[-(MAX_HISTORY * 2):]
    thread.updated_at = datetime.now(timezone.utc)
    thread.save()
