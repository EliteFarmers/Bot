const { MessageEmbed, MessageActionRow } = require('discord.js');
const { DataHandler } = require('./database.js');
const { Data } = require('./data.js');

class ServerLB {
	static async submitScores(interaction) {
		const user = await DataHandler.getPlayer(undefined, { discordid: interaction.user.id });
		if (!user) {
			return await interaction.reply({ content: '**Error!** You need to use \`/verify\` to link your Minecraft account first!', ephemeral: true });
		}

		const server = await DataHandler.getServer(interaction.guildId);
		if (!server) return error();
		if (!server.lbchannel) {
			return await interaction.reply({ content: 'This feature was turned off! This may be intentional, so don\'t bother the server admins about it.', ephemeral: true });
		}

		if (server.lbrolereq && !interaction.member.roles.cache.has(server.lbrolereq)) {
			if (server.lbrolereq === server.weightrole && server.weightreq >= 0) {
				return await interaction.reply({ content: `**Error!** You need the <@&${server.lbrolereq}> role first!\nThis is a reward for reaching **${server.weightreq}** total farming weight! Check your weight with \`/weight\`.`, ephemeral: true });
			}
			return await interaction.reply({ content: `**Error!** You need the <@&${server.lbrolereq}> role first!`, ephemeral: true });
		}

		await interaction.deferUpdate();

		const onCooldown = +(user.updatedat ?? 0) > +(Date.now() - (10 * 60 * 1000));
		const contestData = await Data.getLatestContestData(user, !onCooldown).catch(e => console.log(e));
		if (!onCooldown) DataHandler.update({ updatedat: Date.now().toString() }, { discordid: user.discordid }).catch();

		if (!contestData) {
			const embed = new MessageEmbed()
				.setColor('#CB152B')
				.setTitle('Error: No Contest Data!')
				.addField('Proper Usage:', '`/jacob` `player:`(player name)')
				.setDescription('This could mean that my code is bad, or well, that my code is bad.\n`*(API could be down)*')
				.setFooter('Created by Kaeso#5346');
			await interaction.editReply();
			return await interaction.followUp({ embeds: [embed] });
		}

		const channel = (server.lbupdatechannel) ? interaction.guild.channels.cache.get(server.lbupdatechannel) 
			?? await interaction.guild.channels.fetch(server.lbupdatechannel) : undefined;

		let newScores = {};
		const dontUpdate = [];

		const userScores = contestData.scores ?? {};
		const serverScores = server.scores ?? {};

		for (const crop of Object.keys(contestData.scores)) {
			const userScore = userScores[crop];
			const serverScore = serverScores[crop];

			//TODO: Add support for custom cutoff dates
			if (!userScore) continue;
			const nowClaimed = (serverScore?.value && serverScore?.obtained === userScore?.obtained && serverScore?.user === interaction.user.id && !serverScore?.par && userScore?.par);

			if ((!serverScore && userScore.value) || userScore.value > (serverScore?.value ?? 0) || nowClaimed) {
				newScores[crop] = { user: interaction.user.id, ign: user.ign, ...userScore };
				if (nowClaimed) dontUpdate.push(crop);
			}
		}

		if (Object.keys(newScores).length <= 0) {
			const embed = new MessageEmbed().setColor('#FF8600')
				.setTitle('Sorry! No New Records')
				.setDescription(`You don\'t have any jacob\'s scores that would beat these records!\nKeep in mind that scores are only valid starting on **${Data.getReadableDate(Data.CUTOFFDATE)}**\n(The first contest after the last nerf to farming)`)
				.setFooter('If you\'re positive that this isn\'t true please contact Kaeso#5346');

			if (onCooldown) {
				embed.description += `\n⠀\nThis could be because fetching your profile is on cooldown, try again <t:${Math.floor((+(user.updatedat ?? 0) + (10 * 60 * 1000)) / 1000)}:R>`;
			}
			await interaction.editReply().catch((e) => console.log(e));
			return await interaction.followUp({ embeds: [embed], ephemeral: true }).catch((e) => console.log(e));
		}

		const updatedScores = {...server.scores, ...newScores};
		await DataHandler.updateServer({ scores: updatedScores }, server.guildid);

		const embed = new MessageEmbed().setColor('#03fc7b')
			.setTitle('Jacob\'s Contest Leaderboard')
			.setDescription('These are the highscores set by your fellow server members!')
			.setFooter(`Highscores only valid after ${Data.getReadableDate(Data.CUTOFFDATE)}⠀⠀Created by Kaeso#5346`);

		for (const crop of Object.keys(updatedScores)) {
			const contest = updatedScores[crop];

			let details = (contest.par) 
				? `\`#${(contest.pos + 1).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}\` of \`${contest.par.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}\` on \`${contest.profilename}\`!` 
				: `Contest Still Unclaimed!`;

			if (!contest.value) { continue };

			embed.fields.push({
				name: `${Data.getReadableCropName(crop)} - ${contest.ign}`,
				value: `<@${contest.user}> - **${contest.value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}**⠀⠀${details}\n${Data.getReadableDate(contest.obtained)}⠀[\🔗](https://sky.shiiyu.moe/stats/${contest.ign}/${contest.profilename})`,
			});
		}
		
		await interaction.editReply({ content: '⠀', embeds: [embed] }).catch(async () => {
			await interaction.editReply({ embeds: [embed] });
		});
		await interaction.followUp({ content: 'Success! Check the leaderboard now!', ephemeral: true }).catch();

		if (channel) {
			const embeds = [];
			for (const crop of Object.keys(newScores)) {
				if (dontUpdate.includes(crop)) continue;
				const record = newScores[crop];

				const embed = new MessageEmbed().setColor('#03fc7b')
					.setTitle(`New High Score for ${Data.getReadableCropName(crop)}!`)
				
				embed.description = (serverScores[crop])
					? `<@${interaction.user.id}> (${user.ign}) has ${interaction.user.id !== serverScores[crop]?.user ? `beaten <@${serverScores[crop]?.user}> (${serverScores[crop]?.ign})` : 'improved their score'} by **${(record.value - serverScores[crop]?.value ?? 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}** collection for a total of **${record.value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}**!`
					: `<@${interaction.user.id}> (${user.ign}) has set a new record of **${record.value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}**!`;

				embeds.push(embed);
			}
			if (server.lbroleping) {
				await channel?.send({ content: `<@&${server.lbroleping}>`, embeds: embeds, allowedMentions: { roles: [server.lbroleping] } }).catch();
			} else {
				await channel?.send({ embeds: embeds }).catch();
			}
		}
	}

