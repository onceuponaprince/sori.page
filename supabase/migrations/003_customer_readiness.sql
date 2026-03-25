-- ============================================================
-- sori.page — Customer readiness (auth, billing, credits, tenancy)
-- ============================================================

-- Hybrid tenancy control-plane tables
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    plan TEXT NOT NULL DEFAULT 'starter',
    status TEXT NOT NULL DEFAULT 'active',
    deployment_mode TEXT NOT NULL DEFAULT 'shared' CHECK (deployment_mode IN ('shared', 'dedicated')),
    engine_base_url TEXT,
    engine_auth_mode TEXT NOT NULL DEFAULT 'api_key' CHECK (engine_auth_mode IN ('none', 'api_key')),
    credit_balance INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tenant_memberships (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited', 'disabled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, user_id)
);

CREATE TABLE IF NOT EXISTS tenant_api_keys (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    api_key TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tenant_api_keys_active ON tenant_api_keys(tenant_id, active);

-- Stripe billing state
CREATE TABLE IF NOT EXISTS billing_customers (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    stripe_customer_id TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (tenant_id IS NOT NULL OR user_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS subscriptions (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    stripe_subscription_id TEXT NOT NULL UNIQUE,
    stripe_customer_id TEXT NOT NULL,
    stripe_price_id TEXT,
    status TEXT NOT NULL,
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (tenant_id IS NOT NULL OR user_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS billing_webhook_events (
    id BIGSERIAL PRIMARY KEY,
    stripe_event_id TEXT NOT NULL UNIQUE,
    event_type TEXT NOT NULL,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    payload JSONB NOT NULL DEFAULT '{}'
);

-- Immutable credit ledger
CREATE TABLE IF NOT EXISTS credit_ledger (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    entry_type TEXT NOT NULL CHECK (entry_type IN ('grant', 'reserve', 'release', 'adjustment')),
    reason TEXT NOT NULL,
    operation_key TEXT,
    generation_id BIGINT REFERENCES generations(id),
    request_id TEXT,
    stripe_event_id TEXT,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (user_id IS NOT NULL OR tenant_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_credit_ledger_user ON credit_ledger(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_ledger_tenant ON credit_ledger(tenant_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_ledger_operation_entry ON credit_ledger(operation_key, entry_type) WHERE operation_key IS NOT NULL;

-- Helper for tenant membership checks in policies
CREATE OR REPLACE FUNCTION is_tenant_member(p_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM tenant_memberships tm
        WHERE tm.tenant_id = p_tenant_id
          AND tm.user_id = auth.uid()
          AND tm.status = 'active'
    );
$$;

-- Reserve credits atomically for a billable operation
CREATE OR REPLACE FUNCTION reserve_credits(
    p_user_id UUID,
    p_tenant_id UUID,
    p_amount INTEGER,
    p_operation_key TEXT,
    p_reason TEXT
)
RETURNS TABLE (allowed BOOLEAN, remaining INTEGER, reservation_id BIGINT, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_profile_credits INTEGER;
    v_tenant_credits INTEGER;
    v_existing BIGINT;
BEGIN
    IF p_amount <= 0 THEN
        RETURN QUERY SELECT FALSE, 0, NULL::BIGINT, 'Invalid amount';
        RETURN;
    END IF;

    SELECT id INTO v_existing
    FROM credit_ledger
    WHERE operation_key = p_operation_key
      AND entry_type = 'reserve'
    LIMIT 1;

    IF v_existing IS NOT NULL THEN
        IF p_tenant_id IS NOT NULL THEN
            SELECT credit_balance INTO v_tenant_credits FROM tenants WHERE id = p_tenant_id;
            RETURN QUERY SELECT TRUE, COALESCE(v_tenant_credits, 0), v_existing, NULL::TEXT;
        ELSE
            SELECT credits INTO v_profile_credits FROM profiles WHERE id = p_user_id;
            RETURN QUERY SELECT TRUE, COALESCE(v_profile_credits, 0), v_existing, NULL::TEXT;
        END IF;
        RETURN;
    END IF;

    IF p_tenant_id IS NOT NULL THEN
        SELECT credit_balance INTO v_tenant_credits
        FROM tenants
        WHERE id = p_tenant_id
        FOR UPDATE;

        IF COALESCE(v_tenant_credits, 0) < p_amount THEN
            RETURN QUERY SELECT FALSE, COALESCE(v_tenant_credits, 0), NULL::BIGINT, 'Not enough credits';
            RETURN;
        END IF;

        UPDATE tenants
        SET credit_balance = credit_balance - p_amount, updated_at = NOW()
        WHERE id = p_tenant_id;
    ELSE
        SELECT credits INTO v_profile_credits
        FROM profiles
        WHERE id = p_user_id
        FOR UPDATE;

        IF COALESCE(v_profile_credits, 0) < p_amount THEN
            RETURN QUERY SELECT FALSE, COALESCE(v_profile_credits, 0), NULL::BIGINT, 'Not enough credits';
            RETURN;
        END IF;

        UPDATE profiles
        SET credits = credits - p_amount,
            total_credits_used = total_credits_used + p_amount,
            updated_at = NOW()
        WHERE id = p_user_id;
    END IF;

    INSERT INTO credit_ledger (user_id, tenant_id, amount, entry_type, reason, operation_key, metadata)
    VALUES (p_user_id, p_tenant_id, -p_amount, 'reserve', p_reason, p_operation_key, '{}'::jsonb)
    RETURNING id INTO v_existing;

    IF p_tenant_id IS NOT NULL THEN
        SELECT credit_balance INTO v_tenant_credits FROM tenants WHERE id = p_tenant_id;
        RETURN QUERY SELECT TRUE, COALESCE(v_tenant_credits, 0), v_existing, NULL::TEXT;
    ELSE
        SELECT credits INTO v_profile_credits FROM profiles WHERE id = p_user_id;
        RETURN QUERY SELECT TRUE, COALESCE(v_profile_credits, 0), v_existing, NULL::TEXT;
    END IF;
END;
$$;

-- Finalize (or release) an existing reservation
CREATE OR REPLACE FUNCTION finalize_credits(
    p_operation_key TEXT,
    p_success BOOLEAN,
    p_generation_id BIGINT DEFAULT NULL,
    p_request_id TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_reserve RECORD;
BEGIN
    SELECT * INTO v_reserve
    FROM credit_ledger
    WHERE operation_key = p_operation_key
      AND entry_type = 'reserve'
    ORDER BY id DESC
    LIMIT 1;

    IF v_reserve.id IS NULL THEN
        RETURN;
    END IF;

    UPDATE credit_ledger
    SET generation_id = COALESCE(p_generation_id, generation_id),
        request_id = COALESCE(p_request_id, request_id)
    WHERE id = v_reserve.id;

    IF p_success THEN
        RETURN;
    END IF;

    IF EXISTS (
        SELECT 1 FROM credit_ledger
        WHERE operation_key = p_operation_key
          AND entry_type = 'release'
    ) THEN
        RETURN;
    END IF;

    IF v_reserve.tenant_id IS NOT NULL THEN
        UPDATE tenants
        SET credit_balance = credit_balance + ABS(v_reserve.amount),
            updated_at = NOW()
        WHERE id = v_reserve.tenant_id;
    ELSE
        UPDATE profiles
        SET credits = credits + ABS(v_reserve.amount),
            updated_at = NOW()
        WHERE id = v_reserve.user_id;
    END IF;

    INSERT INTO credit_ledger (
        user_id, tenant_id, amount, entry_type, reason, operation_key, generation_id, request_id, metadata
    )
    VALUES (
        v_reserve.user_id,
        v_reserve.tenant_id,
        ABS(v_reserve.amount),
        'release',
        'generation_failed',
        p_operation_key,
        p_generation_id,
        p_request_id,
        '{}'::jsonb
    );
END;
$$;

-- Credit grants (billing or manual adjustments)
CREATE OR REPLACE FUNCTION grant_credits(
    p_user_id UUID,
    p_tenant_id UUID,
    p_amount INTEGER,
    p_reason TEXT,
    p_operation_key TEXT DEFAULT NULL,
    p_stripe_event_id TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Grant amount must be positive';
    END IF;

    IF p_tenant_id IS NOT NULL THEN
        UPDATE tenants
        SET credit_balance = credit_balance + p_amount, updated_at = NOW()
        WHERE id = p_tenant_id;
    ELSE
        UPDATE profiles
        SET credits = credits + p_amount, updated_at = NOW()
        WHERE id = p_user_id;
    END IF;

    INSERT INTO credit_ledger (user_id, tenant_id, amount, entry_type, reason, operation_key, stripe_event_id, metadata)
    VALUES (p_user_id, p_tenant_id, p_amount, 'grant', p_reason, p_operation_key, p_stripe_event_id, '{}'::jsonb)
    ON CONFLICT DO NOTHING;
END;
$$;

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view tenant"
    ON tenants FOR SELECT USING (is_tenant_member(id));

CREATE POLICY "Tenant members can view memberships"
    ON tenant_memberships FOR SELECT USING (is_tenant_member(tenant_id));

CREATE POLICY "Tenant members can view subscriptions"
    ON subscriptions FOR SELECT USING (tenant_id IS NOT NULL AND is_tenant_member(tenant_id));

CREATE POLICY "Users can view own billing customer"
    ON billing_customers FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can view own ledger"
    ON credit_ledger FOR SELECT USING (
        (user_id = auth.uid()) OR (tenant_id IS NOT NULL AND is_tenant_member(tenant_id))
    );
