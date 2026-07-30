import db from './db.js';
import User from './post.js';

const Machine = db.sequelize.define('machines', {
    uuid: {
        type: db.Sequelize.STRING,
        allowNull: false,
        unique: true
    },

    hostname: {
        type: db.Sequelize.STRING,
        allowNull: false
    },

    os: {
        type: db.Sequelize.STRING,
        allowNull: false
    },

    status: {
        type: db.Sequelize.STRING,
        allowNull: false,
        defaultValue: 'OFFLINE'
    },

    lastSeen: {
        type: db.Sequelize.DATE,
        allowNull: true
    }
});

User.hasMany(Machine, {
    foreignKey: { allowNull: false },
    onDelete: 'CASCADE'
});

Machine.belongsTo(User);

export default Machine;