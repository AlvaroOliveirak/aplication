import express from "express";
import { Alert } from "../models/alert.js";

const router = express.Router();

router.post("/", async (req, res) => {
  const alert = await Alert.create(req.body);
  res.json(alert);
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