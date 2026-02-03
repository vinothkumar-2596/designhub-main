import { Button } from '@/components/ui/button';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';

interface GeminiBlinkProps {
    onClick: () => void;
    className?: string;
}

export function GeminiBlink({ onClick, className = '' }: GeminiBlinkProps) {
    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        onClick={onClick}
                        variant="ghost"
                        className={`relative h-9 rounded-full px-3 bg-primary/10 hover:bg-primary/20 dark:bg-white/10 dark:hover:bg-white/15 transition-colors ${className}`}
                    >
                        <div className="relative flex items-center justify-center mr-2">
                            <span className="relative flex h-5 w-5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/40 dark:bg-white/30 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-5 w-5 items-center justify-center">
                                    <svg
                                        viewBox="0 0 24 24"
                                        className="h-4 w-4"
                                        fill="none"
                                        stroke="url(#ai-buddy-gradient)"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    >
                                        <defs>
                                            <linearGradient id="ai-buddy-gradient" x1="0" y1="0" x2="24" y2="24">
                                                <stop offset="0%" stopColor="#38BDF8" />
                                                <stop offset="50%" stopColor="#6366F1" />
                                                <stop offset="100%" stopColor="#F472B6" />
                                            </linearGradient>
                                        </defs>
                                        <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
                                        <path d="M20 3v4" />
                                        <path d="M22 5h-4" />
                                        <path d="M4 17v2" />
                                        <path d="M5 18H3" />
                                    </svg>
                                </span>
                            </span>
                        </div>
                        <span className="font-semibold text-primary dark:text-white">AI Buddy</span>
                        <span className="sr-only">Open Task Buddy AI</span>
                    </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" align="end">
                    <p>Task Buddy AI</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}
