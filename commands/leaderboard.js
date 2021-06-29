const Discord = require('discord.js');
const { DataHandler } = require('../database.js');

module.exports = {
    name: 'lb',
    aliases: ['leaderboard', 'lbs'],
    description: 'Get the farming weight leaderboard',
    usage: '(username)',
    guildOnly: false,
    dmOnly: false,
    async execute(message, args) {
        let playerName = args[0] ?? null;
        let givenIndex = 0;

        if (playerName !== null) {
            const user = await DataHandler.getPlayerByName(playerName).then(player => {
                if (player) {
                    givenIndex = player.dataValues.rank ?? 0;
                }
            });
        }

        const leaderboardLength = await DataHandler.getLeaderboard().then(lb => { return lb.length; });
        let index = Math.floor(givenIndex / 10) * 10;
        const maxIndex = Math.floor((leaderboardLength - 1) / 10) * 10;

        let embed = await DataHandler.getLeaderboardEmbed(givenIndex, playerName);

        if (leaderboardLength <= 10) {
            message.channel.send({ embeds: [embed] });
            return;
        }

        const row = new Discord.MessageActionRow()
            .addComponents(
                new Discord.MessageButton()
                    .setCustomID('first')
                    .setLabel('First')
                    .setStyle('PRIMARY')
                    .setDisabled(index < 10),
                new Discord.MessageButton()
                    .setCustomID('back')
                    .setLabel('Back')
                    .setStyle('PRIMARY')
                    .setDisabled(index < 10),
                new Discord.MessageButton()
                    .setCustomID('forward')
                    .setLabel('Next')
                    .setStyle('PRIMARY')
                    .setDisabled(index + 10 > maxIndex),
                new Discord.MessageButton()
                    .setCustomID('last')
                    .setLabel('Last')
                    .setStyle('PRIMARY')
                    .setDisabled(index + 10 > maxIndex),
            );

        let sentMessage = await message.channel.send({ embeds: [embed], components: [row] });

        const filter = i => {
            return ['first', 'back', 'forward', 'last'].includes(i.customID) && i.user.id === message.author.id;
        };

        const collector = sentMessage.createMessageComponentInteractionCollector(filter, { time: 60000 });

        collector.on('collect', async i => {
            if (i.customID === 'first') {
                index = 0;
                embed = await DataHandler.getLeaderboardEmbed(0);
            } else if (i.customID === 'back') {
                if (index >= 10) {
                    index -= 10;
                    embed = await DataHandler.getLeaderboardEmbed(index);
                }
            } else if (i.customID === 'forward') {
                if (index < maxIndex) {
                    index += 10;
                    embed = await DataHandler.getLeaderboardEmbed(index);
                }
            } else if (i.customID === 'last') {
                if (index !== 990) {
                    index = maxIndex;
                    embed = await DataHandler.getLeaderboardEmbed(index);
                }
            }

            const newRow = new Discord.MessageActionRow()
                .addComponents(
                    new Discord.MessageButton()
                        .setCustomID('first')
                        .setLabel('First')
                        .setStyle('PRIMARY')
                        .setDisabled(index < 10),
                    new Discord.MessageButton()
                        .setCustomID('back')
                        .setLabel('Back')
                        .setStyle('PRIMARY')
                        .setDisabled(index < 10),
                    new Discord.MessageButton()
                        .setCustomID('forward')
                        .setLabel('Next')
                        .setStyle('PRIMARY')
                        .setDisabled(index >= maxIndex),
                    new Discord.MessageButton()
                        .setCustomID('last')
                        .setLabel('Last')
                        .setStyle('PRIMARY')
                        .setDisabled(index >= maxIndex),
            );

            i.update({ embeds: [embed], components: [newRow] }).catch(() => { });;
        });
        
        collector.on('end', collected => {
            collector.stop();
            sentMessage.edit({ embeds: [embed], components: [] }).catch(() => { });
        })
    },
}

