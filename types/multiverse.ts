/**
 * types/multiverse.ts — Core type definitions for the Multiverse Scene Tester.
 *
 * This file is the single source of truth for every data structure that flows
 * between the Next.js frontend and the Django/Neo4j backend. Every interface
 * maps directly to a Neo4j node type, a REST payload, or a React component's
 * props.
 *
 * KEY DESIGN DECISIONS
 * ────────────────────
 * 1. Each MultiverseNode corresponds to a Neo4j `MultiverseSceneNode`.
 *    The `stateSnapshotId` on every node points to a frozen copy of the
 *    world-state at that exact branch point, so agents never accidentally
 *    read "future" knowledge.
 *
 * 2. ChoiceEdge captures *why* a character made a choice (the `intent`
 *    field). This is not cosmetic — the SimulationManager on the backend
 *    uses intent to bias the Truth Guard prompt toward conflict, evasion,
 *    or honesty.
 *
 * 3. EpistemicProfile is the per-character knowledge envelope. The backend
 *    builds it from Neo4j KNOWS_ABOUT relationships, then ships it to Claude
 *    as part of the Truth Guard system prompt. The frontend renders it inside
 *    the Oracle chat so writers can see what each agent is "allowed" to know.
 *
 * NAMING CONVENTION
 * ─────────────────
 * - Types that map to Neo4j nodes are prefixed-free (MultiverseNode, ChoiceEdge).
 * - Types that only exist on the frontend are prefixed with `UI` (UITreeLayout).
 * - Types that only exist in API payloads are prefixed with `Api` (ApiSimulateRequest).
 */

// ============================================================
// 1. STRUCTURAL INTENT
// ============================================================

/**
 * The emotional or strategic driver behind a character's choice.
 *
 * The backend uses this to shape the Truth Guard prompt:
 * - 'deception'     → agent is instructed to withhold/distort a known fact
 * - 'confrontation' → agent pushes toward direct conflict
 * - 'avoidance'     → agent deflects or changes subject
 * - 'truth'         → agent reveals information honestly
 * - 'discovery'     → agent is actively seeking new information
 * - 'sacrifice'     → agent acts against self-interest for another
 */
export type ChoiceIntent =
  | "deception"
  | "confrontation"
  | "avoidance"
  | "truth"
  | "discovery"
  | "sacrifice";

/**
 * Structural patterns that map to classic narrative beats.
 * These come from the knowledge graph's ConceptNode labels and help the
 * frontend display contextual information about where a scene falls in
 * the overall story arc.
 */
export type StructuralPattern =
  | "rising_action"
  | "climax"
  | "falling_action"
  | "revelation"
  | "reversal"
  | "false_victory"
  | "dark_moment"
  | "resolution";

// ============================================================
// 2. EPISTEMIC PROFILE — "Who knows what"
// ============================================================

/**
 * A single fact that a character either knows or does not know.
 *
 * `factNodeId` references a StoryFactNode in Neo4j. The backend resolves
 * these from the KNOWS_ABOUT edges on the CharacterNode. During simulation,
 * the Truth Guard prompt includes `knownFacts` as "You KNOW" and the
 * complement set (all story facts minus knownFacts) as "You DO NOT KNOW".
 */
export interface EpistemicFact {
  /** Neo4j StoryFactNode UID */
  factNodeId: string;

  /** Human-readable description, e.g. "Maya has the stolen letter" */
  description: string;

  /**
   * The beat index where this character *learned* this fact.
   * null means the character knew this from the story's opening state.
   */
  learnedAtBeat: number | null;
}

/**
 * The complete knowledge envelope for a single character at a specific
 * point in the multiverse timeline.
 *
 * The backend builds this by:
 * 1. Loading the StateSnapshot for the current MultiverseNode
 * 2. Traversing KNOWS_ABOUT edges from the CharacterNode
 * 3. Filtering to only include facts introduced at or before the
 *    current beat index
 *
 * This object is then injected into the Claude system prompt as
 * structured data, forming the core of the "Truth Guard" mechanism.
 */
export interface EpistemicProfile {
  /** Neo4j CharacterNode UID */
  characterId: string;

  /** Display name, e.g. "Maya Chen" */
  characterName: string;

  /** Optional role descriptor from the story outline, e.g. "protagonist" */
  roleHint: string | null;

  /** Bio/traits pulled from the project metadata for prompt injection */
  characterBio: string;

  /** Facts this character KNOWS at the current simulation point */
  knownFacts: EpistemicFact[];

