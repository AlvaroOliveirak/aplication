import express from "express";
import { queryRange } from "../services/prometheus.js";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { query, range, start, end, comparePrevious } = req.body;

    const data = await queryRange(query, range, start, end, comparePrevious);

    res.json(data);
  } catch (err) {
    console.error("Erro na query:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;