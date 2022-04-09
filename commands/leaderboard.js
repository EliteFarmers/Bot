const Discord = require('discord.js');
const { DataHandler } = require('../classes/database.js');

module.exports = {
    name: 'leaderboard',
    aliases: ['lb', 'lbs'],
    description: 'Get the farming weight leaderboard',
    usage: '(username)',
    guildOnly: false,
    dmOnly: false,
    async execute(interaction) {
        const options = interaction?.options?._hoistedOptions;

		const playerName = options[0]?.value ?? null;
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

        let embed = await DataHandler.getLeaderboardEmbed(givenIndex, playerName, true);

        if (leaderboardLength <= 10) {
            interaction.reply({ embeds: [embed] });
            return;
        }

        const row = new Discord.MessageActionRow()
            .addComponents(
                new Discord.MessageButton()
                    .setCustomId('first')
                    .setLabel('First')
                    .setStyle('PRIMARY')
                    .setDisabled(index < 10),
                new Discord.MessageButton()
                    .setCustomId('back')
                    .setLabel('Back')
                    .setStyle('PRIMARY')
                    .setDisabled(index < 10),
                new Discord.MessageButton()
                    .setCustomId('forward')
                    .setLabel('Next')
                    .setStyle('PRIMARY')
                    .setDisabled(index + 10 > maxIndex),
                new Discord.MessageButton()
                    .setCustomId('last')
                    .setLabel('Last')
                    .setStyle('PRIMARY')
                    .setDisabled(index + 10 > maxIndex),
            );

        let sentMessage = await interaction.reply({ embeds: [embed], components: [row] }).then(async () => {
            const reply = await interaction.fetchReply();
            const collector = reply.createMessageComponentCollector({ componentType: 'BUTTON', time: 30000 });
    
            collector.on('collect', async i => {
                if (i.user.id === interaction.user.id) {
                    collector.resetTimer({time: 15000});

                    if (i.customId === 'first') {
                        index = 0;
                    } else if (i.customId === 'back') {
                        if (index >= 10) {
                            index -= 10;
                        }
                    } else if (i.customId === 'forward') {
                        if (index < maxIndex) {
                            index += 10;
                        }
                    } else if (i.customId === 'last') {
                        if (index !== 990) {
                            index = maxIndex; 
                        }
                    }
    
                    embed = await DataHandler.getLeaderboardEmbed(index, playerName).then(embed => {
                        const newRow = new Discord.MessageActionRow()
                        .addComponents(
                            new Discord.MessageButton()
                                .setCustomId('first')
                                .setLabel('First')
                                .setStyle('PRIMARY')
                                .setDisabled(index < 10),
                            new Discord.MessageButton()
                                .setCustomId('back')
                                .setLabel('Back')
                                .setStyle('PRIMARY')
                                .setDisabled(index < 10),
                            new Discord.MessageButton()
                                .setCustomId('forward')
                                .setLabel('Next')
                                .setStyle('PRIMARY')
                                .setDisabled(index >= maxIndex),
                            new Discord.MessageButton()
                                .setCustomId('last')
                                .setLabel('Last')
                                .setStyle('PRIMARY')
                                .setDisabled(index >= maxIndex),
                        );
        
                        i.update({ embeds: [embed], components: [newRow] }).catch(error => { console.log(error) });;
                    });
                } else {
                    i.reply({ content: `These buttons aren't for you!`, ephemeral: true });
                }
            });
    
            collector.on('end', async collected => {
                await DataHandler.getLeaderboardEmbed(index, playerName).then(embed => { 
                    interaction.editReply({ embeds: [embed], components: [] })
                }).catch(error => {
                    console.log(error);
                })
            });
        });
    },
}

