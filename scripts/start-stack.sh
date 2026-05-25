#!/usr/bin/env bash
# Start local infrastructure for sori.page dev (Neo4j, Weaviate, Redis, context-engine).
#
# Usage:
#   ./scripts/start-stack.sh                  # default services
#   ./scripts/start-stack.sh neo4j redis      # subset only
#
# After this script, start app processes separately:
#   yarn dev                                  # frontend @ http://localhost:3010
#   cd backend && python manage.py runserver  # Django @ :8000 (if not using Docker backend)
#   cd backend && celery -A sori worker --loglevel=info  # simulations + async tasks

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ $# -gt 0 ]]; then
  SERVICES=("$@")
else
  SERVICES=(neo4j weaviate redis context-engine)
fi

echo "Starting Docker services: ${SERVICES[*]}"
docker compose up -d "${SERVICES[@]}"

echo ""
echo "Infrastructure is up."
echo "  Neo4j browser : http://localhost:7474  (neo4j / soripage_dev_2024)"
echo "  Weaviate      : http://localhost:8080"
echo "  Redis         : redis-cli -h localhost -p 6379 ping"
echo "  Context engine: http://localhost:8001"
echo ""
echo "Next (separate terminals):"
echo "  yarn dev"
echo "  cd backend && celery -A sori worker --loglevel=info   # required for Scene simulations"
echo "  cd backend && python manage.py runserver             # optional if not using Docker backend"