  /**
   * Facts this character DOES NOT KNOW — i.e. facts that exist in the
   * story world but this character has no KNOWS_ABOUT edge to.
   * The Truth Guard prompt lists these explicitly so Claude avoids them.
   */
  unknownFacts: EpistemicFact[];
}

// ============================================================
// 3. DIALOGUE TURN — A single line of agent output
// ============================================================

/**
 * One line of dialogue or action generated by an AI agent during
 * the simulation loop.
 *
 * The `isParadox` flag is set by the backend's validation pass after
 * generation. If Claude's output references anything from the character's
 * `unknownFacts` list, the backend flags it here and the frontend renders
 * a "Structural Paradox" warning badge.
 */
export interface DialogueTurn {
  /** Unique ID for this turn (used as React key) */
  id: string;

  /** Which character is speaking/acting */
  characterId: string;
  characterName: string;

  /** The generated dialogue or action description */
  content: string;

  /**
   * Whether this turn contains a knowledge violation.
   * true = the agent mentioned something from its "DO NOT KNOW" list.
   */
  isParadox: boolean;

  /**
   * If isParadox is true, this explains which fact was leaked.
   * e.g. "Maya referenced 'the hidden will' which she doesn't learn until beat 7"
   */
  paradoxDetail: string | null;

  /** ISO 8601 timestamp of generation */
  generatedAt: string;
}

// ============================================================
// 4. MULTIVERSE NODE — A single state in the branching tree
// ============================================================

/**
 * Represents a single state in the narrative multiverse.
 *
 * Each node is a snapshot of a simulated scene interaction. The tree
 * grows as writers explore different choices:
 *
 *   [root: "Maya enters the study"]
 *       ├── [branch: "Maya lies about the letter"]
 *       │       ├── [leaf: "Elias believes her"]
 *       │       └── [leaf: "Elias calls her bluff"]
 *       └── [branch: "Maya confesses"]
 *               └── [leaf: "Elias forgives her"]
 *
 * NODE TYPES:
 * - 'simulation' → Contains dialogue turns from the AI agents
 * - 'decision'   → A fork point where the writer chose a branch
 * - 'canon'      → A simulation node the writer has "committed" to the story
 *
 * LIFECYCLE:
 * 1. Writer triggers simulation → 'simulation' node created
 * 2. Agents generate dialogue → DialogueTurns populate `dialogueTurns`
 * 3. System identifies decision point → 'decision' node created
 * 4. Writer picks a branch → new child 'simulation' node
 * 5. Writer commits a branch → node type changes to 'canon'
 */
export interface MultiverseNode {
  /** Unique identifier, used as Neo4j MultiverseSceneNode UID */
  id: string;

  /** Determines how this node renders and behaves */
  type: "simulation" | "decision" | "canon";

  /**
   * Writer-facing label for this node, e.g. "Maya tries to steal the key"
   * This is the scene goal that was fed to the agents.
   */
  sceneGoal: string;

  /**
   * The dialogue turns generated by the AI agents for this node.
   * Empty for 'decision' nodes (they're just fork points).
   */
  dialogueTurns: DialogueTurn[];

  /**
   * References the frozen world-state at the moment this node was created.
   * The backend uses this to reconstruct the correct epistemic profiles
   * for each agent. Without this, branching would corrupt the knowledge
   * graph because different branches would share mutable state.
   */
  stateSnapshotId: string;

  /**
   * The IDs of the two characters whose agents are interacting.
   * Always exactly 2 for a simulation; may be empty for manual decision nodes.
   */
  activeCharacterIds: string[];

  /**
   * The branching choices available from this node.
   * Empty for leaf nodes (simulations that haven't reached a decision point).
   */
  choices: ChoiceEdge[];

  /** Structural metadata computed by the backend's validation pass */
  metadata: MultiverseNodeMetadata;

  /** ID of the parent node. null for the root of the tree. */
  parentNodeId: string | null;

  /** ISO 8601 creation timestamp */
  createdAt: string;
}

/**
 * Metadata attached to every MultiverseNode by the backend's
 * post-generation analysis pass.
 */
export interface MultiverseNodeMetadata {
  /**
   * How confident the system is that this scene branch is structurally
   * plausible. Ranges from 0.0 (implausible) to 1.0 (rock solid).
   *
   * Computed from:
   * - Number of epistemic violations (paradoxes reduce score)
   * - Causal consistency with prior branches
   * - Alignment with the story's established structural pattern
   */
  confidenceScore: number;

  /**
   * The narrative beat this scene maps to, pulled from the knowledge graph.
   * e.g. "rising_action", "revelation". null if the system can't classify.
   */
  structuralPattern: StructuralPattern | null;

