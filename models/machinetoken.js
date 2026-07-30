import db from './db.js';
import User from './post.js';

const MachineToken = db.sequelize.define('machine_tokens', {
    token: {
        type: db.Sequelize.STRING,
        allowNull: false,
        unique: true
    },

    used: {
        type: db.Sequelize.BOOLEAN,
        defaultValue: false
    }
});

User.hasMany(MachineToken, {
    foreignKey: {
        allowNull: false
    },
    onDelete: 'CASCADE'
});

MachineToken.belongsTo(User);

export default MachineToken;