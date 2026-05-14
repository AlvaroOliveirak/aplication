import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from 'url';

import { sequelize } from "./models/index.js";

import queryRoutes from "./routes/query.js";
import dashboardRoutes from "./routes/dashboard.js";
import alertRoutes from "./routes/alert.js";

import { startAlertEngine } from "./jobs/alertengine.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));
app.use(express.static(path.join(__dirname, "../views")));

app.use("/api/query", queryRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/alert", alertRoutes);

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../views/layouts/dashboard.handlebars"), {
    headers: { 'Content-Type': 'text/html' }
  });
});

app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "../views/layouts/dashboard.handlebars"), {
    headers: { 'Content-Type': 'text/html' }
  });
});

async function start() {
  await sequelize.sync();

  startAlertEngine();

  app.listen(3001, () => {
    console.log("🚀 Server rodando na porta 3001");
  });
}

start();