import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface ContentCardProps {
    children: ReactNode;
    className?: string;
    author?: {
        name: string;
        avatar?: string;
        role?: string;
    };
    metadata?: {
        date?: Date;
        readTime?: string;
        category?: string;
    };
}

/**
 * Elegant content card with author information and metadata
 */
export function ContentCard({
    children,
    className,
    author,
    metadata
}: ContentCardProps) {
    return (
        <div className={cn(
            "rounded-2xl border border-[#D9E6FF] dark:border-border bg-white dark:bg-card p-6 shadow-sm transition-all duration-300 hover:shadow-md",
            className
        )}>
            {/* Author Section */}
            {author && (
                <div className="flex items-center gap-3 mb-4 pb-4 border-b border-border/50">
                    {author.avatar && (
                        <img
                            src={author.avatar}
                            alt={author.name}
                            className="h-10 w-10 rounded-full object-cover ring-2 ring-border"
                        />
                    )}
                    {!author.avatar && (
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                            {author.name.charAt(0).toUpperCase()}
                        </div>
                    )}
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">
                            {author.name}
                        </p>
                        {author.role && (
                            <p className="text-xs text-muted-foreground truncate">
                                {author.role}
                            </p>
                        )}
                    </div>
                </div>
            )}

            {/* Metadata Section */}
            {metadata && (
                <div className="flex items-center gap-3 text-xs text-muted-foreground mb-4">
                    {metadata.date && (
                        <span>{metadata.date.toLocaleDateString()}</span>
                    )}
                    {metadata.readTime && (
                        <>
                            <span>•</span>
                            <span>{metadata.readTime}</span>
                        </>
                    )}
                    {metadata.category && (
                        <>
                            <span>•</span>
                            <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                                {metadata.category}
                            </span>
                        </>
                    )}
                </div>
            )}

            {/* Content */}
            <div>
                {children}
            </div>
        </div>
    );
}
