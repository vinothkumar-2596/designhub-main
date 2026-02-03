import { cn } from "@/lib/utils";
import { ReactNode, useState } from "react";

interface AnimatedCardProps {
    children: ReactNode;
    className?: string;
    containerClassName?: string;
    onClick?: () => void;
}

/**
 * Animated card with background overlay effect on hover (dark mode only)
 */
export function AnimatedCard({
    children,
    className,
    containerClassName,
    onClick
}: AnimatedCardProps) {
    const [isHovered, setIsHovered] = useState(false);

    return (
        <div
            className={cn(
                "group relative overflow-hidden rounded-2xl border border-[#D9E6FF] dark:border-border bg-white dark:bg-card transition-all duration-300",
                onClick && "cursor-pointer",
                containerClassName
            )}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={onClick}
        >
            {/* Animated Background Overlay - Dark mode only */}
            <div
                className={cn(
                    "absolute inset-0 bg-gradient-to-br opacity-0 transition-opacity duration-500",
                    "dark:from-primary/10 dark:via-primary/15 dark:to-accent/10",
                    isHovered && "dark:opacity-100"
                )}
            />

            {/* Content */}
            <div className={cn("relative z-10", className)}>
                {children}
            </div>
        </div>
    );
}

/**
 * Card with glow effect on hover (dark mode only)
 */
export function GlowCard({
    children,
    className,
    containerClassName,
    onClick
}: AnimatedCardProps) {
    return (
        <div
            className={cn(
                "group relative overflow-hidden rounded-2xl",
                containerClassName
            )}
            onClick={onClick}
        >
            {/* Glow effect - Dark mode only */}
            <div className="absolute inset-0 rounded-2xl opacity-0 blur-xl transition-opacity duration-500 dark:bg-gradient-to-br dark:from-primary/20 dark:via-transparent dark:to-accent/20 dark:group-hover:opacity-100" />

            {/* Card */}
            <div className={cn(
                "relative rounded-2xl border border-[#D9E6FF] dark:border-border bg-white dark:bg-card transition-all duration-300",
                "dark:group-hover:border-primary/50 dark:group-hover:shadow-lg dark:group-hover:shadow-primary/10",
                onClick && "cursor-pointer",
                className
            )}>
                {children}
            </div>
        </div>
    );
}

/**
 * Feature card with animated border on hover (dark mode only)
 */
export function FeatureCard({
    children,
    className,
    containerClassName,
    onClick
}: AnimatedCardProps) {
    return (
        <div
            className={cn(
                "group relative overflow-hidden rounded-2xl",
                containerClassName
            )}
            onClick={onClick}
        >
            {/* Card content */}
            <div className={cn(
                "relative rounded-2xl bg-white dark:bg-card border border-[#D9E6FF] dark:border-border transition-all duration-300",
                onClick && "cursor-pointer",
                className
            )}>
                {children}
            </div>
        </div>
    );
}
