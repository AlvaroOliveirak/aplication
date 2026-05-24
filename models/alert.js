import db from './db.js';
import User from './post.js';

const Alert = db.sequelize.define('alerts', {
  metricId: {
    type: db.Sequelize.STRING,
    allowNull: false
  },
  metricName: {
    type: db.Sequelize.STRING,
    allowNull: false,
    defaultValue: 'Metrica'
  },
  query: {
    type: db.Sequelize.TEXT,
    allowNull: false
  },
  warningThreshold: {
    type: db.Sequelize.FLOAT,
    allowNull: false,
    defaultValue: 0
  },
  criticalThreshold: {
    type: db.Sequelize.FLOAT,
    allowNull: false,
    defaultValue: 0
  },
  threshold: {
    type: db.Sequelize.FLOAT,
    allowNull: false,
    defaultValue: 0
  },
  status: {
    type: db.Sequelize.STRING,
    allowNull: false,
    defaultValue: 'OK'
  },
  lastValue: {
    type: db.Sequelize.FLOAT,
    allowNull: false,
    defaultValue: 0
  },
  unit: {
    type: db.Sequelize.STRING,
    allowNull: false,
    defaultValue: '%'
  },
  anomalyEnabled: {
    type: db.Sequelize.BOOLEAN,
    allowNull: false,
    defaultValue: true
  },
  zScoreThreshold: {
    type: db.Sequelize.FLOAT,
    allowNull: false,
    defaultValue: 2.5
  }
});

User.hasMany(Alert, { foreignKey: { allowNull: true }, onDelete: 'CASCADE' });
Alert.belongsTo(User, { foreignKey: { allowNull: true } });

export default Alert;
