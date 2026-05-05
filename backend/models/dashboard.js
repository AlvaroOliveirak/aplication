import { sequelize } from "./index.js";
import { DataTypes } from "sequelize";

export const Dashboard = sequelize.define("dashboard", {
  name: DataTypes.STRING,
  query: DataTypes.TEXT
});