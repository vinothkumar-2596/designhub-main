import express from "express";
import { generateAIContent } from "../lib/ollama.js";
import AIFile from "../models/AIFile.js";
import { GoogleGenerativeAI } from "@google/generative-ai";

const router = express.Router();

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
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: "GEMINI_API_KEY is not configured on the server" });
    }

    try {
        const { messages = [], userMessage = "", systemPrompt = "" } = req.body || {};

        if (!userMessage) {
            return res.status(400).json({ error: "userMessage is required" });
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "models/gemini-2.5-flash" });

        const chat = model.startChat({
            history: messages.map((msg) => ({
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

        const prompt = systemPrompt ? `${systemPrompt}\n\nUser: ${userMessage}` : userMessage;
        const result = await chat.sendMessage(prompt);
        const response = result.response;
        const text = response.text();

        res.json({ text });
    } catch (error) {
        console.error("Gemini proxy error:", error);
        const message = error instanceof Error ? error.message : "Unknown Gemini error";
        const status = message.includes("429") ? 429 : 500;
        res.status(status).json({ error: message });
    }
});

export default router;
