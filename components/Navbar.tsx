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
      className={cn(
        "flex items-center gap-2 whitespace-nowrap rounded-full border px-4 py-2.5 text-sm transition-all duration-300",
        active
          ? "border-primary/65 bg-primary/95 text-primary-foreground shadow-[0_14px_28px_oklch(var(--primary)/0.24)]"
          : "border-border/65 bg-background/55 text-[var(--sori-text-secondary)] hover:-translate-y-0.5 hover:border-primary/30 hover:bg-secondary/70 hover:text-foreground",
      )}
      data-active={active}
    >
      {props.children}
    </Link>
  );
};
