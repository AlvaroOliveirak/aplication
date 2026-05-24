import db from './db.js';
import User from './post.js';

const Dashboard = db.sequelize.define('dashboards', {
  name: {
    type: db.Sequelize.STRING,
    allowNull: false
  },
  query: {
    type: db.Sequelize.TEXT,
    allowNull: false
  },
  metricId: {
    type: db.Sequelize.STRING,
    allowNull: false
  },
  chartType: {
    type: db.Sequelize.STRING,
    allowNull: false,
    defaultValue: 'line'
  },
  aggregation: {
    type: db.Sequelize.STRING,
    allowNull: false,
    defaultValue: 'none'
  }
});

User.hasMany(Dashboard, { foreignKey: { allowNull: true }, onDelete: 'CASCADE' });
Dashboard.belongsTo(User, { foreignKey: { allowNull: true } });

export default Dashboard;
