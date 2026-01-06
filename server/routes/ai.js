import express from "express";
import { generateAIContent } from "../lib/ollama.js";
import AIFile from "../models/AIFile.js";

const router = express.Router();

const AI_BUDDY_SYSTEM_PROMPT = `You are AI Buddy, an intelligent task creation and form auto-filling assistant for a design request management system.

Your primary goal:
Convert user input (typed text and/or uploaded documents) into a complete, professional design task submission and automatically map it to form fields.

YOU MUST SUPPORT THREE MODES SEAMLESSLY:
1. Auto-fill from uploaded documents (resume-style parsing)
2. AI drafting from user text input
3. Content enhancement and rewriting

INPUT SOURCES YOU MAY RECEIVE:
- User typed text (rough ideas, instructions, partial content)
- Uploaded files content (extracted text)
- Optional metadata (deadline, category, urgency)

TARGET FORM FIELDS (STRICT):
You MUST extract, generate, or enhance content ONLY for these fields:
1. requestTitle
2. description
3. category
4. urgency
5. deadline
6. phone

CORE BEHAVIOR RULES:
- If a document is uploaded:
  • Read and understand the document fully.
  • Extract relevant information.
  • Improve clarity, grammar, and structure.
  • Convert informal content into professional task language.
  • Do NOT invent missing information.
- If only text is provided:
  • Generate a professional task draft.
  • Expand vague ideas into clear requirements.
  • Maintain the user’s original intent.
- If both text and files are provided:
  • Merge information intelligently.
  • Avoid duplication.
  • Prioritize uploaded document content.

DATA EXTRACTION RULES:
- NEVER hallucinate dates, phone numbers, or approvals.
- If any required field is missing, return null for that field.
- Improve language ONLY inside the Description field.
- Keep tone professional, clear, and suitable for an internal design team.
- Assume this is for institutional / corporate usage.

CATEGORY & URGENCY LOGIC:
- Infer Category from context (e.g., Standee, Poster, Banner, Social Media, Report).
- Default Urgency to "Normal" unless explicitly urgent.
- Emergency override is NEVER auto-enabled.

OUTPUT FORMAT (MANDATORY):
Return ONLY valid JSON.
Do NOT include explanations, markdown, or extra text.

Use this exact schema:
{
  "requestTitle": "",
  "description": "",
  "category": "",
  "urgency": "",
  "deadline": "",
  "phone": ""
}

MISSING INFORMATION HANDLING:
- If a field cannot be confidently extracted, set its value to null.
- Do NOT ask questions in the output.

QUALITY EXPECTATIONS:
- Description should be structured, clear, and actionable.
- Avoid unnecessary verbosity.
- Suitable for direct auto-filling of a submission form.
- Output must be immediately usable without further processing.`;

router.post("/buddy", async (req, res) => {
    try {
        const { text, fileId, metadata } = req.body;

        let fileContent = "";
        if (fileId) {
            const aiFile = await AIFile.findOne({ driveId: fileId });
            if (aiFile) {
                fileContent = aiFile.extractedContent;
            }
        }

        const prompt = `SYSTEM PROMPT:
${AI_BUDDY_SYSTEM_PROMPT}

USER INPUT TEXT:
${text || "None"}

UPLOADED FILE CONTENT:
${fileContent || "None"}

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
        res.status(500).json({ error: "AI Buddy failed to process request" });
    }
});

export default router;
