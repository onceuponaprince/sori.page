"use client";

import Link from "next/link";

interface PlaygroundOnboardingProps {
  storyUid: string;
  hasCharacters: boolean;
  hasPublished: boolean;
}

const STEPS = [
  {
    key: "create",
    title: "Create a character",
    description: "Add a name and sketch voice, knowledge, and boundaries in markdown.",
  },
  {
    key: "publish",
    title: "Publish to graph",
    description: "Promote your draft so Talk and Scene can use it at runtime.",
  },
  {
    key: "talk",
    title: "Go to Talk",
    description: "Chat one-on-one with a published character to test voice and knowledge.",
  },
] as const;

export function PlaygroundOnboarding({
  storyUid,
  hasCharacters,
  hasPublished,
}: PlaygroundOnboardingProps) {
  const completed = {
    create: hasCharacters,
    publish: hasPublished,
    talk: false,
  };

  const activeIndex = !hasCharacters ? 0 : !hasPublished ? 1 : 2;

  return (
    <div className="mx-auto max-w-lg p-8">
      <p className="sori-kicker">Getting started</p>
      <h2
        style={{ fontFamily: "var(--font-display)", fontSize: "1.25rem" }}
        className="mt-2 font-medium text-foreground"
      >
        Set up your simulation playground
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Three quick steps to go from empty story to your first character chat.
      </p>

      <ol className="mt-8 space-y-4">
        {STEPS.map((step, index) => {
          const isComplete =
            step.key === "create"
              ? completed.create
              : step.key === "publish"
                ? completed.publish
                : false;
          const isActive = index === activeIndex && !isComplete;

          return (
            <li
              key={step.key}
              className={`border p-4 ${
                isActive
                  ? "border-accent bg-accent/5"
                  : isComplete
                    ? "border-emerald-200 bg-emerald-50/50"
                    : "border-border bg-card"
              }`}
            >
              <div className="flex items-start gap-3">
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center text-xs ${
                    isComplete
                      ? "bg-emerald-600 text-white"
                      : isActive
                        ? "bg-accent text-white"
                        : "border border-border text-muted-foreground"
                  }`}
                >
                  {isComplete ? "✓" : index + 1}
                </span>
                <div>
                  <p className="text-sm font-medium text-foreground">{step.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{step.description}</p>
                  {step.key === "talk" && hasPublished && (
                    <Link
                      href={`/story/${storyUid}/talk`}
                      className="mt-3 inline-block border border-accent px-3 py-1.5 text-xs text-accent transition-colors hover:bg-accent hover:text-white"
                    >
                      Open Talk tab →
                    </Link>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {!hasCharacters && (
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Use <strong className="text-foreground">+ New character</strong> in the sidebar to begin.
        </p>
      )}
    </div>
  );
}
