import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex shrink-0 items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold leading-none transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive: "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        // Status variants
        pending:
          "border-transparent bg-status-pending-bg text-status-pending dark:border-status-pending/30 dark:bg-status-pending/20 dark:text-status-pending",
        progress:
          "border-transparent bg-status-progress-bg text-status-progress dark:border-status-progress/30 dark:bg-status-progress/20 dark:text-status-progress",
        review:
          "border-transparent bg-status-review-bg text-status-review dark:border-status-review/30 dark:bg-status-review/20 dark:text-status-review",
        completed:
          "border-transparent bg-status-completed-bg text-status-completed dark:border-status-completed/30 dark:bg-status-completed/20 dark:text-status-completed",
        urgent:
          "border-transparent bg-status-urgent-bg text-status-urgent dark:border-status-urgent/30 dark:bg-status-urgent/20 dark:text-status-urgent",
        clarification:
          "border-transparent bg-status-clarification-bg text-status-clarification dark:border-status-clarification/30 dark:bg-status-clarification/20 dark:text-status-clarification",
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
