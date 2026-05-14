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

        let status = "OK";
        if (lastValue >= alert.threshold) {
          status = "WARNING";
        }
        if (lastValue >= alert.threshold * 1.2) { // Example: critical if 20% above threshold
          status = "CRITICAL";
        }

        await Alert.update({
          status,
          lastValue
        }, {
          where: { id: alert.id }
        });

        if (status !== "OK") {
          console.log(`🚨 ALERT TRIGGERED: ${alert.metricName} - ${status} (${lastValue})`);
        }

      } catch (err) {
        console.error(err.message);
      }
    }
  });
}