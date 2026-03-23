import "./globals.css";
import { Fraunces, IBM_Plex_Mono, Lora } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { NuqsAdapter } from "nuqs/adapters/next/app";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
});

const lora = Lora({
  subsets: ["latin"],
  variable: "--font-lora",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-ibm-plex-mono",
  weight: "400",
});

export const metadata = {
  title: "sori.page — AI Context Engine for Writers",
  description:
    "Structure your story with verified narrative knowledge. AI that understands story structure, not just words.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${fraunces.variable} ${lora.variable} ${ibmPlexMono.variable}`}
      >
        <NuqsAdapter>
          {children}
          <Toaster />
        </NuqsAdapter>
      </body>
    </html>
  );
}
