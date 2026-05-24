import db from './db.js';
import User from './post.js';
import Alert from './alert.js';

const AlertLog = db.sequelize.define('alert_logs', {
  metricId: {
    type: db.Sequelize.STRING,
    allowNull: false
  },
  metricName: {
    type: db.Sequelize.STRING,
    allowNull: false
  },
  query: {
    type: db.Sequelize.TEXT,
    allowNull: false
  },
  warningThreshold: {
    type: db.Sequelize.FLOAT,
    allowNull: false
  },
  criticalThreshold: {
    type: db.Sequelize.FLOAT,
    allowNull: false
  },
  threshold: {
    type: db.Sequelize.FLOAT,
    allowNull: false
  },
  value: {
    type: db.Sequelize.FLOAT,
    allowNull: false
  },
  zScore: {
    type: db.Sequelize.FLOAT,
    allowNull: true
  },
  movingAverage: {
    type: db.Sequelize.FLOAT,
    allowNull: true
  },
  trend: {
    type: db.Sequelize.FLOAT,
    allowNull: true
  },
  status: {
    type: db.Sequelize.STRING,
    allowNull: false
  },
  unit: {
    type: db.Sequelize.STRING,
    allowNull: false,
    defaultValue: '%'
  },
  report: {
    type: db.Sequelize.TEXT,
    allowNull: true
  }
});

User.hasMany(AlertLog, { foreignKey: { allowNull: true }, onDelete: 'CASCADE' });
AlertLog.belongsTo(User, { foreignKey: { allowNull: true } });
Alert.hasMany(AlertLog, { foreignKey: { allowNull: true }, onDelete: 'CASCADE' });
AlertLog.belongsTo(Alert, { foreignKey: { allowNull: true } });

export default AlertLog;
