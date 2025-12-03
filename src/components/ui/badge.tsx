import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 font-gaming uppercase tracking-wider",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow-neon",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground shadow-purple",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground",
        outline: 
          "border-primary/50 text-primary",
        success:
          "border-transparent bg-success text-success-foreground",
        gold:
          "border-transparent bg-accent text-accent-foreground shadow-gold",
        live:
          "border-transparent bg-destructive text-destructive-foreground animate-pulse",
        glass:
          "border-border/50 bg-card/50 backdrop-blur text-foreground",
        created:
          "border-primary/30 bg-primary/10 text-primary",
        joined:
          "border-secondary/30 bg-secondary/10 text-secondary",
        voting:
          "border-accent/30 bg-accent/10 text-accent",
        disputed:
          "border-destructive/30 bg-destructive/10 text-destructive animate-pulse",
        resolved:
          "border-success/30 bg-success/10 text-success",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
