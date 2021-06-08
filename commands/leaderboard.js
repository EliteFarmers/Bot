const Discord = require('discord.js');
const { DataHandler } = require('../database.js');

module.exports = {
    name: 'lb',
    aliases: ['leaderboard', 'lbs'],
    description: 'Get the farming weight leaderboard',
    usage: '[username] (profile name)',
    guildOnly: false,
    dmOnly: false,
    async execute(message, args) {
        let playerName = args[0] ?? null;

        const embed = new Discord.MessageEmbed()
            .setColor('#03fc7b')
            .setTitle(`Farming Weight Leaderboard`)
            .setDescription('More pages and searching coming soon')
            .setFooter('Created by Kaeso#5346    Run the weight command to update/add players');

        await DataHandler.getLeaderboard(playerName).then(leaderboard => {
            embed.fields = [];

            for (let i = 0; i < 10; i++) {
                if (leaderboard[i] === undefined) {
                    break;
                }
                const player = leaderboard[i].dataValues;
                embed.fields.push({
                    name: `#${i + 1} – ${player.ign.replace(/\_/g, '\\_')}`,
                    value: `[🔗](https://sky.shiiu.moe/stats/${player.uuid}) ${(player.weight / 100).toString().replace(/\B(?<!\.\d*)(?=(\d{3})+(?!\d))/g, ",")}`,
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

            message.channel.send(embed);
        });
        
    }
};

