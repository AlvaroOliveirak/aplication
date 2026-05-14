import { sequelize } from "./index.js";
import { DataTypes } from "sequelize";

export const Alert = sequelize.define("alert", {
  metricId: DataTypes.STRING,
  metricName: DataTypes.STRING,
  query: DataTypes.TEXT,
  threshold: DataTypes.FLOAT,
  color: DataTypes.STRING,
  status: DataTypes.STRING,
  lastValue: DataTypes.FLOAT,
  unit: DataTypes.STRING
});