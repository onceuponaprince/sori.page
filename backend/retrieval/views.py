from rest_framework.decorators import api_view
from rest_framework.response import Response

from retrieval.services import build_structural_context


@api_view(["POST"])
def analyze_outline(request):
    data = request.data or {}
    outline = data.get("outline", "")
    title = data.get("title")
    story_uid = data.get("story_uid")
    enrich = data.get("enrich", False)

    if not outline or not str(outline).strip():
        return Response({"error": "Outline is required"}, status=400)

    payload = build_structural_context(
        str(outline),
        title=title,
        story_uid=story_uid,
    )

    if enrich and story_uid:
        try:
            from retrieval.epistemic_llm import enrich_epistemic_graph
            enriched = enrich_epistemic_graph(
                story_uid=story_uid,
                outline=str(outline),
                heuristic_state=payload.get("epistemic_state"),
            )
            if enriched:
                payload["epistemic_state"] = enriched
        except Exception:
            pass

    return Response(payload)


@api_view(["GET"])
def epistemic_state(request, story_uid: str):
    """Return the current epistemic graph for a story."""
    if not story_uid or not story_uid.strip():
        return Response({"error": "story_uid is required"}, status=400)

    try:
        from retrieval.epistemic import get_epistemic_state
        state = get_epistemic_state(story_uid)
        return Response(state)
    except Exception as exc:
        return Response({"error": str(exc)}, status=500)
