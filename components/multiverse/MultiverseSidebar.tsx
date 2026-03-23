/**
 * MultiverseSidebar — The top-level container for the Multiverse Scene Tester.
 *
 * This component is the "Narrative Laboratory" — a secondary panel within
 * the Tiptap editor where writers run "what-if" simulations and explore
 * branching outcomes.
 *
 * COMPOSITION
 * ───────────
 * The sidebar has three sections, stacked vertically:
 *
 *   ┌─────────────────────────────────┐
 *   │  HEADER                         │  Scene goal input + controls
 *   ├─────────────────────────────────┤
 *   │  TAB: TREE / ORACLE             │  Toggle between views
 *   ├─────────────────────────────────┤
 *   │  MultiverseTree                 │  (when TREE tab active)
 *   │  — or —                         │
 *   │  OracleChat                     │  (when ORACLE tab active)
 *   ├─────────────────────────────────┤
 *   │  FOOTER                         │  Commit button + metadata
 *   └─────────────────────────────────┘
 *
 * STATE MANAGEMENT
 * ────────────────
 * All multiverse state comes from the useMultiverse() hook, which is
 * called here and passed down to child components via props. This keeps
 * MultiverseTree and OracleChat as pure presentational components.
 *
 * THE "BRANCH-TO-BEAT" PIPELINE
 * ─────────────────────────────
 * When the writer commits a branch:
 * 1. commitBranch() sends POST /api/agent/commit/
 * 2. Backend merges knowledge into the canonical graph
 * 3. Backend returns a relationalBeatId
 * 4. onBeatCreated callback fires, passing the beat ID to the parent
 *    SoriEditor, which inserts a beat card into the structural sidebar
 *
 * This is the bridge between the experimental sandbox and the real story.
 *
 * VISUAL STYLE
 * ────────────
 * Uses sori-paper base with dotted border dividers, matching the
 * "Writer's Treehouse" aesthetic. The sidebar slides in/out using
 * the sidebarSlide animation preset.
 */

"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { multiverseMotion } from "@/lib/sori-motion";
import { useMultiverse } from "@/lib/use-multiverse";
import { OracleChat } from "./OracleChat";
import { MultiverseTree } from "./MultiverseTree";
import type { ChoiceIntent, EpistemicProfile } from "@/types/multiverse";

// ============================================================
// PROPS
// ============================================================

interface MultiverseSidebarProps {
  /**
   * The story UID from the Tiptap editor.
   * Used to scope all multiverse operations to this story.
   */
  storyUid: string;

  /**
   * Whether the sidebar panel is visible.
   * Controlled by the parent SoriEditor via a toggle button.
   */
  isOpen: boolean;

  /**
   * Called when the writer commits a branch and a RelationalBeat
   * is created. The parent SoriEditor uses this to insert the beat
   * into the structural sidebar.
   */
  onBeatCreated?: (beatId: string) => void;

  /**
   * Called when the writer clicks the close button.
   * The parent SoriEditor hides the sidebar panel.
   */
  onClose: () => void;

  /**
   * Character IDs available for simulation.
   * These come from the story's CharacterNode UIDs in Neo4j.
   * The writer selects which two characters to simulate.
   */
  availableCharacterIds: Array<{ id: string; name: string }>;
}

// ============================================================
// TAB TYPES
// ============================================================

/**
 * The two views available in the sidebar.
 * 'tree' shows the branching visualization.
 * 'oracle' shows the dialogue chat window.
 */
type SidebarTab = "tree" | "oracle";

// ============================================================
// COMPONENT
// ============================================================

