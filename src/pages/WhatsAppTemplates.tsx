import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { MessageSquare, CheckCircle2, PlayCircle, Loader2, Search, Key } from 'lucide-react';

const templates = [
    {
        id: 'task_submitted',
        name: 'Task Submitted',
        icon: MessageSquare,
        color: 'bg-blue-500',
        content: `Hello {{requester_name}},

Your task request has been successfully submitted.

 Task ID: {{task_id}}
Title: {{task_title}}
Status: Submitted
Deadline: {{deadline}}

Our team will review your request and keep you updated through the dashboard.

– SMVEC Design Desk`
    },
    {
        id: 'task_started',
        name: 'Task Started',
        icon: PlayCircle,
        color: 'bg-green-500',
        content: `Hello {{requester_name}},

Good news! Your task has been started by our design team.

Task ID: {{task_id}}
Title: {{task_title}}
Status: Started

We’ll keep you informed as progress continues.

– SMVEC Design Desk`
    },
    {
        id: 'task_in_progress',
        name: 'Task In Progress',
        icon: Loader2,
        color: 'bg-amber-500',
        content: `Hello {{requester_name}},

Your task is currently in progress 

Task ID: {{task_id}}
Title: {{task_title}}
Status: In Progress

Design work is actively underway.  
You can track updates anytime from your dashboard.

– SMVEC Design Desk`
    },
    {
        id: 'task_submitted_for_review',
        name: 'Task Submitted for Review',
        icon: Search,
        color: 'bg-purple-500',
        content: `Hello {{requester_name}},

An update has been submitted for your task.

Task ID: {{task_id}}
Title: {{task_title}}
Status: Submitted for Review

Please review the update in your dashboard and share feedback if required.

– SMVEC Design Desk`
    },
    {
        id: 'task_final_files_uploaded',
        name: 'Final Files Uploaded',
        icon: CheckCircle2,
        color: 'bg-emerald-500',
        content: `Hello {{requester_name}},

Your task has been completed and final files are uploaded 

Task ID: {{task_id}}
Title: {{task_title}}
Status: Completed

You can download the final files from your dashboard.

Thank you for working with us,  
SMVEC Design Desk`
    },
    {
        id: 'forgot_password_otp',
        name: 'Forgot Password – OTP',
        icon: Key,
        color: 'bg-slate-700',
        content: `Hello {{user_name}},

Your One-Time Password (OTP) to reset your password is:

OTP: {{otp_code}}

This OTP is valid for {{expiry_minutes}} minutes.  
Please do not share this code with anyone.

– SMVEC Support Team`
    }
];

export default function WhatsAppTemplates() {
    return (
        <DashboardLayout>
            <div className="space-y-6 max-w-5xl">
                <div className="animate-fade-in">
                    <h1 className="text-2xl font-bold text-foreground">WhatsApp Templates</h1>
                    <p className="text-muted-foreground mt-1">
                        Official messaging templates for the SMVEC Design Desk workflow
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-12">
                    {templates.map((template, index) => (
                        <Card key={template.id} className="overflow-hidden border-border/70 shadow-sm hover:shadow-md transition-shadow animate-slide-up" style={{ animationDelay: `\${index * 100}ms` }}>
                            <CardHeader className="pb-3 space-y-1">
                                <div className="flex items-center justify-between">
                                    <div className={`p-2 rounded-lg \${template.color} text-white`}>
                                        <template.icon className="h-5 w-5" />
                                    </div>
                                    <Badge variant="outline" className="text-[10px] uppercase font-mono tracking-tighter">
                                        {template.id}
                                    </Badge>
                                </div>
                                <CardTitle className="text-xl mt-2">{template.name}</CardTitle>
                                <CardDescription>Sent automatically on lifecycle events</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-border/40 font-mono text-sm whitespace-pre-wrap leading-relaxed relative group">
                                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white dark:bg-slate-800 px-2 py-1 rounded text-[10px] font-bold text-slate-400 border border-border shadow-sm pointer-events-none">
                                        PREVIEW
                                    </div>
                                    {template.content}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </DashboardLayout>
    );
}
