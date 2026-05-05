import { sequelize } from "./index.js";
import { DataTypes } from "sequelize";

export const Alert = sequelize.define("alert", {
  metric: DataTypes.STRING,
  query: DataTypes.TEXT,
  threshold: DataTypes.FLOAT
});