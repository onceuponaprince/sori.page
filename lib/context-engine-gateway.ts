import { createAdminClient } from "@/lib/supabase/admin";

export interface EngineRouteTarget {
  baseUrl: string;
  apiKey: string | null;
  tenantId: string | null;
}

export async function resolveEngineTarget(tenantId: string | null): Promise<EngineRouteTarget> {
  const fallbackUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";
  if (!tenantId) {
    return { baseUrl: fallbackUrl, apiKey: null, tenantId: null };
  }

  const supabase = createAdminClient();
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, engine_base_url, engine_auth_mode")
    .eq("id", tenantId)
    .maybeSingle();

  if (!tenant) {
    return { baseUrl: fallbackUrl, apiKey: null, tenantId };
  }

  if (tenant.engine_auth_mode !== "api_key") {
    return {
      baseUrl: tenant.engine_base_url || fallbackUrl,
      apiKey: null,
      tenantId,
    };
  }

  const { data: keyRow } = await supabase
    .from("tenant_api_keys")
    .select("api_key")
    .eq("tenant_id", tenantId)
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    baseUrl: tenant.engine_base_url || fallbackUrl,
    apiKey: keyRow?.api_key ?? null,
    tenantId,
  };
}

export async function fetchContextEngine(
  tenantId: string | null,
  path: string,
  init: RequestInit,
) {
  const target = await resolveEngineTarget(tenantId);
  const headers = new Headers(init.headers || {});
  if (target.apiKey) {
    headers.set("X-API-Key", target.apiKey);
  }
  if (target.tenantId) {
    headers.set("X-Tenant-Id", target.tenantId);
  }
  return fetch(`${target.baseUrl}${path}`, { ...init, headers });
}
