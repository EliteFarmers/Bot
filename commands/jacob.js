const Discord = require('discord.js');
const { Data } = require('../data.js');
const { DataHandler } = require('../database.js');

module.exports = {
    name: 'jacob',
    aliases: ['jlb', 'jlbs'],
    description: 'Get jacob\'s high scores or leaderboard!',
    usage: '(username)',
    guildOnly: false,
    dmOnly: false,
	async execute(interaction, p = undefined) {
		const options = interaction?.options?._hoistedOptions;

		let playerName = p;
		let profileName = undefined;

		if (!p) {
			for (let i = 0; i < Object.keys(options).length; i++) {
				let option = options[Object.keys(options)[i]];
				if (option.name === 'player') {
					playerName = option.value.trim();
				} else if (option.name === 'profile') {
					profileName = option.value.trim();
				}
			}
		}

        if (!playerName) {
			let user = await DataHandler.getPlayer(null, { discordid: interaction.user.id });
			if (!user || !user.dataValues?.ign) {
				const embed = new Discord.MessageEmbed()
					.setColor('#CB152B')
					.setTitle('Error: Specify a Username!')
					.addField('Proper Usage:', '`/jacob` `player:` `(player name)` `profile:` `(profile name)`')
					.setDescription('Checking for yourself?\nYou must use \`/verify\` \`player:\`(account name) before using this shortcut!\n**Please verify again if you were already, this data had to be reset**')
					.setFooter('Created by Kaeso#5346');
				interaction.reply({ embeds: [embed], ephemeral: true });
				return;
			}
			
			playerName = user.dataValues.ign;
		}

        const uuid = await Data.getUUID(playerName).then(result => {
			playerName = result.name;
			return result.id;
		}).catch(() => {
			return undefined;
		});
		if (!uuid) {
			const embed = new Discord.MessageEmbed()
				.setColor('#CB152B')
				.setTitle('Error: Invalid Username!')
				.setDescription(`Player "${playerName}" does not exist.`)
				.addField('Proper Usage:', '`/weight` `player:`(player name)')
				.setFooter('Created by Kaeso#5346');
			interaction.reply({ embeds: [embed], ephemeral: true });
			return;
		}

        let grabnewdata = true;
		const user = await DataHandler.getPlayer(uuid);
		if (user && user.dataValues?.updatedat) {
			grabnewdata = (+(user.dataValues?.updatedat ?? 0) < +(Date.now() - (10 * 60 * 1000)));
		}

		await interaction.deferReply();

        const contestData = await Data.getLatestContestData(user, grabnewdata);

        if (!contestData) {
            const embed = new Discord.MessageEmbed()
                .setColor('#CB152B')
                .setTitle('Error: No Contest Data!')
                .addField('Proper Usage:', '`/jacob` `player:`(player name)')
                .setDescription('This could mean that my code is bad, or well, that my code is bad.\n`*(API might be down)*')
                .setFooter('Created by Kaeso#5346');
            interaction.editReply({ embeds: [embed] });
            return;
        }

        if (!playerName) {
            const embed = new Discord.MessageEmbed()
                .setColor('#CB152B')
                .setTitle('Error: Specify a Username!')
                .addField('Proper Usage:', '`/jacob` `player:`(player name)')
                .setDescription('Checking for yourself?\nYou must use \`/verify\` \`player:\`(account name) before using this shortcut!')
                .setFooter('Created by Kaeso#5346');
            interaction.editReply({ embeds: [embed] });
            return;
		}

        // if (!user || !user.dataValues?.contestdata?.scores) {
        //     const embed = new Discord.MessageEmbed()
        //         .setColor('#CB152B')
        //         .setTitle('Error: No Jacob\'s Data Found!')
        //         .setDescription(`Try running \`/weight\` \`player: ${playerName}\` first!\n`)
        //         .setFooter('Created by Kaeso#5346');
        //     interaction.editReply({ embeds: [embed] });
        //     return;
        // }

        DataHandler.update({ contestdata: contestData }, { uuid: uuid });

        const embed = await getHighScoreEmbed();
        if (!embed) { return; }

        let scoresCount = 0;
        for (let i = 0; i < contestData.scores.length; i++) {
            const score = contestData.scores[i];
            scoresCount += (score.value !== 0) ? 1 : 0;
        }

        const row = new Discord.MessageActionRow().addComponents(
            new Discord.MessageButton()
                .setCustomId('overall')
                .setLabel('Overall Stats')
                .setStyle('SUCCESS')
                .setDisabled(profileName !== true),
            new Discord.MessageButton()
                .setCustomId('crops')
                .setLabel('All Crops')
                .setStyle('PRIMARY')
                .setDisabled(profileName !== true || scoresCount > 3),
            new Discord.MessageButton()
                .setCustomId('recents')
                .setLabel('Recent Contests')
                .setStyle('PRIMARY')
        );

        const args = {
            components: [row],
            embeds: [embed],
            allowedMentions: { repliedUser: false },
            fetchReply: true
        }
        
        const select = new Discord.MessageActionRow().addComponents(
            new Discord.MessageSelectMenu().setCustomId('select')
                .setPlaceholder('Filter by Crop!')
                .addOptions([
                    { label: 'Cactus', value: 'cactus' },
                    { label: 'Carrot', value: 'carrot' },
                    { label: 'Cocoa Beans', value: 'cocoa' },
                    { label: 'Melon', value: 'melon' },
                    { label: 'Mushroom', value: 'mushroom' },
                    { label: 'Nether Wart', value: 'netherwart' },
                    { label: 'Potato', value: 'potato' },
                    { label: 'Pumpkin', value: 'pumpkin' },
                    { label: 'Sugar Cane', value: 'sugarcane' },
                    { label: 'Wheat', value: 'wheat' }
                ]),
        );

        selectedCrop = undefined;
        recentsInter = undefined;
        interaction.editReply(args).then(async reply => {
            const collector = reply.createMessageComponentCollector({ componentType: 'BUTTON', time: 30000 });
    
            collector.on('collect', async i => {
                if (i.user.id === interaction.user.id) {
                    collector.resetTimer({ time: 30000 });

                    const newRow = new Discord.MessageActionRow().addComponents(
                        new Discord.MessageButton()
                            .setCustomId('overall')
                            .setLabel('Overall Stats')
                            .setStyle('SUCCESS')
                            .setDisabled(i.customId === 'overall'),
                        new Discord.MessageButton()
                            .setCustomId('crops')
                            .setLabel('All Crops')
                            .setStyle('PRIMARY')
                            .setDisabled(i.customId === 'crops' || scoresCount > 3),
                        new Discord.MessageButton()
                            .setCustomId('recents')
                            .setLabel('Recent Contests')
                            .setStyle('PRIMARY')
                            .setDisabled(i.customId === 'recents')
                        );

                    const recentRow = new Discord.MessageActionRow().addComponents(
                        new Discord.MessageButton()
                            .setCustomId('overall')
                            .setLabel('Overall Stats')
                            .setStyle('SECONDARY')
                            .setDisabled(i.customId === 'overall'),
                        new Discord.MessageButton()
                            .setCustomId('expand')
                            .setLabel('Show More')
                            .setStyle('SUCCESS')
                            .setDisabled(i.customId === 'expand'),
                        new Discord.MessageButton()
                            .setCustomId('recents')
                            .setLabel('Recent Contests')
                            .setStyle('PRIMARY')
                            .setDisabled(i.customId === 'recents' || i.customId === 'expand')
                    );

                    if (i.customId === 'overall') {
                        profileName = undefined;
                        i.update({ embeds: [await getHighScoreEmbed(false)], components: [newRow] }).catch(error => { console.log(error); collector.stop(); });
                    } else if (i.customId === 'crops') {
                        profileName = undefined;
                        i.update({ embeds: [await getHighScoreEmbed(true)], components: [newRow] }).catch(error => { console.log(error); collector.stop(); });
                    } else if (i.customId === 'recents') {
                        profileName = undefined;
                        i.update({ embeds: [await getRecents(undefined, i.customId === 'expand')], components: [select, recentRow], fetchReply: true }).then(reply => {
                            const newCollector = reply.createMessageComponentCollector({ componentType: 'SELECT_MENU', time: 30000 });

                            newCollector.on('collect', async inter => {
                                recentsInter = inter;
                                if (inter.user.id === interaction.user.id) {
                                    collector.resetTimer({ time: 30000 });
                                    newCollector.resetTimer({ time: 30000 });

                                    selectedCrop = inter.values[0];
                                    inter.update({ embeds: [await getRecents(selectedCrop, i.customId === 'expand')], components: [select, recentRow] }).catch(error => { console.log(error) });
                                } else {
                                    inter.reply({ content: `These buttons aren't for you!`, ephemeral: true });
                                }
                            });

                            newCollector.on('end', async collected => {
                                collector.stop();
                            });
                        }).catch(error => { console.log(error); collector.stop(); });
                    } else if (i.customId === 'expand') {
                        i.update({ embeds: [await getRecents(selectedCrop, true)], components: [select, recentRow] }).catch(error => { console.log(error) });            
                    }
                } else {
                    i.reply({ content: `These buttons aren't for you!`, ephemeral: true });
                }
            });
    
            collector.on('end', async collected => {
                interaction.editReply({ components: [] })
            });
        });

        async function getRecents(selectedCrop = undefined, expand = false) {
            const newEmbed = new Discord.MessageEmbed()
                .setColor('#03fc7b')
                .setTitle(`Recent ${selectedCrop ? Data.getReadableCropName(selectedCrop) : 'Jacob\'s'} Contests for ${user?.dataValues?.ign ? user?.dataValues?.ign.replace(/\_/g, '\\_') : playerName}${profileName ? ` on ${profileName}` : ``}`)
                .setFooter(`Note: Highscores only valid after ${Data.getReadableDate(Data.CUTOFFDATE)}\nCreated by Kaeso#5346    Can take up to 10 minutes to update`);

            const contests = (selectedCrop) ? contestData.recents[selectedCrop] : contestData.recents.overall;

            let addedIndex = 0;
            const contestAmount = Object.keys(contests).length;
            if (!expand && contestAmount > 4) newEmbed.description = 'Click \"Show More\" to see more contests!';
            for (let i = 0; i < Math.min(expand ? 10 : 4, contestAmount); i++) {
                const crop = Object.keys(contests)[i]
                const contest = contests[crop];

                let details = (contest.par) 
                ? `\`#${(contest.pos + 1).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}\` of \`${contest.par.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}\` ${!profileName ? ` on \`${contest.name}\`!` : ` players!`}` 
                : `${!profileName ? `Unclaimed on \`${contest.name}\`!` : `Contest Still Unclaimed!`}`;

                if (!contest.value) { continue };
                addedIndex++;

                newEmbed.fields.push({
                    name: `${Data.getReadableDate(contest.obtained)}`,
                    value: `${(selectedCrop) ? 'Collected ' : `${Data.getReadableCropName(contest.crop)} - `}**${contest.value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}**\n` + details,// + '\n⠀ ',
                    inline: true
                });

                if (addedIndex % 2 == 1) {
                    newEmbed.fields.push({
                        name: "⠀",
                        value: "⠀",
                        inline: true
                    });
                }
            }

            if (addedIndex === 0) {
                newEmbed.fields.push({
                    name: `No Data Found`,
                    value: `Sorry, but ${user?.dataValues?.ign ? user?.dataValues?.ign.replace(/\_/g, '\\_') : playerName.replace(/\_/g, '\\_') } hasn\'t participated in any ${selectedCrop ? Data.getReadableCropName(selectedCrop) : ''} contests!\n⠀ `,
                    inline: false
                });
            }

            return newEmbed;
        }

        async function getHighScoreEmbed(allcrops = false) {
            const jacob = contestData
            const scores = jacob?.scores;

            const cMedals = jacob.currentmedals;
            const tMedals = jacob.totalmedals;

            const partic = (jacob.firstplace) 
            ? `Out of **${jacob.participations.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}** contests, **${user?.dataValues?.ign ? user?.dataValues?.ign.replace(/\_/g, '\\_') : playerName.replace(/\_/g, '\\_') }** has been 1st **${jacob.firstplace.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}** times!`
            : `**${user.dataValues?.ign ? user.dataValues?.ign.replace(/\_/g, '\\_') : 'N/A'}** has participated in **${jacob.participations.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}** contests!`;

            const embed = new Discord.MessageEmbed()
                .setColor('#03fc7b')
                .setTitle(`${!profileName || allcrops ? `Overall ` : ``}Jacob's High Scores for ${user?.dataValues?.ign ? user?.dataValues?.ign.replace(/\_/g, '\\_') : playerName.replace(/\_/g, '\\_') }${profileName ? ` on ${profileName}` : ``}`)
                .setFooter(`Note: Scores only valid after ${Data.getReadableDate(Data.CUTOFFDATE)}\nCreated by Kaeso#5346    Can take up to 10 minutes to update`)
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
                    ? `\`#${(scores[crop].pos + 1).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}\` of \`${scores[crop].par.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}\` ${!profileName ? ` on \`${scores[crop].profilename}\`!` : ` players!`}\n\`${Data.getReadableDate(scores[crop].obtained)}\`` 
                    : `${!profileName ? `Unclaimed on \`${scores[crop].profilename}\`!` : `Contest Still Unclaimed!`}\n\`${Data.getReadableDate(scores[crop].obtained)}\``;

                    if (!scores[crop].value) { continue };
                    addedIndex++;

                    embed.fields.push({
                        name: `${Data.getReadableCropName(crop)} - ${scores[crop].value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`,
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
                    ? `Placed \`#${(scores[crop].pos + 1).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}\` of \`${scores[crop].par.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}\` players in \`${Data.getReadableDate(scores[crop].obtained)}!\`` 
                    : `Obtained in \`${Data.getReadableDate(scores[crop].obtained)}\``;
    
                    if (scores[crop].value > 0) {
                        highscores.set(`
**${Data.getReadableCropName(crop)}** - Collected **${scores[crop].value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}** items${scores[crop].profilename ? ` on \`${scores[crop].profilename}\`` : ``}!
${details}
                        `, Data.getApproxWeightByCrop(scores[crop].value, crop));
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
            const profiles = user.dataValues?.profiledata?.profiles;

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

