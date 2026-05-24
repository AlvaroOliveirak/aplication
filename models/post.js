import db from './db.js';
import bcrypt from 'bcryptjs';

function isBcryptHash(value) {
    return typeof value === 'string' && /^\$2[aby]\$\d{2}\$/.test(value);
}

const Post = db.sequelize.define('users', {
    email: {
        type: db.Sequelize.STRING,
        allowNull: false,
        unique: true
    },
    password: {
        type: db.Sequelize.STRING,
        allowNull: true
    },
    googleId: {
        type: db.Sequelize.STRING,
        allowNull: true,
        unique: true
    },
    name: {
        type: db.Sequelize.STRING,
        allowNull: true
    },
    authProvider: {
        type: db.Sequelize.STRING,
        allowNull: false,
        defaultValue: 'local'
    },
    theme: {
        type: db.Sequelize.STRING,
        allowNull: false,
        defaultValue: 'dark'
    }
}, {
    hooks: {
        beforeSave: async (post) => {
            if (!post.changed('password') || isBcryptHash(post.password)) {
                return;
            }

            post.password = await bcrypt.hash(post.password, 10);
        }
    }
});

export default Post;
