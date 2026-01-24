import { GoogleGenerativeAI } from '@google/generative-ai';

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

if (!API_KEY) {
    console.warn('â ï¸ VITE_GEMINI_API_KEY not found. Task Buddy AI will not work.');
}

const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

export const TASK_BUDDY_SYSTEM_PROMPT = `You are TaskBuddy AI, a SMART REQUEST WIZARD inside the DesignDesk portal.

GOAL
Help users create a design request by asking ONE question at a time, using OPTIONS instead of open-ended questions wherever possible.

REQUIRED FIELDS (must collect all)
- request_title
- description
- category
- urgency
- deadline

QUESTION ORDER (strict)
1) What design is needed
2) Description / details
3) Category
4) Urgency
5) Deadline
6) Optional data availability

RULES
- Ask ONE question per turn. Do NOT ask everything at once.
- Always give OPTIONS for the user to choose.
- Use short, clear, option-based prompts.
- If the user gives multiple fields in one message, accept them and move to the next missing field.

OPTIONS TO USE
1) What design is needed (capture request_title)
Choose one:
- Event banner
- Social media post
- Flyer
- Brochure
- Website asset
- UI/UX screen
- LED backdrop
- Campaign/other
- Other (type)

2) Description / details
Choose one:
- I will type a 1-2 line brief now
- Keep it minimal (use title only)
- I will add details later
If the user chooses to type now, ask them to provide the brief in the next message.
If minimal/later, proceed to the next step.

3) Category (must map to these values)
Choose one:
- banner
- campaign_or_others
- social_media_creative
- website_assets
- ui_ux
- led_backdrop
- brochure
- flyer

4) Urgency
Choose one:
- Normal
- Urgent

5) Deadline
Choose one:
- 3 days from now
- 1 week from now
- Pick a date (YYYY-MM-DD)
If user picks a date, accept the next message as the date and validate format.

6) Optional data availability
Ask what additional data is available and show options:
- content/copy
- logo/brand assets
- reference/inspiration
- size/dimensions
- none

MANDATORY FINAL PROMPT
After all required fields are collected, ask exactly:
"Do you want to continue or proceed now?"
Give ONLY these options:
- ✅ Send to Draft
- 📎 Add more details / attachments
- 🚀 Submit request

OPTION LOGIC
If user selects:
1) "Send to Draft" -> respond ONLY with SAVE_DRAFT JSON (no extra text).
2) "Add more details / attachments" -> ask what additional data is available (content, logo, reference, size, text, etc.) using options.
3) "Submit request" -> respond ONLY with SUBMIT_REQUEST JSON (no extra text).

SHORTCUT INTENT
If user says: "ok send to draft", "draft", "later", or "save"
Treat as "Send to Draft".

FINAL OUTPUT RULES (very strict)
When user chooses "Send to Draft", respond ONLY with JSON:
{
  "action": "SAVE_DRAFT",
  "data": {
    "request_title": "",
    "description": "",
    "category": "",
    "urgency": "Normal | Urgent",
    "deadline": "YYYY-MM-DD",
    "phone": "",
    "attachments_note": ""
  }
}

When user chooses "Submit request", respond ONLY with JSON:
{
  "action": "SUBMIT_REQUEST",
  "data": {
    "request_title": "",
    "description": "",
    "category": "",
    "urgency": "Normal | Urgent",
    "deadline": "YYYY-MM-DD"
  }
}

Do NOT add explanations.
Do NOT ask follow-up questions after action is decided.`;

export interface TaskDraft {
    title: string;
    description: string;
    category: 'banner' | 'campaign_or_others' | 'social_media_creative' | 'website_assets' | 'ui_ux' | 'led_backdrop' | 'brochure' | 'flyer';
    urgency: 'low' | 'intermediate' | 'normal' | 'urgent';
    deadline: string;
    whatsappNumbers?: string[];
    notes?: string;
    phone?: string;
    attachmentsNote?: string;
}

export interface TaskBuddyActionPayload {
    request_title: string;
    description: string;
    category: string;
    urgency: string;
    deadline: string;
    phone?: string;
    attachments_note?: string;
}

export interface AIResponse {
    type: 'message' | 'task_draft' | 'action';
    content?: string;
    data?: TaskDraft | TaskBuddyActionPayload;
    action?: 'SAVE_DRAFT' | 'SUBMIT_REQUEST';
}

const DRAFT_LABELS = [
    'Request Title',
    'Objective',
    'Description',
    'Design Type',
    'Size / Format',
    'Content Copy (Final Tuned)',
    'Design Style Notes',
    'Deadline',
    'Priority',
    'Additional Notes for Designer'
];

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const extractDraftSections = (text: string) => {
    const labelPattern = DRAFT_LABELS.map(escapeRegExp).join('|');
    const regex = new RegExp(`^(${labelPattern})\\s*:\\s*([\\s\\S]*?)(?=^(${labelPattern})\\s*:|\\s*$)`, 'gmi');
    const sections: Record<string, string> = {};
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
        const label = match[1].trim();
        const value = match[2].trim();
        sections[label] = value;
    }

    return sections;
};

