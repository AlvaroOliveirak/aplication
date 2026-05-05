import express from "express";
import { queryRange } from "../services/prometheus.js";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { query } = req.body;

    const data = await queryRange(query);

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;