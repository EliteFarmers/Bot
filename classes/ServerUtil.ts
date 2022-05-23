import { MessageEmbed, MessageActionRow, ButtonInteraction, GuildMemberRoleManager, GuildMember, Guild, GuildTextBasedChannel, CommandInteraction, InteractionReplyOptions, MessageOptions, MessagePayload } from 'discord.js';
import DataHandler from './Database';
import Data, { ContestScore, CropString, FarmingContestScores } from './Data';
import { CanUpdateAndFlag, FindChannel } from './Util';
import { ServerData } from 'database/models/servers';
import { UserData } from 'database/models/users';

export default class ServerUtil {
	static async submitScores(interaction: ButtonInteraction) {
		if (!interaction.guildId || !interaction.member) return;

		const user = await DataHandler.getPlayer(undefined, { discordid: interaction.user.id });
		if (!user) {
			return await interaction.reply({ content: '**Error!** You need to use `/verify` to link your Minecraft account first!', ephemeral: true });
		}

		const server = await DataHandler.getServer(interaction.guildId);
		if (!server) return;
		if (!server.lbchannel) {
			return await interaction.reply({ content: 'This feature was turned off! This may be intentional, so don\'t bother the server admins about it.', ephemeral: true });
		}

		if (!server.lbactiveid || !interaction.customId.includes(server.lbactiveid)) {
			const embed = interaction?.message?.embeds[0];
			if (!embed) {
				await interaction.update({ embeds: [], components: [] })
			} else {
				embed.footer = { text: 'This leaderboard no longer accepts updates\n' + (embed.footer?.text ?? '')};
				embed.description = 'These highscores were set by your fellow server members!';
				await interaction.update({ embeds: [embed], components: [] });
			}
			return await interaction.followUp({ content: 'This leaderboard was turned off! This may be intentional, so don\'t bother the server admins about it.', ephemeral: true });
		}

		if (server.lbrolereq && !(interaction.member.roles as GuildMemberRoleManager).cache.has(server.lbrolereq)) {
			if (server.lbrolereq === server.weightrole && (server.weightreq ?? -1) >= 0) {
				return await interaction.reply({ content: `**Error!** You need the <@&${server.lbrolereq}> role first!\nThis is a reward for reaching **${server.weightreq}** total farming weight! Check your weight with \`/weight\`.`, ephemeral: true });
			}
			return await interaction.reply({ content: `**Error!** You need the <@&${server.lbrolereq}> role first!`, ephemeral: true });
		}

		await interaction.deferUpdate();

		const grabnewdata = await CanUpdateAndFlag(user, 2);
		const contestData = grabnewdata 
			? await Data.getAllValidContests(user.uuid, parseInt(server.lbcutoff ?? Data.CUTOFFDATE), server.lbconfig?.exclusions)
			: await Data.getLatestContestData(user, false).then(data => data?.scores);

		if (!contestData) {
			const embed = new MessageEmbed().setColor('#CB152B')
				.setTitle('Error: No Contest Data!')
				.setDescription('This could mean that my code is bad, or well, that my code is bad.\n`*(API could be down)*')
				.setFooter({ text: 'Created by Kaeso#5346' });
			await interaction.editReply({});
			return await interaction.followUp({ embeds: [embed], ephemeral: true });
		}

		if (!interaction.guild) return;
		const channel = (server.lbupdatechannel) ? await FindChannel(interaction.guild, server.lbupdatechannel) : undefined;

		const newScores: { [key: string]: ContestScore } = {};
		const dontUpdate = [];

		const userScores = contestData ?? ({} as FarmingContestScores);
		const serverScores = server.scores ?? ({} as FarmingContestScores);

		const exclusions = server.lbconfig?.exclusions;

		outer: for (const crop in contestData) {
			const userScore = userScores[crop];
			const serverScore = serverScores[crop as CropString];
			const obtained = +userScore.obtained;

			if (!userScore || (+(server.lbcutoff ?? -1) > obtained)) continue;

			if (exclusions) for (const range of exclusions) {
				if (obtained > +range.from && obtained < +range.to) continue outer;
			}

			const nowClaimed = !!(serverScore && serverScore.obtained === userScore.obtained && serverScore.user === interaction.user.id && (serverScore.par === undefined || serverScore.par === null) && userScore.par);

			if ((!serverScore && userScore.value) || userScore.value > (serverScore?.value ?? 0) || nowClaimed) {
				newScores[crop] = { user: interaction.user.id, ign: user.ign ?? undefined, ...userScore };
				if (nowClaimed) dontUpdate.push(crop);
			}
		}

		// True if someone has since claimed the contest for their highscore, or if a user's scores were removed from the leaderboard
		const silentUpdate = (Object.keys(serverScores).length < (interaction.message?.embeds[0]?.fields?.filter(f => f.name !== 'Nothing Yet')?.length ?? 0) || (dontUpdate.length > 0 && Object.keys(newScores).length === dontUpdate.length));

		if (Object.keys(newScores).length <= 0) {
			const embed = new MessageEmbed().setColor('#FF8600')
				.setTitle('Sorry! No New Records')
				.setDescription(`You don't have any scores that would beat these records!\nKeep in mind that scores are only valid starting on ${server.lbcutoff ? `**${Data.getReadableDate(server.lbcutoff)}**\n(The custom cutoff date for this leaderboard)` : `**${Data.getReadableDate(Data.CUTOFFDATE)}**\n(The first contest after the last nerf to farming)`}`)
				.setFooter({ text: 'If you\'re positive that this isn\'t true please contact Kaeso#5346' });

			if ((exclusions?.length ?? 0) > 0) {
				let text = 'Scores are also not counted if they fall within these date ranges:\n⠀\n';

				exclusions?.forEach(ex => {
					text += `**${Data.getReadableDate(ex.to)}** - **${Data.getReadableDate(ex.from)}**\n${ex.reason ? `**Reason:** \`${ex.reason}\`` : '⠀'}`;
				})

				embed.addField('Date Exclusions:', text);
			}

			if (!grabnewdata) {
				embed.description += `\n⠀\n**This could be because fetching your profile is on cooldown.** Try again <t:${Math.floor((+(user.updatedat ?? 0) + (2 * 60 * 1000)) / 1000)}:R>`;
			}
			await interaction.followUp({ embeds: [embed], ephemeral: true }).catch((e) => console.log(e));

			if (!silentUpdate) {
				return await interaction.editReply({}).catch((e) => console.log(e));
			}
		}

		const updatedScores = {...server.scores, ...newScores};
		await DataHandler.updateServer({ scores: updatedScores as FarmingContestScores ?? null }, server.guildid);

		const embed = new MessageEmbed().setColor('#03fc7b')
			.setTitle('Jacob\'s Contest Leaderboard')
			.setDescription('These are the highscores set by your fellow server members!')
			.setFooter({ text: `Highscores only valid after ${Data.getReadableDate(server.lbcutoff ?? Data.CUTOFFDATE)}⠀⠀Created by Kaeso#5346` });

		for (const crop of Object.keys(updatedScores) as CropString[]) {
			const contest = updatedScores[crop];
			if (!contest) continue;

			const details = (contest.par && contest.pos !== undefined) 
				? `\`#${(contest.pos + 1).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}\` of \`${contest.par.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}\` on [${contest.profilename}](https://sky.shiiyu.moe/stats/${contest.ign}/${contest.profilename})` 
				: `Contest Still Unclaimed! [Link](https://sky.shiiyu.moe/stats/${contest.ign}/${contest.profilename})`;

			if (!contest.value) continue;

			embed.fields.push({
				name: `${Data.getReadableCropName(crop)} - ${contest.ign}`,
				value: `<@${contest.user}> - **${contest.value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}**⠀⠀${details}\n${Data.getReadableDate(contest.obtained)}`,
				inline: false,
			});
		}
		// Sort the leaderboard embeds
		embed.fields.sort((a, b) => a.name.localeCompare(b.name));
		
		await interaction.editReply({ content: '⠀', embeds: [embed] }).catch(async () => {
			await interaction.editReply({ embeds: [embed] });
		});

		if (silentUpdate) {
			return interaction.followUp({ content: 'Success! No new scores, but your contest has since been claimed and updated!', ephemeral: true }).catch(() => undefined);
		}
		
		await interaction.followUp({ content: 'Success! Check the leaderboard now!', ephemeral: true }).catch(() => undefined);

		if (channel) {
			const embeds = [];
			for (const crop of Object.keys(newScores) as CropString[]) {
				if (dontUpdate.includes(crop)) continue;

				const record = newScores[crop as CropString];
				const url = Data.getCropURL(crop);

				const embed = new MessageEmbed().setColor(Data.getCropHex(crop))
					.setTitle(`New High Score for ${Data.getReadableCropName(crop)}!`)
					
				if (url) embed.setThumbnail(url);

				if (serverScores[crop]) {
					embed.description = `<@${interaction.user.id}> (${user.ign}) ${interaction.user.id !== serverScores[crop]?.user ? `has beaten <@${serverScores[crop]?.user}> (${serverScores[crop]?.ign})` : 'improved their score'} by **${(record.value - serverScores[crop]?.value ?? 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}** collection for a total of **${record.value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}**!`;
					embed.setFooter({ text: `The previous score was ${(serverScores[crop]?.value ?? 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}!` })
				} else {
					embed.description = `<@${interaction.user.id}> (${user.ign}) set a new record of **${record.value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}**!`;
				}
				
				embeds.push(embed);
			}

			if (server.lbroleping && channel) {
				await (channel as GuildTextBasedChannel)?.send({ 
					content: `<@&${server.lbroleping}>`, 
					embeds: embeds, 
					allowedMentions: { roles: [server.lbroleping] } 
				}).catch(() => undefined);
			} else {
				await (channel as GuildTextBasedChannel)?.send({ embeds: embeds }).catch(() => undefined);
			}
		}
	}

	static async toggleRole(interaction: ButtonInteraction) {
		if (!interaction.guildId || !interaction.guild || !interaction.member) return;

		const server = await DataHandler.getServer(interaction.guildId);
		if (!server) return;
		
		if (server.lbroleping && server.lbupdatechannel) {
			if (!interaction.guild.roles.cache.has(server.lbroleping)) {
				if (!interaction.guild.roles.fetch(server.lbroleping)) {
					await interaction.reply({ content: '**Error!** Looks like this isn\'t configured properly!\nThe role I was given does\'nt seem to exist! Please message an admin so they can fix this!', ephemeral: true });
					return;
				}
			}

			if (Array.isArray(interaction.member.roles)) return;
			const roleManager = interaction.member.roles as GuildMemberRoleManager;

			if (roleManager.cache.has(server.lbroleping)) {
				await roleManager.remove(server.lbroleping, 'User opted out.').then(async () => {
					await interaction.reply({ content: '**Success!** You\'ll no longer get pinged when someone gets a new score on the leaderboard.', ephemeral: true });
				}).catch(async () => {
					await interaction.reply({ content: '**Error!** Looks like this isn\'t configured properly!\nI don\'t have permission to remove this role from you! Please message an admin so they can fix this!', ephemeral: true });
				});
			} else {
				await roleManager.add(server.lbroleping).then(async () => {
					await interaction.reply({ content: '**Success!** You\'ll now get pinged when someone gets a new score on the leaderboard!', ephemeral: true });
				}).catch(async () => {
					await interaction.reply({ content: '**Error!** Looks like this isn\'t configured properly!\nI don\'t have permission to add this role to you! Please message an admin so they can fix this!', ephemeral: true });
				});
			}
		} else {
			interaction.reply({ content: 'This feature isn\'t set up! This may be intentional, so don\'t bother the server admins about it.', ephemeral: true });
		}
	}

	static async handleWeightRole(interaction: CommandInteraction, server: ServerData) {
		if (!server.weightrole || !(server.weightreq !== undefined) || !interaction.guild || !interaction.member) return;

		if (server.inreview?.includes(interaction.user.id)) return;

		const user = await DataHandler.getPlayer(undefined, { discordid: interaction.user.id });
		if (!user) return;

		if (!server.reviewchannel) return this.grantWeightRole(interaction, interaction.guild, (interaction.member as GuildMember), server, user);
		DataHandler.updateServer({ inreview: [interaction.user.id, ...(server.inreview ?? [])] }, server.guildid);

		const channel = interaction.guild.channels.cache.get(server.reviewchannel) 
			?? await interaction.guild.channels.fetch(server.reviewchannel);

		if (!channel || channel.type !== 'GUILD_TEXT') return;

		const reviewEmbed = new MessageEmbed().setColor('#03fc7b')
			.setTitle(`${user.ign} ${server.weightreq === 0 ? `is verified!` : `has reached ${server?.weightreq} weight!`}`)
			.setDescription(`<@${user.discordid}> has ${server.weightreq === 0 ? `linked their account` : `achieved ${server?.weightreq} weight`}, they're awaiting approval now!`);

		const reviewRow = new MessageActionRow().addComponents(
			{ label: 'Approve', customId: `WEIGHTROLEAPPROVE|${user.discordid}`, style: 'SUCCESS', type: 'BUTTON' },
			{ label: 'Deny', customId: `WEIGHTROLEDENY`, style: 'DANGER', type: 'BUTTON' },
			{ label: 'SkyCrypt', style: 'LINK', url: `https://sky.shiiyu.moe/stats/${user.ign}`, type: 'BUTTON' },
			{ label: 'Plancke', style: 'LINK', url: `https://plancke.io/hypixel/player/stats/${user.ign}`, type: 'BUTTON' }
		);

		if (server.reviewerrole) {
			(channel as GuildTextBasedChannel)?.send({ 
				content: `<@&${server.reviewerrole}>`, 
				embeds: [reviewEmbed], 
				components: [reviewRow], 
				allowedMentions: { 
					roles: [server.reviewerrole] 
				} 
			}).catch(() => undefined);
		} else {
			(channel as GuildTextBasedChannel)?.send({ 
				embeds: [reviewEmbed], 
				components: [reviewRow] 
			}).catch(() => undefined);
		}
	}

	static async grantWeightRole(interaction: ButtonInteraction | CommandInteraction, guild: Guild, member: GuildMember, server: ServerData, user: UserData) {

		if (!user) {
			const findUser = await DataHandler.getPlayer(undefined, { discordid: interaction.user.id });
			if (findUser) {
				user = findUser;
			} else return;
		}

		DataHandler.updateServer({ inreview: [...((server.inreview ?? []).filter((e) => e !== user.discordid))] }, server.guildid);

		if (!server?.weightrole) return;
		await member?.roles?.add(server.weightrole).then(async () => {
			const embed = new MessageEmbed().setColor('#03fc7b')
				.setTitle('Congratulations!')
				.setDescription(`You have ${server.weightreq === 0 ? `linked your account` : `achieved ${server?.weightreq} weight`}, earning you the <@&${server.weightrole}> role!`);

			reply(interaction, { embeds: [embed], ephemeral: true });

			if (server.weightchannel) {
				const channel = guild.channels.cache.get(server.weightchannel) 
					?? await guild.channels.fetch(server.weightchannel);


				if (!channel || channel.type !== 'GUILD_TEXT') return;

				try {
					const welcomeEmbed = new MessageEmbed().setColor('#03fc7b')
						.setTitle(`Welcome ${user.ign}!`)
						.setDescription(`<@${member.id}> has ${server.weightreq === 0 ? `linked their account.` : `achieved ${server?.weightreq} weight!`}`);

					const linkRow = new MessageActionRow().addComponents(
						{ label: 'SkyCrypt', style: 'LINK', url: `https://sky.shiiyu.moe/stats/${user.ign}`, type: 'BUTTON' },
						{ label: 'Plancke', style: 'LINK', url: `https://plancke.io/hypixel/player/stats/${user.ign}`, type: 'BUTTON' }
					);

					(channel as GuildTextBasedChannel)?.send({ embeds: [welcomeEmbed], components: [linkRow] }).catch(() => undefined);
				} catch (e) { console.log(e); }
			}
		}).catch(async () => {
			reply(interaction, { content: '**Error!** Looks like this isn\'t configured properly!\nI don\'t have permission to add this role to you! Please message an admin so they can fix this!', ephemeral: true });
		});

		function reply(interaction: CommandInteraction | ButtonInteraction, message: string | MessagePayload | MessageOptions | InteractionReplyOptions) {
			if (interaction.isButton()) {
				return interaction.update({ content: `**Approved by** <@${interaction.user.id}>!`, components: [] }).catch(() => undefined);
			}

			if (interaction.replied) {
				interaction.followUp(message).catch(() => undefined);
			} else {
				interaction.reply(message).catch(() => {
					interaction.channel?.send(message).catch(() => undefined);
				});
			}
		}
	}
}