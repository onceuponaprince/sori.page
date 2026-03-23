/**
 * useMultiverse() — React hook for Multiverse Scene Tester state management.
 *
 * This hook owns the entire client-side state for the multiverse sidebar:
 * - The tree of MultiverseNodes
 * - Navigation (which node is active, breadcrumb history)
 * - API calls to the Django backend (simulate, branch, commit)
 * - Polling for async simulation results
 *
 * DESIGN DECISIONS
 * ────────────────
 * 1. useReducer over useState: The multiverse state has complex
 *    transitions (adding nodes, updating metadata, changing active node)
 *    that would be error-prone with multiple useState calls. A reducer
 *    gives us atomic updates and makes the state machine explicit.
 *
 * 2. Polling over WebSocket: The simulation task takes 10-60 seconds.
 *    Polling every 2 seconds with a simple GET is simpler to implement
 *    and debug than a WebSocket connection. We can upgrade to WebSocket
 *    in v2 if the polling frequency becomes a problem.
 *
 * 3. All API calls go through the Django backend, not directly to
 *    the Next.js API routes. The Django backend owns Neo4j and Celery.
 *
 * USAGE
 * ─────
 *   const {
 *     state,            // MultiverseState — the full tree + navigation
 *     activeNode,       // MultiverseNode | null — currently viewed node
 *     startSimulation,  // (goal, charIds) => void — trigger a new simulation
 *     selectChoice,     // (choiceEdge) => void — pick a branch
 *     commitBranch,     // () => void — make current branch canon
 *     navigateTo,       // (nodeId) => void — jump to a tree node
 *     navigateBack,     // () => void — go up one level in history
 *   } = useMultiverse(storyUid);
 */

import { useCallback, useEffect, useReducer, useRef } from "react";
import type {
  MultiverseState,
  MultiverseNode,
  ChoiceEdge,
  ApiSimulateResponse,
  ApiBranchResponse,
  ApiCommitResponse,
  ChoiceIntent,
} from "@/types/multiverse";

// ============================================================
// CONFIGURATION
// ============================================================

/**
 * Base URL for the Django backend API.
 * Falls back to localhost:8000 in development.
 */
const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/**
 * How often to poll for simulation completion (in milliseconds).
 * 2 seconds is a good balance between responsiveness and server load.
 */
const POLL_INTERVAL_MS = 2000;

/**
 * Maximum time to poll before giving up (in milliseconds).
 * 2 minutes should be enough for even the longest simulations.
 */
const POLL_TIMEOUT_MS = 120_000;


// ============================================================
// REDUCER — State machine for the multiverse
// ============================================================

/**
 * All possible actions that can update the multiverse state.
 *
 * Using a discriminated union (type field) lets TypeScript narrow
 * the payload type in the reducer's switch statement.
 */
type MultiverseAction =
  | { type: "INIT_TREE"; payload: { rootNodeId: string; nodes: Record<string, MultiverseNode> } }
  | { type: "SIMULATION_START" }
  | { type: "SIMULATION_COMPLETE"; payload: { node: MultiverseNode } }
  | { type: "SIMULATION_ERROR"; payload: { error: string } }
  | { type: "BRANCH_START" }
  | { type: "BRANCH_COMPLETE"; payload: { edge: ChoiceEdge; targetNode: MultiverseNode } }
  | { type: "BRANCH_ERROR"; payload: { error: string } }
  | { type: "COMMIT_COMPLETE"; payload: { node: MultiverseNode; beatId: string } }
  | { type: "NAVIGATE_TO"; payload: { nodeId: string } }
  | { type: "NAVIGATE_BACK" }
  | { type: "CLEAR_ERROR" };

/**
 * The initial state before any data is loaded.
 * All fields are empty/false — the UI shows a "start simulation" prompt.
 */
function createInitialState(): MultiverseState {
  return {
    rootNodeId: "",
    activeNodeId: "",
    history: [],
    nodes: {},
    isSimulating: false,
    isBranching: false,
    error: null,
  };
}

/**
 * Pure reducer function for multiverse state transitions.
 *
 * Each case handles one atomic state change. The reducer never makes
 * API calls or has side effects — that's the hook's job.
 *
 * STATE TRANSITIONS:
 *
 *   INIT_TREE
 *     Loads a previously saved tree from the backend.
 *     Sets the root and active node, builds the history.
 *
 *   SIMULATION_START → SIMULATION_COMPLETE | SIMULATION_ERROR
 *     Marks isSimulating=true, then either adds the new node
 *     or sets an error message.
 *
 *   BRANCH_START → BRANCH_COMPLETE | BRANCH_ERROR
 *     Marks isBranching=true, then either adds the new edge+node
 *     or sets an error message.
 *
 *   COMMIT_COMPLETE
 *     Updates the node type to 'canon' in the tree.
 *
 *   NAVIGATE_TO / NAVIGATE_BACK
 *     Changes which node the Oracle chat displays.
 */
