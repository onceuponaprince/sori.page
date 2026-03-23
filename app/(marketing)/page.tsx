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
    <div className="min-h-screen">
      <div className="mx-auto max-w-7xl px-5 pb-16 pt-6 sm:px-8 sm:pb-24">
        <header className="sori-shell mb-8 flex items-center justify-between rounded-[1.6rem] px-4 py-3 sm:px-6">
          <a href="/" className="sori-link-underline">
            <span className="text-2xl" style={{ fontFamily: "var(--font-display)" }}>
              sori<span className="text-muted-foreground">.page</span>
            </span>
          </a>
          <div className="flex gap-2 sm:gap-3">
            <Button variant="ghost" asChild>
              <a href="/login">Sign In</a>
            </Button>
            <Button asChild className="shadow-md">
              <a href="/write">Open the Treehouse</a>
            </Button>
          </div>
        </header>

        <motion.section
          className="sori-paper relative rounded-[2rem] px-6 py-10 sm:px-10 sm:py-14"
          initial="initial"
          animate="animate"
          variants={soriMotion.stagger}
        >
          <div className="pointer-events-none absolute -right-20 -top-12 h-56 w-56 rounded-full bg-sori-glow blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-[radial-gradient(circle,oklch(0.78_0.08_314_/_0.18),transparent_60%)] blur-3xl" />

          <div className="relative z-10 grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10">
            <motion.div variants={soriMotion.inkSettle}>
              <div className="sori-chip inline-flex rounded-full px-3 py-1">
                The Writer&apos;s Treehouse
              </div>
              <p className="sori-kicker mt-4 text-sm">
                structure-first writing guidance
              </p>
              <h1 className="sori-title mt-4 text-5xl sm:text-6xl lg:text-7xl">
                Stories worth telling.
                <br />
                Confidence worth feeling.
              </h1>
              <p className="mt-5 max-w-2xl text-lg text-[var(--sori-text-secondary)] sm:text-xl">
                sori.page studies the shape of your story, surfaces structural
                patterns, and gently shows where your outline is already working
                harder than you think.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <a href="/write">Start Writing</a>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <a href="#demo">Try a demo analysis</a>
                </Button>
              </div>

              {submitted ? (
                <div className="sori-panel mt-8 rounded-[1.5rem] p-6">
                  <p
                    className="text-lg font-semibold"
                    style={{ fontFamily: "var(--font-ui)" }}
                  >
                    You&apos;re on the list.
                  </p>
                  <p className="mt-1 text-[var(--sori-text-secondary)]">
                    We&apos;ll reach out when your early access spot opens.
                  </p>
                </div>
              ) : (
                <form
                  onSubmit={handleSubmit}
                  className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center"
                >
                  <Input
                    type="email"
                    placeholder="you@storystudio.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="text-base"
                  />
                  <Button
                    type="submit"
                    size="lg"
                    disabled={loading}
                    className="h-12 whitespace-nowrap px-8"
                  >
                    {loading ? "Joining..." : "Join Waitlist"}
                  </Button>
                </form>
              )}

              <p className="mt-4 text-sm text-[var(--sori-text-muted)]">
                Free launch credits. No spam. No ghostwriting.
              </p>
            </motion.div>

            <motion.aside
              className="sori-panel rounded-[1.6rem] p-6"
              variants={soriMotion.inkSettle}
            >
              <p className="sori-kicker text-xs">what you get</p>
              <h2 className="mt-3 text-3xl">A structural co-architect.</h2>
              <p className="mt-3 text-[var(--sori-text-secondary)]">
                Instead of writing scenes for you, sori.page maps narrative
                forces, compares your outline to stories across genres, and
                highlights where payoff, pressure, and character knowledge may
                drift apart.
              </p>
              <div className="mt-5 space-y-3 text-sm" style={{ fontFamily: "var(--font-ui)" }}>
                <div className="rounded-[1.15rem] border border-border/70 bg-background/45 p-4">
                  Cross-genre matching that explains why your romance might share
                  structural DNA with a thriller.
                </div>
                <div className="rounded-[1.15rem] border border-border/70 bg-background/45 p-4">
                  Confidence bands for coherence, never quality scores for your
                  prose.
                </div>
                <div className="rounded-[1.15rem] border border-border/70 bg-background/45 p-4">
                  Timeline checks that flag when a character acts on knowledge
                  they have not earned yet.
                </div>
              </div>
            </motion.aside>
          </div>
        </motion.section>

        <section className="mt-10 grid gap-6 md:grid-cols-3">
          <FeatureCard
            title="Story Structure Analyzer"
            description="Paste an outline and get pattern identification, cross-genre resonance, and gentle structural questions."
          />
          <FeatureCard
            title="Writer&apos;s Treehouse Editor"
            description="Draft inside a Tiptap workspace with a sidebar that updates as your story reveals its arc."
          />
          <FeatureCard
            title="Knowledge Graph Backbone"
            description="Trace every insight back to narrative concepts, functions, and examples instead of opaque model intuition."
          />
        </section>

        <section id="demo" className="mt-16 grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
          <div className="sori-paper rounded-[1.8rem] p-6 sm:p-7">
            <p className="sori-kicker text-xs">interactive analyzer demo</p>
            <h2 className="mt-3 text-4xl">See how sori reads story shape.</h2>
            <p className="mt-3 text-[var(--sori-text-secondary)]">
              The demo analyses below are prebuilt examples of the product&apos;s
              structural voice. The live analyzer keeps the same tone: comparative,
              specific, and never prescriptive.
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              {ANALYZER_DEMOS.map((demo) => (
                <button
                  key={demo.id}
                  onClick={() => setSelectedDemoId(demo.id)}
                  className={`rounded-full border px-4 py-2 text-sm transition-all ${
                    selectedDemoId === demo.id
                      ? "border-primary/70 bg-primary/95 text-primary-foreground shadow-[0_10px_24px_oklch(var(--primary)/0.22)]"
                      : "border-border/70 bg-background/55 text-[var(--sori-text-secondary)] hover:border-primary/35 hover:text-foreground"
                  }`}
                >
                  {demo.label}
                </button>
              ))}
            </div>

            <div className="sori-editor-surface mt-6 rounded-[1.5rem] p-5">
              <p className="sori-kicker text-xs">outline sample</p>
              <h3 className="mt-2 text-2xl">{selectedDemo.genre}</h3>
              <div className="mt-4 whitespace-pre-line text-[15px] leading-7 text-[var(--sori-text-secondary)]">
                {selectedDemo.outline}
              </div>
            </div>
          </div>

          <motion.div
            key={selectedDemo.id}
            className="sori-paper rounded-[1.8rem] p-6 sm:p-7"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
          >
            <div className="flex flex-wrap items-center gap-3">
              <span className="sori-chip rounded-full px-3 py-1">
                  {demoLoading
                    ? statusCopy(latestStatus)
                    : demoAnalysis.confidenceLabel}
              </span>
              <span className="text-sm text-[var(--sori-text-secondary)]">
                  Coherence signal: {demoAnalysis.coherenceScore}/100
              </span>
            </div>
            <h3 className="mt-4 text-3xl">{demoAnalysis.title}</h3>
            <p className="mt-3 text-[var(--sori-text-secondary)]">
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
              <div className="sori-panel rounded-[1.3rem] p-4">
                <p className="sori-kicker text-xs">Pattern matches</p>
                <div className="mt-3 space-y-3">
                  {demoAnalysis.patternMatches.map((match) => (
                    <div key={match.id} className="rounded-[1rem] border border-border/65 bg-background/45 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <h4 className="text-lg">{match.label}</h4>
                        <span className="text-xs text-[var(--sori-text-muted)]">
                          {Math.round(match.confidence * 100)}% fit
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-[var(--sori-text-secondary)]">
                        {match.whyItFits}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="sori-panel rounded-[1.3rem] p-4">
                <p className="sori-kicker text-xs">Stories like yours</p>
                <div className="mt-3 space-y-3">
                  {demoAnalysis.crossGenreComparisons.map((story) => (
                    <div key={story.title} className="rounded-[1rem] border border-border/65 bg-background/45 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <h4 className="text-lg">{story.title}</h4>
                        <span className="text-xs uppercase tracking-[0.18em] text-[var(--sori-text-muted)]">
                          {story.medium}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-[var(--sori-text-secondary)]">
                        {story.resonance}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        <div className="sori-paper mt-16 rounded-[1.8rem] p-8 text-center">
          <h2 className="text-3xl">Know why each suggestion appears.</h2>
          <p className="mt-4 mx-auto text-lg text-[var(--sori-text-secondary)]">
            Most AI tools chase plausible sentences. sori.page chases structural
            clarity, comparative pattern recognition, and creative confidence.
          </p>
          <p className="mt-2 mx-auto text-[var(--sori-text-secondary)]">
            Every flagship experience is built around this rule: analyze, suggest,
            and contextualize. Never write the story for the writer.
          </p>
        </div>
      </div>

      <footer className="border-t border-border/70 py-8 text-center text-sm text-[var(--sori-text-muted)]">
        sori.page
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
    <div className="sori-panel rounded-[1.5rem] p-6 transition-transform duration-200 hover:-translate-y-1">
      <h3 className="text-xl">{title}</h3>
      <p className="mt-3 text-sm leading-relaxed text-[var(--sori-text-secondary)]">
        {description}
      </p>
    </div>
  );
}

function AnalysisCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="sori-panel rounded-[1.2rem] p-4">
      <p className="sori-kicker text-xs">{title}</p>
      <p className="mt-3 text-sm text-[var(--sori-text-secondary)]">{body}</p>
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
