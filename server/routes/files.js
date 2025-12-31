import express from "express";
import multer from "multer";
import { uploadToDrive } from "../lib/drive.js";

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: Number(process.env.UPLOAD_MAX_BYTES || 25 * 1024 * 1024),
  },
});

router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    console.log("File upload request received.");
    if (!req.file) {
      console.warn("Upload missing file payload.");
      return res.status(400).json({ error: "File is required." });
    }

    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID || "";
    const makePublic = process.env.DRIVE_PUBLIC !== "false";

    const file = await uploadToDrive({
      buffer: req.file.buffer,
      filename: req.file.originalname,
      mimeType: req.file.mimetype,
      folderId,
      makePublic,
    });

    console.log("Drive upload success:", file?.id);
    res.json({
      id: file.id,
      name: file.name,
      webViewLink: file.webViewLink,
      webContentLink: file.webContentLink,
    });
  } catch (error) {
    console.error("File upload failed:", error?.message || error);
    res.status(500).json({ error: error?.message || "Upload failed." });
  }
});

export default router;