function multiverseReducer(
  state: MultiverseState,
  action: MultiverseAction,
): MultiverseState {
  switch (action.type) {
    case "INIT_TREE": {
      const { rootNodeId, nodes } = action.payload;
      return {
        ...state,
        rootNodeId,
        activeNodeId: rootNodeId,
        history: [rootNodeId],
        nodes,
        error: null,
      };
    }

    case "SIMULATION_START": {
      return {
        ...state,
        isSimulating: true,
        error: null,
      };
    }

    case "SIMULATION_COMPLETE": {
      const { node } = action.payload;
      const isFirstNode = !state.rootNodeId;

      return {
        ...state,
        isSimulating: false,
        // If this is the first simulation, it becomes the root.
        rootNodeId: isFirstNode ? node.id : state.rootNodeId,
        activeNodeId: node.id,
        history: isFirstNode ? [node.id] : [...state.history, node.id],
        nodes: {
          ...state.nodes,
          [node.id]: node,
        },
      };
    }

    case "SIMULATION_ERROR": {
      return {
        ...state,
        isSimulating: false,
        error: action.payload.error,
      };
    }

    case "BRANCH_START": {
      return {
        ...state,
        isBranching: true,
        error: null,
      };
    }

    case "BRANCH_COMPLETE": {
      const { edge, targetNode } = action.payload;

      // Update the source node's choices to include the new edge.
      const sourceNodeId = state.activeNodeId;
      const sourceNode = state.nodes[sourceNodeId];

      // Add the edge to the source node's choices if not already present.
      const updatedChoices = sourceNode
        ? [
            ...sourceNode.choices.filter((c) => c.id !== edge.id),
            edge,
          ]
        : [edge];

      const updatedSourceNode: MultiverseNode = sourceNode
        ? { ...sourceNode, choices: updatedChoices }
        : sourceNode;

      return {
        ...state,
        isBranching: false,
        activeNodeId: targetNode.id,
        history: [...state.history, targetNode.id],
        nodes: {
          ...state.nodes,
          ...(sourceNode ? { [sourceNodeId]: updatedSourceNode } : {}),
          [targetNode.id]: targetNode,
        },
      };
    }

    case "BRANCH_ERROR": {
      return {
        ...state,
        isBranching: false,
        error: action.payload.error,
      };
    }

    case "COMMIT_COMPLETE": {
      const { node } = action.payload;
      return {
        ...state,
        nodes: {
          ...state.nodes,
          [node.id]: node,
        },
      };
    }

    case "NAVIGATE_TO": {
      const { nodeId } = action.payload;
      if (!state.nodes[nodeId]) return state;

      // Build a new history path from root to the target node.
      // Walk up the parent chain to construct the path.
      const path = buildPathToNode(nodeId, state.nodes);

      return {
        ...state,
        activeNodeId: nodeId,
        history: path,
      };
    }

    case "NAVIGATE_BACK": {
      if (state.history.length <= 1) return state;

      const newHistory = state.history.slice(0, -1);
      return {
        ...state,
        activeNodeId: newHistory[newHistory.length - 1],
        history: newHistory,
      };
    }

    case "CLEAR_ERROR": {
      return { ...state, error: null };
    }

    default:
      return state;
  }
}


// ============================================================
// HELPER: Build path from root to a target node
// ============================================================

/**
 * Walk up the parent chain from a target node to the root.
 *
 * Returns an array of node IDs from root to target, suitable
 * for the `history` field in MultiverseState.
 *
 * If the parent chain is broken (orphan node), returns just [nodeId].
 */
function buildPathToNode(
  nodeId: string,
  nodes: Record<string, MultiverseNode>,
): string[] {
  const path: string[] = [];
  let currentId: string | null = nodeId;

  // Walk up the parent chain, collecting IDs.
  // Safety: limit to 100 iterations to prevent infinite loops
  // in case of circular references (shouldn't happen, but defensive).
  let safety = 0;
  while (currentId && safety < 100) {
    path.unshift(currentId);
    const node = nodes[currentId];
    currentId = node?.parentNodeId ?? null;
    safety++;
  }

  return path;
}


// ============================================================
// THE HOOK
// ============================================================

/**
 * Props for the useMultiverse hook.
 *
 * storyUid is the only required field — it tells the hook which
 * story's multiverse to load and which story to create simulations for.
 */
interface UseMultiverseOptions {
  storyUid: string;
}

