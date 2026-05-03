import Sequelize from 'sequelize';

const sequelize = new Sequelize('userdb', 'postgres', 'alvarooliver18', {
  host: 'postgres',
  dialect: 'postgres'
});

export default { Sequelize, sequelize };