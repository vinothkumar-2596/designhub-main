import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Image as ImageIcon,
    Paperclip,
    Mic,
    ArrowUp,
    Briefcase,
    Search,
    HelpCircle,
    User,
    Sparkles,
    Download,
    CheckCircle,
    Edit3,
    FileText,
    RefreshCw,
    X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from "@/components/ui/use-toast";
import { upsertLocalTask } from '@/lib/taskStorage';
import { Task, TaskCategory, TaskUrgency } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { addDays } from 'date-fns';

interface DesignRequestDraft {
    requestTitle: string;
    category: string;
    urgency: string;
    description: string;
    deadline: string;
    phone: string;
    files?: any[];
}

interface ImprovementData {
    original: string;
    improved: string;
    type?: string;
}

interface Message {
    role: 'user' | 'assistant';
    content?: string;
    type: 'text' | 'draft' | 'confirmation' | 'success' | 'file_upload' | 'improvement_options' | 'improved_result';
    draftData?: DesignRequestDraft;
    improvementData?: ImprovementData;
    options?: { label: string; action: string }[];
}

interface CampaignState {
    step: 'idle' | 'collecting_inputs';
    currentQuestionIndex: number;
    answers: Record<string, string>;
}

const CAMPAIGN_QUESTIONS = [
    "What type of campaign is this? (e.g., poster, social media, banner)",
    "What is the event or campaign name?",
    "What is the date or duration?",
    "Who is the target audience?",
    "What is the desired tone? (e.g., formal, celebratory, promotional)"
];

const CAMPAIGN_KEYS = ['type', 'name', 'date', 'audience', 'tone'];

const PLACEHOLDER_TEXTS = [
    "Drop a file, speak, or type your request",
    "AI will draft, improve, or prepare it for submission"
];

