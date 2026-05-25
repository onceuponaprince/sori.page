"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { multiverseMotion } from "@/lib/sori-motion";
import { useMultiverse } from "@/lib/use-multiverse";
import { useStoryBeat } from "@/lib/story-beat-context";
import { useStorySceneGoal } from "@/lib/story-scene-goal-context";
import { OracleChat } from "@/components/multiverse/OracleChat";
import { MultiverseTree } from "@/components/multiverse/MultiverseTree";
import type { ChoiceIntent, EpistemicProfile } from "@/types/multiverse";
import type { PlaygroundCharacter } from "@/types/character";

type SceneTab = "tree" | "oracle";

interface ScenePanelProps {
  storyUid: string;
  publishedCharacters: PlaygroundCharacter[];
  resumeNodeUid?: string | null;
}

export function ScenePanel({
  storyUid,
  publishedCharacters,
  resumeNodeUid,
}: ScenePanelProps) {
  const [activeTab, setActiveTab] = useState<SceneTab>("oracle");
  const [sceneGoal, setSceneGoal] = useState("");
  const [selectedCharA, setSelectedCharA] = useState(publishedCharacters[0]?.id ?? "");
  const [selectedCharB, setSelectedCharB] = useState(publishedCharacters[1]?.id ?? "");
  const [lastCommittedBeatId, setLastCommittedBeatId] = useState<string | null>(
    null,
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

  const { notifyBeatCreated } = useStoryBeat();
  const { pendingSceneGoal, clearPendingSceneGoal } = useStorySceneGoal();

  const lastHandledResumeRef = useRef<string | null>(null);

  useEffect(() => {
    if (!pendingSceneGoal) return;
    setSceneGoal(pendingSceneGoal);
    clearPendingSceneGoal();
  }, [pendingSceneGoal, clearPendingSceneGoal]);
  useEffect(() => {
    if (!resumeNodeUid) return;
    if (lastHandledResumeRef.current === resumeNodeUid) return;
    if (!state.nodes[resumeNodeUid]) return;
    lastHandledResumeRef.current = resumeNodeUid;
    navigateTo(resumeNodeUid);
  }, [resumeNodeUid, state.nodes, navigateTo]);

  useEffect(() => {
    if (!publishedCharacters.length) {
      setSelectedCharA("");
      setSelectedCharB("");
      return;
    }

    const nextA = publishedCharacters.find((char) => char.id === selectedCharA)?.id
      ?? publishedCharacters[0]?.id
      ?? "";
    const nextB =
      publishedCharacters.find(
        (char) =>
          char.id === selectedCharB && char.id !== nextA,
      )?.id ?? publishedCharacters.find((char) => char.id !== nextA)?.id
      ?? "";

    if (nextA !== selectedCharA) setSelectedCharA(nextA);
    if (nextB !== selectedCharB) setSelectedCharB(nextB);
  }, [publishedCharacters, selectedCharA, selectedCharB]);

  const profiles: [EpistemicProfile, EpistemicProfile] | null =
    activeNode && activeNode.epistemicProfiles.length === 2
      ? [activeNode.epistemicProfiles[0], activeNode.epistemicProfiles[1]]
      : null;

  const canStart =
    Boolean(sceneGoal.trim()) &&
    Boolean(selectedCharA) &&
    Boolean(selectedCharB) &&
    selectedCharA !== selectedCharB &&
    !state.isSimulating;

  const handleStartSimulation = useCallback(() => {
    if (!canStart) return;
    setLastCommittedBeatId(null);
    setActiveTab("oracle");
    startSimulation(sceneGoal.trim(), [selectedCharA, selectedCharB]);
  }, [canStart, selectedCharA, selectedCharB, sceneGoal, startSimulation]);

  const handleCommit = useCallback(async () => {
    const beatId = await commitBranch();
    if (beatId && activeNode) {
      setLastCommittedBeatId(beatId);
      await notifyBeatCreated(
        beatId,
        activeNode.sceneGoal,
        activeNode.metadata.structuralPattern ?? "unclassified",
      );
    }
  }, [commitBranch, activeNode, notifyBeatCreated]);

  const handleChoiceSelect = useCallback(
    (label: string, intent: ChoiceIntent) => {
      selectChoice(label, intent);
      setActiveTab("oracle");
    },
    [selectChoice],
  );

  return (
    <div className="flex h-full flex-col border border-border bg-card">
      <header className="shrink-0 border-b border-border px-4 py-4 sm:px-6">
        <p className="sori-kicker">scene simulator</p>
        <h1
          style={{ fontFamily: "var(--font-display)", fontSize: "1.15rem" }}
          className="mt-1 font-medium"
        >
          Scene
        </h1>

        <div className="mt-3">
          <input
            value={sceneGoal}
            onChange={(event) => setSceneGoal(event.target.value)}
            placeholder="Maya tries to steal the key without Elias noticing"
            className="w-full border border-border bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none"
          />
        </div>

        <div className="mt-2 flex flex-wrap gap-2">
          <select
            value={selectedCharA}
            onChange={(event) => setSelectedCharA(event.target.value)}
            className="flex-1 border border-border bg-background px-2 py-1.5 text-sm"
          >
            <option value="">Character A</option>
            {publishedCharacters.map((char) => (
              <option key={char.id} value={char.id} title={char.id}>
                {char.name}
              </option>
            ))}
          </select>
          <span
            style={{ fontFamily: "var(--font-body)", fontSize: "0.65rem" }}
            className="flex items-center text-muted-foreground"
          >
            vs
          </span>
          <select
            value={selectedCharB}
            onChange={(event) => setSelectedCharB(event.target.value)}
            className="flex-1 border border-border bg-background px-2 py-1.5 text-sm"
          >
            <option value="">Character B</option>
            {publishedCharacters.map((char) => (
              <option key={char.id} value={char.id} title={char.id}>
                {char.name}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={handleStartSimulation}
          disabled={!canStart}
          className="mt-3 w-full border border-accent bg-accent px-4 py-2 text-sm text-white transition-colors hover:bg-transparent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          {state.isSimulating ? "Agents interacting…" : "Test Plausibility"}
        </button>
      </header>

      <nav className="flex shrink-0 border-b border-border">
        <TabButton
          label="Oracle"
          isActive={activeTab === "oracle"}
          onClick={() => setActiveTab("oracle")}
        />
        <TabButton
          label="Tree"
          isActive={activeTab === "tree"}
          onClick={() => setActiveTab("tree")}
          badge={state.nodes[state.activeNodeId] ? String(Object.keys(state.nodes).length) : undefined}
        />
      </nav>

      <div className="min-h-0 flex-1 overflow-hidden">
        {activeTab === "oracle" ? (
          <OracleChat
            turns={activeNode?.dialogueTurns || []}
            profiles={profiles}
            isSimulating={state.isSimulating}
            onMarkDecision={() => setActiveTab("tree")}
          />
        ) : (
          <MultiverseTree
            state={state}
            onNodeSelect={navigateTo}
            onChoiceSelect={handleChoiceSelect}
          />
        )}
      </div>

      <AnimatePresence>
        {state.error && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="shrink-0 overflow-hidden border-t border-accent/20"
          >
            <div className="flex items-center justify-between bg-accent/5 px-4 py-2.5">
              <p
                style={{ fontFamily: "var(--font-body)", fontSize: "0.72rem" }}
                className="m-0 text-accent"
              >
                {state.error}
              </p>
              <button
                onClick={clearError}
                className="text-accent/70 hover:text-accent"
                style={{ fontFamily: "var(--font-body)", fontSize: "0.72rem" }}
              >
                dismiss
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <section className="shrink-0 border-t border-border px-4 py-3 sm:px-6">
        {lastCommittedBeatId && (
          <p className="mb-2 text-xs text-muted-foreground">
            Beat committed and inserted into the Editor: {lastCommittedBeatId.slice(0, 8)}
          </p>
        )}

        {activeNode && activeNode.type !== "canon" && activeNode.dialogueTurns.length > 0 && (
          <>
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
                  {activeNode.metadata.paradoxCount === 1 ? "" : "es"}
                </span>
              )}
            </div>
            <motion.button
              onClick={handleCommit}
              {...multiverseMotion.choiceHover}
              disabled={state.isSimulating || state.isBranching}
              className="w-full border border-foreground bg-foreground px-4 py-2.5 text-sm text-background transition-colors hover:bg-transparent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              Commit to Story
            </motion.button>
          </>
        )}

        {activeNode && activeNode.type === "canon" && (
          <p style={{ fontFamily: "var(--font-body)", fontSize: "0.72rem" }} className="m-0 text-accent">
            This branch is canon.
          </p>
        )}

        {state.history.length > 1 && (
          <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <button onClick={navigateBack} className="hover:text-foreground">
              ← back
            </button>
            <span>
              depth {state.history.length - 1} / {Object.keys(state.nodes).length} nodes
            </span>
          </div>
        )}
      </section>
    </div>
  );
}

interface TabButtonProps {
  label: string;
  isActive: boolean;
  onClick: () => void;
  badge?: string;
}

function TabButton({ label, isActive, onClick, badge }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`relative flex-1 border-b-2 px-4 py-2.5 text-left text-sm transition-colors ${
        isActive
          ? "border-accent text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
      type="button"
    >
      <span className="inline-flex items-center gap-1.5">
        {label}
        {badge && (
          <span className="bg-accent/15 px-1.5 py-0.5 text-[10px] text-accent">
            {badge}
          </span>
        )}
      </span>
    </button>
  );
}
