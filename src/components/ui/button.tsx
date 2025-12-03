import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 font-gaming tracking-wide uppercase",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:shadow-neon hover:-translate-y-0.5",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-primary/50 bg-transparent text-primary hover:bg-primary/10 hover:border-primary hover:shadow-neon",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 hover:shadow-purple",
        ghost:
          "text-foreground hover:bg-muted hover:text-foreground",
        link:
          "text-primary underline-offset-4 hover:underline",
        neon:
          "relative overflow-hidden bg-gradient-to-r from-primary to-primary text-primary-foreground shadow-neon hover:shadow-neon hover:-translate-y-1",
        gold:
          "bg-gradient-to-r from-accent to-accent text-accent-foreground shadow-gold hover:-translate-y-0.5",
        hero:
          "relative overflow-hidden bg-gradient-to-r from-primary via-primary to-primary text-primary-foreground font-bold tracking-wider shadow-neon hover:shadow-neon transition-all duration-500",
        glass:
          "bg-card/50 backdrop-blur-xl border border-border/50 text-foreground hover:bg-card/70 hover:border-primary/30",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-12 rounded-lg px-8 text-base",
        xl: "h-14 rounded-xl px-10 text-lg",
        icon: "h-10 w-10",
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
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