export default function AIMode() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [prompt, setPrompt] = useState('');
    const [messages, setMessages] = useState<Message[]>([]);
    const [view, setView] = useState<'initial' | 'chat'>('initial');
    const [isTyping, setIsTyping] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();

    // Placeholder Animation State
    const [placeholderIndex, setPlaceholderIndex] = useState(0);
    const [placeholderText, setPlaceholderText] = useState("");
    const [isDeleting, setIsDeleting] = useState(false);
    const [loopNum, setLoopNum] = useState(0);
    const [typingSpeed, setTypingSpeed] = useState(150);

    // Campaign Generator State
    const [campaignState, setCampaignState] = useState<CampaignState>({
        step: 'idle',
        currentQuestionIndex: 0,
        answers: {}
    });

    // Voice State
    const [isListening, setIsListening] = useState(false);
    // Upload State
    const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
    const [lastUploadedFile, setLastUploadedFile] = useState<string | null>(null);
    const [lastUploadedFileId, setLastUploadedFileId] = useState<string | null>(null);
    const [allUploadedFiles, setAllUploadedFiles] = useState<any[]>([]);

    const suggestions = [
        { icon: Briefcase, text: "Create a social media campaign for Diwali" },
        { icon: Sparkles, text: "Design a modern minimalist logo for a cafe" },
        { icon: HelpCircle, text: "How do I request a website redesign?" }
    ];

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isTyping]);

    // Typing Animation Effect
    useEffect(() => {
        let ticker = setTimeout(() => {
            handleTyping();
        }, typingSpeed);

        return () => clearTimeout(ticker);
    }, [placeholderText, isDeleting]);

    const handleTyping = () => {
        const i = loopNum % PLACEHOLDER_TEXTS.length;
        const fullText = PLACEHOLDER_TEXTS[i];

        setPlaceholderText(isDeleting
            ? fullText.substring(0, placeholderText.length - 1)
            : fullText.substring(0, placeholderText.length + 1)
        );

        setTypingSpeed(isDeleting ? 30 : 50);

        if (!isDeleting && placeholderText === fullText) {
            setTimeout(() => setIsDeleting(true), 2000); // Pause at full text
        } else if (isDeleting && placeholderText === '') {
            setIsDeleting(false);
            setLoopNum(loopNum + 1);
            setTypingSpeed(50);
        }
    };

    const handleSendMessage = async () => {
        if (!prompt.trim()) return;

        const userMessage: Message = { role: 'user', content: prompt, type: 'text' };
        setMessages(prev => [...prev, userMessage]);
        setPrompt('');
        setView('chat');
        setIsTyping(true);

        // AI Logic Simulation
        // AI Buddy Logic
        try {
            const apiUrl = (import.meta.env.VITE_API_URL as string) || 'http://localhost:4000';
            const res = await fetch(`${apiUrl}/api/ai/buddy`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: userMessage.content,
                    fileId: lastUploadedFileId
                })
            });

            if (!res.ok) throw new Error('AI Buddy failed');
            const data = await res.json();

            setIsTyping(false);
            setMessages(prev => [...prev, {
                role: 'assistant',
                type: 'draft',
                draftData: { ...data, files: [...allUploadedFiles] }
            }]);
        } catch (error) {
            console.error("AI Buddy error:", error);
            setIsTyping(false);
            setMessages(prev => [...prev, {
                role: 'assistant',
                type: 'text',
                content: "I'm having trouble connecting to my brain. Please try again or check your connection."
            }]);
            toast({ title: "AI Error", description: "Could not reach AI Buddy.", variant: "destructive" });
        }
    };

    const processAIResponse = (input: string) => {
        // Redundant since we use AI Buddy now. 
        // Keeping as a stub if needed for future rule-based logic.
    };

    const handleFileUpload = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setLastUploadedFile(file.name);
        setView('chat');
        setUploadStatus('uploading');

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('aiMode', 'true');
            formData.append('uploadedBy', user?.name || 'Guest');

            const apiUrl = (import.meta.env.VITE_API_URL as string) || 'http://localhost:4000';
            const response = await fetch(`${apiUrl}/api/files/upload`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) throw new Error('Upload failed');
            const data = await response.json();

            setLastUploadedFileId(data.id);
            setAllUploadedFiles(prev => [...prev, data]);
            setUploadStatus('success');
            toast({ title: "File uploaded successfully", description: `Saved to Drive → AI Mode Files (${file.name})` });
            setIsTyping(true);

            setTimeout(() => {
                setIsTyping(false);
                const fileMsg: Message = {
                    role: 'user',
                    type: 'file_upload',
                    content: `Uploaded file: ${file.name}`
                };

                const aiMsg: Message = {
                    role: 'assistant',
                    type: 'improvement_options',
                    content: data.extractedContent
                        ? `I've analyzed the content of "${file.name}". What would you like to do with this?`
                        : "What would you like to do with this file?",
                    options: [
                        { label: "Improve content", action: "improve" },
                        { label: "Rewrite professionally", action: "rewrite" },
                        { label: "Generate a submission draft", action: "brief" },
                        { label: "Download enhanced version", action: "download_enhanced" },
                        { label: "Auto-submit with AI", action: "auto_submit" }
                    ]
                };

                setMessages(prev => [...prev, fileMsg, aiMsg]);
                setUploadStatus('idle');
            }, 1000);
        } catch (error) {
            setUploadStatus('error');
            toast({
                title: "Upload failed",
                description: "Could not upload file to server.",
                variant: "destructive"
            });
        }
    };

    const handleImageUpload = () => {
        imageInputRef.current?.click();
    };

    const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setLastUploadedFile(file.name);
        setView('chat');
        setIsTyping(true);

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('aiMode', 'true');
            formData.append('uploadedBy', user?.name || 'Guest');

            const apiUrl = (import.meta.env.VITE_API_URL as string) || 'http://localhost:4000';
            const response = await fetch(`${apiUrl}/api/files/upload`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) throw new Error('Upload failed');
            const data = await response.json();
            setLastUploadedFileId(data.id);
            setAllUploadedFiles(prev => [...prev, data]);

            setTimeout(() => {
                setIsTyping(false);
                const imgMsg: Message = {
                    role: 'user',
                    type: 'file_upload',
                    content: `Uploaded image: ${file.name}`
                };

                const aiMsg: Message = {
                    role: 'assistant',
                    type: 'text',
                    content: "I see you uploaded an image. I can use this as a reference style. Would you like to create a new design request based on this style?"
                };

                setMessages(prev => [...prev, imgMsg, aiMsg]);
            }, 1500);
        } catch (error) {
            setIsTyping(false);
            toast({
                title: "Upload failed",
                description: "Could not upload image to server.",
                variant: "destructive"
            });
        }
    };

    const handleVoiceInput = () => {
        if (isListening) return;
        setIsListening(true);
        setPrompt(""); // Clear prompt to show listening state

        // Mock voice recognition delay
        setTimeout(() => {
            setPrompt("Create a marketing banner for the new summer collection");
            setIsListening(false);
            toast({ title: "Voice captured", description: "AI is processing your request." });
        }, 2000);
    };

    const handleOptionClick = async (action: string) => {
        if (action === "improve") {
            setMessages(prev => [...prev, {
                role: 'user',
                type: 'text',
                content: "Improve content"
            }]);
            setIsTyping(true);
            setTimeout(() => {
                setIsTyping(false);
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    type: 'improvement_options',
                    content: "Select an improvement level:",
                    options: [
                        { label: "Light polish (grammar & tone)", action: "polish" },
                        { label: "Professional rewrite", action: "rewrite" },
                        { label: "Designer-ready brief", action: "brief" },
                        { label: "Executive-level clarity", action: "clarity" }
                    ]
                }]);
            }, 800);
        } else if (action === 'improve' || action === 'rewrite' || action === 'brief') {
            setMessages(prev => [...prev, { role: 'user', type: 'text', content: action === 'improve' ? "Improve content" : action === 'brief' ? "Generate a submission draft" : "Rewrite professionally" }]);
            setIsTyping(true);

            try {
                const apiUrl = (import.meta.env.VITE_API_URL as string) || 'http://localhost:4000';
                const res = await fetch(`${apiUrl}/api/files/ai-process`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        fileId: lastUploadedFileId,
                        action: action === 'brief' ? 'generate_submission' : action,
                        instruction: prompt
                    })
                });

                if (!res.ok) throw new Error('AI processing failed');
                const data = await res.json();

                setIsTyping(false);
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    type: 'improved_result',
                    content: "I've refined the content based on your file using the master prompt. You can use this directly or download it.",
                    improvementData: {
                        original: lastUploadedFile || "document.docx",
                        improved: data.processedContent,
                        type: action
                    }
                }]);
                setPrompt('');
            } catch (error) {
                setIsTyping(false);
                toast({ title: "AI processing failed", description: "Could not refine document content.", variant: "destructive" });
            }
        } else if (action === 'auto_submit') {
            setMessages(prev => [...prev, { role: 'user', type: 'text', content: "Auto-submit with AI" }]);
            setIsTyping(true);
            setTimeout(() => {
                setIsTyping(false);
                setMessages(prev => [...prev, { role: 'assistant', type: 'confirmation' }]);
            }, 1000);
        } else if (action === 'use_improved') {
            // Logic to convert improved text to draft
            setMessages(prev => [...prev, { role: 'user', type: 'text', content: "Use this & create request" }]);
            setIsTyping(true);
            setTimeout(() => {
                setIsTyping(false);
                const title = lastUploadedFile ? lastUploadedFile.split('.')[0].replace(/_/g, ' ') : "Draft Content";
                const draft: DesignRequestDraft = {
                    requestTitle: `${title} Design`,
                    category: "Social Media / Marketing",
                    urgency: "Normal",
                    description: `Design request based on ${lastUploadedFile || 'uploaded document'}.`,
                    deadline: "",
                    phone: ""
                };
                setMessages(prev => [...prev, { role: 'assistant', type: 'draft', draftData: draft }]);
            }, 1000);
        }
    };


    const handleUpdateDraft = (index: number, field: keyof DesignRequestDraft, value: string) => {
        setMessages(prev => prev.map((msg, i) => {
            if (i === index && msg.type === 'draft' && msg.draftData) {
                return { ...msg, draftData: { ...msg.draftData, [field]: value } };
            }
            return msg;
        }));
    };

    const handleFinishEditing = (index: number) => {
        // Lock the draft (optional for now, can just append confirmation)
        setMessages(prev => [...prev, { role: 'assistant', type: 'confirmation' }]);
    };

    const handleSubmit = () => {
        // Find the last improved result or draft message to get its content
        const lastImprovedMsg = [...messages].reverse().find(m => m.type === 'draft' || m.type === 'improved_result');

        if (!lastImprovedMsg?.draftData) {
            toast({
                title: "No draft found",
                description: "AI Buddy hasn't generated a draft yet.",
                variant: "destructive"
            });
            return;
        }

        toast({
            title: "Navigating to form",
            description: "Opening the design request form with your AI draft..."
        });

        navigate('/new-request', { state: { aiDraft: lastImprovedMsg.draftData } });
    };

    const handleDownload = () => {
        // Mock Download
        toast({
            title: "File Ready",
            description: "Downloading draft as PDF...",
        });
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    return (
        <div className="flex-1 h-full flex flex-col bg-gradient-to-b from-white to-[#F8FAFC]">

            {/* Chat Area */}
            {view === 'chat' && (
                <ScrollArea className="flex-1 p-6">
                    <div className="max-w-3xl mx-auto space-y-6 pb-20">
                        {messages.map((msg, idx) => (
                            <div key={idx} className={cn("flex gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300", msg.role === 'user' ? "justify-end" : "justify-start")}>
                                {msg.role === 'assistant' && msg.type !== 'draft' && msg.type !== 'confirmation' && msg.type !== 'success' && msg.type !== 'improved_result' && (
                                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 mt-1 flex-shrink-0">
                                        <Sparkles className="h-4 w-4 text-primary" />
                                    </div>
                                )}

                                {/* Text Message */}
                                {msg.type === 'text' && (
                                    <div className={cn(
                                        "max-w-[80%] p-4 rounded-2xl whitespace-pre-wrap shadow-sm",
                                        msg.role === 'user'
                                            ? "bg-primary text-primary-foreground rounded-tr-sm"
                                            : "bg-white border border-slate-200 text-slate-800 rounded-tl-sm"
                                    )}>
                                        {msg.content}
                                    </div>
                                )}

                                {/* File Upload Message (User) */}
                                {msg.type === 'file_upload' && (
                                    <div className="bg-primary/10 border border-primary/20 text-primary p-4 rounded-2xl rounded-tr-sm flex items-center gap-3">
                                        <FileText className="h-5 w-5" />
                                        <span>{msg.content}</span>
                                    </div>
                                )}

                                {/* Improvement Options (Chips) */}
                                {msg.type === 'improvement_options' && (
                                    <div className="space-y-3 max-w-[80%]">
                                        <div className="bg-white border border-slate-200 p-4 rounded-2xl rounded-tl-sm text-slate-800 shadow-sm">
                                            {msg.content}
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {msg.options?.map((opt, i) => (
                                                <Button key={i} onClick={() => handleOptionClick(opt.action)} variant="outline" className="bg-white hover:bg-slate-50 border-primary/20 text-primary hover:text-primary/80 rounded-full h-8 text-sm">
                                                    {opt.label}
                                                </Button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Improved Result */}
                                {msg.type === 'improved_result' && msg.improvementData && (
                                    <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-2xl shadow-lg overflow-hidden">
                                        <div className="bg-gradient-to-r from-violet-50 to-indigo-50 p-4 border-b border-indigo-100 flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Sparkles className="h-4 w-4 text-indigo-600" />
                                                <span className="font-semibold text-indigo-900">Improved Content</span>
                                            </div>
                                            <span className="text-xs text-indigo-600 uppercase tracking-wider font-medium">{msg.improvementData.type}</span>
                                        </div>
                                        <div className="p-6">
                                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-slate-700 whitespace-pre-wrap leading-relaxed">
                                                {msg.improvementData.improved}
                                            </div>
                                            <div className="grid grid-cols-2 gap-3 mt-6">
                                                <Button onClick={handleSubmit} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
                                                    <CheckCircle className="h-4 w-4" /> Submit with AI
                                                </Button>
                                                <Button onClick={handleDownload} variant="outline" className="w-full gap-2 text-slate-600 group flex flex-col items-center h-auto py-2">
                                                    <div className="flex items-center gap-2">
                                                        <Download className="h-4 w-4" /> Download AI-generated file
                                                    </div>
                                                    <span className="text-[9px] text-slate-500 font-normal">(Editable & ready for manual upload)</span>
                                                </Button>
                                            </div>
                                            <div className="flex justify-center mt-3 gap-4">
                                                <button className="text-xs text-slate-500 hover:text-indigo-600 flex items-center gap-1 transition-colors">
                                                    <Edit3 className="h-3 w-3" /> Make more changes
                                                </button>
                                                <button className="text-xs text-slate-500 hover:text-red-600 flex items-center gap-1 transition-colors">
                                                    <X className="h-3 w-3" /> Cancel
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Editable Draft Card */}
                                {msg.type === 'draft' && msg.draftData && (
                                    <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-2xl shadow-lg overflow-hidden">
                                        <div className="bg-slate-50 p-4 border-b border-slate-200 flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Edit3 className="h-4 w-4 text-primary" />
                                                <span className="font-semibold text-slate-700">Draft Design Request</span>
                                            </div>
                                            <span className="text-xs text-slate-500 uppercase tracking-wider">Editable Mode</span>
                                        </div>
                                        <div className="p-6 space-y-4">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label>Request Title</Label>
                                                    <Input value={msg.draftData.requestTitle} onChange={(e) => handleUpdateDraft(idx, 'requestTitle', e.target.value)} />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Category</Label>
                                                    <Input value={msg.draftData.category} onChange={(e) => handleUpdateDraft(idx, 'category', e.target.value)} />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label>Urgency</Label>
                                                    <Input value={msg.draftData.urgency} onChange={(e) => handleUpdateDraft(idx, 'urgency', e.target.value)} />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Deadline</Label>
                                                    <Input value={msg.draftData.deadline} onChange={(e) => handleUpdateDraft(idx, 'deadline', e.target.value)} />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Description</Label>
                                                <Textarea rows={4} value={msg.draftData.description} onChange={(e) => handleUpdateDraft(idx, 'description', e.target.value)} />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Phone (WhatsApp updates)</Label>
                                                <Input value={msg.draftData.phone} onChange={(e) => handleUpdateDraft(idx, 'phone', e.target.value)} />
                                            </div>
                                            <Button onClick={() => handleFinishEditing(idx)} className="w-full mt-4 bg-primary hover:bg-primary/90">
                                                Go to Submission Form
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                {/* Confirmation Prompt */}
                                {msg.type === 'confirmation' && (
                                    <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-md p-6 space-y-4">
                                        <div className="space-y-2 text-center">
                                            <h3 className="font-semibold text-lg text-slate-800">AI draft is ready.</h3>
                                            <p className="text-slate-600 text-sm">Review the draft above or click below to finalize it in the submission form.</p>
                                        </div>
                                        <div className="space-y-3 pt-2">
                                            <Button onClick={handleSubmit} className="w-full bg-green-600 hover:bg-green-700 text-white gap-2">
                                                <CheckCircle className="h-4 w-4" /> Go to Form
                                            </Button>
                                            <Button onClick={handleDownload} variant="outline" className="w-full gap-2 group flex flex-col items-center py-6 h-auto">
                                                <div className="flex items-center gap-2">
                                                    <Download className="h-4 w-4" /> Download AI-generated file
                                                </div>
                                                <span className="text-[10px] text-slate-500 font-normal mt-1">(Editable & ready for manual upload)</span>
                                            </Button>
                                        </div>
                                    </div>
                                )}
                                {/* Success Message */}
                                {msg.type === 'success' && (
                                    <div className="w-full max-w-md bg-green-50 border border-green-200 rounded-2xl p-6 space-y-4">
                                        <div className="flex items-center gap-3 text-green-800 font-semibold mb-2">
                                            <CheckCircle className="h-6 w-6" />
                                            Success
                                        </div>
                                        <p className="text-green-700">Your design request has been successfully submitted. You can track it in the Dashboard.</p>
                                        <Button variant="outline" className="w-full border-green-200 text-green-700 hover:bg-green-100" onClick={() => window.location.href = '/dashboard'}>
                                            Go to Dashboard
                                        </Button>
                                    </div>
                                )}

                                {msg.role === 'user' && msg.type !== 'file_upload' && (
                                    <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200 mt-1 flex-shrink-0">
                                        <User className="h-4 w-4 text-slate-500" />
                                    </div>
                                )}
                            </div>
                        ))}
                        {isTyping && (
                            <div className="flex gap-4 justify-start">
                                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                                    <Sparkles className="h-4 w-4 text-primary animate-pulse" />
                                </div>
                                <div className="bg-white border border-slate-200 p-4 rounded-2xl rounded-tl-sm shadow-sm flex items-center gap-2">
                                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></span>
                                </div>
                            </div>
                        )}
                        <div ref={scrollRef} />
                    </div>
                </ScrollArea>
            )}

            {/* Initial View Container (Center) */}
            {view === 'initial' && (
                <div className="flex-1 flex flex-col items-center justify-center p-6">
                    <div className="w-full max-w-3xl space-y-10 animate-fade-in">
                        <div className="text-center space-y-3">
                            <h1 className="text-4xl font-bold tracking-tight text-[#1E2A5A] flex items-center justify-center gap-3">
                                Meet AI Mode
                            </h1>
                            <p className="text-lg text-[#64748B]">
                                Start by typing an idea, uploading a document, or speaking your requirement.
                                <br />
                                AI will take care of the rest.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Input Area */}
            <div className={cn("p-6", view === 'initial' ? "flex justify-center" : "bg-white/80 backdrop-blur-md border-t border-slate-200")}>
                <div className={cn("w-full transition-all duration-500", view === 'initial' ? "max-w-3xl" : "max-w-3xl mx-auto")}>

                    {/* Suggestions - Initial View Only */}
                    {view === 'initial' && (
                        <div className="mb-8 relative z-10 w-full">
                            <div className="relative group w-full">
                                <div className="absolute inset-0 bg-gradient-to-r from-blue-100 via-purple-100 to-pink-100 rounded-[2rem] blur-xl opacity-50"></div>
                                <div className={cn(
                                    "relative bg-[#F1F5F9]/80 backdrop-blur-xl border border-white/50 rounded-[2rem] p-4 shadow-lg focus-within:shadow-xl focus-within:bg-white/90 transition-all",
                                    uploadStatus === 'uploading' && "animate-pulse border-blue-300"
                                )}>
                                    <div className="flex flex-col min-h-[120px]">
                                        <textarea
                                            value={isListening ? "Listening… Speak clearly" : (uploadStatus === 'uploading' ? "Uploading… Please wait" : prompt)}
                                            onChange={(e) => setPrompt(e.target.value)}
                                            onKeyDown={handleKeyDown}
                                            placeholder={placeholderText}
                                            disabled={isListening || uploadStatus === 'uploading'}
                                            className={cn(
                                                "flex-1 bg-transparent border-none outline-none resize-none text-lg text-[#1E2A5A] placeholder:text-[#94A3B8] p-2",
                                                (isListening || uploadStatus === 'uploading') && "text-blue-500 animate-pulse font-medium",
                                                isListening && "text-red-500"
                                            )}
                                        />
                                        <div className="flex items-center justify-between mt-2 px-2">
                                            <div className="flex items-center gap-2 text-[#64748B]">
                                                <Button onClick={handleImageUpload} variant="ghost" size="icon" className="group hover:bg-white/50 hover:text-[#1E2A5A] rounded-full h-10 w-10 relative" title="Upload Image">
                                                    <ImageIcon className="h-5 w-5" />
                                                </Button>
                                                <Button
                                                    onClick={handleFileUpload}
                                                    variant="ghost"
                                                    size="icon"
                                                    className="group hover:bg-white/50 hover:text-[#1E2A5A] rounded-full h-10 w-10 relative"
                                                    title="Release to upload your file"
                                                >
                                                    <Paperclip className="h-5 w-5" />
                                                    {uploadStatus === 'uploading' && <span className="absolute -top-1 -right-1 flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-sky-500"></span></span>}
                                                </Button>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <Button
                                                    onClick={handleVoiceInput}
                                                    variant="ghost"
                                                    size="icon"
                                                    className={cn("group/mic hover:bg-white/50 text-[#64748B] hover:text-[#1E2A5A] rounded-full h-10 w-10 transition-all relative", isListening && "bg-red-50 text-red-500 animate-pulse")}
                                                    title="Click to speak. AI will convert your voice into text."
                                                >
                                                    <Mic className="h-5 w-5 group-hover/mic:scale-110 transition-transform" />
                                                </Button>
                                                <Button
                                                    onClick={handleSendMessage}
                                                    className={cn(
                                                        "rounded-full h-10 w-10 p-0 transition-all duration-300",
                                                        prompt.trim()
                                                            ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md"
                                                            : "bg-[#E2E8F0] text-[#94A3B8] hover:bg-[#CBD5E1]"
                                                    )}
                                                    disabled={!prompt.trim()}
                                                >
                                                    <ArrowUp className="h-5 w-5" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                    {/* Hidden File Inputs */}
                                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                                    <input type="file" ref={imageInputRef} onChange={handleImageChange} accept="image/*" className="hidden" />
                                </div>
                            </div>

                            {/* Helper Text */}
                            <p className="text-center text-sm text-[#94A3B8] mt-4 mb-8">
                                Upload a file or share your idea. AI can enhance content, rewrite it, or convert it into a ready-to-submit request.
                            </p>

                            <div className="space-y-4">
                                {suggestions.map((item, index) => (
                                    <button
                                        key={index}
                                        onClick={() => { setPrompt(item.text); }}
                                        className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-white/60 hover:shadow-sm transition-all duration-200 text-left group"
                                    >
                                        <div className="h-10 w-10 rounded-full bg-white border border-[#E2E8F0] flex items-center justify-center text-[#64748B] group-hover:text-primary group-hover:border-primary/20 transition-colors">
                                            <item.icon className="h-5 w-5" />
                                        </div>
                                        <span className="text-[#64748B] group-hover:text-[#1E2A5A] transition-colors">
                                            {item.text}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Compact Input for Chat View */}
                    {view === 'chat' && (
                        <div className="relative bg-white border border-slate-200 rounded-2xl p-2 shadow-sm flex items-end gap-2">
                            <Button onClick={handleFileUpload} variant="ghost" size="icon" className="text-slate-400 hover:text-slate-600">
                                <Paperclip className="h-5 w-5" />
                            </Button>
                            <textarea
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Reply..."
                                className="flex-1 max-h-[150px] bg-transparent border-none outline-none resize-none text-base text-[#1E2A5A] placeholder:text-[#94A3B8] py-2"
                                rows={1}
                            />
                            <Button
                                onClick={handleSendMessage}
                                size="icon"
                                className={cn(
                                    "rounded-xl transition-all",
                                    prompt.trim()
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-slate-100 text-slate-300"
                                )}
                                disabled={!prompt.trim()}
                            >
                                <ArrowUp className="h-5 w-5" />
                            </Button>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}
