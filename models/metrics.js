import db from './db.js';
import Machine from './machine.js';

const Metric = db.sequelize.define('metrics', {
    cpu: {
        type: db.Sequelize.FLOAT,
        allowNull: false
    },

    ram: {
        type: db.Sequelize.FLOAT,
        allowNull: false
    },

    disk: {
        type: db.Sequelize.FLOAT,
        allowNull: false
    },

    networkRx: {
        type: db.Sequelize.BIGINT,
        allowNull: false,
        defaultValue: 0
    },

    networkTx: {
        type: db.Sequelize.BIGINT,
        allowNull: false,
        defaultValue: 0
    }
});

Machine.hasMany(Metric, {
    foreignKey: {
        allowNull: false
    },
    onDelete: 'CASCADE'
});

Metric.belongsTo(Machine);

export default Metric;