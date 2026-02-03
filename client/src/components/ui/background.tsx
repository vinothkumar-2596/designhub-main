import { cn } from "@/lib/utils";
import { ReactNode } from "react";

export function GridBackground({
    children,
    className
}: {
    children?: ReactNode;
    className?: string;
}) {
    return (
        <div className={cn("relative w-full", className)}>
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center dark:bg-black bg-white [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)]">
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f2e_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#8080801a_1px,transparent_1px),linear-gradient(to_bottom,#8080801a_1px,transparent_1px)] bg-[size:14px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_110%)]" />
            </div>
            {children}
        </div>
    );
}

export function GridSmallBackground({
    children,
    className,
    hideGrid = false,
}: {
    children?: ReactNode;
    className?: string;
    hideGrid?: boolean;
}) {
    return (
        <div className={cn("relative w-full", className)}>
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center dark:bg-black bg-white [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)]">
                <div
                  className={cn(
                    "absolute inset-0 bg-none bg-[size:20px_20px]",
                    hideGrid
                      ? "dark:bg-none"
                      : "dark:bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)]"
                  )}
                />
            </div>
            {children}
        </div>
    );
}

export function DotBackground({
    children,
    className
}: {
    children?: ReactNode;
    className?: string;
}) {
    return (
        <div className={cn("relative w-full", className)}>
            <div className="pointer-events-none absolute inset-0 dark:bg-black bg-white dark:bg-dot-white/[0.2] bg-dot-black/[0.2]">
                <div className="absolute pointer-events-none inset-0 bg-white dark:bg-black [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)]" />
            </div>
            {children}
        </div>
    );
}
