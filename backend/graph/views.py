"""
Graph API views — query the Neo4j knowledge graph.

These endpoints let the Next.js frontend search and retrieve
concept nodes, function nodes, and their relationships.
"""
from rest_framework.decorators import api_view
from rest_framework.response import Response
from graph.models import ConceptNode, FunctionNode, InstanceNode


@api_view(["GET"])
def search_concepts(request):
    """Full-text search across concept and function nodes.

    GET /api/graph/concepts/search/?q=mentor+death&limit=10
    """
    query = request.query_params.get("q", "")
    limit = int(request.query_params.get("limit", 10))

    if not query:
        return Response({"results": [], "source": "neo4j"})

    # Use Neo4j full-text index for search
    from neomodel import db

    results_raw, _ = db.cypher_query(
        """
        CALL db.index.fulltext.queryNodes('concept_search', $query)
        YIELD node, score
        WHERE node.status = 'canonized'
        RETURN node.uid AS uid,
               node.name AS name,
               node.description AS description,
               node.depth_score AS depth_score,
               node.confidence AS confidence,
               score
        ORDER BY score DESC
        LIMIT $limit
        """,
        {"query": query, "limit": limit},
    )

    results = [
        {
            "uid": row[0],
            "name": row[1],
            "description": row[2],
            "depth_score": row[3],
            "confidence": row[4],
            "relevance_score": row[5],
            "type": "concept",
        }
        for row in results_raw
    ]

    # Also search function nodes
    func_results_raw, _ = db.cypher_query(
        """
        CALL db.index.fulltext.queryNodes('function_search', $query)
        YIELD node, score
        RETURN node.uid AS uid,
               node.name AS name,
               node.description AS description,
               node.depth_score AS depth_score,
               node.confidence AS confidence,
               score
        ORDER BY score DESC
        LIMIT $limit
        """,
        {"query": query, "limit": limit},
    )

    for row in func_results_raw:
        results.append(
            {
                "uid": row[0],
                "name": row[1],
                "description": row[2],
                "depth_score": row[3],
                "confidence": row[4],
                "relevance_score": row[5],
                "type": "function",
            }
        )

    # Sort combined results by relevance
    results.sort(key=lambda x: x["relevance_score"], reverse=True)

    return Response({"results": results[:limit], "source": "neo4j"})


@api_view(["GET"])
def get_concept(request, uid):
    """Get a single concept node with its relationships.

    GET /api/graph/concepts/<uid>/
    """
    try:
        concept = ConceptNode.nodes.get(uid=uid)
    except ConceptNode.DoesNotExist:
        return Response({"error": "Concept not found"}, status=404)

    # Get related concepts
    related = [
        {"uid": c.uid, "name": c.name, "depth_score": c.depth_score}
        for c in concept.related_to.all()
    ]

    # Get instances
    instances = [
        {
            "uid": i.uid,
            "description": i.description,
            "work": i.work,
            "verified": i.verified,
        }
        for i in concept.instances.all()[:20]
    ]

    # Check if it has a function
    functions = [
        {
            "uid": f.uid,
            "name": f.name,
            "parameters": f.parameters,
            "formula_description": f.formula_description,
        }
        for f in concept.has_function.all()
    ]

    return Response(
        {
            "uid": concept.uid,
            "name": concept.name,
            "description": concept.description,
            "depth_score": concept.depth_score,
            "confidence": concept.confidence,
            "status": concept.status,
            "related_concepts": related,
            "instances": instances,
            "functions": functions,
        }
    )


@api_view(["GET"])
def graph_stats(request):
    """Get overall graph statistics.

    GET /api/graph/stats/
    """
    from neomodel import db

    stats_raw, _ = db.cypher_query(
        """
        MATCH (c:ConceptNode) WITH count(c) AS concepts
        MATCH (f:FunctionNode) WITH concepts, count(f) AS functions
        MATCH (i:InstanceNode) WITH concepts, functions, count(i) AS instances
        MATCH (g:GapNode) WITH concepts, functions, instances, count(g) AS gaps
        RETURN concepts, functions, instances, gaps
        """
    )

    if stats_raw:
        row = stats_raw[0]
        return Response(
            {
                "concepts": row[0],
                "functions": row[1],
                "instances": row[2],
                "gaps": row[3],
            }
        )

    return Response({"concepts": 0, "functions": 0, "instances": 0, "gaps": 0})
