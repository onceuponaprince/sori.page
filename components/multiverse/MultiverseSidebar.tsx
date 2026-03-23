"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { multiverseMotion } from "@/lib/sori-motion";
import { useMultiverse } from "@/lib/use-multiverse";
import { OracleChat } from "./OracleChat";
import { MultiverseTree } from "./MultiverseTree";
import type { ChoiceIntent, EpistemicProfile } from "@/types/multiverse";

interface MultiverseSidebarProps {
  storyUid: string;
  isOpen: boolean;
  onBeatCreated?: (beatId: string) => void;
  onClose: () => void;
  availableCharacterIds: Array<{ id: string; name: string }>;
}

type SidebarTab = "tree" | "oracle";

export function MultiverseSidebar({
  storyUid,
  isOpen,
  onBeatCreated,
  onClose,
  availableCharacterIds,
}: MultiverseSidebarProps) {
  const [activeTab, setActiveTab] = useState<SidebarTab>("oracle");
  const [sceneGoal, setSceneGoal] = useState("");
  const [selectedCharA, setSelectedCharA] = useState(
    availableCharacterIds[0]?.id || ""
  );
  const [selectedCharB, setSelectedCharB] = useState(
    availableCharacterIds[1]?.id || ""
  );

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

  const handleStartSimulation = useCallback(() => {
    if (!sceneGoal.trim()) return;
    if (!selectedCharA || !selectedCharB) return;
    if (selectedCharA === selectedCharB) return;
    startSimulation(sceneGoal.trim(), [selectedCharA, selectedCharB]);
  }, [sceneGoal, selectedCharA, selectedCharB, startSimulation]);

  const handleCommit = useCallback(async () => {
    await commitBranch();
    if (onBeatCreated && activeNode) {
      onBeatCreated(activeNode.id);
    }
  }, [commitBranch, onBeatCreated, activeNode]);

  const handleMarkDecision = useCallback(() => {
    setActiveTab("tree");
  }, []);

  const handleChoiceSelect = useCallback(
    (label: string, intent: ChoiceIntent) => {
      selectChoice(label, intent);
      setActiveTab("oracle");
    },
    [selectChoice],
  );

  const profiles: [EpistemicProfile, EpistemicProfile] | null = null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.aside
          {...multiverseMotion.sidebarSlide}
          className="flex h-full flex-col overflow-hidden border border-border bg-card"
        >
          {/* Header */}
          <div className="shrink-0 border-b border-border px-4 py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="sori-kicker">narrative laboratory</p>
                <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.15rem", fontWeight: 500 }} className="mt-1 text-foreground">
                  Multiverse Tester
                </h2>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 text-muted-foreground transition-colors hover:text-foreground"
                aria-label="Close multiverse sidebar"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div className="mt-3">
              <input
                type="text"
                value={sceneGoal}
                onChange={(e) => setSceneGoal(e.target.value)}
                placeholder="e.g. Maya tries to steal the key without Elias noticing"
                style={{ fontFamily: "var(--font-body)", fontSize: "0.78rem" }}
                className="w-full border border-border bg-transparent px-3 py-2 text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none"
              />
            </div>

            <div className="mt-2 flex gap-2">
              <select
                value={selectedCharA}
                onChange={(e) => setSelectedCharA(e.target.value)}
                style={{ fontFamily: "var(--font-body)", fontSize: "0.72rem" }}
                className="flex-1 border border-border bg-transparent px-2 py-1.5 text-foreground"
              >
                <option value="">Agent A</option>
                {availableCharacterIds.map((char) => (
                  <option key={char.id} value={char.id}>{char.name}</option>
                ))}
              </select>
              <span style={{ fontFamily: "var(--font-body)", fontSize: "0.65rem" }} className="flex items-center text-muted-foreground">
                vs
              </span>
              <select
                value={selectedCharB}
                onChange={(e) => setSelectedCharB(e.target.value)}
                style={{ fontFamily: "var(--font-body)", fontSize: "0.72rem" }}
                className="flex-1 border border-border bg-transparent px-2 py-1.5 text-foreground"
              >
                <option value="">Agent B</option>
                {availableCharacterIds.map((char) => (
                  <option key={char.id} value={char.id}>{char.name}</option>
                ))}
              </select>
            </div>

            <button
              onClick={handleStartSimulation}
              disabled={
                !sceneGoal.trim() ||
                !selectedCharA ||
                !selectedCharB ||
                selectedCharA === selectedCharB ||
                state.isSimulating
              }
              style={{ fontFamily: "var(--font-body)", fontSize: "0.72rem", letterSpacing: "0.12em", textTransform: "uppercase" }}
              className="mt-3 w-full border border-accent bg-accent px-4 py-2.5 text-white transition-colors hover:bg-transparent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
            >
              {state.isSimulating ? "Agents interacting..." : "Test Plausibility"}
            </button>
          </div>

          {/* Tab Switcher */}
          <div className="flex shrink-0 border-b border-border">
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

          {/* Main Content */}
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

          {/* Error Display */}
          <AnimatePresence>
            {state.error && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="shrink-0 overflow-hidden border-t border-accent/20"
              >
                <div className="flex items-center justify-between bg-accent/5 px-4 py-2.5">
                  <p style={{ fontFamily: "var(--font-body)", fontSize: "0.72rem" }} className="m-0 text-accent">
                    {state.error}
                  </p>
                  <button
                    onClick={clearError}
                    style={{ fontFamily: "var(--font-body)", fontSize: "0.72rem" }}
                    className="text-accent/60 hover:text-accent"
                  >
                    dismiss
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Footer */}
          {activeNode && activeNode.type !== "canon" && activeNode.dialogueTurns.length > 0 && (
            <div className="shrink-0 border-t border-border px-4 py-3">
              <div className="mb-2 flex flex-wrap gap-1.5">
                <span className="sori-chip px-2 py-0.5 text-[10px]">
                  confidence {Math.round(activeNode.metadata.confidenceScore * 100)}%
                </span>
                {activeNode.metadata.structuralPattern && (
                  <span className="sori-chip px-2 py-0.5 text-[10px]">
                    {activeNode.metadata.structuralPattern.replace("_", " ")}
                  </span>
                )}
                {activeNode.metadata.isParadox && (
                  <span className="border border-accent/30 bg-accent/10 px-2 py-0.5 text-[10px] text-accent">
                    {activeNode.metadata.paradoxCount} paradox
                    {activeNode.metadata.paradoxCount !== 1 ? "es" : ""}
                  </span>
                )}
              </div>

              <motion.button
                onClick={handleCommit}
                {...multiverseMotion.choiceHover}
                style={{ fontFamily: "var(--font-body)", fontSize: "0.72rem", letterSpacing: "0.12em", textTransform: "uppercase" }}
                className="w-full border border-foreground bg-foreground px-4 py-2.5 text-background transition-colors hover:bg-transparent hover:text-foreground"
              >
                Commit to Story
              </motion.button>
            </div>
          )}

          {activeNode && activeNode.type === "canon" && (
            <div className="shrink-0 border-t border-accent/30 px-4 py-3">
              <p style={{ fontFamily: "var(--font-body)", fontSize: "0.72rem" }} className="m-0 text-center text-accent">
                This branch is canon
              </p>
            </div>
          )}

          {state.history.length > 1 && (
            <div className="shrink-0 border-t border-border px-4 py-2">
              <div style={{ fontFamily: "var(--font-body)", fontSize: "0.65rem" }} className="flex items-center gap-1 text-muted-foreground">
                <button
                  onClick={navigateBack}
                  className="hover:text-foreground"
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
      style={{ fontFamily: "var(--font-body)", fontSize: "0.65rem", letterSpacing: "0.14em", textTransform: "uppercase" }}
      className={`relative flex-1 px-4 py-2.5 text-center font-medium transition-colors cursor-pointer ${
        isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      <span className="flex items-center justify-center gap-1.5">
        {label}
        {badge && (
          <span className="bg-accent/15 px-1.5 py-0.5 text-[9px] text-accent">
            {badge}
          </span>
        )}
      </span>

      {isActive && (
        <motion.div
          layoutId="multiverse-tab-indicator"
          className="absolute bottom-0 left-2 right-2 h-[2px] bg-accent"
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
        />
      )}
    </button>
  );
}
