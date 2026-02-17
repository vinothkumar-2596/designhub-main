import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

import { cn } from "@/lib/utils";

const TooltipProvider = TooltipPrimitive.Provider;

const Tooltip = TooltipPrimitive.Root;

const TooltipTrigger = TooltipPrimitive.Trigger;

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 max-w-[340px] overflow-hidden rounded-xl border border-[#D5E2FB]/80 bg-gradient-to-br from-white/92 via-[#F5F9FF]/85 to-[#EAF2FF]/78 supports-[backdrop-filter]:bg-[#F5F9FF]/62 supports-[backdrop-filter]:backdrop-blur-xl px-3 py-2 text-xs leading-relaxed text-[#162955] shadow-[0_18px_50px_-28px_rgba(37,99,235,0.55)] ring-1 ring-white/70 dark:border-slate-600/70 dark:bg-[linear-gradient(155deg,rgba(12,24,56,0.92),rgba(9,20,45,0.88))] dark:text-slate-100 dark:ring-white/10 dark:shadow-[0_22px_56px_-30px_rgba(2,8,23,0.95)] animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className,
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
