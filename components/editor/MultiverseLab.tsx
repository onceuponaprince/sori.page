"use client";

/**
 * Multiverse Scene Tester — “laboratory” sidebar (PlayerView-style branching without
 * replacing the main Tiptap canvas). Uses {@link types/multiverse} shapes and
 * {@link lib/multiverse-graph} for navigation until Django + Neo4j back the live loop.
 */

import { useCallback, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { soriMotion } from "@/lib/sori-motion";
import {
  applyChoice,
  buildBranchToBeatSummary,
  createSeedMultiverseTree,
  markNodeCanon,
  nodesAlongHistory,
  naiveParadoxScan,
} from "@/lib/multiverse-graph";
import { buildTruthGuardSystemPrompt } from "@/lib/multiverse-truth-guard";
import type { ChoiceEdge, MultiverseState } from "@/types/multiverse";

type OracleLine = { id: string; text: string };

const DEMO_FORBIDDEN = ["the letter is a forgery", "basement tunnel"];

export function MultiverseLab() {
  const [sceneGoal, setSceneGoal] = useState(
    "Maya tries to steal the key without Elias noticing",
  );

  const seed = useMemo(() => createSeedMultiverseTree(sceneGoal), [sceneGoal]);
  const [nodes, setNodes] = useState(seed.nodes);
  const [state, setState] = useState<MultiverseState>(seed.state);
  const [oracleLines, setOracleLines] = useState<OracleLine[]>(() => [
    {
      id: "o1",
      text: "Maya: If I borrow your coat, will you pretend you didn't see me near the desk?",
    },
    {
      id: "o2",
      text: "Elias: I see everything near the desk. Try honesty — it's lighter.",
    },
  ]);
  const [committedNote, setCommittedNote] = useState<string | null>(null);
  const [showTruthGuardPreview, setShowTruthGuardPreview] = useState(false);

  const activeNode = nodes[state.activeNodeId];
  const pathNodes = useMemo(() => nodesAlongHistory(state, nodes), [state, nodes]);

  const resetLab = useCallback(() => {
    const next = createSeedMultiverseTree(sceneGoal);
    setNodes(next.nodes);
    setState(next.state);
    setOracleLines([
      {
        id: "o1",
        text: "Maya: If I borrow your coat, will you pretend you didn't see me near the desk?",
      },
      {
        id: "o2",
        text: "Elias: I see everything near the desk. Try honesty — it's lighter.",
      },
    ]);
    setCommittedNote(null);
  }, [sceneGoal]);

  const onChoose = useCallback(
    (choiceId: string) => {
      setState((prev) => applyChoice(prev, nodes, choiceId));
    },
    [nodes],
  );

  const onCommitBranch = useCallback(() => {
    if (!activeNode) {
      return;
    }

    // Resolve the ChoiceEdge that led to the active node (parent = previous history id).
    let choice: ChoiceEdge | undefined;
    if (state.history.length >= 2) {
      const parentId = state.history[state.history.length - 2]!;
      const parent = nodes[parentId];
      choice = parent?.choices.find((c) => c.targetNodeId === activeNode.id);
    }

    const resolvedChoice: ChoiceEdge =
      choice ??
      {
        id: "commit-direct",
        label: "Commit current beat",
        targetNodeId: activeNode.id,
        intent: "truth",
      };

    const { headline, body } = buildBranchToBeatSummary({
      choice: resolvedChoice,
      node: activeNode,
    });

    setNodes((prev) => ({
      ...prev,
      [activeNode.id]: markNodeCanon(prev[activeNode.id]!),
    }));

    setCommittedNote(`${headline}\n\n${body}`);
  }, [activeNode, state.history, nodes]);

  /** Demo only: scan oracle text for forbidden substrings (see naiveParadoxScan). */
  const paradoxHits = useMemo(
    () =>
      oracleLines.flatMap((line) =>
        naiveParadoxScan(line.text, DEMO_FORBIDDEN).map((h) => `${line.id}:${h}`),
      ),
    [oracleLines],
  );

  const truthGuardDemo = useMemo(
    () =>
      buildTruthGuardSystemPrompt({
        characterName: "Maya",
        characterProfile: "Quick-witted, risk-tolerant; hides fear behind humor.",
        knowsAbout: ["The key is on Elias's person", "The door to the archive sticks"],
        doesNotKnow: DEMO_FORBIDDEN,
        sceneGoal,
      }),
    [sceneGoal],
  );

  return (
    <div className="space-y-4">
      <div className="sori-bg-parchment sori-border-dotted rounded-[1.4rem] p-4 shadow-sm">
        <p className="sori-kicker text-xs">multiverse lab</p>
        <h2 className="mt-2 font-[family-name:var(--font-display)] text-2xl tracking-tight">
          Scene branches
        </h2>
        <p className="mt-2 text-sm text-[var(--sori-text-secondary)]">
          Stress-test causality and epistemic boundaries. Simulation text stays in the
          lab; commit only stores a relational beat summary for your outline.
        </p>

        <label className="mt-4 block">
          <span className="sr-only">Scene goal</span>
          <Input
            value={sceneGoal}
            onChange={(e) => setSceneGoal(e.target.value)}
            className="mt-1 font-[family-name:var(--font-body)]"
            placeholder="Scene goal for this test"
          />
        </label>

        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={resetLab}>
            Reset tree
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowTruthGuardPreview((v) => !v)}
          >
            {showTruthGuardPreview ? "Hide" : "Preview"} Truth-Guard prompt
          </Button>
        </div>
      </div>

      {showTruthGuardPreview && (
        <motion.pre
          className="sori-border-dotted max-h-48 overflow-auto rounded-[1rem] bg-background/40 p-3 font-mono text-[10px] leading-relaxed text-[var(--sori-text-secondary)]"
          {...soriMotion.inkSettle}
        >
          {truthGuardDemo}
        </motion.pre>
      )}

      <div className="sori-bg-parchment sori-border-dotted rounded-[1.4rem] p-4">
        <p className="sori-kicker text-xs">branch tree</p>
        <ul className="mt-3 space-y-2">
          {pathNodes.map((n, index) => (
            <motion.li
              key={n.id}
              initial={soriMotion.popIn.initial}
              animate={soriMotion.popIn.animate}
              transition={{
                ...soriMotion.popIn.transition,
                delay: index * 0.07,
              }}
              className={`rounded-[1rem] border px-3 py-2 text-sm ${
                n.id === state.activeNodeId
                  ? "border-primary/40 bg-primary/5"
                  : "border-border/60 bg-background/30"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--sori-text-muted)]">
                  {n.type} · {n.stateSnapshotId}
                </span>
                {n.metadata.isParadox && (
                  <span className="text-[10px] font-medium uppercase tracking-wider text-destructive">
                    paradox
                  </span>
                )}
              </div>
              <p className="mt-1 whitespace-pre-wrap text-[var(--sori-text-secondary)]">
                {n.content.slice(0, 160)}
                {n.content.length > 160 ? "…" : ""}
              </p>
            </motion.li>
          ))}
        </ul>

        {activeNode && activeNode.choices.length > 0 && (
          <div className="sori-border-dotted-y mt-4 space-y-2 py-4">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--sori-text-muted)]">
              Choose path
            </p>
            <div className="flex flex-col gap-2">
              {activeNode.choices.map((c) => (
                <motion.div key={c.id} {...soriMotion.cardLift}>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-auto w-full justify-start whitespace-normal rounded-[1rem] py-3 text-left text-sm"
                    onClick={() => onChoose(c.id)}
                  >
                    <span className="mr-2 font-mono text-[10px] text-[var(--sori-text-muted)]">
                      {c.intent}
                    </span>
                    {c.label}
                  </Button>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-2">
          <Button
            type="button"
            size="sm"
            disabled={!activeNode}
            onClick={onCommitBranch}
            className="w-full sm:w-auto"
          >
            Commit to story
          </Button>
          <p className="mt-2 text-xs text-[var(--sori-text-muted)]">
            Inserts a relational beat summary into the pulse stream below — not prose.
          </p>
        </div>
      </div>

      <div className="sori-bg-parchment sori-border-dotted rounded-[1.4rem] p-4">
        <p className="sori-kicker text-xs">oracle</p>
        <p className="mt-1 text-xs text-[var(--sori-text-muted)]">
          Ink-flow reveal on transcript lines (agent dialogue only).
        </p>
        <div className="mt-3 max-h-56 space-y-3 overflow-y-auto pr-1">
          <AnimatePresence initial={false}>
            {oracleLines.map((line) => (
              <motion.p
                key={line.id}
                className="rounded-[0.85rem] border border-border/50 bg-background/35 px-3 py-2 text-sm text-[var(--sori-text-secondary)]"
                {...soriMotion.inkSettle}
              >
                {line.text}
              </motion.p>
            ))}
          </AnimatePresence>
        </div>
        {paradoxHits.length > 0 && (
          <p className="mt-3 text-xs font-medium text-destructive">
            Structural paradox (demo scan): leaked forbidden phrase(s).
          </p>
        )}
      </div>

      {committedNote && (
        <motion.div
          className="sori-panel rounded-[1.2rem] p-4 text-sm text-[var(--sori-text-secondary)]"
          {...soriMotion.inkSettle}
        >
          <p className="sori-kicker text-xs">committed beat</p>
          <p className="mt-2 whitespace-pre-wrap">{committedNote}</p>
        </motion.div>
      )}
    </div>
  );
}
