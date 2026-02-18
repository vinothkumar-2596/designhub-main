import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Paperclip, MessageSquare, Laptop, Sparkles, FileText, ShieldCheck, CalendarClock } from 'lucide-react';
import { Link } from 'react-router-dom';

export interface ActivityItem {
    id: string;
    title: string;
    subtitle: string;
    time: string;
    type: 'attachment' | 'message' | 'request' | 'approval' | 'deadline' | 'system';
    link?: string;
}

interface ActivityFeedProps {
    notifications: ActivityItem[];
}

const truncateByCount = (value: string, maxChars: number) => {
    const text = String(value || '').trim();
    if (!text) return '';
    return text.length > maxChars ? `${text.slice(0, maxChars - 1)}...` : text;
};

export function ActivityFeed({ notifications }: ActivityFeedProps) {
    const hasActivity = notifications.length > 0;
    const enableScroll = notifications.length > 3;

    return (
        <div className="relative overflow-hidden rounded-[28px] border border-slate-100 bg-white dark:bg-card dark:border-border p-2 flex flex-col">
            {/* Visual Glass Header Section */}
            <div className="relative h-[17rem] w-full overflow-hidden rounded-[22px] bg-slate-50/50 dark:bg-muted/40">
                {/* Background Gradients */}
                <div className="absolute top-0 right-0 h-64 w-64 translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-100/40 dark:bg-blue-500/10 blur-3xl" />
                <div className="absolute bottom-0 left-0 h-64 w-64 -translate-x-1/2 translate-y-1/2 rounded-full bg-indigo-100/40 dark:bg-indigo-500/10 blur-3xl" />

                {/* Glass Card "Activity" */}
                <div className="absolute inset-0 flex items-center justify-center p-4">
                    <div className="relative w-full max-w-sm rounded-[22px] border border-white/40 dark:border-border bg-white/40 dark:bg-card/70 backdrop-blur-xl p-5">
                        <div className="mb-3 flex items-center justify-between">
                            <h3 className="text-lg font-bold text-slate-800 dark:text-foreground">Activity</h3>
                            <div className="flex items-center gap-2">
                                <span className="rounded-full bg-slate-100 dark:bg-muted px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:text-muted-foreground">
                                    {notifications.length}
                                </span>
                                <span className="h-2 w-2 rounded-full bg-indigo-400 animate-pulse" />
                            </div>
                        </div>

                        {hasActivity ? (
                            enableScroll ? (
                                <ScrollArea
                                    type="always"
                                    className="h-[156px] w-full pr-3 overflow-hidden"
                                    scrollbarClassName="w-2 rounded-full bg-slate-200/55 p-[1px] dark:bg-slate-700/45"
                                    thumbClassName="bg-slate-400/80 transition-colors hover:bg-slate-500/85 dark:bg-slate-300/45 dark:hover:bg-slate-300/60"
                                >
                                    <div className="space-y-2">
                                        {notifications.map((item, index) => (
                                            <Link
                                                key={item.id}
                                                to={item.link || '#'}
                                                className="flex min-h-11 items-center gap-3 cursor-pointer"
                                                style={{ animationDelay: `${index * 100}ms` }}
                                            >
                                                <div className={cn(
                                                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
                                                    item.type === 'attachment' && "bg-blue-50 text-blue-500 dark:bg-blue-500/10 dark:text-blue-300",
                                                    item.type === 'message' && "bg-emerald-50 text-emerald-500 dark:bg-emerald-500/10 dark:text-emerald-300",
                                                    item.type === 'request' && "bg-[#EAF1FF] text-[#3B5FCC] dark:bg-[#223D7A]/45 dark:text-[#8FB0FF]",
                                                    item.type === 'approval' && "bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-300",
                                                    item.type === 'deadline' && "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300",
                                                    item.type === 'system' && "bg-rose-50 text-rose-500 dark:bg-rose-500/10 dark:text-rose-300",
                                                )}>
                                                    {item.type === 'attachment' && <Paperclip className="h-4 w-4" />}
                                                    {item.type === 'message' && <MessageSquare className="h-4 w-4" />}
                                                    {item.type === 'request' && <FileText className="h-4 w-4" />}
                                                    {item.type === 'approval' && <ShieldCheck className="h-4 w-4" />}
                                                    {item.type === 'deadline' && <CalendarClock className="h-4 w-4" />}
                                                    {item.type === 'system' && <Laptop className="h-4 w-4" />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-semibold text-slate-900 dark:text-foreground" title={item.title}>
                                                        {truncateByCount(item.title, 24)}
                                                    </p>
                                                    {item.subtitle ? (
                                                        <p className="text-[11px] text-slate-500 dark:text-muted-foreground" title={item.subtitle}>
                                                            {truncateByCount(item.subtitle, 34)}
                                                        </p>
                                                    ) : null}
                                                </div>
                                            </Link>
                                        ))}
                                    </div>
                                </ScrollArea>
                            ) : (
                                <div className="space-y-2">
                                    {notifications.map((item, index) => (
                                        <Link
                                            key={item.id}
                                            to={item.link || '#'}
                                            className="flex min-h-11 items-center gap-3 cursor-pointer"
                                            style={{ animationDelay: `${index * 100}ms` }}
                                        >
                                            <div className={cn(
                                                "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
                                                item.type === 'attachment' && "bg-blue-50 text-blue-500 dark:bg-blue-500/10 dark:text-blue-300",
                                                item.type === 'message' && "bg-emerald-50 text-emerald-500 dark:bg-emerald-500/10 dark:text-emerald-300",
                                                item.type === 'request' && "bg-[#EAF1FF] text-[#3B5FCC] dark:bg-[#223D7A]/45 dark:text-[#8FB0FF]",
                                                item.type === 'approval' && "bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-300",
                                                item.type === 'deadline' && "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300",
                                                item.type === 'system' && "bg-rose-50 text-rose-500 dark:bg-rose-500/10 dark:text-rose-300",
                                            )}>
                                                {item.type === 'attachment' && <Paperclip className="h-4 w-4" />}
                                                {item.type === 'message' && <MessageSquare className="h-4 w-4" />}
                                                {item.type === 'request' && <FileText className="h-4 w-4" />}
                                                {item.type === 'approval' && <ShieldCheck className="h-4 w-4" />}
                                                {item.type === 'deadline' && <CalendarClock className="h-4 w-4" />}
                                                {item.type === 'system' && <Laptop className="h-4 w-4" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold text-slate-900 dark:text-foreground" title={item.title}>
                                                    {truncateByCount(item.title, 24)}
                                                </p>
                                                {item.subtitle ? (
                                                    <p className="text-[11px] text-slate-500 dark:text-muted-foreground" title={item.subtitle}>
                                                        {truncateByCount(item.subtitle, 34)}
                                                    </p>
                                                ) : null}
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            )
                        ) : (
                            <div className="space-y-4">
                                {[1, 2, 3].map((i) => (
                                    <div key={i} className="flex items-center gap-3 opacity-60 dark:opacity-90">
                                        <div className={cn(
                                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-400 dark:bg-slate-800/80 dark:text-slate-300",
                                            i === 1 && "text-blue-400",
                                            i === 2 && "text-emerald-400",
                                            i === 3 && "text-rose-400"
                                        )}>
                                            {i === 1 && <Paperclip className="h-4 w-4" />}
                                            {i === 2 && <MessageSquare className="h-4 w-4" />}
                                            {i === 3 && <Laptop className="h-4 w-4" />}
                                        </div>
                                        <div className="flex-1 space-y-2">
                                            <div className="h-2 w-16 rounded-full bg-slate-200 dark:bg-slate-700/70" />
                                            <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-700/40" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Footer Content */}
            <div className="p-8 pt-7 pb-10 mt-auto">
                <Badge
                    variant="secondary"
                    className="bg-blue-50 text-blue-600 dark:bg-muted dark:text-foreground border-none rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider mb-3"
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
