import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Paperclip, MessageSquare, Laptop, Sparkles, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';

export interface ActivityItem {
    id: string;
    title: string;
    subtitle: string;
    time: string;
    type: 'attachment' | 'message' | 'system';
    link?: string;
}

interface ActivityFeedProps {
    notifications: ActivityItem[];
}

export function ActivityFeed({ notifications }: ActivityFeedProps) {
    const hasActivity = notifications.length > 0;

    return (
        <div className="group relative overflow-hidden rounded-[32px] border border-slate-100 bg-white dark:bg-card dark:border-border p-2 shadow-xl shadow-slate-200/50 dark:shadow-[0_22px_50px_-28px_rgba(0,0,0,0.6)] transition-all hover:shadow-2xl hover:shadow-slate-200/60 dark:transition-none dark:hover:shadow-none flex flex-col">
            {/* Visual Glass Header Section */}
            <div className="relative h-64 w-full overflow-hidden rounded-[24px] bg-slate-50/50 dark:bg-muted/40">
                {/* Background Gradients */}
                <div className="absolute top-0 right-0 h-64 w-64 translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-100/40 dark:bg-blue-500/10 blur-3xl" />
                <div className="absolute bottom-0 left-0 h-64 w-64 -translate-x-1/2 translate-y-1/2 rounded-full bg-indigo-100/40 dark:bg-indigo-500/10 blur-3xl" />

                {/* Glass Card "Activity" */}
                <div className="absolute inset-0 flex items-center justify-center p-6">
                    <div className="relative w-full max-w-sm rounded-[24px] border border-white/40 dark:border-border bg-white/40 dark:bg-card/70 backdrop-blur-xl shadow-xl shadow-indigo-500/5 p-6 transition-transform duration-500 group-hover:scale-[1.02]">
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="text-lg font-bold text-slate-800 dark:text-foreground">Activity</h3>
                            <div className="flex items-center gap-2">
                                <span className="rounded-full bg-slate-100 dark:bg-muted px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:text-muted-foreground">
                                    {notifications.length}
                                </span>
                                <span className="h-2 w-2 rounded-full bg-indigo-400 animate-pulse" />
                            </div>
                        </div>

                        <div className="space-y-4">
                            {hasActivity ? (
                                notifications.map((item, index) => (
                                    <Link
                                        key={item.id}
                                        to={item.link || '#'}
                                        className="flex items-center gap-3 group/item cursor-pointer"
                                        style={{ animationDelay: `${index * 100}ms` }}
                                    >
                                        <div className={cn(
                                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-colors",
                                            item.type === 'attachment' && "bg-blue-50 text-blue-500 group-hover/item:bg-blue-100 dark:bg-blue-500/10 dark:text-blue-300",
                                            item.type === 'message' && "bg-emerald-50 text-emerald-500 group-hover/item:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300",
                                            item.type === 'system' && "bg-rose-50 text-rose-500 group-hover/item:bg-rose-100 dark:bg-rose-500/10 dark:text-rose-300",
                                        )}>
                                            {item.type === 'attachment' && <Paperclip className="h-4 w-4" />}
                                            {item.type === 'message' && <MessageSquare className="h-4 w-4" />}
                                            {item.type === 'system' && <Laptop className="h-4 w-4" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-slate-900 dark:text-foreground truncate">{item.title}</p>
                                            {item.subtitle ? (
                                                <p className="text-[11px] text-slate-500 dark:text-muted-foreground truncate">{item.subtitle}</p>
                                            ) : null}
                                        </div>
                                    </Link>
                                ))
                            ) : (
                                // Empty State Visualization (Skeleton lines)
                                [1, 2, 3].map((i) => (
                                    <div key={i} className="flex items-center gap-3 opacity-40">
                                        <div className={cn(
                                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-400 dark:bg-muted dark:text-muted-foreground",
                                            i === 1 && "text-blue-400",
                                            i === 2 && "text-emerald-400",
                                            i === 3 && "text-rose-400"
                                        )}>
                                            {i === 1 && <Paperclip className="h-4 w-4" />}
                                            {i === 2 && <MessageSquare className="h-4 w-4" />}
                                            {i === 3 && <Laptop className="h-4 w-4" />}
                                        </div>
                                        <div className="flex-1 space-y-2">
                                            <div className="h-2 w-16 rounded-full bg-slate-200 dark:bg-muted" />
                                            <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-muted/80" />
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer Content */}
            <div className="p-6 pt-5 mt-auto">
                <Badge
                    variant="secondary"
                    className="bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-muted dark:text-foreground border-none rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider mb-3"
                >
                    <Sparkles className="h-3 w-3 mr-1.5" />
                    <span className="gradient-name bg-gradient-to-r from-sky-300 via-indigo-400 to-pink-300 dark:from-sky-200 dark:via-indigo-400 dark:to-pink-300 bg-clip-text text-transparent">
                        Real-Time Activity
                    </span>
                </Badge>

                <h2 className="text-2xl font-bold text-slate-900 dark:text-foreground mb-2 tracking-tight">
                    Live Updates
                </h2>

                <p className="text-sm text-slate-500 dark:text-muted-foreground leading-relaxed font-medium">
                    {hasActivity
                        ? "Stay updated with the latest changes, comments, and file uploads across your projects."
                        : "See every file upload, comment, and login in one place - so you can keep track of what's happening."}
                </p>
            </div>
        </div>
    );
}
