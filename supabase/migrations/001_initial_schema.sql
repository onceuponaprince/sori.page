-- ============================================================
-- sori.page — Initial Postgres Schema (via Supabase)
-- ============================================================
-- This handles: auth profiles, credits, waitlist, generation history.
-- Neo4j handles the knowledge graph. Postgres handles everything else.
-- ============================================================

-- Waitlist (for pre-launch signups)
CREATE TABLE IF NOT EXISTS waitlist (
    id BIGSERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User profiles (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE,
    display_name TEXT,
    avatar_url TEXT,
    -- Credit system
    credits INTEGER NOT NULL DEFAULT 5,
    total_credits_used INTEGER NOT NULL DEFAULT 0,
    tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'starter', 'pro', 'unlimited')),
    -- Contributor status (bridges to Neo4j ContributorNode)
    is_contributor BOOLEAN NOT NULL DEFAULT FALSE,
    neo4j_contributor_uid TEXT, -- links to Neo4j ContributorNode.uid
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Credit tiers and their limits
-- free: 5 credits (resets monthly)
-- starter: 50 credits/month
-- pro: 200 credits/month
-- unlimited: no limit

-- Generation history (audit trail + analytics)
CREATE TABLE IF NOT EXISTS generations (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    generation_type TEXT NOT NULL CHECK (generation_type IN ('beat', 'character')),
    -- Input parameters
    input_params JSONB NOT NULL DEFAULT '{}',
    -- Output
    output_text TEXT,
    structural_notes TEXT,
    metadata JSONB NOT NULL DEFAULT '{}',
    -- Credit cost
    credits_used INTEGER NOT NULL DEFAULT 1,
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Credit transactions (for tracking purchases, grants, usage)
CREATE TABLE IF NOT EXISTS credit_transactions (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL, -- positive = credit, negative = debit
    reason TEXT NOT NULL, -- 'generation', 'purchase', 'signup_bonus', 'monthly_reset'
    generation_id BIGINT REFERENCES generations(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_generations_user ON generations(user_id);
CREATE INDEX IF NOT EXISTS idx_generations_type ON generations(generation_type);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_email ON waitlist(email);

-- Auto-create profile on auth signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO profiles (id, display_name, avatar_url, credits)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
        5 -- signup bonus
    );
    -- Log the signup bonus
    INSERT INTO credit_transactions (user_id, amount, reason)
    VALUES (NEW.id, 5, 'signup_bonus');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

-- Users can read/update their own profile
CREATE POLICY "Users can view own profile"
    ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE USING (auth.uid() = id);

-- Users can view their own generations
CREATE POLICY "Users can view own generations"
    ON generations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create generations"
    ON generations FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can view their own transactions
CREATE POLICY "Users can view own transactions"
    ON credit_transactions FOR SELECT USING (auth.uid() = user_id);

-- Waitlist is insert-only for anonymous users
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can join waitlist"
    ON waitlist FOR INSERT WITH CHECK (true);
