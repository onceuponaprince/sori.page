/**
 * Multiverse Scene Tester — shared contracts between Next.js, Django, and Neo4j.
 *
 * Neo4j mapping (intended):
 * - MultiverseNode  → (:SceneNode) with properties for type, content, stateSnapshotId, metadata
 * - ChoiceEdge      → [:CHOICE { label, intent }]→ next SceneNode
 * - StateSnapshot   → (:StateSnapshot) linked from SceneNode; encodes KNOWS_ABOUT edges at that branch
 *
 * The frontend keeps an in-memory graph shaped like these types until the backend
 * persists branches after "Commit to Story".
 */

/** How a branch choice is structurally motivated (used for analytics and prompts). */
export type ChoiceIntent = "deception" | "confrontation" | "avoidance" | "truth";

/** Node role in the simulation lifecycle. */
export type MultiverseNodeType = "simulation" | "decision" | "canon";

/**
 * A single vertex in the narrative multiverse tree.
 * Renders as a card in the sidebar; `choices` are the outbound edges.
 */
export interface MultiverseNode {
  id: string;
  type: MultiverseNodeType;
  /** Dialogue or stage action produced by agents (never final novel prose). */
  content: string;
  /**
   * Foreign key to the epistemic slice in Neo4j/Django.
   * Must be sent to `POST /api/v1/simulate` so agents stay inside KNOWS_ABOUT.
   */
  stateSnapshotId: string;
  /** Who is “holding the floor” in the Oracle transcript, if applicable. */
  activeCharacterId?: string;
  choices: ChoiceEdge[];
  metadata: MultiverseNodeMetadata;
}

export interface MultiverseNodeMetadata {
  /** Heuristic or model-estimated plausibility; not “writing quality”. */
  confidenceScore: number;
  structuralPattern?: string;
  /** True when an agent used information outside their epistemic state. */
  isParadox: boolean;
}

/**
 * Directed edge: writer picks this to advance the lab branch.
 * `relatedBeatId` links into Tiptap / relational beat data when committed.
 */
export interface ChoiceEdge {
  id: string;
  label: string;
  targetNodeId: string;
  intent: ChoiceIntent;
  relatedBeatId?: string;
}

/**
 * In-memory root for React state machines driving the Multiverse sidebar.
 * `history` is a stack of node ids visited (decision path).
 */
export interface MultiverseState {
  rootNodeId: string;
  activeNodeId: string;
  history: string[];
  isSimulating: boolean;
}

/** Parameters for constructing the Truth-Guard system prompt (two agent instances). */
export interface TruthGuardPromptParams {
  characterName: string;
  characterProfile: string;
  /** Facts the character may use (KNOWS_ABOUT in the graph). */
  knowsAbout: string[];
  /** Facts that must never appear in speech, implication, or action for this proxy. */
  doesNotKnow: string[];
  sceneGoal: string;
}

/** Payload the Next.js client should POST when starting or continuing a simulation turn. */
export interface SimulateRequestBody {
  stateSnapshotId: string;
  sceneGoal: string;
  /** Prior transcript lines in the Oracle (speaker-prefixed strings). */
  transcript: string[];
  characterA: TruthGuardCharacterSlot;
  characterB: TruthGuardCharacterSlot;
}

export interface TruthGuardCharacterSlot {
  characterId: string;
  name: string;
  profile: string;
  knowsAbout: string[];
  doesNotKnow: string[];
}

/** Normalized response shape the UI can append as a new MultiverseNode (backend fills this). */
export interface SimulateTurnResponse {
  newNode: Omit<MultiverseNode, "choices"> & {
    suggestedChoices: Array<Omit<ChoiceEdge, "targetNodeId"> & { provisionalTargetId?: string }>;
  };
  paradoxDetected: boolean;
  paradoxHints?: string[];
}
