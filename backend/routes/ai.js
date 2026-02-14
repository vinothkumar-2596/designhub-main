import express from "express";
import { generateAIContent } from "../lib/ollama.js";
import AIFile from "../models/AIFile.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { requireRole } from "../middleware/auth.js";

const router = express.Router();
router.use(requireRole(["staff", "designer", "treasurer"]));

const GEMINI_READY_RESPONSE_CONTRACT = `When ready, respond ONLY in this format:

STATUS: READY

{
  "title": "",
  "description": "",
  "category": "",
  "urgency": "",
  "deadline": "",
  "phone": ""
}
Do not include explanations.`;

const buildGeminiPrompt = (systemPrompt, userMessage) => {
    const sections = [];
    if (systemPrompt && String(systemPrompt).trim()) {
        sections.push(String(systemPrompt).trim());
    }
    sections.push(`Current user message:\n${String(userMessage || "").trim()}`);
    // Keep the contract at the end to enforce strict output.
    sections.push(GEMINI_READY_RESPONSE_CONTRACT);
    return sections.join("\n\n");
};

const normalizeChatHistory = (messages) => {
    if (!Array.isArray(messages)) {
        return [];
    }
    return messages
        .map((msg) => ({
            role: msg?.role === "user" ? "user" : "model",
            parts: String(msg?.parts || "").trim(),
        }))
        .filter((msg) => Boolean(msg.parts));
};

const buildOllamaFallbackPrompt = (systemPrompt, messages, userMessage) => {
    const sections = [
        "You are TaskBuddy AI.",
        "Follow the instructions carefully. Ask one concise follow-up question if details are missing.",
    ];

    if (systemPrompt && String(systemPrompt).trim()) {
        sections.push(`SYSTEM INSTRUCTIONS:\n${String(systemPrompt).trim()}`);
    }

    const history = normalizeChatHistory(messages)
        .map((msg) => `${msg.role === "user" ? "User" : "Assistant"}: ${msg.parts}`)
        .join("\n");

    if (history) {
        sections.push(`CONVERSATION HISTORY:\n${history}`);
    }

    sections.push(`Current user message:\n${String(userMessage || "").trim()}`);
    sections.push(GEMINI_READY_RESPONSE_CONTRACT);

    return sections.join("\n\n");
};

const runOllamaFallback = async ({ systemPrompt, messages, userMessage }) => {
    const prompt = buildOllamaFallbackPrompt(systemPrompt, messages, userMessage);
    const text = await generateAIContent(prompt);

    if (typeof text === "string" && text.trim().startsWith("[AI SIMULATION]")) {
        throw new Error("Ollama fallback is not available.");
    }

    const readyPayload = extractReadyPayload(text);
    if (readyPayload) {
        return {
            ready: true,
            data: readyPayload,
            provider: "ollama",
            fallback: true,
        };
    }

    return {
        ready: false,
        message: text,
        provider: "ollama",
        fallback: true,
    };
};

const extractReadyPayload = (text) => {
    if (!text || !/STATUS:\s*READY/i.test(text)) {
        return null;
    }
    const statusIndex = text.search(/STATUS:\s*READY/i);
    const jsonStart = text.indexOf("{", statusIndex);
    const jsonEnd = text.lastIndexOf("}");
    if (jsonStart === -1 || jsonEnd === -1 || jsonEnd < jsonStart) {
        return null;
    }
    const jsonString = text.substring(jsonStart, jsonEnd + 1);
    try {
        const parsed = JSON.parse(jsonString);
        return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
        return null;
    }
};

const AI_BUDDY_SYSTEM_PROMPT = `SYSTEM ROLE:
You are Task Buddy AI operating in STRICT ATTACHMENT-ONLY MODE.

ATTACHED CONTENT (USE ONLY THIS):
<<<BEGIN ATTACHED CONTENT>>>
{{EXTRACTED_TEXT}}
<<<END ATTACHED CONTENT>>>

NON-NEGOTIABLE RULES:
1. The attached content above is the ONLY source of truth.
2. You are NOT allowed to add, invent, infer, summarize, or rewrite content.
3. Every sentence you output MUST already exist in the attached content.
4. You may ONLY:
   - Preserve the text as-is
   - Suggest formatting, hierarchy, or design usage
5. If you cannot comply strictly, you MUST stop and return an error.

OUTPUT CONTRACT:
Return ONLY a JSON object in the following shape:

{
  "requestTitle": "Improve Attached Content",
  "description": "Use the attached content exactly as provided. No wording changes.",
  "category": "<auto-detected from content>",
  "notesForDesigner": "Design-only improvements. Text must remain unchanged."
}

FAIL-SAFE:
If the attached content is empty, unreadable, or missing:
Return exactly this error text and NOTHING else:
"Draft generation blocked: attachment-only mode requires readable content."`;


