import Discord from 'discord.js';
import { Sequelize, Op } from 'sequelize';
import { dbUri } from '../config.json';
import throttledQueue from 'throttled-queue';
import { CropString } from './Data';

const throttle = throttledQueue(1, 60000);

const Users = require('../database/models/users.js')(new Sequelize(dbUri, {
    dialect: 'postgres',
    logging: false,
}), Sequelize);

const Servers = require('../database/models/servers.js')(new Sequelize(dbUri, {
    dialect: 'postgres',
    logging: false,
}), Sequelize);

export default class DataHandler {

    private constructor() { }

    static async syncTables() {
        await Users.sync();
        await Servers.sync();

        this.updateLeaderboard();
        //For wiping table
        //Users.sync({ force: true })
    }

    static leaderboard: any;

    static async getPlayer(playeruuid?: string, where: any = null) {
        if (!where) { where = { uuid: playeruuid }; }
        return await Users.findOne({ where: where });
    }

    static async getPlayerByName(name: string) {
        return await Users.findOne({ where: { ign: { [Op.iLike]: '%' + name } } });
    }

    static async update(changes: any, where: any) {
        const user = await Users.findOne({ where: where });
        if (user) {
            return await Users.update(changes, { where: where });
        }
    }

    static async updatePlayer(playeruuid: string, playerName: string, profileuuid: string, nWeight: number) {
        let newWeight = Math.round(nWeight * 100);
        if (typeof newWeight !== typeof 1) { return; }

        try {
            const user = await this.getPlayer(playeruuid);
            if (user) {
                if (user.dataValues.weight > newWeight && user.dataValues.profile !== profileuuid) {
                    if (!user.dataValues.profile) {
                        let updatedUser = await Users.update({ name: playerName, profile: profileuuid, updatedat: Date.now().toString() }, { where: { uuid: playeruuid } });
                    }
                    return;
                }
                let updatedUser = await Users.update({ weight: newWeight, name: playerName, profile: profileuuid, updatedat: Date.now().toString() }, { where: { uuid: playeruuid } });
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
        return this.leaderboard.length;
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
        return await Users.findAll({ limit: 1000, order: [['weight', 'DESC']], where: { cheating: false } });
    }

    static async getJacobLB(crop: CropString) {
        const lb = await Users.findAll({ limit: 1000, order: [[[Sequelize.json(`contestdata.scores.${crop}`), `${crop}`], 'DESC']] });
        return lb;
    }

    static async getServer(guild: string, where: any = null) {
        if (!where) { where = { guildid: guild }; }
        const server = await Servers.findOne({ where: where });
        return (server) ? server : await this.createServer(guild, true);
    }

    static async createServer(guildid: string, skipfind = false) {
        try {
            const server = (skipfind) ? undefined : await this.getServer(guildid);
            if (!server) { 
                await Servers.create({ guildid: guildid });
                return await Servers.findOne({ where: { guildid: guildid } }) ?? undefined;
            }
            return undefined;
        } catch (e) {
            console.log(e);
            return undefined;
        }
    }

    static async updateServer(changes: any, guildid: string) {
        const server = await Servers.findOne({ where: { guildid: guildid } });
        if (server) {
            return await Servers.update(changes, { where: { guildid: guildid } });
        }
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

            const isHighlightedPlayer = (foundPlayer && ((playerName ?? '').toLowerCase() === player.ign.toLowerCase()));
            const weightFormatted = (player.weight / 100).toString().replace(/\B(?<!\.\d*)(?=(\d{3})+(?!\d))/g, ",");

            embed.fields.push({
                name: `#${i + 1} – ${player.ign ? player.ign.replace(/\_/g, '\\_') : 'N/A'}`,
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