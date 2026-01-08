import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sparkles, Send, Loader2, CheckCircle2, X, Paperclip, User } from 'lucide-react';
import { sendMessageToAI, type TaskDraft, type AIResponse } from '@/lib/ai';
import { toast } from 'sonner';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

interface TaskBuddyModalProps {
    isOpen: boolean;
    onClose: () => void;
    onTaskCreated?: (draft: TaskDraft) => void;
    initialMessage?: string;
}

export function TaskBuddyModal({ isOpen, onClose, onTaskCreated, initialMessage }: TaskBuddyModalProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [taskDraft, setTaskDraft] = useState<TaskDraft | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const [showWelcome, setShowWelcome] = useState(true);

    useEffect(() => {
        if (isOpen && initialMessage) {
            setShowWelcome(false);
            setInput(initialMessage);
            setTimeout(() => inputRef.current?.focus(), 100);
        } else if (!isOpen) {
            setMessages([]);
            setInput('');
            setTaskDraft(null);
            setShowWelcome(true);
        }
    }, [isOpen, initialMessage]);

    useEffect(() => {
        if (messages.length > 0) {
            setShowWelcome(false);
        }
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: input.trim(),
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);
        setShowWelcome(false);

        try {
            const chatHistory = messages
                .map(msg => ({
                    role: msg.role === 'user' ? 'user' as const : 'model' as const,
                    parts: msg.content
                }));

            const response: AIResponse = await sendMessageToAI(chatHistory, userMessage.content);

            if (response.type === 'task_draft' && response.data) {
                setTaskDraft(response.data);
                const assistantMessage: Message = {
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    content: "I've drafted a task for you based on your request.",
                    timestamp: new Date()
                };
                setMessages(prev => [...prev, assistantMessage]);
            } else if (response.content) {
                const assistantMessage: Message = {
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    content: response.content,
                    timestamp: new Date()
                };
                setMessages(prev => [...prev, assistantMessage]);
            }
        } catch (error) {
            console.error('AI Error:', error);
            toast.error('Failed to get response');
            const errorMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: "I encountered an error. Please try again.",
                timestamp: new Date()
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleUseTaskDraft = () => {
        if (taskDraft && onTaskCreated) {
            onTaskCreated(taskDraft);
            toast.success('Task draft applied to form!');
            onClose();
        }
    };

    const handleRegenerateDraft = () => {
        setTaskDraft(null);
        setInput('Can you regenerate the task draft with more details?');
        setTimeout(() => handleSend(), 100);
    };

    const suggestions = [
        "Draft a design request for a modern office branding",
        "Create a task for website homepage redesign",
        "Need a social media campaign graphic request",
        "Write a brief for a new product packaging design"
    ];

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl h-[700px] flex flex-col p-0 gap-0 bg-white/95 backdrop-blur-xl overflow-hidden rounded-[32px] border-white/20 shadow-2xl ring-1 ring-white/40">
                {/* Close Button Only */}


                <div className="flex-1 flex flex-col items-center justify-center overflow-hidden bg-white/40 relative">
                    {showWelcome ? (
                        <div className="w-full max-w-2xl px-8 flex flex-col items-center animate-in fade-in zoom-in-95 duration-500">
                            {/* Hero Section */}
                            <div className="mb-8 flex flex-col items-center text-center">
                                <div className="h-16 w-16 mb-6 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 shadow-lg shadow-primary/10 flex items-center justify-center ring-1 ring-primary/10 backdrop-blur-sm">
                                    <Sparkles className="h-8 w-8 text-primary" />
                                </div>
                                <h2 className="text-3xl font-bold text-slate-900 mb-2 tracking-tight">Task Buddy AI</h2>
                                <p className="text-slate-500 text-lg">
                                    Your personal design assistant for creating perfect requests
                                </p>
                            </div>

                            {/* Suggestions Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full mb-8">
                                {suggestions.map((suggestion, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => {
                                            setInput(suggestion);
                                            // Optional: auto-send
                                            // handleSend();
                                        }}
                                        className="text-left p-4 rounded-xl border border-slate-200/60 bg-white/60 hover:bg-white hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 group backdrop-blur-sm"
                                    >
                                        <p className="text-sm font-medium text-slate-700 group-hover:text-primary transition-colors">
                                            {suggestion}
                                        </p>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <ScrollArea className="flex-1 w-full px-4 md:px-20" ref={scrollRef}>
                            <div className="space-y-8 py-8">
                                {messages.map((message) => (
                                    <div
                                        key={message.id}
                                        className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                    >
                                        <div className={`flex gap-4 max-w-[85%] ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                                            <div className={`shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${message.role === 'user' ? 'bg-primary shadow-lg shadow-primary/20' : 'bg-primary shadow-lg shadow-primary/20'}`}>
                                                {message.role === 'user' ? <User className="h-4 w-4 text-white" /> : <Sparkles className="h-4 w-4 text-white" />}
                                            </div>
                                            <div className="space-y-1">
                                                <div className={`text-sm font-semibold mb-1 ${message.role === 'user' ? 'text-right text-slate-900' : 'text-left text-slate-900'}`}>
                                                    {message.role === 'user' ? 'You' : 'Task Buddy'}
                                                </div>
                                                <div className="text-slate-600 leading-relaxed text-[15px]">
                                                    {message.content}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {isLoading && (
                                    <div className="flex gap-4 justify-start">
                                        <div className="shrink-0 h-8 w-8 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
                                            <Sparkles className="h-4 w-4 text-white" />
                                        </div>
                                        <div className="space-y-1">
                                            <div className="text-sm font-semibold mb-1 text-slate-900">Task Buddy</div>
                                            <div className="flex gap-1.5 items-center h-6">
                                                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                                                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                                                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" />
                                            </div>
                                        </div>
                                    </div>
                                )}
                                {/* Task Draft Card Inline */}
                                {taskDraft && (
                                    <div className="ml-12 p-4 rounded-xl border border-primary/20 bg-primary/5 backdrop-blur-sm w-fit max-w-lg">
                                        <div className="flex items-center gap-2 mb-2">
                                            <CheckCircle2 className="h-4 w-4 text-primary" />
                                            <span className="font-semibold text-slate-900">Draft Ready: {taskDraft.title}</span>
                                        </div>
                                        <p className="text-sm text-slate-600 mb-3">{taskDraft.description}</p>
                                        <div className="flex gap-2">
                                            <Button size="sm" onClick={handleUseTaskDraft} className="bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20">Use Draft</Button>
                                            <Button size="sm" variant="outline" onClick={handleRegenerateDraft} className="border-primary/20 text-primary hover:bg-primary/5">Regenerate</Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    )}

                    {/* Footer Input */}
                    <div className="w-full px-4 md:px-20 pb-8 pt-4 z-10">
                        <div className="relative group">
                            <div className="absolute inset-0 bg-white/40 rounded-[32px] blur-xl group-hover:bg-primary/5 transition-all duration-500" />
                            <div className="relative">
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 p-2 hover:bg-slate-100 rounded-full cursor-pointer transition-colors">
                                    <Paperclip className="h-5 w-5 text-slate-400 group-focus-within:text-primary/70 transition-colors" />
                                </div>
                                <Input
                                    ref={inputRef}
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyPress={handleKeyPress}
                                    placeholder="Ask me anything..."
                                    className="w-full h-14 pl-12 pr-12 rounded-[28px] border-slate-200/80 shadow-sm bg-white/80 backdrop-blur-xl text-lg placeholder:text-slate-400 focus-visible:ring-primary/20 focus-visible:border-primary/30 transition-all duration-300"
                                    disabled={isLoading}
                                />
                                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                    <Button
                                        onClick={handleSend}
                                        disabled={!input.trim() || isLoading}
                                        size="icon"
                                        className="h-10 w-10 rounded-full bg-primary hover:bg-primary/90 text-white disabled:opacity-50 transition-all shadow-lg shadow-primary/20 hover:scale-105 active:scale-95"
                                    >
                                        {isLoading ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <Send className="h-4 w-4 ml-0.5" />
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </div>
                        <div className="text-center mt-3">
                            <p className="text-xs text-slate-400">
                                This AI isn't used to train our models. Always verify critical details.
                            </p>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
