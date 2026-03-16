"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LandingPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

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
      <div className="flex justify-between items-center p-6 max-w-5xl mx-auto">
        <span className="text-xl font-bold tracking-tight">
          sori<span className="text-muted-foreground">.page</span>
        </span>
        <div className="flex gap-3">
          <Button variant="ghost" asChild>
            <a href="/login">Sign In</a>
          </Button>
          <Button asChild>
            <a href="/generate">Try It Free</a>
          </Button>
        </div>
      </div>

      {/* Hero */}
      <div className="flex flex-col items-center justify-center min-h-[75vh] px-6">
        <div className="max-w-2xl text-center space-y-8">
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
            sori<span className="text-muted-foreground">.page</span>
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground leading-relaxed">
            AI that understands <em>story structure</em>, not just words.
            Generate scenes, characters, and beats grounded in real narrative
            knowledge.
          </p>

          {submitted ? (
            <div className="bg-muted rounded-lg p-6">
              <p className="text-lg font-medium">You&apos;re on the list.</p>
              <p className="text-muted-foreground mt-1">
                We&apos;ll reach out when your spot opens up.
              </p>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto"
            >
              <Input
                type="email"
                placeholder="you@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-12 text-base"
              />
              <Button
                type="submit"
                size="lg"
                disabled={loading}
                className="h-12 px-8 whitespace-nowrap"
              >
                {loading ? "Joining..." : "Join Waitlist"}
              </Button>
            </form>
          )}

          <p className="text-sm text-muted-foreground">
            Free credits on launch. No spam.
          </p>
        </div>
      </div>

      {/* What it does */}
      <div className="max-w-5xl mx-auto px-6 pb-24">
        <div className="grid md:grid-cols-3 gap-6">
          <FeatureCard
            title="Story Beat Generator"
            description="Pick a genre and a moment in the story. Get a structurally-grounded scene with the reasoning visible — not just output, but why."
          />
          <FeatureCard
            title="Character Generator"
            description="Create characters that fit your narrative structure. Insert them into template scenes from real stories to test how they work."
          />
          <FeatureCard
            title="Knowledge Graph"
            description="Powered by verified narrative concepts — tropes, structures, archetypes — contributed and validated by writers, not scraped by bots."
          />
        </div>

        {/* Differentiator */}
        <div className="mt-24 text-center max-w-2xl mx-auto space-y-6">
          <h2 className="text-3xl font-bold tracking-tight">
            Not another AI writing tool
          </h2>
          <p className="text-muted-foreground text-lg leading-relaxed">
            Most AI writing tools generate text that <em>sounds</em> like a
            story. sori.page generates text that <em>is structured</em> like a
            story — because it reasons from verified narrative patterns, not
            statistical word prediction.
          </p>
          <p className="text-muted-foreground">
            Every suggestion traces back to a concept node with a confidence
            score. You always know <em>why</em> the AI recommends what it does.
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
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
    <div className="border rounded-xl p-6 space-y-3">
      <h3 className="font-semibold text-lg">{title}</h3>
      <p className="text-muted-foreground text-sm leading-relaxed">
        {description}
      </p>
    </div>
  );
}
