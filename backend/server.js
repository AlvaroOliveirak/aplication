import express from "express";
import cors from "cors";

import { sequelize } from "./models/index.js";

import queryRoutes from "./routes/query.js";
import dashboardRoutes from "./routes/dashboard.js";
import alertRoutes from "./routes/alert.js";

import { startAlertEngine } from "./jobs/alertEngine.js";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/query", queryRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/alert", alertRoutes);

async function start() {
  await sequelize.sync();

  startAlertEngine();

  app.listen(3000, () => {
    console.log("🚀 Server rodando na porta 3000");
  });
}

start();