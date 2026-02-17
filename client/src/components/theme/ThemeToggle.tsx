import { useEffect, useRef, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const animationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setMounted(true);
    return () => {
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
        animationTimeoutRef.current = null;
      }
    };
  }, []);

  if (!mounted) return null;

  const isDark = theme === "dark";
  const handleThemeToggle = () => {
    setIsAnimating(true);
    if (animationTimeoutRef.current) {
      clearTimeout(animationTimeoutRef.current);
    }
    animationTimeoutRef.current = setTimeout(() => {
      setIsAnimating(false);
      animationTimeoutRef.current = null;
    }, 450);
    setTheme(isDark ? "light" : "dark");
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={handleThemeToggle}
      aria-label="Toggle theme"
      data-animating={isAnimating}
      className={cn(
        "rounded-full border border-border bg-background/70 text-foreground shadow-sm hover:bg-muted/60 dark:hover:bg-white/10 dark:hover:text-white",
        className
      )}
    >
      <span
        className={cn(
          "relative flex h-4 w-4 items-center justify-center",
          isAnimating && "animate-[spin_0.45s_cubic-bezier(0.22,1,0.36,1)]"
        )}
      >
        <Sun
          className={cn(
            "absolute h-4 w-4 transition-all duration-300",
            isDark ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0"
          )}
        />
        <Moon
          className={cn(
            "absolute h-4 w-4 transition-all duration-300",
            isDark ? "rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100"
          )}
        />
      </span>
    </Button>
  );
}
