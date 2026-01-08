import { GoogleGenerativeAI } from '@google/generative-ai';

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

if (!API_KEY) {
    console.warn('⚠️ VITE_GEMINI_API_KEY not found. Task Buddy AI will not work.');
}

const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

export const TASK_BUDDY_SYSTEM_PROMPT = `You are Task Buddy, an AI assistant embedded inside the DesignDesk Task Portal.

🎯 PRIMARY OBJECTIVES:
- Help users draft complete task submission requests
- Improve or rewrite uploaded documents
- Generate campaign content (post text, captions, descriptions, slogans, briefs)
- Ask smart follow-up questions based on missing parameters
- Provide FAQ, help, and portal guidance
- Convert AI output into a ready-to-submit task request

🚫 CONSTRAINTS:
- You must NEVER generate images or image prompts
- You must ONLY generate text content, drafts, structured data, and guidance
- Keep responses professional, clear, friendly, and concise
- No emojis, no slang

📋 TASK SUBMISSION PARAMETERS (MANDATORY FIELDS):
When creating a task, you must extract or ask for:
1. Request Title
2. Description / Brief
3. Category (Banner, Campaign/Others, Social Media Creative, Website Assets, UI/UX, LED Backdrop, Brochure, Flyer)
4. Urgency (Normal / High / VIP)
5. Deadline
6. WhatsApp Number(s) (optional)
7. Attachments (if mentioned)

If any required field is missing, ask short, clear questions one by one.

🧩 RESPONSE FORMAT:
When you have all required information, respond with a JSON object:
{
  "type": "task_draft",
  "data": {
    "title": "...",
    "description": "...",
    "category": "...",
    "urgency": "...",
    "deadline": "YYYY-MM-DD",
    "whatsappNumbers": ["..."],
    "notes": "..."
  }
}

For regular conversation, respond with:
{
  "type": "message",
  "content": "your response here"
}

🧠 WEBSITE DATA AWARENESS:
- Minimum 3 working days rule for deadlines
- Approval flows for modifications
- Designer availability calendar
- Status definitions (Pending, In Progress, Completed)

Always aim to reduce user effort and guide them step-by-step.`;

export interface TaskDraft {
    title: string;
    description: string;
    category: 'banner' | 'campaign_or_others' | 'social_media_creative' | 'website_assets' | 'ui_ux' | 'led_backdrop' | 'brochure' | 'flyer';
    urgency: 'low' | 'intermediate' | 'normal' | 'urgent';
    deadline: string;
    whatsappNumbers?: string[];
    notes?: string;
}

export interface AIResponse {
    type: 'message' | 'task_draft';
    content?: string;
    data?: TaskDraft;
}

export async function sendMessageToAI(
    messages: { role: 'user' | 'model'; parts: string }[],
    userMessage: string
): Promise<AIResponse> {
    if (!genAI) {
        throw new Error('Gemini AI is not configured. Please add VITE_GEMINI_API_KEY to your .env file.');
    }

    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

        const chat = model.startChat({
            history: messages.map(msg => ({
                role: msg.role,
                parts: [{ text: msg.parts }]
            })),
            generationConfig: {
                temperature: 0.7,
                topP: 0.95,
                topK: 40,
                maxOutputTokens: 2048,
            },
        });

        const result = await chat.sendMessage(TASK_BUDDY_SYSTEM_PROMPT + '\n\nUser: ' + userMessage);
        const response = result.response;
        const text = response.text();

        // Try to parse as JSON first
        try {
            const parsed = JSON.parse(text);
            return parsed as AIResponse;
        } catch {
            // If not JSON, return as regular message
            return {
                type: 'message',
                content: text
            };
        }
    } catch (error) {
        console.error('AI Error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown AI error';

        if (errorMessage.includes('429')) {
            throw new Error('Usage limit exceeded (Quota). Please wait a minute and try again.');
        }

        throw new Error(`AI Error: ${errorMessage}`);
    }
}

export function validateTaskDraft(draft: Partial<TaskDraft>): { valid: boolean; missing: string[] } {
    const required = ['title', 'description', 'category', 'urgency', 'deadline'];
    const missing = required.filter(field => !draft[field as keyof TaskDraft]);

    return {
        valid: missing.length === 0,
        missing
    };
}