  /**
   * true if ANY dialogue turn in this node contains an epistemic violation —
   * i.e. an agent mentioned knowledge they shouldn't have.
   */
  isParadox: boolean;

  /**
   * Number of individual paradox violations found in this node's dialogue.
   * Useful for severity display (1 slip vs. 5 contradictions).
   */
  paradoxCount: number;
}

// ============================================================
// 5. CHOICE EDGE — The decision path between nodes
// ============================================================

/**
 * Represents a writer's available choice at a decision point.
 *
 * Each ChoiceEdge is a directed edge in Neo4j from one MultiverseSceneNode
 * to another. When the writer picks a choice, the backend creates the
 * target node, takes a new StateSnapshot, and kicks off a fresh simulation.
 *
 * The `relatedBeatId` is the bridge to the main Tiptap editor: when the
 * writer clicks "Commit to Story", the system creates a RelationalBeat
 * in the editor sidebar referencing this choice's outcome.
 */
export interface ChoiceEdge {
  /** Unique identifier for this edge */
  id: string;

  /**
   * Writer-facing label describing the choice.
   * e.g. "Maya lies about the letter", "Elias confronts her directly"
   */
  label: string;

  /** The MultiverseNode this choice leads to */
  targetNodeId: string;

  /**
   * The emotional/strategic driver behind this choice.
   * Determines how the next simulation's agents are prompted.
   */
  intent: ChoiceIntent;

  /**
   * If this choice has been committed to the story, this points to the
   * RelationalBeat ID that was inserted into the Tiptap editor sidebar.
   * null until the writer clicks "Commit to Story".
   */
  relatedBeatId: string | null;
}

// ============================================================
// 6. STATE SNAPSHOT — Frozen world-state at a branch point
// ============================================================

/**
 * A frozen copy of the entire story world at a specific branch point.
 *
 * When the writer creates a new branch, the backend "photographs" the
 * current state of all characters, locations, relationships, and known
 * facts. This snapshot is stored as a JSON blob on the Neo4j
 * StateSnapshotNode and referenced by every MultiverseNode in that
 * branch's subtree.
 *
 * WHY SNAPSHOTS MATTER:
 * Without them, exploring Branch A would mutate the graph, and when the
 * writer backtracks to explore Branch B, the agents would have "memories"
 * from Branch A. Snapshots make branching truly independent.
 */
export interface StateSnapshot {
  /** Unique identifier, matches Neo4j StateSnapshotNode UID */
  id: string;

  /** The MultiverseNode that triggered this snapshot */
  sourceNodeId: string;

  /**
   * The story this snapshot belongs to.
   * Links back to StoryNode.uid in the existing graph model.
   */
  storyUid: string;

  /** All character epistemic profiles at this point in the timeline */
  characterProfiles: EpistemicProfile[];

  /**
   * Location states — where each character physically is.
   * Keys are characterIds, values are location descriptions.
   */
  locationStates: Record<string, string>;

  /**
   * Relationship states between characters at this point.
   * e.g. { "maya-elias": "suspicious", "elias-father": "estranged" }
   */
  relationshipStates: Record<string, string>;

  /** ISO 8601 timestamp of when this snapshot was taken */
  createdAt: string;
}

// ============================================================
// 7. MULTIVERSE STATE — Root container for the sidebar
// ============================================================

/**
 * The top-level state object for the Multiverse Sidebar React component.
 *
 * This is what the `useMultiverse()` hook returns. It holds the entire
 * tree of explored branches plus the current navigation position.
 *
 * NAVIGATION MODEL:
 * The writer can click any node in the tree to "visit" it. Visiting a
 * node loads its dialogue into the Oracle chat and its choices into the
 * branching panel. The `history` array tracks the path from root to the
 * current node, enabling breadcrumb navigation.
 */
export interface MultiverseState {
  /** The ID of the tree's root node (the initial scene setup) */
  rootNodeId: string;

  /** The node the writer is currently viewing in the Oracle chat */
  activeNodeId: string;

  /**
   * Ordered list of node IDs from root to activeNode.
   * Used for breadcrumb rendering and "back" navigation.
   */
  history: string[];

  /**
   * Map of all nodes by ID.
   * Using a record instead of an array makes lookups O(1) and avoids
   * the n² cost of finding nodes by ID during tree rendering.
   */
  nodes: Record<string, MultiverseNode>;

  /** true while the backend is running a simulation (agents are "talking") */
  isSimulating: boolean;

  /** true while the backend is creating a new branch + snapshot */
  isBranching: boolean;

  /** Error message from the latest API call, null if no error */
  error: string | null;
}

// ============================================================
// 8. API PAYLOADS — Request/response shapes for Django endpoints
// ============================================================

