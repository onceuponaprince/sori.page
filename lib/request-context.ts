import { randomUUID } from "crypto";
import type { NextRequest } from "next/server";
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

export async function requireRequestContext(req: NextRequest): Promise<RequestContext> {
  const requestId = req.headers.get("x-request-id") || randomUUID();
  const idempotencyKey =
    req.headers.get("x-idempotency-key") || `${requestId}:default`;
  const token = extractBearerToken(req);

  if (!token) {
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
      userId: data.user.id,
      email: data.user.email ?? null,
      tenantId: null,
      requestId,
      idempotencyKey,
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
    userId: data.user.id,
    email: data.user.email ?? null,
    tenantId: requestedTenantId,
    requestId,
    idempotencyKey,
  };
}