/**
 * Return type of the useMultiverse hook.
 *
 * Exported as a named interface so the sidebar component can
 * type its props without importing the hook.
 */
export interface UseMultiverseReturn {
  /** The full multiverse state (tree + navigation) */
  state: MultiverseState;

  /** The currently active/viewed node, or null if tree is empty */
  activeNode: MultiverseNode | null;

  /**
   * Start a new simulation round.
   *
   * Creates a MultiverseSceneNode in Neo4j, dispatches a Celery task,
   * and begins polling for results. The `state.isSimulating` flag is
   * true while the simulation runs.
   *
   * @param sceneGoal - What the scene is testing, e.g. "Maya tries to steal the key"
   * @param characterIds - Exactly 2 CharacterNode UIDs
   */
  startSimulation: (sceneGoal: string, characterIds: [string, string]) => void;

  /**
   * Select a choice at a decision point to create a new branch.
   *
   * Creates a new MultiverseSceneNode + ChoiceEdge in Neo4j and
   * navigates to the new branch. The node starts empty — call
   * startSimulation() to populate it with dialogue.
   *
   * @param choiceLabel - What the choice describes
   * @param intent - The emotional/strategic driver
   */
  selectChoice: (choiceLabel: string, intent: ChoiceIntent) => void;

  /**
   * Commit the current branch to the canonical story.
   *
   * Changes the active node's type to 'canon', merges its snapshot
   * into the main graph, and generates a RelationalBeat ID.
   */
  commitBranch: () => void;

  /** Navigate to a specific node in the tree */
  navigateTo: (nodeId: string) => void;

  /** Navigate back one level in the history */
  navigateBack: () => void;

  /** Clear the current error message */
  clearError: () => void;
}

