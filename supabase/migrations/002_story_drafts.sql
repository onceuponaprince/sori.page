-- ============================================================
-- sori.page — Story Draft Persistence
-- ============================================================
-- Stores the Writer's Treehouse editor state while keeping a bridge
-- to the Neo4j StoryNode / SceneNode identifiers used by the graph layer.
-- ============================================================

CREATE TABLE IF NOT EXISTS story_drafts (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    story_uid TEXT NOT NULL UNIQUE,
    scene_uid TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT 'Untitled treehouse draft',
    outline_text TEXT NOT NULL DEFAULT '',
    editor_json JSONB NOT NULL DEFAULT '{}',
    analyzer_snapshot JSONB NOT NULL DEFAULT '{}',
    last_analysis_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_story_drafts_user ON story_drafts(user_id);
CREATE INDEX IF NOT EXISTS idx_story_drafts_story_uid ON story_drafts(story_uid);

ALTER TABLE story_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own story drafts"
    ON story_drafts FOR SELECT
    USING (user_id IS NULL OR auth.uid() = user_id);

CREATE POLICY "Users can create own story drafts"
    ON story_drafts FOR INSERT
    WITH CHECK (user_id IS NULL OR auth.uid() = user_id);

CREATE POLICY "Users can update own story drafts"
    ON story_drafts FOR UPDATE
    USING (user_id IS NULL OR auth.uid() = user_id);
