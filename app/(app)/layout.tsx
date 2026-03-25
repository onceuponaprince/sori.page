import { ActiveLink } from "@/components/Navbar";
import { UserMenu } from "@/components/UserMenu";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh]">
      {/* Top nav bar */}
      <header className="w-full border-b border-border bg-background">
        <div className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-6">
            <a href="/" className="flex items-center gap-3 text-foreground hover:text-accent transition-colors">
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 500, fontSize: "1.1rem", letterSpacing: "0.02em" }}>
                sori<span style={{ color: "#8A857E" }}>.page</span>
              </span>
            </a>
            <nav className="flex flex-wrap gap-2">
              <ActiveLink href="/write">Write</ActiveLink>
              <ActiveLink href="/discover">Discover</ActiveLink>
              <ActiveLink href="/generate">Beats</ActiveLink>
              <ActiveLink href="/characters">Characters</ActiveLink>
              <ActiveLink href="/contribute">Community</ActiveLink>
              <ActiveLink href="/gaps">Gaps</ActiveLink>
              <ActiveLink href="/admin">Admin</ActiveLink>
            </nav>
          </div>
          <div className="flex items-center">
            <UserMenu />
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="min-h-[calc(100dvh-57px)]">
        {children}
      </main>
    </div>
  );
}
