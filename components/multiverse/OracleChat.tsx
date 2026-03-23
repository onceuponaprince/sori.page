"use client";

import { useRef, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { multiverseMotion } from "@/lib/sori-motion";
import type { DialogueTurn, EpistemicProfile } from "@/types/multiverse";

interface OracleChatProps {
  turns: DialogueTurn[];
  profiles: [EpistemicProfile, EpistemicProfile] | null;
  isSimulating: boolean;
  onMarkDecision: () => void;
}

export function OracleChat({
  turns,
  profiles,
  isSimulating,
  onMarkDecision,
}: OracleChatProps) {
  const scrollAnchorRef = useRef<HTMLDivElement>(null);
  const [showKnowledge, setShowKnowledge] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      scrollAnchorRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
    return () => clearTimeout(timer);
  }, [turns.length]);

  const firstCharId = turns.length > 0 ? turns[0].characterId : null;

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <p className="sori-kicker">oracle view</p>
          <h3 style={{ fontFamily: "var(--font-display)", fontSize: "1rem", fontWeight: 500 }} className="mt-1 text-foreground">
            Agent Dialogue
          </h3>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowKnowledge(!showKnowledge)}
            className="sori-chip px-3 py-1 transition-colors hover:border-foreground cursor-pointer"
          >
            {showKnowledge ? "hide knowledge" : "show knowledge"}
          </button>
        </div>
      </div>

      {/* Knowledge Badges */}
      <AnimatePresence>
        {showKnowledge && profiles && (
          <motion.div
            {...multiverseMotion.inkFlow}
            exit={{ opacity: 0, y: -8 }}
            className="border-b border-border px-4 py-3"
          >
            <div className="grid grid-cols-2 gap-3">
              {profiles.map((profile) => (
                <KnowledgeBadge key={profile.characterId} profile={profile} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dialogue Turns */}
      <div className="hide-scrollbar flex-1 overflow-y-auto px-4 py-4">
        {turns.length === 0 && !isSimulating && (
          <div className="flex h-full items-center justify-center">
            <p style={{ fontFamily: "var(--font-body)", fontSize: "0.78rem", color: "#8A857E" }} className="text-center">
              Start a simulation to see agents interact here.
              <br />
              <span style={{ fontSize: "0.68rem" }} className="mt-1 block">
                Each agent only knows what the Truth Guard allows.
              </span>
            </p>
          </div>
        )}

        <AnimatePresence mode="popLayout">
          {turns.map((turn) => (
            <DialogueBubble
              key={turn.id}
              turn={turn}
              isLeft={turn.characterId === firstCharId}
            />
          ))}
        </AnimatePresence>

        {isSimulating && (
          <motion.div
            {...multiverseMotion.inkFlow}
            style={{ fontFamily: "var(--font-body)", fontSize: "0.78rem", color: "#8A857E" }}
            className="mt-3 flex items-center gap-2"
          >
            <SimulatingDots />
            <span>Agents are interacting...</span>
          </motion.div>
        )}

        <div ref={scrollAnchorRef} />
      </div>

      {/* Footer Actions */}
      {turns.length > 0 && !isSimulating && (
        <div className="border-t border-border px-4 py-3">
          <button
            onClick={onMarkDecision}
            style={{ fontFamily: "var(--font-body)", fontSize: "0.72rem", letterSpacing: "0.12em", textTransform: "uppercase" }}
            className="w-full border border-border px-4 py-2.5 transition-colors hover:border-accent hover:text-accent cursor-pointer"
          >
            Mark as Decision Point
          </button>
        </div>
      )}
    </div>
  );
}

function DialogueBubble({
  turn,
  isLeft,
}: {
  turn: DialogueTurn;
  isLeft: boolean;
}) {
  return (
    <motion.div
      {...multiverseMotion.inkFlow}
      className={`mb-3 flex ${isLeft ? "justify-start" : "justify-end"}`}
    >
      <motion.div
        {...(turn.isParadox ? multiverseMotion.paradoxPulse : {})}
        className={`relative max-w-[85%] border p-3 ${
          turn.isParadox
            ? "border-accent/40 bg-accent/5"
            : isLeft
              ? "border-border bg-card"
              : "border-border bg-secondary/50"
        }`}
      >
        <p className="sori-kicker mb-1.5" style={{ fontSize: "0.58rem" }}>
          {turn.characterName}
        </p>

        <p style={{ fontFamily: "var(--font-body)", fontSize: "0.78rem", lineHeight: 1.6 }} className="m-0 text-foreground">
          {turn.content}
        </p>

        {turn.isParadox && turn.paradoxDetail && (
          <div className="mt-2 border border-accent/30 bg-accent/10 px-2.5 py-1.5">
            <p style={{ fontFamily: "var(--font-body)", fontSize: "0.6rem", letterSpacing: "0.14em", textTransform: "uppercase" }} className="m-0 font-medium text-accent">
              Structural Paradox
            </p>
            <p style={{ fontFamily: "var(--font-body)", fontSize: "0.68rem" }} className="m-0 mt-0.5 text-accent/80">
              {turn.paradoxDetail}
            </p>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

function KnowledgeBadge({ profile }: { profile: EpistemicProfile }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-border bg-card p-2.5">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between text-left cursor-pointer"
      >
        <div>
          <p style={{ fontFamily: "var(--font-body)", fontSize: "0.72rem", fontWeight: 500 }} className="m-0 text-foreground">
            {profile.characterName}
          </p>
          {profile.roleHint && (
            <p style={{ fontFamily: "var(--font-body)", fontSize: "0.6rem" }} className="m-0 text-muted-foreground">
              {profile.roleHint}
            </p>
          )}
        </div>
        <div className="flex gap-1.5 text-[10px]">
          <span className="border border-foreground/20 px-1.5 py-0.5 text-foreground">
            {profile.knownFacts.length} known
          </span>
          <span className="border border-accent/20 px-1.5 py-0.5 text-accent">
            {profile.unknownFacts.length} hidden
          </span>
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="mt-2 space-y-1 border-t border-border pt-2">
              {profile.knownFacts.length > 0 && (
                <div>
                  <p style={{ fontFamily: "var(--font-body)", fontSize: "0.58rem", letterSpacing: "0.14em", textTransform: "uppercase" }} className="m-0 font-medium text-foreground">
                    Knows
                  </p>
                  {profile.knownFacts.map((fact) => (
                    <p
                      key={fact.factNodeId}
                      style={{ fontFamily: "var(--font-body)", fontSize: "0.6rem", color: "#4A4845" }}
                      className="m-0 leading-snug"
                    >
                      • {fact.description}
                    </p>
                  ))}
                </div>
              )}
              {profile.unknownFacts.length > 0 && (
                <div className="mt-1.5">
                  <p style={{ fontFamily: "var(--font-body)", fontSize: "0.58rem", letterSpacing: "0.14em", textTransform: "uppercase" }} className="m-0 font-medium text-accent">
                    Does Not Know
                  </p>
                  {profile.unknownFacts.slice(0, 5).map((fact) => (
                    <p
                      key={fact.factNodeId}
                      style={{ fontFamily: "var(--font-body)", fontSize: "0.6rem", color: "#8A857E" }}
                      className="m-0 leading-snug"
                    >
                      • {fact.description}
                    </p>
                  ))}
                  {profile.unknownFacts.length > 5 && (
                    <p style={{ fontFamily: "var(--font-body)", fontSize: "0.6rem", color: "#8A857E" }} className="m-0">
                      + {profile.unknownFacts.length - 5} more...
                    </p>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SimulatingDots() {
  return (
    <span className="flex gap-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="inline-block h-1.5 w-1.5 rounded-full bg-accent"
          animate={{ y: [0, -4, 0] }}
          transition={{
            duration: 0.6,
            repeat: Infinity,
            delay: i * 0.15,
            ease: "easeInOut",
          }}
        />
      ))}
    </span>
  );
}
