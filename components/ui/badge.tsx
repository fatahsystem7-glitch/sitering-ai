import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none [&_svg]:size-3",
  {
    variants: {
      variant: {
        default: "border-emerald-500/30 bg-emerald-500/15 text-emerald-300",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        destructive: "border-red-500/30 bg-red-500/15 text-red-300",
        warning: "border-amber-500/30 bg-amber-500/15 text-amber-300",
        outline: "text-foreground",
        muted: "border-transparent bg-muted text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