router.post("/buddy", async (req, res) => {
    try {
        const { text, fileId, metadata, attachmentText } = req.body;

        let fileContent = "";
        if (attachmentText) {
            fileContent = String(attachmentText);
        }
        if (fileId) {
            const aiFile = await AIFile.findOne({ driveId: fileId });
            if (aiFile) {
                fileContent = aiFile.extractedContent;
            }
        }

        const hasAttachment = Boolean(fileId || attachmentText);
        const normalizedContent = (fileContent || "").trim();
        if (!normalizedContent || normalizedContent.trim().length < 30) {
            throw new Error("Draft generation blocked: attachment-only mode requires readable content.");
        }

        const systemPrompt = AI_BUDDY_SYSTEM_PROMPT.replace("{{EXTRACTED_TEXT}}", normalizedContent || "");

        const prompt = `SYSTEM PROMPT:
${systemPrompt}

USER INPUT TEXT:
${text || "None"}

UPLOADED FILE CONTENT:
${normalizedContent || "None"}

METADATA (if any):
${metadata ? JSON.stringify(metadata) : "None"}

Please process the above information and return the mandatory JSON response.`;

        const result = await generateAIContent(prompt);

        // Attempt to parse result as JSON. Ollama might return it with markdown.
        let jsonResult;
        try {
            // Clean up markdown code blocks if present
            const cleaned = result.replace(/```json\n?|\n?```/g, "").trim();
            jsonResult = JSON.parse(cleaned);
        } catch (e) {
            console.warn("AI didn't return valid JSON. Full response:", result);
            // Fallback or attempt to extract JSON
            const jsonMatch = result.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                try {
                    jsonResult = JSON.parse(jsonMatch[0]);
                } catch (e2) {
                    return res.status(500).json({ error: "Failed to parse AI response as JSON", raw: result });
                }
            } else {
                return res.status(500).json({ error: "AI failed to generate a valid prompt response", raw: result });
            }
        }

        res.json(jsonResult);
    } catch (error) {
        console.error("AI Buddy process failed:", error);
        const message = error instanceof Error ? error.message : "AI Buddy failed to process request";
        if (message === "Draft generation blocked: attachment-only mode requires readable content.") {
            return res.status(400).send(message);
        }
        res.status(500).json({ error: "AI Buddy failed to process request" });
    }
});

router.post("/gemini", async (req, res) => {
    const { messages = [], userMessage = "", systemPrompt = "" } = req.body || {};

    if (!userMessage) {
        return res.status(400).json({ error: "userMessage is required" });
    }

    const apiKey =
        process.env.GEMINI_API_KEY ||
        process.env.VITE_GEMINI_API_KEY ||
        process.env.GOOGLE_API_KEY;
    if (!apiKey) {
        return res
            .status(503)
            .json({ error: "AI service is temporarily unavailable. Please contact admin.", code: "AI_KEY_MISSING" });
    }

    try {
        const normalizedMessages = normalizeChatHistory(messages);

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "models/gemini-2.5-flash" });

        const chat = model.startChat({
            history: normalizedMessages.map((msg) => ({
                role: msg.role,
                parts: [{ text: msg.parts }],
            })),
            generationConfig: {
                temperature: 0.7,
                topP: 0.95,
                topK: 40,
                maxOutputTokens: 2048,
            },
        });

        const prompt = buildGeminiPrompt(systemPrompt, userMessage);
        const result = await chat.sendMessage(prompt);
        const response = result.response;
        const text = response.text();
        const readyPayload = extractReadyPayload(text);

        if (readyPayload) {
            return res.json({
                ready: true,
                data: readyPayload,
            });
        }

        return res.json({
            ready: false,
            message: text,
        });
    } catch (error) {
        console.error("Gemini proxy error:", error);
        const message = error instanceof Error ? error.message : "Unknown Gemini error";
        const lower = message.toLowerCase();
        const statusHint =
            Number(error?.status || error?.statusCode || error?.response?.status || 0) || 0;

        const isQuotaExhaustedError =
            lower.includes("exceeded your current quota") ||
            lower.includes("insufficient quota") ||
            (lower.includes("quota") && (lower.includes("exceeded") || lower.includes("billing")));
        const isRateLimitError =
            statusHint === 429 ||
            lower.includes("429") ||
            lower.includes("rate limit") ||
            lower.includes("too many requests");
        const isAuthError =
            statusHint === 401 ||
            statusHint === 403 ||
            lower.includes("403") ||
            lower.includes("api key") ||
            lower.includes("forbidden") ||
            lower.includes("permission") ||
            lower.includes("authentication") ||
            lower.includes("leaked");

        if (isQuotaExhaustedError || isRateLimitError) {
            try {
                const fallbackPayload = await runOllamaFallback({ systemPrompt, messages, userMessage });
                return res.json(fallbackPayload);
            } catch (fallbackError) {
                console.error("Ollama fallback failed:", fallbackError);
            }

            if (isQuotaExhaustedError) {
                return res.status(429).json({
                    error: "AI quota exceeded. Update Gemini billing/quota or use a different project key.",
                    code: "AI_QUOTA_EXHAUSTED",
                });
            }

            return res
                .status(429)
                .json({ error: "Rate limit. Try again in 1 minute.", code: "AI_QUOTA_EXCEEDED" });
        }

        if (isAuthError) {
            return res
                .status(503)
                .json({ error: "AI service is temporarily unavailable. Please contact admin.", code: "AI_AUTH_UNAVAILABLE" });
        }

        return res
            .status(503)
            .json({ error: "AI service is temporarily unavailable. Please try again later.", code: "AI_UNAVAILABLE" });
    }
});

export default router;