export function MultiverseSidebar({
  storyUid,
  isOpen,
  onBeatCreated,
  onClose,
  availableCharacterIds,
}: MultiverseSidebarProps) {
  // ── Local UI state ──
  const [activeTab, setActiveTab] = useState<SidebarTab>("oracle");
  const [sceneGoal, setSceneGoal] = useState("");
  const [selectedCharA, setSelectedCharA] = useState(
    availableCharacterIds[0]?.id || ""
  );
  const [selectedCharB, setSelectedCharB] = useState(
    availableCharacterIds[1]?.id || ""
  );

  // ── Multiverse state from the hook ──
  const {
    state,
    activeNode,
    startSimulation,
    selectChoice,
    commitBranch,
    navigateTo,
    navigateBack,
    clearError,
  } = useMultiverse({ storyUid });

  // ── Handlers ──

  /**
   * Handle the "Test Plausibility" button click.
   *
   * Validates that a scene goal is entered and two different characters
   * are selected, then triggers the simulation.
   */
  const handleStartSimulation = useCallback(() => {
    if (!sceneGoal.trim()) return;
    if (!selectedCharA || !selectedCharB) return;
    if (selectedCharA === selectedCharB) return;

    startSimulation(sceneGoal.trim(), [selectedCharA, selectedCharB]);
  }, [sceneGoal, selectedCharA, selectedCharB, startSimulation]);

  /**
   * Handle the "Commit to Story" button click.
   *
   * Commits the active branch and notifies the parent editor
   * about the new RelationalBeat.
   */
  const handleCommit = useCallback(async () => {
    await commitBranch();
    // After commit, the hook updates the node type to 'canon'.
    // We also notify the parent about the beat (in a real implementation,
    // the commit response would include the beat ID).
    if (onBeatCreated && activeNode) {
      onBeatCreated(activeNode.id);
    }
  }, [commitBranch, onBeatCreated, activeNode]);

  /**
   * Handle the "Mark Decision" button in OracleChat.
   *
   * This is a manual override — the writer wants to flag the current
   * dialogue point as a fork, even if the automatic detector didn't.
   * For v1, we just switch to the tree view so they can see the choices.
   */
  const handleMarkDecision = useCallback(() => {
    setActiveTab("tree");
  }, []);

  /**
   * Handle choice selection from the tree view.
   *
   * Creates a new branch and switches back to the oracle view
   * so the writer can see the new simulation when they trigger it.
   */
  const handleChoiceSelect = useCallback(
    (label: string, intent: ChoiceIntent) => {
      selectChoice(label, intent);
      setActiveTab("oracle");
    },
    [selectChoice],
  );

  // ── Build epistemic profiles for the Oracle chat ──
  // In v1, we pass null because the profiles come from the backend
  // with the simulation results. A future version could fetch them
  // separately for real-time display.
  const profiles: [EpistemicProfile, EpistemicProfile] | null = null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.aside
          {...multiverseMotion.sidebarSlide}
          className="flex h-full flex-col overflow-hidden rounded-[1.75rem] border border-[var(--sori-border)] bg-gradient-to-b from-[var(--sori-bg-surface)] to-[var(--sori-bg-secondary)]"
          style={{ boxShadow: "var(--sori-paper-shadow)" }}
        >
          {/* ═══ HEADER ═══ */}
          <div className="shrink-0 border-b border-dotted border-[var(--sori-border)] px-4 py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="sori-kicker text-[10px]">narrative laboratory</p>
                <h2 className="mt-1 font-[family-name:var(--font-display)] text-xl tracking-tight">
                  Multiverse Tester
                </h2>
              </div>
              <button
                onClick={onClose}
                className="rounded-full p-1.5 text-[var(--sori-text-muted)] transition-colors hover:bg-[var(--sori-bg-secondary)] hover:text-[var(--sori-text-primary)]"
                aria-label="Close multiverse sidebar"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M4 4L12 12M12 4L4 12"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            {/* Scene goal input */}
            <div className="mt-3">
              <input
                type="text"
                value={sceneGoal}
                onChange={(e) => setSceneGoal(e.target.value)}
                placeholder="e.g. Maya tries to steal the key without Elias noticing"
                className="w-full rounded-[0.85rem] border border-[var(--sori-border)] bg-[var(--sori-bg-surface)] px-3 py-2 text-sm text-[var(--sori-text-primary)] placeholder:text-[var(--sori-text-muted)] focus:border-[var(--sori-accent-coral)] focus:outline-none"
              />
            </div>

            {/* Character selection */}
            <div className="mt-2 flex gap-2">
              <select
                value={selectedCharA}
                onChange={(e) => setSelectedCharA(e.target.value)}
                className="flex-1 rounded-[0.7rem] border border-[var(--sori-border)] bg-[var(--sori-bg-surface)] px-2 py-1.5 text-xs text-[var(--sori-text-secondary)]"
              >
                <option value="">Agent A</option>
                {availableCharacterIds.map((char) => (
                  <option key={char.id} value={char.id}>
                    {char.name}
                  </option>
                ))}
              </select>
              <span className="flex items-center text-[10px] text-[var(--sori-text-muted)]">
                vs
              </span>
              <select
                value={selectedCharB}
                onChange={(e) => setSelectedCharB(e.target.value)}
                className="flex-1 rounded-[0.7rem] border border-[var(--sori-border)] bg-[var(--sori-bg-surface)] px-2 py-1.5 text-xs text-[var(--sori-text-secondary)]"
              >
                <option value="">Agent B</option>
                {availableCharacterIds.map((char) => (
                  <option key={char.id} value={char.id}>
                    {char.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Start simulation button */}
            <button
              onClick={handleStartSimulation}
              disabled={
                !sceneGoal.trim() ||
                !selectedCharA ||
                !selectedCharB ||
                selectedCharA === selectedCharB ||
                state.isSimulating
              }
              className="mt-3 w-full rounded-[1rem] bg-[var(--sori-accent-coral)] px-4 py-2.5 text-sm font-medium text-white transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {state.isSimulating
                ? "Agents interacting..."
                : "Test Plausibility"}
            </button>
          </div>

          {/* ═══ TAB SWITCHER ═══ */}
          <div className="flex shrink-0 border-b border-dotted border-[var(--sori-border)]">
            <TabButton
              label="Oracle"
              isActive={activeTab === "oracle"}
              onClick={() => setActiveTab("oracle")}
            />
            <TabButton
              label="Tree"
              isActive={activeTab === "tree"}
              onClick={() => setActiveTab("tree")}
              badge={
                Object.keys(state.nodes).length > 0
                  ? String(Object.keys(state.nodes).length)
                  : undefined
              }
            />
          </div>

          {/* ═══ MAIN CONTENT ═══ */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === "oracle" ? (
              <OracleChat
                turns={activeNode?.dialogueTurns || []}
                profiles={profiles}
                isSimulating={state.isSimulating}
                onMarkDecision={handleMarkDecision}
              />
            ) : (
              <MultiverseTree
                state={state}
                onNodeSelect={navigateTo}
                onChoiceSelect={handleChoiceSelect}
              />
            )}
          </div>

          {/* ═══ ERROR DISPLAY ═══ */}
          <AnimatePresence>
            {state.error && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="shrink-0 overflow-hidden border-t border-destructive/20"
              >
                <div className="flex items-center justify-between bg-destructive/5 px-4 py-2.5">
                  <p className="m-0 text-xs text-destructive">
                    {state.error}
                  </p>
                  <button
                    onClick={clearError}
                    className="text-xs text-destructive/60 hover:text-destructive"
                  >
                    dismiss
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ═══ FOOTER ═══ */}
          {activeNode && activeNode.type !== "canon" && activeNode.dialogueTurns.length > 0 && (
            <div className="shrink-0 border-t border-dotted border-[var(--sori-border)] px-4 py-3">
              {/* Metadata chips */}
              <div className="mb-2 flex flex-wrap gap-1.5">
                <span className="sori-chip rounded-full px-2 py-0.5 text-[10px]">
                  confidence{" "}
                  {Math.round(activeNode.metadata.confidenceScore * 100)}%
                </span>
                {activeNode.metadata.structuralPattern && (
                  <span className="sori-chip rounded-full px-2 py-0.5 text-[10px]">
                    {activeNode.metadata.structuralPattern.replace("_", " ")}
                  </span>
                )}
                {activeNode.metadata.isParadox && (
                  <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] text-destructive">
                    {activeNode.metadata.paradoxCount} paradox
                    {activeNode.metadata.paradoxCount !== 1 ? "es" : ""}
                  </span>
                )}
              </div>

              {/* Commit button */}
              <motion.button
                onClick={handleCommit}
                {...multiverseMotion.choiceHover}
                className="w-full rounded-[1rem] border-2 border-[var(--sori-accent-amber)] bg-[var(--sori-accent-amber)]/10 px-4 py-2.5 text-sm font-medium text-[var(--sori-accent-amber)] transition-all hover:bg-[var(--sori-accent-amber)]/20"
              >
                ✦ Commit to Story
              </motion.button>
            </div>
          )}

          {/* Already committed indicator */}
          {activeNode && activeNode.type === "canon" && (
            <div className="shrink-0 border-t border-dotted border-[var(--sori-accent-amber)]/30 px-4 py-3">
              <p className="m-0 text-center text-xs text-[var(--sori-accent-amber)]">
                ✦ This branch is canon
              </p>
            </div>
          )}

          {/* Navigation breadcrumbs */}
          {state.history.length > 1 && (
            <div className="shrink-0 border-t border-dotted border-[var(--sori-border)] px-4 py-2">
              <div className="flex items-center gap-1 text-[10px] text-[var(--sori-text-muted)]">
                <button
                  onClick={navigateBack}
                  className="hover:text-[var(--sori-text-primary)]"
                >
                  ← back
                </button>
                <span className="mx-1">·</span>
                <span>
                  depth {state.history.length - 1} of{" "}
                  {Object.keys(state.nodes).length} nodes
                </span>
              </div>
            </div>
          )}
        </motion.aside>
      )}
    </AnimatePresence>
  );
}


// ============================================================
// TAB BUTTON — Styled tab switcher
// ============================================================

/**
 * A single tab button in the view switcher.
 *
 * Uses an underline indicator for the active state, matching
 * the sori-link-underline pattern from globals.css.
 */
function TabButton({
  label,
  isActive,
  onClick,
  badge,
}: {
  label: string;
  isActive: boolean;
  onClick: () => void;
  badge?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        relative flex-1 px-4 py-2.5 text-center text-xs font-medium
        uppercase tracking-[0.14em] transition-colors
        ${
          isActive
            ? "text-[var(--sori-text-primary)]"
            : "text-[var(--sori-text-muted)] hover:text-[var(--sori-text-secondary)]"
        }
      `}
    >
      <span className="flex items-center justify-center gap-1.5">
        {label}
        {badge && (
          <span className="rounded-full bg-[var(--sori-accent-coral)]/15 px-1.5 py-0.5 text-[9px] text-[var(--sori-accent-coral)]">
            {badge}
          </span>
        )}
      </span>

      {/* Active underline indicator */}
      {isActive && (
        <motion.div
          layoutId="multiverse-tab-indicator"
          className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full bg-[var(--sori-accent-coral)]"
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
        />
      )}
    </button>
  );
}
