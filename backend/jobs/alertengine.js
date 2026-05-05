import cron from "node-cron";
import { Alert } from "../models/alert.js";
import { queryRange } from "../services/prometheus.js";

export function startAlertEngine() {
  cron.schedule("*/10 * * * * *", async () => {
    console.log("Checking alerts...");

    const alerts = await Alert.findAll();

    for (const alert of alerts) {
      try {
        const result = await queryRange(alert.query);

        if (!result.length) continue;

        const lastValue = parseFloat(
          result[0].values.slice(-1)[0][1]
        );

        if (lastValue > alert.threshold) {
          console.log(`🚨 ALERT TRIGGERED: ${alert.metric}`);

          // aqui você pode:
          // salvar log no banco
          // enviar email
          // websocket pro frontend
        }

      } catch (err) {
        console.error(err.message);
      }
    }
  });
}