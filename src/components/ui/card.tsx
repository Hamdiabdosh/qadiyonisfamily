import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const cardVariants = cva(
  "rounded-2xl text-card-foreground backdrop-blur-xl transition-all duration-300 ease-out",
  {
    variants: {
      variant: {
        default: [
          "border border-border/60 bg-card/80",
          "shadow-[0_4px_24px_var(--glow-card)]",
          "hover:shadow-[0_8px_32px_var(--glow-primary)] hover:-translate-y-0.5",
          "dark:bg-card dark:shadow-md dark:hover:shadow-lg dark:hover:shadow-black/20",
        ],
        cta: [
          "border border-primary/30 bg-gradient-to-br from-primary/10 via-card/90 to-primary/5",
          "shadow-[0_4px_28px_var(--glow-primary)]",
          "hover:shadow-[0_8px_40px_var(--glow-primary)] hover:-translate-y-1",
          "dark:border-border dark:bg-card dark:bg-none dark:shadow-md dark:hover:shadow-lg dark:hover:shadow-black/20",
        ],
        stat: [
          "border border-primary/25 bg-gradient-to-br from-primary/8 to-card/90",
          "shadow-[0_2px_16px_var(--glow-card)]",
          "hover:shadow-[0_4px_24px_var(--glow-primary)]",
          "dark:border-border dark:bg-card dark:bg-none dark:shadow-md dark:hover:shadow-lg dark:hover:shadow-black/20",
        ],
        interactive: [
          "border border-border/60 bg-card/80 cursor-pointer",
          "shadow-[0_4px_20px_var(--glow-card)]",
          "hover:shadow-[0_6px_28px_var(--glow-primary)] hover:-translate-y-0.5",
          "active:scale-[0.99]",
          "dark:bg-card dark:shadow-md dark:hover:shadow-lg dark:hover:shadow-black/20",
        ],
        flat: "border border-border/40 bg-card/60 shadow-none hover:shadow-none hover:translate-y-0 dark:bg-card/80",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof cardVariants> {}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, ...props }, ref) => (
    <div ref={ref} className={cn(cardVariants({ variant }), className)} {...props} />
  ),
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
  ),
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("font-semibold leading-none tracking-tight", className)}
      {...props}
    />
  ),
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
  ),
);
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
  ),
);
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center p-6 pt-0", className)} {...props} />
  ),
);
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent, cardVariants };