const mapDesignTypeToCategory = (value: string): TaskDraft['category'] | null => {
    const normalized = value.toLowerCase();
    if (normalized.includes('banner')) return 'banner';
    if (normalized.includes('social')) return 'social_media_creative';
    if (normalized.includes('website')) return 'website_assets';
    if (normalized.includes('ui') || normalized.includes('ux')) return 'ui_ux';
    if (normalized.includes('led')) return 'led_backdrop';
    if (normalized.includes('brochure')) return 'brochure';
    if (normalized.includes('flyer')) return 'flyer';
    if (normalized.includes('campaign')) return 'campaign_or_others';
    return null;
};

const mapPriorityToUrgency = (value: string): TaskDraft['urgency'] | null => {
    const normalized = value.toLowerCase();
    if (normalized.includes('vip') || normalized.includes('urgent') || normalized.includes('high')) {
        return 'urgent';
    }
    if (normalized.includes('medium') || normalized.includes('intermediate')) {
        return 'intermediate';
    }
    if (normalized.includes('low')) {
        return 'low';
    }
    if (normalized.includes('normal') || normalized.includes('standard')) {
        return 'normal';
    }
    return null;
};

const mapActionCategoryToTaskDraft = (value: string): TaskDraft['category'] => {
    const normalized = value.toLowerCase().trim();
    if (normalized === 'banner') return 'banner';
    if (normalized === 'campaign_or_others') return 'campaign_or_others';
    if (normalized === 'social_media_creative') return 'social_media_creative';
    if (normalized === 'website_assets') return 'website_assets';
    if (normalized === 'ui_ux') return 'ui_ux';
    if (normalized === 'led_backdrop') return 'led_backdrop';
    if (normalized === 'brochure') return 'brochure';
    if (normalized === 'flyer') return 'flyer';
    return mapDesignTypeToCategory(normalized) || 'campaign_or_others';
};

const mapActionUrgencyToTaskDraft = (value: string): TaskDraft['urgency'] => {
    const normalized = value.toLowerCase();
    if (normalized.includes('urgent')) return 'urgent';
    if (normalized.includes('intermediate') || normalized.includes('medium')) return 'intermediate';
    if (normalized.includes('low')) return 'low';
    return 'normal';
};

export const mapActionPayloadToDraft = (payload: TaskBuddyActionPayload): TaskDraft => {
    const description = payload.attachments_note
        ? `${payload.description}

Attachments/Notes: ${payload.attachments_note}`.trim()
        : payload.description;
    return {
        title: payload.request_title || 'Design Request',
        description: description || 'Design request details',
        category: mapActionCategoryToTaskDraft(payload.category || ''),
        urgency: mapActionUrgencyToTaskDraft(payload.urgency || ''),
        deadline: payload.deadline || '',
        whatsappNumbers: payload.phone ? [payload.phone] : undefined,
        notes: payload.attachments_note || '',
        phone: payload.phone,
        attachmentsNote: payload.attachments_note
    };
};

const toIsoDate = (value: string) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return value;
    }
    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const parseTaskDraftFromText = (text: string): TaskDraft | null => {
    const sections = extractDraftSections(text);
    if (!sections['Request Title'] && !sections['Description'] && !sections['Design Type']) {
        return null;
    }

    const descriptionParts = [
        sections['Description'],
        sections['Content Copy (Final Tuned)'] ? `Content Copy: ${sections['Content Copy (Final Tuned)']}` : '',
        sections['Design Style Notes'] ? `Design Style Notes: ${sections['Design Style Notes']}` : ''
    ].filter(Boolean);

    const category = mapDesignTypeToCategory(sections['Design Type'] || '');
    const urgency = mapPriorityToUrgency(sections['Priority'] || '');

    const draft: TaskDraft = {
        title: sections['Request Title'] || 'Design Request',
        description: descriptionParts.join('\n\n') || sections['Objective'] || 'Design request details',
        category: category || 'campaign_or_others',
        urgency: urgency || 'normal',
        deadline: sections['Deadline'] ? toIsoDate(sections['Deadline']) : '',
        notes: sections['Additional Notes for Designer'] || ''
    };

    return draft;
};

export async function sendMessageToAI(
    messages: { role: 'user' | 'model'; parts: string }[],
    userMessage: string
): Promise<AIResponse> {
    if (!genAI) {
        throw new Error('Gemini AI is not configured. Please add VITE_GEMINI_API_KEY to your .env file.');
    }

    try {
        const model = genAI.getGenerativeModel({ model: 'models/gemini-2.5-flash' });

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
            if (parsed && typeof parsed === 'object') {
                if (parsed.action === 'SAVE_DRAFT' || parsed.action === 'SUBMIT_REQUEST') {
                    return {
                        type: 'action',
                        action: parsed.action,
                        data: parsed.data as TaskBuddyActionPayload
                    };
                }
                if (parsed.type === 'message' || parsed.type === 'task_draft') {
                    return parsed as AIResponse;
                }
            }
        } catch {
            const draft = parseTaskDraftFromText(text);
            if (draft) {
                const validation = validateTaskDraft(draft);
                if (validation.valid) {
                    return {
                        type: 'task_draft',
                        data: draft
                    };
                }
            }

            // If not JSON or draft, return as regular message
            return {
                type: 'message',
                content: text
            };
        }

        // If JSON parsed but did not match known shapes, treat as message
        return {
            type: 'message',
            content: text
        };
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
