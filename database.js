const Discord = require('discord.js');
const { Sequelize, Op } = require('sequelize');
const { dbUri } = require('./config.json');
const fetch = require('node-fetch');
const throttledQueue = require('throttled-queue');
const throttle = throttledQueue(1, 60000);

const sequelize = new Sequelize(dbUri, {
    dialect: 'postgres',
    logging: false,
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
    tableName: 'users',
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

    static async syncTables() {
        await Users.sync();

        this.updateLeaderboard();
        //For wiping table
        //Users.sync({ force: true })
    }

    static leaderboard;

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
                if (user.dataValues.weight > newWeight && user.dataValues.profile !== profileuuid) {
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

    static async getLeaderboardEmbed(from = 0, playerName = null, firstCall = false) {
        let startIndex = from;
        let foundPlayer = false;
        const leaderboard = this.leaderboard;

        const embed = new Discord.MessageEmbed()
            .setColor('#03fc7b')
            .setTitle(`Farming Weight Leaderboard`)
            .setDescription('**Note:** Not many players are currently on the leaderboard.')
            .setFooter('Created by Kaeso#5346    Run the weight command to update/add players');

        if (playerName !== null) {
            const user = await this.getPlayerByName(playerName).catch(() => { return undefined; });

            if (user) {
                foundPlayer = true;
                startIndex = (firstCall) ? user.dataValues.rank - 1 : startIndex;
                const weightFormatted = (user.dataValues.weight / 100).toString().replace(/\B(?<!\.\d*)(?=(\d{3})+(?!\d))/g, ",");
                embed.setDescription(`**${user.dataValues.ign}** is rank **#${user.dataValues.rank}** with **${weightFormatted}** weight`)
            } else {
                startIndex = 0;
            }
        }

        const maxIndex = Math.floor((leaderboard.length - 1) / 10) * 10;

        startIndex = Math.floor(startIndex / 10) * 10;
        if (startIndex > maxIndex) {
            startIndex = maxIndex;
        }

        let topMessage = '';
        
        for (let i = startIndex; i < startIndex + 10; i++) {
            if (leaderboard[i] === undefined) {
                break;
            }
            const player = leaderboard[i].dataValues;

            const isHighlightedPlayer = (foundPlayer && (playerName.toLowerCase() === player.ign.toLowerCase()));
            const weightFormatted = (player.weight / 100).toString().replace(/\B(?<!\.\d*)(?=(\d{3})+(?!\d))/g, ",");

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

        return embed;
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


