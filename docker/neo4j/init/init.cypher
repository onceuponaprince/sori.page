// ============================================================
// sori.page — Neo4j Schema Initialization
// ============================================================
// This runs once when the Neo4j container first starts.
// Constraints ensure data integrity. Indexes ensure query speed.
// ============================================================

// --- Uniqueness constraints ---
CREATE CONSTRAINT concept_name IF NOT EXISTS
FOR (c:ConceptNode) REQUIRE c.name IS UNIQUE;

CREATE CONSTRAINT function_name IF NOT EXISTS
FOR (f:FunctionNode) REQUIRE f.name IS UNIQUE;

CREATE CONSTRAINT source_url IF NOT EXISTS
FOR (s:SourceNode) REQUIRE s.url IS UNIQUE;

CREATE CONSTRAINT contributor_username IF NOT EXISTS
FOR (c:ContributorNode) REQUIRE c.username IS UNIQUE;

CREATE CONSTRAINT story_uid IF NOT EXISTS
FOR (s:StoryNode) REQUIRE s.uid IS UNIQUE;

CREATE CONSTRAINT scene_uid IF NOT EXISTS
FOR (s:SceneNode) REQUIRE s.uid IS UNIQUE;

CREATE CONSTRAINT commit_uid IF NOT EXISTS
FOR (c:Commit) REQUIRE c.uid IS UNIQUE;

CREATE CONSTRAINT branch_uid IF NOT EXISTS
FOR (b:Branch) REQUIRE b.uid IS UNIQUE;

CREATE CONSTRAINT gap_uid IF NOT EXISTS
FOR (g:GapNode) REQUIRE g.uid IS UNIQUE;

// --- Performance indexes ---
// These speed up the most common queries the agent will run.

CREATE INDEX concept_status IF NOT EXISTS
FOR (c:ConceptNode) ON (c.status);

CREATE INDEX concept_depth IF NOT EXISTS
FOR (c:ConceptNode) ON (c.depth_score);

CREATE INDEX concept_confidence IF NOT EXISTS
FOR (c:ConceptNode) ON (c.confidence);

CREATE INDEX function_depth IF NOT EXISTS
FOR (f:FunctionNode) ON (f.depth_score);

CREATE INDEX function_confidence IF NOT EXISTS
FOR (f:FunctionNode) ON (f.confidence);

CREATE INDEX instance_verified IF NOT EXISTS
FOR (i:InstanceNode) ON (i.verified);

CREATE INDEX gap_status IF NOT EXISTS
FOR (g:GapNode) ON (g.status);

CREATE INDEX gap_importance IF NOT EXISTS
FOR (g:GapNode) ON (g.importance_score);

CREATE INDEX branch_status IF NOT EXISTS
FOR (b:Branch) ON (b.status);

CREATE INDEX slang_term IF NOT EXISTS
FOR (s:SlangNode) ON (s.term);

// --- Full-text search indexes ---
// These enable natural language search across the graph.

CREATE FULLTEXT INDEX concept_search IF NOT EXISTS
FOR (c:ConceptNode) ON EACH [c.name, c.description];

CREATE FULLTEXT INDEX function_search IF NOT EXISTS
FOR (f:FunctionNode) ON EACH [f.name, f.description];

CREATE FULLTEXT INDEX gap_search IF NOT EXISTS
FOR (g:GapNode) ON EACH [g.name, g.description];
