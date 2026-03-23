"use client";

import { ActiveLink } from "@/components/Navbar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-[100dvh] grid-rows-[auto,1fr] px-4 pb-4 pt-4 sm:px-6">
      <div className="sori-shell mb-4 grid gap-4 rounded-[1.8rem] px-5 py-4 md:grid-cols-[1fr,auto] md:items-center md:px-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-6">
          <a href="/" className="flex items-center gap-3">
            <span className="sori-chip rounded-full px-3 py-1">Writer&apos;s Treehouse</span>
            <span className="text-2xl" style={{ fontFamily: "var(--font-display)" }}>
              sori<span className="text-muted-foreground">.page</span>
            </span>
          </a>
          <nav className="flex flex-col gap-2 md:flex-row md:flex-wrap">
            <ActiveLink href="/write">Write</ActiveLink>
            <ActiveLink href="/discover">Discover</ActiveLink>
            <ActiveLink href="/generate">Beats</ActiveLink>
            <ActiveLink href="/characters">Characters</ActiveLink>
            <ActiveLink href="/contribute">Community</ActiveLink>
            <ActiveLink href="/gaps">Gaps</ActiveLink>
            <ActiveLink href="/admin">Admin</ActiveLink>
          </nav>
        </div>
        <div className="flex flex-col items-start gap-2 text-sm text-[var(--sori-text-secondary)] md:items-end">
          <span className="sori-chip rounded-full px-3 py-1">5 credits</span>
          <p className="m-0 max-w-none text-xs text-[var(--sori-text-muted)]">
            Analyze structure. Keep your voice.
          </p>
        </div>
      </div>
      <div className="sori-shell relative grid overflow-hidden rounded-[2rem]">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/25 to-transparent" />
        <div className="absolute inset-0 overflow-auto p-3 sm:p-4">
          <div className="min-h-full rounded-[1.6rem] border border-border/60 bg-background/35 p-0 backdrop-blur-sm">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
