"use client";

import { cn } from "@/utils/cn";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import Link from "next/link";

export const ActiveLink = (props: { href: string; children: ReactNode }) => {
  const pathname = usePathname();
  const active = pathname === props.href;
  return (
    <Link
      href={props.href}
      style={{ fontFamily: "var(--font-body)", fontSize: "0.75rem", letterSpacing: "0.04em" }}
      className={cn(
        "flex items-center gap-2 whitespace-nowrap border px-4 py-2 text-sm transition-colors",
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border text-muted-foreground hover:border-foreground hover:text-foreground",
      )}
      data-active={active}
    >
      {props.children}
    </Link>
  );
};
