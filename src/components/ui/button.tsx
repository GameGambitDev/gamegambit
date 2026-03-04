import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 font-gaming tracking-wide uppercase",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:shadow-neon hover:-translate-y-0.5 active:translate-y-0",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 hover:shadow-[0_0_20px_hsl(0_85%_55%/0.4)]",
        outline:
          "border border-primary/40 bg-transparent text-primary hover:bg-primary/10 hover:border-primary hover:shadow-neon",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 hover:shadow-magenta",
        ghost:
          "text-foreground hover:bg-muted hover:text-foreground",
        link:
          "text-primary underline-offset-4 hover:underline",
        neon:
          "relative overflow-hidden bg-gradient-to-r from-primary via-neon-cyan to-primary bg-[length:200%_100%] text-primary-foreground shadow-neon hover:shadow-neon-lg hover:-translate-y-1 hover:bg-[position:100%_0] active:translate-y-0",
        gold:
          "bg-gradient-to-r from-accent via-neon-gold to-accent bg-[length:200%_100%] text-accent-foreground shadow-gold hover:-translate-y-0.5 hover:shadow-[0_0_30px_hsl(45_100%_55%/0.5)] active:translate-y-0",
        cyber:
          "relative overflow-hidden bg-card border border-primary/30 text-primary hover:border-primary/60 hover:shadow-neon before:absolute before:inset-0 before:bg-gradient-to-r before:from-primary/10 before:to-secondary/10 before:opacity-0 hover:before:opacity-100 before:transition-opacity",
        glass:
          "bg-card/50 backdrop-blur-xl border border-border/50 text-foreground hover:bg-card/70 hover:border-primary/30 hover:shadow-[inset_0_0_20px_hsl(var(--primary)/0.1)]",
        magenta:
          "bg-gradient-to-r from-secondary via-neon-magenta to-secondary bg-[length:200%_100%] text-secondary-foreground shadow-magenta hover:-translate-y-0.5 hover:shadow-[0_0_30px_hsl(300_100%_60%/0.5)]",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-lg px-3 text-xs",
        lg: "h-12 rounded-xl px-8 text-base",
        xl: "h-14 rounded-xl px-10 text-lg",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
  },
)
Button.displayName = "Button"

export { Button, buttonVariants }
