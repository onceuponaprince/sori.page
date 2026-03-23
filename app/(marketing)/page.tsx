"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ANALYZER_DEMOS } from "@/lib/analyzer-demos";
import { soriMotion } from "@/lib/sori-motion";
import { useStream } from "@/lib/use-stream";

export default function LandingPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedDemoId, setSelectedDemoId] = useState(ANALYZER_DEMOS[0].id);
  const { analysis, latestStatus, loading: demoLoading, generate } =
    useStream("/api/analyze");

  const selectedDemo =
    ANALYZER_DEMOS.find((demo) => demo.id === selectedDemoId) ?? ANALYZER_DEMOS[0];
  const demoAnalysis = analysis ?? selectedDemo.analysis;

  useEffect(() => {
    generate({ demo_id: selectedDemoId });
  }, [generate, selectedDemoId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.ok) setSubmitted(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="w-full border-b border-border">
        <div className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
          <a href="/" className="text-foreground hover:text-accent transition-colors">
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 500, fontSize: "1.1rem", letterSpacing: "0.02em" }}>
              sori.page
            </span>
          </a>
          <div className="hidden md:flex items-center gap-4">
            <div className="text-right">
              <p style={{ fontFamily: "var(--font-body)", fontSize: "0.7rem", color: "#8A857E", lineHeight: 1.4 }}>
                AI Context Engine for Writers
              </p>
              <p style={{ fontFamily: "var(--font-body)", fontSize: "0.7rem", color: "#8A857E", lineHeight: 1.4 }}>
                structure-first writing guidance
              </p>
            </div>
            <div className="w-3 h-3 rounded-full bg-foreground" />
          </div>
          <div className="flex gap-3 md:hidden">
            <Button variant="ghost" asChild>
              <a href="/login">Sign In</a>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <motion.section
        className="px-6 py-16 md:py-24 max-w-5xl mx-auto"
        initial="initial"
        animate="animate"
        variants={soriMotion.stagger}
      >
        <motion.div variants={soriMotion.inkSettle}>
          <p
            style={{ fontFamily: "var(--font-body)", fontSize: "0.65rem", letterSpacing: "0.18em", textTransform: "uppercase", color: "#C8635A" }}
            className="mb-4"
          >
            The Writer&apos;s Context Engine
          </p>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(2.4rem, 7vw, 5rem)",
              fontWeight: 500,
              lineHeight: 1.1,
              letterSpacing: "-0.01em",
            }}
            className="text-foreground mb-6"
          >
            A better way of{" "}
            <em style={{ color: "#C8635A", fontStyle: "italic" }}>understanding</em>{" "}
            your story.
          </h1>
          <p
            style={{ fontFamily: "var(--font-body)", fontSize: "0.9rem", color: "#8A857E", maxWidth: "38ch", lineHeight: 1.7 }}
            className="mb-8"
          >
            sori.page studies the shape of your story, surfaces structural
            patterns, and gently shows where your outline is already working
            harder than you think.
          </p>
          <div className="flex flex-wrap gap-4">
            <Button asChild size="lg">
              <a href="/write">Start Writing</a>
            </Button>
            <Button asChild variant="outline" size="lg">
              <a href="#demo">Try a demo analysis</a>
            </Button>
          </div>
        </motion.div>
      </motion.section>

      {/* Waitlist / CTA band */}
      <div className="border-t border-b border-border">
        <div className="px-6 py-12 max-w-5xl mx-auto">
          {submitted ? (
            <div className="border border-accent p-6">
              <h3
                style={{ fontFamily: "var(--font-display)", fontSize: "1.15rem", fontWeight: 500 }}
                className="text-foreground"
              >
                You&apos;re on the list.
              </h3>
              <p style={{ fontFamily: "var(--font-body)", fontSize: "0.85rem", color: "#8A857E" }} className="mt-2">
                We&apos;ll reach out when your early access spot opens.
              </p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-end">
              <div>
                <p
                  style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.4rem, 3.5vw, 2.4rem)", fontWeight: 500, lineHeight: 1.3, maxWidth: "20ch" }}
                  className="text-foreground mb-2"
                >
                  Join the waitlist for early access.
                </p>
                <p style={{ fontFamily: "var(--font-body)", fontSize: "0.78rem", color: "#8A857E" }}>
                  Free launch credits. No spam. No ghostwriting.
                </p>
              </div>
              <form
                onSubmit={handleSubmit}
                className="flex flex-col gap-3 sm:flex-row sm:items-center"
              >
                <Input
                  type="email"
                  placeholder="you@storystudio.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="min-w-[240px]"
                />
                <Button type="submit" disabled={loading}>
                  {loading ? "Joining..." : "Join Waitlist"}
                </Button>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Feature cards */}
      <section className="px-6 py-16 max-w-5xl mx-auto">
        <p
          style={{ fontFamily: "var(--font-body)", fontSize: "0.65rem", letterSpacing: "0.18em", textTransform: "uppercase", color: "#8A857E" }}
          className="mb-6"
        >
          What you get
        </p>
        <div className="grid gap-px bg-border md:grid-cols-3">
          <FeatureCard
            title="Story Structure Analyzer"
            description="Paste an outline and get pattern identification, cross-genre resonance, and gentle structural questions."
          />
          <FeatureCard
            title="Writer's Editor"
            description="Draft inside a Tiptap workspace with a sidebar that updates as your story reveals its arc."
          />
          <FeatureCard
            title="Knowledge Graph"
            description="Trace every insight back to narrative concepts, functions, and examples instead of opaque model intuition."
          />
        </div>
      </section>

      {/* Nav links band */}
      <div className="border-t border-b border-border overflow-hidden">
        <div className="py-8 px-6 max-w-5xl mx-auto flex flex-wrap gap-0">
          {["Structure", "Confidence", "Pattern matching", "Knowledge flow", "Cross-genre", "No ghostwriting"].map((link, i, arr) => (
            <span key={link} className="flex items-center">
              <span
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(1.4rem, 3vw, 2.2rem)",
                  fontWeight: 400,
                  lineHeight: 1.3,
                  fontStyle: "italic",
                }}
                className="text-foreground px-1"
              >
                {link}
              </span>
              {i < arr.length - 1 && (
                <span
                  style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.4rem, 3vw, 2.2rem)", lineHeight: 1.3 }}
                  className="text-foreground/30 px-1"
                >
                  •
                </span>
              )}
            </span>
          ))}
        </div>
      </div>

      {/* Analyzer Demo */}
      <section id="demo" className="px-6 py-16 max-w-7xl mx-auto">
        <div className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
          <div className="border border-border p-6 sm:p-8">
            <p
              style={{ fontFamily: "var(--font-body)", fontSize: "0.65rem", letterSpacing: "0.18em", textTransform: "uppercase", color: "#C8635A" }}
              className="mb-2"
            >
              Interactive Analyzer Demo
            </p>
            <h2
              style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.4rem, 3vw, 2rem)", fontWeight: 500 }}
              className="text-foreground mb-3"
            >
              See how sori reads{" "}
              <em style={{ color: "#C8635A", fontStyle: "italic" }}>story shape</em>.
            </h2>
            <p style={{ fontFamily: "var(--font-body)", fontSize: "0.85rem", color: "#8A857E", lineHeight: 1.7 }}>
              The demo analyses below are prebuilt examples of the product&apos;s
              structural voice.
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              {ANALYZER_DEMOS.map((demo) => (
                <button
                  key={demo.id}
                  onClick={() => setSelectedDemoId(demo.id)}
                  style={{ fontFamily: "var(--font-body)", fontSize: "0.72rem", letterSpacing: "0.04em" }}
                  className={`border px-3 py-1.5 text-sm transition-colors cursor-pointer ${
                    selectedDemoId === demo.id
                      ? "border-foreground bg-foreground text-background"
                      : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
                  }`}
                >
                  {demo.label}
                </button>
              ))}
            </div>

            <div className="mt-6 border border-border p-5">
              <p
                style={{ fontFamily: "var(--font-body)", fontSize: "0.65rem", letterSpacing: "0.18em", textTransform: "uppercase", color: "#8A857E" }}
                className="mb-2"
              >
                Outline sample
              </p>
              <h3
                style={{ fontFamily: "var(--font-display)", fontSize: "1.15rem", fontWeight: 500 }}
                className="text-foreground"
              >
                {selectedDemo.genre}
              </h3>
              <div
                style={{ fontFamily: "var(--font-body)", fontSize: "0.85rem", lineHeight: 1.8, color: "#4A4845" }}
                className="mt-4 whitespace-pre-line"
              >
                {selectedDemo.outline}
              </div>
            </div>
          </div>

          <motion.div
            key={selectedDemo.id}
            className="border border-border p-6 sm:p-8"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
          >
            <div className="flex flex-wrap items-center gap-3">
              <span
                style={{ fontFamily: "var(--font-body)", fontSize: "0.72rem", letterSpacing: "0.12em", textTransform: "uppercase" }}
                className="inline-flex items-center border border-border bg-secondary px-3 py-1 text-muted-foreground"
              >
                {demoLoading
                  ? statusCopy(latestStatus)
                  : demoAnalysis.confidenceLabel}
              </span>
              <span style={{ fontFamily: "var(--font-body)", fontSize: "0.78rem", color: "#8A857E" }}>
                Coherence signal: {demoAnalysis.coherenceScore}/100
              </span>
            </div>
            <h3
              style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", fontWeight: 500 }}
              className="mt-4 text-foreground"
            >
              {demoAnalysis.title}
            </h3>
            <p style={{ fontFamily: "var(--font-body)", fontSize: "0.85rem", color: "#8A857E", lineHeight: 1.7 }} className="mt-3">
              {demoAnalysis.summary}
            </p>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <AnalysisCard title="Current Arc" body={demoAnalysis.currentArc} />
              <AnalysisCard
                title="Timeline Watch"
                body={
                  demoAnalysis.timelineWarnings[0]?.detail ??
                  "No timeline tension surfaced in the first pass."
                }
              />
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="border border-border p-4">
                <p
                  style={{ fontFamily: "var(--font-body)", fontSize: "0.65rem", letterSpacing: "0.18em", textTransform: "uppercase", color: "#8A857E" }}
                  className="mb-3"
                >
                  Pattern matches
                </p>
                <div className="space-y-3">
                  {demoAnalysis.patternMatches.map((match) => (
                    <div key={match.id} className="border border-border p-3">
                      <div className="flex items-center justify-between gap-3">
                        <h4
                          style={{ fontFamily: "var(--font-body)", fontSize: "0.85rem", fontWeight: 500 }}
                          className="text-foreground"
                        >
                          {match.label}
                        </h4>
                        <span style={{ fontFamily: "var(--font-body)", fontSize: "0.68rem", color: "#8A857E" }}>
                          {Math.round(match.confidence * 100)}% fit
                        </span>
                      </div>
                      <p style={{ fontFamily: "var(--font-body)", fontSize: "0.78rem", color: "#8A857E", lineHeight: 1.6 }} className="mt-2">
                        {match.whyItFits}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border border-border p-4">
                <p
                  style={{ fontFamily: "var(--font-body)", fontSize: "0.65rem", letterSpacing: "0.18em", textTransform: "uppercase", color: "#8A857E" }}
                  className="mb-3"
                >
                  Stories like yours
                </p>
                <div className="space-y-3">
                  {demoAnalysis.crossGenreComparisons.map((story) => (
                    <div key={story.title} className="border border-border p-3">
                      <div className="flex items-center justify-between gap-3">
                        <h4
                          style={{ fontFamily: "var(--font-body)", fontSize: "0.85rem", fontWeight: 500 }}
                          className="text-foreground"
                        >
                          {story.title}
                        </h4>
                        <span style={{ fontFamily: "var(--font-body)", fontSize: "0.65rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "#8A857E" }}>
                          {story.medium}
                        </span>
                      </div>
                      <p style={{ fontFamily: "var(--font-body)", fontSize: "0.78rem", color: "#8A857E", lineHeight: 1.6 }} className="mt-2">
                        {story.resonance}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Bottom CTA */}
      <div className="border-t border-border">
        <section className="px-6 py-16 md:py-24 max-w-5xl mx-auto">
          <p
            style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.4rem, 3.5vw, 2.4rem)", fontWeight: 500, lineHeight: 1.3, maxWidth: "20ch" }}
            className="text-foreground mb-4"
          >
            Know why each suggestion appears.
          </p>
          <p style={{ fontFamily: "var(--font-body)", fontSize: "0.85rem", color: "#8A857E", maxWidth: "50ch", lineHeight: 1.7 }}>
            Most AI tools chase plausible sentences. sori.page chases structural
            clarity, comparative pattern recognition, and creative confidence.
          </p>
          <a
            href="mailto:hello@sori.page"
            style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1rem, 2vw, 1.3rem)", fontStyle: "italic" }}
            className="mt-4 inline-block text-accent hover:text-foreground transition-colors underline underline-offset-4"
          >
            hello@sori.page
          </a>
        </section>
      </div>

      {/* Footer */}
      <footer className="w-full border-t border-border">
        <div className="flex items-center justify-between px-6 py-5 max-w-7xl mx-auto">
          <span
            style={{ fontFamily: "var(--font-display)", fontWeight: 500, fontSize: "1rem" }}
            className="text-foreground"
          >
            sori.page
          </span>
          <span style={{ fontFamily: "var(--font-body)", fontSize: "0.68rem", color: "#8A857E" }}>
            © 2026 Yurika
          </span>
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="w-8 h-8 border border-border flex items-center justify-center hover:border-foreground transition-colors"
            aria-label="Scroll to top"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 10V2M2 6l4-4 4 4" />
            </svg>
          </button>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="border border-border bg-card p-6 hover:border-foreground transition-colors">
      <h3
        style={{ fontFamily: "var(--font-display)", fontSize: "1.15rem", fontWeight: 500 }}
        className="text-foreground"
      >
        {title}
      </h3>
      <p style={{ fontFamily: "var(--font-body)", fontSize: "0.85rem", color: "#8A857E", lineHeight: 1.7 }} className="mt-3">
        {description}
      </p>
    </div>
  );
}

function AnalysisCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="border border-border p-4">
      <p
        style={{ fontFamily: "var(--font-body)", fontSize: "0.65rem", letterSpacing: "0.18em", textTransform: "uppercase", color: "#8A857E" }}
        className="mb-2"
      >
        {title}
      </p>
      <p style={{ fontFamily: "var(--font-body)", fontSize: "0.85rem", color: "#8A857E", lineHeight: 1.7 }}>
        {body}
      </p>
    </div>
  );
}

function statusCopy(status: string) {
  switch (status) {
    case "reading-outline":
      return "Reading outline";
    case "matching-structural-dna":
      return "Matching structural DNA";
    default:
      return "Demo analyzer";
  }
}
