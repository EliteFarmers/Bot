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
        let givenIndex = 0;

        if (playerName !== null) {
            const user = await DataHandler.getPlayerByName(playerName).then(player => {
                givenIndex = player.dataValues.rank ?? 0;
            });
        }

        const maxIndex = Math.floor((DataHandler.leaderboard.length - 1) / 10) * 10;

        await DataHandler.sendLeaderboard(message, givenIndex, playerName).then(sentEmbed => {

            let index = Math.floor(givenIndex / 10) * 10;

            const filter = (reaction, user) => {
                return ['⏮️', '⏪', '⏩', '⏭️'].includes(reaction.emoji.name) && user.id === message.author.id;
            };

            sentEmbed.react('⏮️')
                .then(() => sentEmbed.react('⏪'))
                .then(() => sentEmbed.react('⏩'))
                .then(() => sentEmbed.react('⏭️'))
                .then(() => {
                    const collector = sentEmbed.createReactionCollector(filter, { time: 60000 })

                    collector.on('collect', (reaction, user) => {
                        if (reaction.emoji.name === '⏮️') {
                            index = 0;
                            DataHandler.sendLeaderboard(sentEmbed, 0);
                        } else if (reaction.emoji.name === '⏪') {
                            if (index >= 10) {
                                index -= 10;
                                DataHandler.sendLeaderboard(sentEmbed, index);
                            }
                        } else if (reaction.emoji.name === '⏩') {
                            if (index < maxIndex) {
                                index += 10;
                                DataHandler.sendLeaderboard(sentEmbed, index);
                            }
                        } else if (reaction.emoji.name === '⏭️') {
                            if (index !== 990) {
                                index = Math.floor((DataHandler.leaderboard.length - 1)/ 10) * 10;
                                DataHandler.sendLeaderboard(sentEmbed, 990);
                            }
                        }
                        reaction.users.remove(user.id).catch(() => { });
                    });
                    
                    collector.on('end', collected => {
                        collector.stop();
                        sentEmbed.reactions.removeAll();
                    }
                    )
                })
                .catch(() => message.channel.send('I don\'t have permissions to add reactions! Check both role and channel permissions.'));
        });
    },
}

