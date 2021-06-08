const Discord = require('discord.js');
const Sequelize = require('sequelize');
const { dbUri, prefix } = require('./config.json');
const throttledQueue = require('throttled-queue');
const throttle = throttledQueue(1, 60000);

const sequelize = new Sequelize(dbUri, {
    dialect: 'postgres',
    logging: false,
});

const Prefixes = sequelize.define('prefixes', {
    guild: {
        type: Sequelize.STRING,
        unique: true,
    },
    prefix: {
        type: Sequelize.STRING,
        defaultValue: prefix,
        allowNull: false,
    }
});

const Users = sequelize.define('users', {
    uuid: {
        type: Sequelize.STRING,
        unique: true
    },
    ign: {
        type: Sequelize.STRING
    },
    rank: {
        type: Sequelize.INTEGER,
        defaultValue: 0
    },
    weight: {
        type: Sequelize.INTEGER
    }
}, {
    indexes: [
        {
            name: "weight_index",
            using: 'BTREE',
            fields: ['weight']
        }
    ]
});

class DataHandler {

    constructor() {

    }

    static syncTables() {
        Prefixes.sync();
        Users.sync();

        //For wiping table
        //Prefixes.sync({ force: true })
    }

    //Validation should occur before calling
    static async setPrefix(message, guildId, newPrefix) {
        try {
            const prefix = await this.getPrefix(guildId);
            if (prefix) {
                let updatedPrefix = await Prefixes.update({ prefix: newPrefix }, { where: { guild: guildId } });
                return message.reply(`The prefix for this server has been set to \"${newPrefix}\"`);
            } else {
                const newerPrefix = await Prefixes.create({
                    guild: guildId,
                    prefix: newPrefix,
                });
                return message.reply(`The prefix for this server has been changed to \"${newPrefix}\"`);
            }
        } catch (e) {
            if (e.name === 'SequelizeUniqueConstraintError') {
                return message.reply('That prefix already exists.');
            }
            console.log(e);
            return message.reply('Something went wrong with changing that prefix.');
        }
    }

    static async getPrefix(guildId) {
        return await Prefixes.findOne({ where: { guild: guildId } });
    }

    static async getPlayer(playeruuid) {
        return await Users.findOne({ where: { uuid: playeruuid }});
    }

    static async updatePlayer(playeruuid, playerName, nWeight) {
        let newWeight = Math.round(nWeight * 100);
        if (newWeight < 500) {
            return;
        }

        try {
            const user = await this.getPlayer(playeruuid);
            if (user) {
                if (user.dataValues.weight > newWeight) {
                    return;
                }
                let updatedUser = await Users.update({ weight: newWeight }, { where: { uuid: playeruuid } });
            } else {
                const newerUser = await Users.create({
                    uuid: playeruuid,
                    ign: playerName,
                    weight: newWeight,
                });
            }
        } catch (e) {
            console.log(e);
        }
    }

    static async updateLeaderboard() {
        throttle(async function () {
            let leaderboard = await getLeaderboard();

            for (let i = 0; i < leaderboard.length; i++) {
                const player = leaderboard[i];
                Users.update({ rank: i + 1 }, { where: { uuid: player.uuid } });
            }
        })
    }

    static async getLeaderboard(player = null) {
        // if (player !== null) {
        //     await this.updateLeaderboard()
        // }
        return await Users.findAll({ limit: 10, order: [['weight', 'DESC']] })
    }

}

module.exports = {
    DataHandler
}

// new Sequelize(database, username, password, {
//     host: 'localhost',
//     dialect: 'sqlite',
//     logging: false,
// });


