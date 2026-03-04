import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const cardVariants = cva(
  "rounded-xl border text-card-foreground transition-all duration-300",
  {
    variants: {
      variant: {
        default: "bg-card border-border",
        gaming: "bg-gradient-to-br from-card via-card to-muted/10 border-border/50 hover:border-primary/30 shadow-[inset_0_1px_0_0_hsl(var(--foreground)/0.05)]",
        glow: "bg-card border-primary/30 shadow-neon hover:shadow-neon-lg",
        glass: "bg-card/50 backdrop-blur-xl border-border/30 shadow-[inset_0_1px_0_0_hsl(var(--foreground)/0.05)]",
        wager: "bg-gradient-to-br from-card via-card to-muted/20 border-border/50 hover:border-primary/40 hover:shadow-neon transition-all",
        feed: "bg-card/80 border-border/30 hover:bg-card hover:border-primary/20",
        cyber: "bg-card border-border/50 relative before:absolute before:inset-0 before:rounded-xl before:p-[1px] before:bg-gradient-to-br before:from-primary/50 before:to-secondary/50 before:opacity-0 hover:before:opacity-100 before:transition-opacity before:-z-10",
        neonBorder: "bg-card border-transparent shadow-[0_0_0_1px_hsl(var(--primary)/0.3),0_0_20px_hsl(var(--primary)/0.1)] hover:shadow-[0_0_0_1px_hsl(var(--primary)/0.5),0_0_30px_hsl(var(--primary)/0.2)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(cardVariants({ variant }), className)}
      {...props}
    />
  )
)
Card.displayName = "Card"

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
  ),
)
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn("text-2xl font-semibold leading-none tracking-tight font-gaming", className)} {...props} />
  ),
)
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
  ),
)
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />,
)
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center p-6 pt-0", className)} {...props} />
  ),
)
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent, cardVariants }
