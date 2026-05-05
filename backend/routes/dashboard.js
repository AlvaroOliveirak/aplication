import express from "express";
import { Dashboard } from "../models/dashboard.js";

const router = express.Router();

router.post("/", async (req, res) => {
  const dash = await Dashboard.create(req.body);
  res.json(dash);
});

router.get("/", async (req, res) => {
  const dashboards = await Dashboard.findAll();
  res.json(dashboards);
});

export default router;