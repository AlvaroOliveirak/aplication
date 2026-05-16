import express from "express";
import { Alert } from "../models/alert.js";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const threshold = Number(req.body.threshold);

    if (!Number.isFinite(threshold)) {
      return res.status(400).json({ error: "Threshold invalido" });
    }

    const metricId = req.body.metricId || req.body.query;
    const defaults = {
      metricId,
      metricName: req.body.metricName,
      query: req.body.query,
      threshold,
      unit: req.body.unit || "%",
      status: "OK",
      lastValue: 0
    };

    const existing = await Alert.findOne({ where: { query: req.body.query } })
      || await Alert.findOne({ where: { metricId } });

    if (existing) {
      await existing.update(defaults);
      return res.json(existing);
    }

    const alert = await Alert.create(defaults);
    res.json(alert);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/", async (req, res) => {
  const alerts = await Alert.findAll();
  res.json(alerts);
});

router.delete("/:id", async (req, res) => {
  await Alert.destroy({ where: { id: req.params.id } });
  res.json({ success: true });
});

export default router;
