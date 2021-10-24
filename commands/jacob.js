const Discord = require('discord.js');
const { DataFormatter } = require('../data.js');
const { DataHandler } = require('../database.js');

module.exports = {
    name: 'jacob',
    aliases: ['jlb', 'jlbs'],
    description: 'Get jacob\'s high scores or leaderboard!',
    usage: '(username)',
    guildOnly: false,
    dmOnly: false,
    async execute(interaction) {
        const options = interaction?.options?._hoistedOptions;

        let playerName = undefined;
		let profileName = undefined;

		for (let i = 0; i < Object.keys(options).length; i++) {
			let option = options[Object.keys(options)[i]];
			if (option.name === 'player') {
				playerName = option.value.trim();
			} else if (option.name === 'profile') {
				profileName = option.value.trim();
			}
		}

        await interaction.deferReply();

        let user = null;
        if (!playerName) {
			user = await DataHandler.getPlayer(null, { discordid: interaction.user.id });
			if (!user || !user.dataValues?.ign) {
				const embed = new Discord.MessageEmbed()
					.setColor('#03fc7b')
					.setTitle('Error: Specify a Username!')
					.addField('Proper Usage:', '`/jacobs` `player:`(player name)')
					.setDescription('Checking for yourself?\nYou must use \`/verify\` \`player:\`(account name) before using this shortcut!')
					.setFooter('Created by Kaeso#5346');
				interaction.editReply({ embeds: [embed] });
                return;
			}
		}

        const embed = await getHighScoreEmbed(playerName, user);
        if (!embed) { return; }

        let reply;

        if (profileName) {
            const row = new Discord.MessageActionRow().addComponents(
                new Discord.MessageButton()
                    .setCustomId('overall')
                    .setLabel('Overall Stats')
                    .setStyle('SUCCESS'),
                new Discord.MessageButton()
                    .setLabel('SkyCrypt')
                    .setStyle('LINK')
                    .setURL(`https://sky.shiiyu.moe/stats/${playerName}/${profileName}`)
            );

            reply = {
                embeds: [embed],
                components: [row],
                allowedMentions: { repliedUser: false }
            }
        } else {
            const row = new Discord.MessageActionRow().addComponents(
                new Discord.MessageButton()
                    .setCustomId('overall')
                    .setLabel('Overall Stats')
                    .setStyle('SUCCESS')
                    .setDisabled(true),
                new Discord.MessageButton()
                    .setCustomId('crops')
                    .setLabel('All Crops')
                    .setStyle('PRIMARY')
            );

            reply = {
                components: [row],
                embeds: [embed],
                allowedMentions: { repliedUser: false }
            }
        }

        interaction.editReply(reply).then(async () => {
            const reply = await interaction.fetchReply();
            const collector = reply.createMessageComponentCollector({ componentType: 'BUTTON', time: 30000 });
    
            collector.on('collect', async i => {
                if (i.user.id === interaction.user.id) {
                    collector.resetTimer({time: 30000});

                    if (i.customId === 'overall') {
                        const newRow = new Discord.MessageActionRow().addComponents(
                            new Discord.MessageButton()
                                .setCustomId('overall')
                                .setLabel('Overall Stats')
                                .setStyle('SUCCESS')
                                .setDisabled(true),
                            new Discord.MessageButton()
                                .setCustomId('crops')
                                .setLabel('All Crops')
                                .setStyle('PRIMARY')
                            );
                        profileName = undefined;
                        i.update({ embeds: [await getHighScoreEmbed(playerName, user)], components: [newRow] }).catch(error => { console.log(error); collector.stop(); });;
                    } else if (i.customId === 'crops') {
                        const newRow = new Discord.MessageActionRow().addComponents(
                            new Discord.MessageButton()
                                .setCustomId('overall')
                                .setLabel('Overall Stats')
                                .setStyle('SUCCESS'),
                            new Discord.MessageButton()
                                .setCustomId('crops')
                                .setLabel('All Crops')
                                .setStyle('PRIMARY')
                                .setDisabled(true)
                            );
                        profileName = undefined;
                        i.update({ embeds: [await getHighScoreEmbed(playerName, user, true)], components: [newRow] }).catch(error => { console.log(error); collector.stop(); });;
                    } else if (i.customId === 'forward') {

                    } else if (i.customId === 'last') {

                    }
                } else {
                    i.reply({ content: `These buttons aren't for you!`, ephemeral: true });
                }
            });
    
            collector.on('end', async collected => {
                interaction.editReply({ components: [] })
            });
        });

        async function getHighScoreEmbed(name, player = null, allcrops = false) {
            const user = (player) ? player : await DataHandler.getPlayerByName(name);

            if (!user || !user.dataValues?.contestdata?.scores) {
                const embed = new Discord.MessageEmbed()
                    .setColor('#03fc7b')
                    .setTitle('Error: No Jacob\'s Data Found!')
                    .setDescription(`Try running \`/weight\` \`player: ${name}\` first!`)
                    .setFooter('Created by Kaeso#5346');
                interaction.editReply({ embeds: [embed] });
                return;
            }
            playerName = user.dataValues?.ign ?? playerName;

            const jacob = (!profileName) ? user.dataValues?.contestdata : getJacobData(user, profileName);
            const scores = jacob?.scores;

            const cMedals = jacob.currentmedals;
            const tMedals = jacob.totalmedals;

            const partic = (jacob.firstplace) 
            ? `Out of **${jacob.participations.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}** contests, **${user.dataValues?.ign ? user.dataValues?.ign.replace(/\_/g, '\\_') : 'N/A'}** has been 1st **${jacob.firstplace.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}** times!`
            : `**${user.dataValues?.ign ? user.dataValues?.ign.replace(/\_/g, '\\_') : 'N/A'}** has participated in **${jacob.participations.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}** contests!`;

            const embed = new Discord.MessageEmbed()
                .setColor('#03fc7b')
                .setTitle(`${!profileName || allcrops ? `Overall ` : ``}Jacob's High Scores for ${user.dataValues?.ign ? user.dataValues?.ign.replace(/\_/g, '\\_') : 'N/A'}${profileName ? ` on ${profileName}` : ``}`)
                .setFooter(`Note: Scores only valid after ${DataFormatter.getReadableDate(DataFormatter.CUTOFFDATE)}\nCreated by Kaeso#5346    Run the weight command to update a player!`)
                .setDescription(`
🥇 ${cMedals.gold} / **${tMedals.gold}** 🥈 ${cMedals.silver} / **${tMedals.silver}** 🥉 ${cMedals.bronze} / **${tMedals.bronze}**

${partic}
⠀  　
`);

            if (profileName || allcrops) {
                let addedIndex = 0;
                for (let i = 0; i < Object.keys(scores).length; i++) {
                    const crop = Object.keys(scores)[i];
                    if (!crop) { break; }

                    let details = (scores[crop].par) 
                    ? `\`#${(scores[crop].pos + 1).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}\` of \`${scores[crop].par.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}\` ${!profileName ? ` on \`${scores[crop].profilename}\`!` : ` players!`}\n\`${DataFormatter.getReadableDate(scores[crop].obtained)}\`` 
                    : `${!profileName ? `Unclaimed on \`${scores[crop].profilename}\`!` : `Contest Still Unclaimed!`}\n\`${DataFormatter.getReadableDate(scores[crop].obtained)}\``;

                    if (!scores[crop].value) { continue };
                    addedIndex++;

                    embed.fields.push({
                        name: `${DataFormatter.getReadableCropName(crop)} - ${scores[crop].value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`,
                        value: details + '\n⠀ ',
                        inline: true
                    });

                    if (addedIndex % 2 == 1) {
                        embed.fields.push({
                            name: "⠀",
                            value: "⠀",
                            inline: true
                        });
                    }
                }

                if (addedIndex === 0) {
                    embed.fields.push({
                        name: `No Data Found`,
                        value: `Sorry, but ${user.dataValues?.ign} hasn\'t participated in any recent contests!\n⠀ `,
                        inline: false
                    });
                }
            } else {
                let highscores = new Map();

                for (let i = 0; i < Object.keys(scores).length; i++) {
                    const crop = Object.keys(scores)[i];
                    if (!crop) { break; }
                    
                    let details = (scores[crop].par) 
                    ? `Placed \`#${(scores[crop].pos + 1).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}\` of \`${scores[crop].par.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}\` players in \`${DataFormatter.getReadableDate(scores[crop].obtained)}!\`` 
                    : `Obtained in \`${DataFormatter.getReadableDate(scores[crop].obtained)}\``;
    
                    if (scores[crop].value > 0) {
                        highscores.set(`
**${DataFormatter.getReadableCropName(crop)}** - Collected **${scores[crop].value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}** items${scores[crop].profilename ? ` on \`${scores[crop].profilename}\`` : ``}!
${details}
                        `, DataFormatter.getApproxWeightByCrop(scores[crop].value, crop));
                    }
                }

                if (highscores.size === 0) {
                    embed.fields.push({
                        name: `No Data Found`,
                        value: `Sorry, but ${user.dataValues?.ign} hasn\'t participated in any recent contests!\n⠀ `,
                        inline: false
                    });
                } else {
                    let sortedHighs = new Map([...highscores.entries()].sort((a, b) => b[1] - a[1]));

                    let breakdown = ` ⠀  　`;
                    let remaining = 3;

                    sortedHighs.forEach(function (value, key) {
                        if (remaining) {
                            breakdown += key;
                            remaining--;
                        }
                    });

                    embed.fields.push({
                        name: remaining === 0 ? `Top Three High Scores` : 'High Scores',
                        value: breakdown + '⠀  　',
                        inline: false
                    });
                }
            } 

            return embed;
        }

        function getJacobData(user, profileName) {
            const profiles = user.dataValues?.profiledata?.data?.profiles;

            for (let i = 0; i < Object.keys(profiles).length; i++) {
                let key = Object.keys(profiles)[i];
                let profile = profiles[key];
    
                if (profile.cute_name.toLowerCase() === profileName.toLowerCase()) {
                    profileName = profile.cute_name;
                    let p = profile?.members[Object.keys(profile?.members)[0]].jacob
                    return p ? p : user.dataValues?.contestdata;
                }
            }
            profileName = undefined;
            return user.dataValues?.contestdata;
        }
    },
}

