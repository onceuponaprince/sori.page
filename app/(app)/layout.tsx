"use client";

import { ActiveLink } from "@/components/Navbar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-secondary grid grid-rows-[auto,1fr] h-[100dvh]">
      <div className="grid grid-cols-[1fr,auto] gap-2 p-4">
        <div className="flex gap-4 flex-col md:flex-row md:items-center">
          <a href="/" className="flex items-center gap-2">
            <span className="text-xl font-bold tracking-tight">
              sori<span className="text-muted-foreground">.page</span>
            </span>
          </a>
          <nav className="flex gap-1 flex-col md:flex-row">
            <ActiveLink href="/generate">Story Beats</ActiveLink>
            <ActiveLink href="/characters">Characters</ActiveLink>
            <ActiveLink href="/contribute">Contribute</ActiveLink>
            <ActiveLink href="/gaps">Gaps</ActiveLink>
            <ActiveLink href="/admin">Admin</ActiveLink>
          </nav>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="bg-muted px-2 py-1 rounded-md">5 credits</span>
        </div>
      </div>
      <div className="bg-background mx-4 relative grid rounded-t-2xl border border-input border-b-0">
        <div className="absolute inset-0 overflow-auto">{children}</div>
      </div>
    </div>
  );
}
