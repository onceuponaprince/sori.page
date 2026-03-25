from __future__ import annotations

import uuid

from django.conf import settings
from django.http import JsonResponse

from sori.engine_boundary import parse_engine_api_keys


class ContextEngineApiKeyMiddleware:
    """
    Optional API-key protection for engine endpoints.

    Enabled in `sori.settings_engine` when ENGINE_REQUIRE_API_KEY=true.
    """

    API_HEADER = "HTTP_X_API_KEY"
    TENANT_HEADER = "HTTP_X_TENANT_ID"

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request.engine_request_id = request.META.get("HTTP_X_REQUEST_ID") or str(uuid.uuid4())
        configured = parse_engine_api_keys(getattr(settings, "ENGINE_API_KEYS", ""))
        if not configured:
            # Middleware should be a no-op if no keys are configured.
            response = self.get_response(request)
            response["X-Request-Id"] = request.engine_request_id
            return response

        request_key = (request.META.get(self.API_HEADER) or "").strip()
        request_tenant = (request.META.get(self.TENANT_HEADER) or "").strip()

        if not request_key:
            return JsonResponse(
                {"error": "Missing API key", "code": "API_KEY_REQUIRED"},
                status=401,
            )

        matched_tenant: str | None = None
        for candidate in configured:
            if candidate.key != request_key:
                continue
            if candidate.tenant_id and candidate.tenant_id != request_tenant:
                continue
            matched_tenant = candidate.tenant_id
            break

        if matched_tenant is None and request_key:
            # Accept unscoped key entries (no tenant_id) for single-tenant installs.
            has_unscoped = any(c.key == request_key and c.tenant_id is None for c in configured)
            if not has_unscoped:
                return JsonResponse(
                    {"error": "Invalid API key", "code": "API_KEY_INVALID"},
                    status=403,
                )

        request.engine_tenant_id = request_tenant or matched_tenant
        response = self.get_response(request)
        response["X-Request-Id"] = request.engine_request_id
        return response
