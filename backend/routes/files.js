import express from "express";
import multer from "multer";
import { uploadToDrive, getDriveClient } from "../lib/drive.js";
import { extractText } from "../lib/extractor.js";
import { generateAIContent } from "../lib/ollama.js";
import AIFile from "../models/AIFile.js";
import { requireRole } from "../middleware/auth.js";

const router = express.Router();
router.use(requireRole(["staff", "designer", "treasurer"]));

const maxUploadBytes = Number(process.env.UPLOAD_MAX_BYTES || 50 * 1024 * 1024);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: maxUploadBytes,
  },
});

router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    console.log("File upload request received.");
    if (!req.file) {
      console.warn("Upload missing file payload.");
      return res.status(400).json({ error: "File is required." });
    }

    const { aiMode, taskTitle } = req.body;
    const uploadedBy = req.user?.email || req.user?.name || req.body.uploadedBy || "Guest";
    const isAiMode = aiMode === "true";

    const baseFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID || "";
    const makePublic = process.env.DRIVE_PUBLIC !== "false";

    // For AI Mode, use "AI Mode Files" subfolder
    const subfolderName = isAiMode ? "AI Mode Files" : (taskTitle ? String(taskTitle) : undefined);

    const file = await uploadToDrive({
      buffer: req.file.buffer,
      filename: req.file.originalname,
      mimeType: req.file.mimetype,
      folderId: baseFolderId,
      makePublic,
      subfolderName,
    });
    req.auditTargetId = file?.id || "";

    console.log("Drive upload success:", file?.id);

    let extractedContent = "";
    if (isAiMode) {
      extractedContent = await extractText(req.file.buffer, req.file.mimetype);

      // Save metadata to MongoDB
      const aiFile = new AIFile({
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        driveId: file.id,
        driveUrl: file.webViewLink,
        extractedContent,
        uploadedBy,
      });
      await aiFile.save();
      console.log("AI File metadata saved to MongoDB");
    }

    res.json({
      id: file.id,
      name: file.name,
      webViewLink: file.webViewLink,
      webContentLink: file.webContentLink,
      size: req.file.size,
      thumbnailLink: file.thumbnailLink,
      extractedContent, // Return extracted content for UI usage
    });
  } catch (error) {
    console.error("File upload failed:", error?.message || error);
    res.status(500).json({ error: error?.message || "Upload failed." });
  }
});

router.use((err, _req, res, next) => {
  if (!err) return next();
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      const maxMb = Math.round(maxUploadBytes / (1024 * 1024));
      return res.status(413).json({ error: `File too large. Max ${maxMb}MB.` });
    }
    return res.status(400).json({ error: err.message || "Upload failed." });
  }
  return next(err);
});

router.post("/ai-process", async (req, res) => {
  try {
    const { fileId, action, instruction } = req.body;

    if (!fileId || !action) {
      return res.status(400).json({ error: "fileId and action are required." });
    }
    req.auditTargetId = fileId;

    // 1. Get file metadata/content from MongoDB
    const aiFile = await AIFile.findOne({ driveId: fileId });
    if (!aiFile) {
      return res.status(404).json({ error: "File not found or not processed for AI." });
    }

    const extractedText = aiFile.extractedContent;
    if (!extractedText) {
      return res.status(400).json({ error: "No text found in file to process." });
    }

    // 2. Prepare Master Prompt
    const masterPrompt = `If the document is already good, still enhance it slightly instead of repeating it.
You are an expert content editor and communication specialist.

Your task is to carefully read the uploaded document and transform it based on the user's selected action and instruction.

STRICT RULES:
- Always read and use the FULL document content
- Preserve the original meaning
- Improve clarity, structure, and language quality
- Make the content professional and submission-ready
- Do NOT explain what you are doing
- Do NOT add meta comments
- Output ONLY the final processed content

USER ACTION:
{{ACTION}}

USER INSTRUCTION (optional):
{{USER_INSTRUCTION}}

DOCUMENT CONTENT:
{{FILE_TEXT}}`;

    const finalPrompt = masterPrompt
      .replace("{{ACTION}}", action)
      .replace("{{USER_INSTRUCTION}}", instruction || "None")
      .replace("{{FILE_TEXT}}", extractedText);

    console.log(`Processing AI request for action: ${action}`);

    // 3. Generate content via Ollama
    const processedContent = await generateAIContent(finalPrompt);

    res.json({
      originalName: aiFile.originalName,
      action,
      processedContent
    });

  } catch (error) {
    console.error("AI processing failed:", error?.message || error);
    res.status(500).json({ error: error?.message || "AI processing failed." });
  }
});

router.post("/metadata", async (req, res) => {
  try {
    const fileId = req.body?.fileId;
    if (!fileId) {
      return res.status(400).json({ error: "File id is required." });
    }
    const drive = getDriveClient();
    const response = await drive.files.get({
      fileId,
      fields: "id,size,thumbnailLink",
    });
    const sizeValue = response?.data?.size ? Number(response.data.size) : undefined;
    res.json({
      id: response?.data?.id,
      size: Number.isNaN(sizeValue) ? undefined : sizeValue,
      thumbnailLink: response?.data?.thumbnailLink,
    });
  } catch (error) {
    console.error("Drive metadata lookup failed:", error?.message || error);
    res.status(500).json({ error: "Failed to load file metadata." });
  }
});

export default router;
