import Sequelize from "sequelize";

export const sequelize = new Sequelize("tsdb", "postgres", "postgres", {
  host: "localhost",
  dialect: "postgres"
});