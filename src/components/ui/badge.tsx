import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 font-gaming uppercase tracking-wider",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow-neon",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground shadow-magenta",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground",
        outline: 
          "border-primary/50 text-primary hover:bg-primary/10 hover:border-primary",
        success:
          "border-transparent bg-success text-success-foreground",
        gold:
          "border-transparent bg-accent text-accent-foreground shadow-gold",
        live:
          "border-transparent bg-destructive text-destructive-foreground animate-pulse shadow-[0_0_15px_hsl(0_85%_55%/0.5)]",
        glass:
          "border-border/50 bg-card/50 backdrop-blur-lg text-foreground",
        created:
          "border-primary/30 bg-primary/10 text-primary hover:bg-primary/20",
        joined:
          "border-secondary/30 bg-secondary/10 text-secondary hover:bg-secondary/20",
        voting:
          "border-accent/30 bg-accent/10 text-accent hover:bg-accent/20",
        disputed:
          "border-destructive/30 bg-destructive/10 text-destructive animate-pulse",
        resolved:
          "border-success/30 bg-success/10 text-success",
        cyber:
          "border-primary/40 bg-gradient-to-r from-primary/10 to-secondary/10 text-primary backdrop-blur-sm",
        neon:
          "border-primary/50 bg-primary/20 text-primary shadow-[0_0_10px_hsl(var(--primary)/0.3)] hover:shadow-[0_0_15px_hsl(var(--primary)/0.5)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
)

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
