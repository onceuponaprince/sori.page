import { NextRequest, NextResponse } from "next/server";
import { requireRequestContext } from "@/lib/request-context";
import { getCreditBalance } from "@/lib/credits";

export async function GET(req: NextRequest) {
  try {
    const context = await requireRequestContext(req);
    const balance = await getCreditBalance({
      userId: context.userId,
      tenantId: context.tenantId,
    });
    return NextResponse.json({ balance, tenant_id: context.tenantId });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch balance" },
      { status: 401 },
    );
  }
}
