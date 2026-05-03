import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const grafana = axios.create({
  baseURL: process.env.GRAFANA_URL,
  headers: {
    Authorization: `Bearer ${process.env.GRAFANA_TOKEN}`,
    "Content-Type": "application/json"
  }
});

export async function createDashboard(data) {
  const {
    title,
    metric,
    chartType,
    refresh
  } = data;

  const payload = {
    dashboard: {
      title,
      refresh,
      schemaVersion: 39,
      version: 0,
      panels: [
        {
          id: 1,
          type: chartType,
          title: title,
          datasource: {
            type: "prometheus",
            uid: "prometheus"
          },
          targets: [
            {
              refId: "A",
              expr: metric
            }
          ],
          gridPos: {
            x: 0,
            y: 0,
            w: 24,
            h: 10
          }
        }
      ]
    },
    overwrite: true
  };

  const result = await grafana.post("/api/dashboards/db", payload);
  return result.data;
}