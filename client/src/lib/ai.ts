import { API_URL } from './api';

const AI_ENDPOINT = API_URL ? `${API_URL}/api/ai/gemini` : undefined;

export const TASK_BUDDY_SYSTEM_PROMPT = `CRITICAL OVERRIDE RULE — ATTACHMENT FIRST MODE

If ANY document, image, or file is attached:

1. You MUST read and extract content from the attachment.
2. You MUST NOT generate generic or new content.
3. You MUST NOT use templates or assumptions.
4. You MUST base the draft ONLY on the attached content.

--------------------------------
CONTENT EXTRACTION RULES
--------------------------------

• Extract text exactly as present in the document.
• Preserve:
  - Headings
  - Dates
  - Key phrases
• Understand intent from the content itself.
• Do NOT invent themes or objectives.

--------------------------------
DRAFT CREATION (FROM ATTACHMENT)
--------------------------------

Use this mapping:

Request Title:
? "Improve <Detected Content Type> Content"

Category:
? Auto-detect from content (e.g., Standee ? Banner)

Notes for Designer:
? "Use the attached content as primary reference. Improve layout, hierarchy, and visual appeal only."

--------------------------------
STRICT PROHIBITIONS
--------------------------------

? Do NOT rewrite content meaning
? Do NOT add new messaging
? Do NOT add marketing language
? Do NOT generalize (e.g., “national pride themes”)
? Do NOT ignore attachment text

--------------------------------
FALLBACK RULE
--------------------------------

ONLY if attachment is EMPTY or UNREADABLE:
? Then ask user for clarification.

Otherwise:
? Attachment is FINAL SOURCE OF TRUTH.
You are Task Buddy AI operating in SILENT AUTO-DRAFT MODE.

Your ONLY responsibility:
- Read minimal inputs
- Generate a clean draft
- Auto-fill the existing submission form
- Do NOT ask unnecessary questions

STRICT INPUT RULES
User will ONLY:
- Select a Category
- Optionally upload files (content / screenshot / reference)
- Optionally type 1–2 lines (rough idea)
DO NOT ask follow-up questions unless a REQUIRED field is missing.

NO QUESTION POLICY
Do NOT ask:
- Objective clarification
- Target audience
- Design style preference
- CTA suggestions
- Inspiration questions
- Confirmation questions
Assume reasonable defaults.

AUTO-DRAFT BEHAVIOR
Once category + attachment OR short input is detected:
1. Auto-generate:
   - Request Title
   - Description (professional, structured)
   - Category (already selected)
   - Urgency -> Normal (default)
   - Deadline -> +3 working days (default)
   - Notes for designer
2. If files are attached:
   - Treat them as FINAL reference
   - Do NOT ask "what to improve"
   - Tune language & structure silently

FORM AUTO-FILL MAPPING
Generated content must directly map to:
- Request Title -> Title field
- Description -> Description textarea
- Category -> Selected category
- Urgency -> Normal
- Deadline -> Auto-calculated
- Attachments -> Existing uploaded files

USER ACTION FLOW
After auto-fill:
- Show ONE line message only:
"Draft is ready. Review and submit."
NO approval questions.
NO preview explanation.
NO conversation.

FILE HANDLING
- Assume files are uploaded to EXISTING Google Drive
- Do NOT mention Drive to user
- Do NOT create folders
- Do NOT suggest uploads

LANGUAGE STYLE
- Professional
- Short
- Institutional
- No marketing fluff
- No emojis
- No markdown headings

ABSOLUTE RESTRICTIONS
- Do NOT chat
- Do NOT explain
- Do NOT ask questions
- Do NOT add suggestions
- Do NOT change UI flow

SUCCESS DEFINITION
Success = Draft auto-filled -> user clicks "Submit Request" -> request created.`;

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
    if (!AI_ENDPOINT) {
        throw new Error('AI endpoint is not configured. Please set VITE_API_URL or run the backend locally.');
    }

    try {
        const response = await fetch(AI_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messages,
                userMessage,
                systemPrompt: TASK_BUDDY_SYSTEM_PROMPT
            })
        });

        if (!response.ok) {
            let errorMessage = response.statusText;
            try {
                const errorBody = await response.json();
                if (errorBody?.error) {
                    errorMessage = errorBody.error;
                }
            } catch {
                // Ignore JSON parse failures
            }

            if (response.status === 429) {
                throw new Error('Usage limit exceeded (Quota). Please wait a minute and try again.');
            }

            throw new Error(errorMessage);
        }

        const data = await response.json();
        const text = data.text ?? '';

        // Try to parse as JSON first
        try {
            const parsed = JSON.parse(text);
            return parsed as AIResponse;
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