	static async toggleRole(interaction) {
		const server = await DataHandler.getServer(interaction.guildId);
		if (!server) return error('No server found');
		
		if (server.lbroleping && server.lbupdatechannel) {
			if (!interaction.guild.roles.cache.has(server.lbroleping)) {
				if (!interaction.guild.roles.fetch(server.lbroleping)) {
					await interaction.reply({ content: '**Error!** Looks like this isn\'t configured properly!\nThe role I was given does\'nt seem to exist! Please message an admin so they can fix this!', ephemeral: true });
					return;
				}
			}

			if (interaction.member.roles.cache.has(server.lbroleping)) {
				await interaction.member.roles.remove(server.lbroleping, 'User opted out.').then(async () => {
					await interaction.reply({ content: '**Success!** You\'ll no longer get pinged when someone gets a new score on the leaderboard.', ephemeral: true });
				}).catch(async () => {
					await interaction.reply({ content: '**Error!** Looks like this isn\'t configured properly!\nI don\'t have permission to remove this role from you! Please message an admin so they can fix this!', ephemeral: true });
				});
			} else {
				await interaction.member.roles.add(server.lbroleping).then(async () => {
					await interaction.reply({ content: '**Success!** You\'ll now get pinged when someone gets a new score on the leaderboard!', ephemeral: true });
				}).catch(async () => {
					await interaction.reply({ content: '**Error!** Looks like this isn\'t configured properly!\nI don\'t have permission to add this role to you! Please message an admin so they can fix this!', ephemeral: true });
				});
			}
		} else {
			interaction.reply({ content: 'This feature isn\'t set up! This may be intentional, so don\'t bother the server admins about it.', ephemeral: true });
		}
	}
}

module.exports = {
	ServerLB
}