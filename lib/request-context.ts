import { randomUUID } from "crypto";
import type { NextRequest } from "next/server";
import { getDevSessionContextFromRequest } from "@/lib/dev-session";
import { createAdminClient } from "@/lib/supabase/admin";

export interface RequestContext {
  userId: string;
  email: string | null;
  tenantId: string | null;
  requestId: string;
  idempotencyKey: string;
}

function extractBearerToken(req: NextRequest): string | null {
  const authHeader = req.headers.get("authorization") || "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return null;
  }
  return authHeader.slice(7).trim() || null;
}

function baseContext(
  req: NextRequest,
  userId: string,
  email: string | null,
): Pick<RequestContext, "requestId" | "idempotencyKey" | "userId" | "email"> {
  const requestId = req.headers.get("x-request-id") || randomUUID();
  const idempotencyKey =
    req.headers.get("x-idempotency-key") || `${requestId}:default`;

  return { userId, email, requestId, idempotencyKey };
}

async function resolveDevSessionContext(
  req: NextRequest,
): Promise<RequestContext | null> {
  const devSession = await getDevSessionContextFromRequest(req);
  if (!devSession) {
    return null;
  }

  const requestedTenantId = req.headers.get("x-tenant-id");
  if (requestedTenantId) {
    throw new Error("Tenant access denied");
  }

  return {
    ...baseContext(req, devSession.userId, devSession.email),
    tenantId: null,
  };
}

export async function requireRequestContext(req: NextRequest): Promise<RequestContext> {
  const token = extractBearerToken(req);

  if (!token) {
    const devContext = await resolveDevSessionContext(req);
    if (devContext) {
      return devContext;
    }
    throw new Error("Authentication required");
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    throw new Error("Invalid auth token");
  }

  const requestedTenantId = req.headers.get("x-tenant-id");
  if (!requestedTenantId) {
    return {
      ...baseContext(req, data.user.id, data.user.email ?? null),
      tenantId: null,
    };
  }

  const { data: membership } = await supabase
    .from("tenant_memberships")
    .select("tenant_id")
    .eq("tenant_id", requestedTenantId)
    .eq("user_id", data.user.id)
    .eq("status", "active")
    .maybeSingle();

  if (!membership) {
    throw new Error("Tenant access denied");
  }

  return {
    ...baseContext(req, data.user.id, data.user.email ?? null),
    tenantId: requestedTenantId,
  };
}
