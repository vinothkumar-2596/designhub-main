import express from "express";
import Activity from "../models/Activity.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || "50", 10), 200);
    const activity = await Activity.find().sort({ createdAt: -1 }).limit(limit);
    res.json(activity);
  } catch (error) {
    res.status(500).json({ error: "Failed to load activity." });
  }
});

export default router;
