import express from "express";
import { getDriveAuthUrl, saveDriveToken } from "../lib/drive.js";

const router = express.Router();

router.get("/auth-url", (_req, res) => {
  try {
    const url = getDriveAuthUrl();
    res.json({ url });
  } catch (error) {
    res.status(500).json({ error: "Failed to generate auth URL." });
  }
});

router.get("/callback", async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) {
      return res.status(400).json({ error: "Missing code." });
    }
    await saveDriveToken(String(code));
    res.send("Drive connected. You can close this tab.");
  } catch (error) {
    res.status(500).json({ error: "Failed to save Drive token." });
  }
});

export default router;