/**
 * POST body for /api/agent/simulate/
 *
 * Sent when the writer clicks "Test Plausibility" on a selected scene
 * fragment. The backend uses `stateSnapshotId` to load the correct
 * epistemic profiles and runs the simulation with the two characters.
 */
export interface ApiSimulateRequest {
  /** Which story this simulation belongs to */
  storyUid: string;

  /** The scene goal the writer typed, e.g. "Maya tries to steal the key" */
  sceneGoal: string;

  /**
   * The state snapshot to use for epistemic injection.
   * null on the very first simulation (backend creates the initial snapshot).
   */
  stateSnapshotId: string | null;

  /**
   * The two characters whose agents will interact.
   * Must reference existing CharacterNode UIDs in Neo4j.
   */
  characterIds: [string, string];

  /**
   * Optional parent node ID. If provided, this simulation continues
   * from an existing branch point rather than starting fresh.
   */
  parentNodeId: string | null;
}

/**
 * Response from /api/agent/simulate/
 *
 * The backend returns the newly created MultiverseNode with all dialogue
 * turns populated. The frontend appends this to its tree state.
 */
export interface ApiSimulateResponse {
  /** The newly created simulation node */
  node: MultiverseNode;

  /** The state snapshot that was used (or newly created) */
  snapshot: StateSnapshot;

  /** Any validation warnings (paradoxes, structural notes) */
  warnings: string[];
}

/**
 * POST body for /api/agent/branch/
 *
 * Sent when the writer selects a choice at a decision point.
 * The backend creates a new StateSnapshot (branching from the parent's
 * snapshot), applies the choice's effects, and prepares for the next
 * simulation round.
 */
export interface ApiBranchRequest {
  /** The decision node where the writer is choosing */
  sourceNodeId: string;

  /** Writer-facing description of the chosen path */
  choiceLabel: string;

  /** The emotional driver — shapes the next simulation's prompt */
  intent: ChoiceIntent;

  /** The state snapshot to branch from */
  stateSnapshotId: string;
}

/**
 * Response from /api/agent/branch/
 *
 * Returns the new ChoiceEdge, the target MultiverseNode (empty, ready
 * for simulation), and the new branched StateSnapshot.
 */
export interface ApiBranchResponse {
  /** The newly created edge */
  edge: ChoiceEdge;

  /** The target node (type: 'simulation', no dialogue yet) */
  targetNode: MultiverseNode;

  /** The branched snapshot with updated world state */
  snapshot: StateSnapshot;
}

/**
 * POST body for /api/agent/commit/
 *
 * Sent when the writer clicks "Commit to Story" on a branch they like.
 * The backend updates the Neo4j world state globally to match this
 * branch's snapshot, then generates a RelationalBeat for the Tiptap sidebar.
 */
export interface ApiCommitRequest {
  /** The MultiverseNode being committed */
  nodeId: string;

  /** The story to update */
  storyUid: string;
}

/**
 * Response from /api/agent/commit/
 *
 * Returns the updated node (now type: 'canon') and the RelationalBeat
 * that was inserted into the main editor sidebar.
 */
export interface ApiCommitResponse {
  /** The node, now with type changed to 'canon' */
  node: MultiverseNode;

  /** The RelationalBeat ID inserted into the Tiptap sidebar */
  relationalBeatId: string;

  /** Summary text of what changed in the world state */
  worldStateChangeSummary: string;
}

// ============================================================
// 9. UI-ONLY TYPES — Used only in React components
// ============================================================

/**
 * Layout data for rendering a single node in the tree visualization.
 * Computed by the tree layout algorithm, not stored in Neo4j.
 */
export interface UITreeNodeLayout {
  /** The underlying MultiverseNode */
  node: MultiverseNode;

  /** Pixel position for Framer Motion animated rendering */
  x: number;
  y: number;

  /** Depth in the tree (0 = root). Used for indentation + color coding. */
  depth: number;

  /** Whether this node is on the path to the currently active node */
  isOnActivePath: boolean;

  /** Whether this node is the currently selected/viewed node */
  isActive: boolean;
}

/**
 * Props for the Oracle chat component.
 * Extracted as a type so the parent sidebar can build it cleanly.
 */
export interface OracleChatProps {
  /** The dialogue turns to display */
  turns: DialogueTurn[];

  /** The epistemic profiles for the two characters (for the "knowledge badges") */
  profiles: [EpistemicProfile, EpistemicProfile] | null;

  /** Whether the simulation is currently running */
  isSimulating: boolean;

  /** Called when the writer identifies a decision point manually */
  onMarkDecision: () => void;
}