export function useMultiverse({ storyUid }: UseMultiverseOptions): UseMultiverseReturn {
  const [state, dispatch] = useReducer(multiverseReducer, undefined, createInitialState);

  // Polling refs — mutable refs that persist across renders without
  // causing re-renders. We use refs instead of state for poll timers
  // because the polling loop shouldn't trigger UI updates on its own.
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStartRef = useRef<number>(0);

  // ── Load existing tree on mount ──
  useEffect(() => {
    if (!storyUid) return;

    async function loadTree() {
      try {
        const res = await fetch(`${API_BASE}/api/agent/multiverse/${storyUid}/`);
        if (!res.ok) return;

        const data = await res.json();
        if (data.rootNodeId && Object.keys(data.nodes).length > 0) {
          dispatch({
            type: "INIT_TREE",
            payload: {
              rootNodeId: data.rootNodeId,
              nodes: data.nodes,
            },
          });
        }
      } catch (err) {
        // Silently fail on initial load — the user can start fresh.
        console.warn("Failed to load multiverse tree:", err);
      }
    }

    loadTree();
  }, [storyUid]);

  // ── Cleanup polling on unmount ──
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
      }
    };
  }, []);

  // ────────────────────────────────────────────────────────
  // POLLING — Check simulation task status
  // ────────────────────────────────────────────────────────

  /**
   * Start polling a Celery task for completion.
   *
   * Called after dispatching a simulation task. Polls every
   * POLL_INTERVAL_MS until the task succeeds, fails, or times out.
   *
   * On success: dispatches SIMULATION_COMPLETE with the new node.
   * On failure: dispatches SIMULATION_ERROR with the error message.
   * On timeout: dispatches SIMULATION_ERROR with a timeout message.
   */
  const startPolling = useCallback(
    (taskId: string, nodeId: string) => {
      // Clear any existing poll timer.
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
      }

      pollStartRef.current = Date.now();

      pollTimerRef.current = setInterval(async () => {
        // Check for timeout.
        if (Date.now() - pollStartRef.current > POLL_TIMEOUT_MS) {
          clearInterval(pollTimerRef.current!);
          pollTimerRef.current = null;
          dispatch({
            type: "SIMULATION_ERROR",
            payload: {
              error: "Simulation timed out. The agents may be taking too long.",
            },
          });
          return;
        }

        try {
          const res = await fetch(
            `${API_BASE}/api/agent/simulate/${taskId}/status/`
          );
          if (!res.ok) return;

          const data = await res.json();

          if (data.state === "SUCCESS" && data.data) {
            // Simulation complete — stop polling and update state.
            clearInterval(pollTimerRef.current!);
            pollTimerRef.current = null;

            // Build a MultiverseNode from the task result.
            const taskResult = data.data;
            const node: MultiverseNode = {
              id: nodeId,
              type: "simulation",
              sceneGoal: taskResult.sceneGoal || "",
              dialogueTurns: taskResult.turns || [],
              stateSnapshotId: taskResult.snapshotId || "",
              activeCharacterIds: taskResult.activeCharacterIds || [],
              choices: taskResult.choices || [],
              metadata: {
                confidenceScore: taskResult.confidenceScore ?? 1.0,
                structuralPattern: taskResult.structuralPattern ?? null,
                isParadox: taskResult.isParadox ?? false,
                paradoxCount: taskResult.paradoxCount ?? 0,
              },
              parentNodeId: taskResult.parentNodeId ?? null,
              createdAt: new Date().toISOString(),
            };

            dispatch({ type: "SIMULATION_COMPLETE", payload: { node } });
          } else if (data.state === "FAILURE") {
            // Task failed — stop polling and show error.
            clearInterval(pollTimerRef.current!);
            pollTimerRef.current = null;
            dispatch({
              type: "SIMULATION_ERROR",
              payload: {
                error: data.error || "Simulation failed unexpectedly.",
              },
            });
          }
          // PENDING or STARTED — keep polling.
        } catch {
          // Network error — keep polling (might be transient).
          console.warn("Poll request failed, retrying...");
        }
      }, POLL_INTERVAL_MS);
    },
    [],
  );

  // ────────────────────────────────────────────────────────
  // API METHODS
  // ────────────────────────────────────────────────────────

  const startSimulation = useCallback(
    async (sceneGoal: string, characterIds: [string, string]) => {
      dispatch({ type: "SIMULATION_START" });

      try {
        const res = await fetch(`${API_BASE}/api/agent/simulate/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            story_uid: storyUid,
            scene_goal: sceneGoal,
            character_ids: characterIds,
            state_snapshot_id: state.activeNodeId
              ? state.nodes[state.activeNodeId]?.stateSnapshotId || null
              : null,
            parent_node_id: state.activeNodeId || null,
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `HTTP ${res.status}`);
        }

        const { taskId, nodeId } = await res.json();

        // Start polling for the simulation result.
        startPolling(taskId, nodeId);
      } catch (err) {
        dispatch({
          type: "SIMULATION_ERROR",
          payload: {
            error: err instanceof Error ? err.message : "Failed to start simulation",
          },
        });
      }
    },
    [storyUid, state.activeNodeId, state.nodes, startPolling],
  );

  const selectChoice = useCallback(
    async (choiceLabel: string, intent: ChoiceIntent) => {
      if (!state.activeNodeId) return;

      const activeNode = state.nodes[state.activeNodeId];
      if (!activeNode) return;

      dispatch({ type: "BRANCH_START" });

      try {
        const res = await fetch(`${API_BASE}/api/agent/branch/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source_node_id: state.activeNodeId,
            choice_label: choiceLabel,
            intent,
            state_snapshot_id: activeNode.stateSnapshotId,
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `HTTP ${res.status}`);
        }

        const data: ApiBranchResponse = await res.json();

        dispatch({
          type: "BRANCH_COMPLETE",
          payload: {
            edge: data.edge,
            targetNode: data.targetNode,
          },
        });
      } catch (err) {
        dispatch({
          type: "BRANCH_ERROR",
          payload: {
            error: err instanceof Error ? err.message : "Failed to create branch",
          },
        });
      }
    },
    [state.activeNodeId, state.nodes],
  );

  const commitBranch = useCallback(async () => {
    if (!state.activeNodeId) return;

    try {
      const res = await fetch(`${API_BASE}/api/agent/commit/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          node_id: state.activeNodeId,
          story_uid: storyUid,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const data: ApiCommitResponse = await res.json();

      dispatch({
        type: "COMMIT_COMPLETE",
        payload: {
          node: data.node,
          beatId: data.relationalBeatId,
        },
      });
    } catch (err) {
      dispatch({
        type: "SIMULATION_ERROR",
        payload: {
          error: err instanceof Error ? err.message : "Failed to commit branch",
        },
      });
    }
  }, [state.activeNodeId, storyUid]);

  const navigateTo = useCallback(
    (nodeId: string) => {
      dispatch({ type: "NAVIGATE_TO", payload: { nodeId } });
    },
    [],
  );

  const navigateBack = useCallback(() => {
    dispatch({ type: "NAVIGATE_BACK" });
  }, []);

  const clearError = useCallback(() => {
    dispatch({ type: "CLEAR_ERROR" });
  }, []);

  // ── Derived state ──
  const activeNode = state.activeNodeId
    ? state.nodes[state.activeNodeId] ?? null
    : null;

  return {
    state,
    activeNode,
    startSimulation,
    selectChoice,
    commitBranch,
    navigateTo,
    navigateBack,
    clearError,
  };
}
