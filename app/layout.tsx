import "./globals.css";
import { Public_Sans } from "next/font/google";
import { ActiveLink } from "@/components/Navbar";
import { Toaster } from "@/components/ui/sonner";
import { NuqsAdapter } from "nuqs/adapters/next/app";

const publicSans = Public_Sans({ subsets: ["latin"] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <title>sori.page — AI Context Engine for Writers</title>
        <link rel="shortcut icon" href="/images/favicon.ico" />
        <meta
          name="description"
          content="An AI context engine that understands narrative structure, not just words."
        />
      </head>
      <body className={publicSans.className}>
        <NuqsAdapter>
          <div className="bg-secondary grid grid-rows-[auto,1fr] h-[100dvh]">
            <div className="grid grid-cols-[1fr,auto] gap-2 p-4">
              <div className="flex gap-4 flex-col md:flex-row md:items-center">
                <a href="/" className="flex items-center gap-2">
                  <span className="text-xl font-bold tracking-tight">
                    sori<span className="text-muted-foreground">.page</span>
                  </span>
                </a>
                <nav className="flex gap-1 flex-col md:flex-row">
                  <ActiveLink href="/">Architect</ActiveLink>
                  <ActiveLink href="/contribute">Contribute</ActiveLink>
                  <ActiveLink href="/gaps">Gaps</ActiveLink>
                </nav>
              </div>
            </div>
            <div className="bg-background mx-4 relative grid rounded-t-2xl border border-input border-b-0">
              <div className="absolute inset-0">{children}</div>
            </div>
          </div>
          <Toaster />
        </NuqsAdapter>
      </body>
    </html>
  );
}
