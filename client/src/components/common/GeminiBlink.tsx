import { Sparkles } from 'lucide-react';
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
                        className={`relative h-9 rounded-full px-3 bg-primary/10 hover:bg-primary/20 dark:bg-primary/20 dark:hover:bg-primary/30 transition-colors ${className}`}
                    >
                        <div className="relative flex items-center justify-center mr-2">
                            <span className="relative flex h-5 w-5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/40 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-5 w-5 items-center justify-center">
                                    <Sparkles className="h-4 w-4 text-primary" />
                                </span>
                            </span>
                        </div>
                        <span className="font-semibold text-primary">AI Buddy</span>
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
