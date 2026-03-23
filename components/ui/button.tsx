import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/utils/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "border border-primary/80 bg-primary text-primary-foreground shadow-[0_12px_30px_oklch(var(--primary)/0.24)] hover:-translate-y-0.5 hover:bg-primary/92",
        destructive:
          "border border-destructive/70 bg-destructive text-destructive-foreground shadow-[0_12px_24px_oklch(var(--destructive)/0.18)] hover:-translate-y-0.5 hover:bg-destructive/92",
        outline:
          "border border-border/90 bg-card/90 text-foreground shadow-[inset_0_1px_0_oklch(1_0_0/0.65)] hover:-translate-y-0.5 hover:bg-secondary/85",
        secondary:
          "border border-border/80 bg-secondary/85 text-secondary-foreground hover:-translate-y-0.5 hover:bg-secondary",
        ghost:
          "border border-transparent bg-transparent text-foreground hover:bg-secondary/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-5 py-2.5",
        sm: "h-9 px-4 text-xs",
        lg: "h-12 px-8 text-base",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
