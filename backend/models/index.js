import Sequelize from "sequelize";

export const sequelize = new Sequelize("userdb", "postgres", "alvarooliver18", {
  host: "localhost",
  dialect: "postgres",
  port: 5433
});