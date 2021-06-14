const Discord = require('discord.js');
const { Sequelize, Op } = require('sequelize');
const { dbUri, prefix } = require('./config.json');
const fetch = require('node-fetch');
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
    profile: {
        type: Sequelize.STRING
    },
    weight: {
        type: Sequelize.INTEGER
    }
}, {
    freezeTableName: true,
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

        this.updateLeaderboard();
        //For wiping table
        //Prefixes.sync({ force: true })
    }

    static leaderboard;

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

    static async getPlayerByName(name) {
        return await Users.findOne({ where: { ign: { [Op.iLike]: '%' + name } } });
    }

    static async updatePlayer(playeruuid, playerName, profileuuid, nWeight) {
        let newWeight = Math.round(nWeight * 100);

        try {
            const user = await this.getPlayer(playeruuid);
            if (user) {
                if (user.dataValues.weight > nWeight && user.dataValues.profile !== profileuuid) {
                    return;
                }
                let updatedUser = await Users.update({ weight: newWeight, name: playerName, profile: profileuuid }, { where: { uuid: playeruuid } });
            } else {
                const newerUser = await Users.create({
                    uuid: playeruuid,
                    ign: playerName,
                    profile: profileuuid,
                    weight: newWeight,
                });
            }
        } catch (e) {
            console.log(e);
        }
    }

    static getLbLength() {
        return this.leaderboardLength;
    }

    static async updateLeaderboard() {
        return await this.getLeaderboard().then(leaderboard => {
            this.leaderboard = leaderboard;
            for (let i = 0; i < leaderboard.length; i++) {
                const player = leaderboard[i];
                Users.update({ rank: i + 1 }, { where: { uuid: player.uuid } });
            }
        });
    }

    static async getLeaderboard() {
        return await Users.findAll({ limit: 1000, order: [['weight', 'DESC']] })
    }

    static async sendLeaderboard(message, from = 0, playerName = null) {
        let startIndex = from;
        let foundPlayer = false;
        const leaderboard = this.leaderboard;

        if (playerName !== null) {
            const user = await this.getPlayerByName(playerName).catch(() => { return undefined; });

            if (user) {
                foundPlayer = true;
                startIndex = user.dataValues.rank - 1;
            } else {
                startIndex = 0;
            }
        }

        const embed = new Discord.MessageEmbed()
            .setColor('#03fc7b')
            .setTitle(`Farming Weight Leaderboard`)
            .setFooter('Created by Kaeso#5346    Run the weight command to update/add players');
        
        const maxIndex = Math.floor((leaderboard.length - 1) / 10) * 10;

        startIndex = Math.floor(startIndex / 10) * 10;
        if (startIndex > maxIndex) {
            startIndex = maxIndex;
        }
        
        for (let i = startIndex; i < startIndex + 10; i++) {
            if (leaderboard[i] === undefined) {
                break;
            }
            const player = leaderboard[i].dataValues;

            const isHighlightedPlayer = (foundPlayer && (playerName.toLowerCase() === player.ign.toLowerCase()));
            const weightFormatted = (player.weight / 100).toString().replace(/\B(?<!\.\d*)(?=(\d{3})+(?!\d))/g, ",");

            if (isHighlightedPlayer) {
                embed.setDescription(`**${player.ign}** is rank **#${i + 1}** with **${weightFormatted}** weight`);
            }
               
            embed.fields.push({
                name: `#${i + 1} – ${player.ign.replace(/\_/g, '\\_')}`,
                value: `[🔗](https://sky.shiiyu.moe/stats/${player.uuid}) ${weightFormatted} ${(isHighlightedPlayer) ? '⭐' : ' '}`,
                inline: true
            });

            if (i % 2 == 1) {
                embed.fields.push({
                    name: "⠀",
                    value: "⠀",
                    inline: true
                });
            }
        }

        return (message.author.bot) ? message.edit(embed) : message.channel.send(embed);
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


