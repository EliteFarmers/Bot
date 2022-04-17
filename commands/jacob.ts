import { Command } from "../classes/Command";
import { CanUpdateAndFlag } from "../classes/Util";
import { ServerData } from "../database/models/servers";
import { ButtonInteraction, CommandInteraction, Message, MessageActionRow, MessageButton, MessageEmbed, MessageSelectMenu } from 'discord.js';
import Data, { CropString } from '../classes/Data';
import DataHandler from '../classes/Database';

const command: Command = {
	name: 'jacob',
	description: 'Get jacob\'s high scores or leaderboard!',
	access: 'ALL',
	type: 'COMBO',
	slash: {
		name: 'jacob',
		description: 'Get jacob\'s high scores or leaderboard!',
		options: [
			{
				name: 'player',
				type: 'STRING',
				description: 'The player in question.',
				required: false
			},
			{
				name: 'profile',
				type: 'STRING',
				description: 'Optionally specify a profile!',
				required: false
			}
		]
	},
	execute: execute
}

export default command;

async function execute(interaction: ButtonInteraction | CommandInteraction) {
	if (interaction instanceof CommandInteraction) {

		const args: JacobCMDArgs = {
			playerName: interaction.options.getString('player', false) ?? undefined,
			profileName: interaction.options.getString('profile', false) ?? undefined
		}

		return await commandExecute(interaction, args);
		
	} else return await commandExecute(interaction, { playerName: interaction.customId.split('|')[1] });
}

async function commandExecute(interaction: CommandInteraction | ButtonInteraction, cmdArgs: JacobCMDArgs) {
	let { playerName, profileName } = cmdArgs;

	if (!playerName) {
		const user = await DataHandler.getPlayer(undefined, { discordid: interaction.user.id });
		if (!user || !user.ign) {
			const embed = new MessageEmbed()
				.setColor('#CB152B')
				.setTitle('Error: Specify a Username!')
				.addField('Proper Usage:', '`/jacob` `player:` `(player name)` `profile:` `(profile name)`')
				.setDescription('Checking for yourself?\nYou must use `/verify` `player:`(account name) before using this shortcut!')
				.setFooter({ text: 'Created by Kaeso#5346' });
			return interaction.reply({ embeds: [embed], ephemeral: true });
		}
		
		playerName = user.ign;
	}

	const uuid = await Data.getUUID(playerName).then(result => {
		playerName = result.name;
		return result.id;
	}).catch(() => {
		return undefined;
	});
	if (!uuid) {
		const embed = new MessageEmbed().setColor('#CB152B')
			.setTitle('Error: Invalid Username!')
			.setDescription(`Player "${playerName}" does not exist.`)
			.addField('Proper Usage:', '`/weight` `player:`(player name)')
			.setFooter({ text: 'Created by Kaeso#5346' });
		return interaction.reply({ embeds: [embed], ephemeral: true });
	}

	await interaction.deferReply();

	let user = await DataHandler.getPlayer(uuid);

	if (!user) {
		await DataHandler.updatePlayer(uuid, playerName, undefined, undefined);
		user = await DataHandler.getPlayer(uuid);
	}

	if (!user) {
		const embed = new MessageEmbed().setColor('#CB152B')
			.setTitle('Error: Couldn\'t Get User!')
			.setDescription(`Something weird happened with the database. Try again?`)
			.setFooter({ text: 'Contact Kaeso#5346 if this continues to happen!' });
		return interaction.reply({ embeds: [embed], ephemeral: true });
	}

	const grabnewdata = await CanUpdateAndFlag(user) || !user.contestdata;
	const contestData = await Data.getLatestContestData(user, grabnewdata);

	if (!contestData) {
		const embed = new MessageEmbed().setColor('#CB152B')
			.setTitle('Error: No Contest Data!')
			.addField('Proper Usage:', '`/jacob` `player:`(player name)')
			.setDescription('This could mean that my code is bad, or well, that my code is bad.\n*(API might be down)*')
			.setFooter({ text: 'Created by Kaeso#5346' });
		return interaction.editReply({ embeds: [embed] });
	}

	if (!playerName) {
		const embed = new MessageEmbed().setColor('#CB152B')
			.setTitle('Error: Specify a Username!')
			.addField('Proper Usage:', '`/jacob` `player:`(player name)')
			.setDescription('Checking for yourself?\nYou must use `/verify` `player:`(account name) before using this shortcut!')
			.setFooter({ text: 'Created by Kaeso#5346' });
		return interaction.editReply({ embeds: [embed] });
	}

	// Nothing depends on this being waited for
	DataHandler.update({ contestdata: contestData }, { uuid: uuid });

	const embed = await getHighScoreEmbed();
	if (!embed) { return; }

	let scoresCount = 0;
	for (const crop in contestData.scores) {
		const score = contestData.scores[crop as CropString];
		scoresCount += (score.value !== 0) ? 1 : 0;
	}

	const row = new MessageActionRow().addComponents(
		new MessageButton()
			.setCustomId('overall')
			.setLabel('Overall Stats')
			.setStyle('SUCCESS')
			.setDisabled(profileName !== undefined),
		new MessageButton()
			.setCustomId('crops')
			.setLabel('All Crops')
			.setStyle('PRIMARY')
			.setDisabled(profileName !== undefined && scoresCount <= 3),
		new MessageButton()
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
	
	const select = new MessageActionRow().addComponents(
		new MessageSelectMenu().setCustomId('select')
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

	let selectedCrop: CropString | undefined = undefined;
	interaction.editReply(args).then(async reply => {
		if (!(reply instanceof Message)) return;
		const collector = reply.createMessageComponentCollector({ componentType: 'BUTTON', time: 30000 });

		collector.on('collect', async i => {
			if (i.user.id === interaction.user.id) {
				collector.resetTimer({ time: 30000 });

				const newRow = new MessageActionRow().addComponents(
					new MessageButton()
						.setCustomId('overall')
						.setLabel('Overall Stats')
						.setStyle('SUCCESS')
						.setDisabled(i.customId === 'overall'),
					new MessageButton()
						.setCustomId('crops')
						.setLabel('All Crops')
						.setStyle('PRIMARY')
						.setDisabled(i.customId === 'crops' || scoresCount > 3),
					new MessageButton()
						.setCustomId('recents')
						.setLabel('Recent Contests')
						.setStyle('PRIMARY')
						.setDisabled(i.customId === 'recents')
				);

				const recentRow = new MessageActionRow().addComponents(
					new MessageButton()
						.setCustomId('overall')
						.setLabel('Overall Stats')
						.setStyle('SECONDARY')
						.setDisabled(i.customId === 'overall'),
					new MessageButton()
						.setCustomId('expand')
						.setLabel('Show More')
						.setStyle('SUCCESS')
						.setDisabled(i.customId === 'expand'),
					new MessageButton()
						.setCustomId('recents')
						.setLabel('Recent Contests')
						.setStyle('PRIMARY')
						.setDisabled(i.customId === 'recents' || i.customId === 'expand')
				);

				if (i.customId === 'overall') {
					profileName = undefined;

					const scoresEmbed = await getHighScoreEmbed(false);
					if (!scoresEmbed) return;

					i.update({ embeds: [scoresEmbed], components: [newRow] }).catch(error => { console.log(error); collector.stop(); });
				} else if (i.customId === 'crops') {
					profileName = undefined;

					const scoresEmbed = await getHighScoreEmbed(false);
					if (!scoresEmbed) return;

					i.update({ embeds: [scoresEmbed], components: [newRow] }).catch(error => { console.log(error); collector.stop(); });
				} else if (i.customId === 'recents') {
					profileName = undefined;

					const recentsEmbed = await getRecents(undefined, false)
					if (!recentsEmbed) return;

					i.update({ embeds: [recentsEmbed], components: [select, recentRow], fetchReply: true }).then(reply => {
						if (!(reply instanceof Message)) return;
						const newCollector = reply.createMessageComponentCollector({ componentType: 'SELECT_MENU', time: 30000 });

						newCollector.on('collect', async inter => {
							if (inter.user.id === interaction.user.id) {
								collector.resetTimer({ time: 30000 });
								newCollector.resetTimer({ time: 30000 });

								selectedCrop = inter.values[0] as CropString;

								const cropsEmbed = await getRecents(selectedCrop, i.customId === 'expand');
								if (!cropsEmbed) return;

								inter.update({ embeds: [cropsEmbed], components: [select, recentRow] }).catch(() => undefined);
							} else {
								inter.reply({ content: `These buttons aren't for you!`, ephemeral: true });
							}
						});

						newCollector.on('end', () => {
							collector.stop();
						});
					}).catch(error => { console.log(error); collector.stop(); });
				} else if (i.customId === 'expand') {
					const cropsEmbed = await getRecents(selectedCrop, true);
					if (!cropsEmbed) return;

					i.update({ embeds: [cropsEmbed], components: [select, recentRow] }).catch(error => { console.log(error) });            
				}
			} else {
				i.reply({ content: `These buttons aren't for you!`, ephemeral: true });
			}
		});

		collector.on('end', () => {
			interaction.editReply({ components: [] }).catch(() => undefined);
		});
	});

	async function getRecents(selectedCrop?: CropString, expand = false) {
		if (!contestData) return;

		const newEmbed = new MessageEmbed().setColor('#03fc7b')
			.setTitle(`Recent ${selectedCrop ? Data.getReadableCropName(selectedCrop) : 'Jacob\'s'} Contests for ${user?.ign ? user?.ign.replace(/_/g, '\\_') : playerName}${profileName ? ` on ${profileName}` : ``}`)
			.setFooter({ text: `Note: Highscores only valid after ${Data.getReadableDate(Data.CUTOFFDATE)}\nCreated by Kaeso#5346    Can take up to 10 minutes to update` });

		const contests = (selectedCrop) ? contestData.recents[selectedCrop] : contestData.recents.overall;

		let addedIndex = 0;
		const contestAmount = Object.keys(contests).length;
		if (!expand && contestAmount > 4) newEmbed.description = 'Click "Show More" to see more contests!';
		for (let i = 0; i < Math.min(expand ? 10 : 4, contestAmount); i++) {
			const contest = contests[i];

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			if ((contest as any)?.name) contest.profilename = (contest as any).name;

			const details = (contest.par && contest.pos !== undefined) 
				? `\`#${(contest.pos + 1).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}\` of \`${contest.par.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}\` ${!profileName ? ` on \`${contest.profilename}\`!` : ` players!`}` 
				: `${!profileName ? `Unclaimed on \`${contest.profilename}\`!` : `Contest Still Unclaimed!`}`;

			if (!contest.value) continue;
			addedIndex++;

			newEmbed.fields.push({
				name: `${Data.getReadableDate(contest.obtained)}`,
				value: `${(selectedCrop) ? 'Collected ' : `${Data.getReadableCropName(contest?.crop ?? '') ?? 'ERROR'} - `}**${contest.value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}**\n` + details,// + '\n⠀',
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
				value: `Sorry, but ${user?.ign ? user?.ign.replace(/_/g, '\\_') : (playerName ?? 'Player').replace(/_/g, '\\_') } hasn't participated in any ${selectedCrop ? Data.getReadableCropName(selectedCrop) : ''} contests!\n⠀`,
				inline: false
			});
		}

		return newEmbed;
	}

	async function getHighScoreEmbed(allcrops = false) {
		const jacob = contestData;
		if (!jacob) return undefined;

		const scores = jacob.scores;

		const cMedals = jacob.currentmedals;
		const tMedals = jacob.totalmedals;

		const partic = (jacob.firstplace) 
			? `Out of **${jacob.participations.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}** contests, **${user?.ign ? user?.ign.replace(/_/g, '\\_') : (playerName ?? 'Player').replace(/_/g, '\\_') }** has been 1st **${jacob.firstplace.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}** times!`
			: `**${user?.ign ? user?.ign.replace(/_/g, '\\_') : 'N/A'}** has participated in **${jacob.participations.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}** contests!`;

		const embed = new MessageEmbed().setColor('#03fc7b')
			.setTitle(`${!profileName || allcrops ? `Overall ` : ``}Jacob's High Scores for ${user?.ign ? user?.ign.replace(/_/g, '\\_') : (playerName ?? 'Player').replace(/_/g, '\\_') }${profileName ? ` on ${profileName}` : ``}`)
			.setFooter({ text: `Note: Scores only valid after ${Data.getReadableDate(Data.CUTOFFDATE)}\nCreated by Kaeso#5346    Can take up to 10 minutes to update` })
			.setDescription(`🥇 ${cMedals.gold} / **${tMedals.gold}** 🥈 ${cMedals.silver} / **${tMedals.silver}** 🥉 ${cMedals.bronze} / **${tMedals.bronze}**\n${partic}\n⠀`);

		if (profileName || allcrops) {
			let addedIndex = 0;
			for (let i = 0; i < Object.keys(scores).length; i++) {
				const crop = Object.keys(scores)[i] as CropString;
				if (!crop) break;

				const details = (scores[crop].par && scores[crop].pos !== undefined) 
					? `\`#${((scores[crop].pos ?? 0) + 1).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}\` of \`${(scores[crop].par ?? 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}\` ${!profileName ? ` on \`${scores[crop].profilename}\`!` : ` players!`}\n\`${Data.getReadableDate(scores[crop].obtained)}\`` 
					: `${!profileName ? `Unclaimed on \`${scores[crop].profilename}\`!` : `Contest Still Unclaimed!`}\n\`${Data.getReadableDate(scores[crop].obtained)}\``;

				if (!scores[crop].value) continue;
				addedIndex++;

				embed.fields.push({
					name: `${Data.getReadableCropName(crop)} - ${scores[crop].value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`,
					value: details + '\n⠀',
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
					value: `Sorry, but ${user?.ign} hasn't participated in any recent contests!\n⠀`,
					inline: false
				});
			}
		} else {
			const highscores = new Map();

			for (let i = 0; i < Object.keys(scores).length; i++) {
				const crop = Object.keys(scores)[i] as CropString;
				if (!crop) break;
				
				const details = (scores[crop].par && scores[crop].pos !== undefined) 
					? `Placed \`#${((scores[crop].pos ?? 0) + 1).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}\` of \`${(scores[crop].par ?? 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}\` players in \`${Data.getReadableDate(scores[crop].obtained)}!\`` 
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
					value: `Sorry, but ${user?.ign} hasn't participated in any recent contests!\n⠀`,
					inline: false
				});
			} else {
				const sortedHighs = new Map([...highscores.entries()].sort((a, b) => b[1] - a[1]));

				let breakdown = `⠀`;
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
}
// function getJacobData(user, profileName) {
// 	const profiles = user.dataValues?.profiledata?.profiles;

// 	for (let i = 0; i < Object.keys(profiles).length; i++) {
// 		let key = Object.keys(profiles)[i];
// 		let profile = profiles[key];

// 		if (profile.cute_name.toLowerCase() === profileName.toLowerCase()) {
// 			profileName = profile.cute_name;
// 			let p = profile?.members[Object.keys(profile?.members)[0]].jacob
// 			return p ? p : user.dataValues?.contestdata;
// 		}
// 	}
// 	profileName = undefined;
// 	return user.dataValues?.contestdata;
// }

type JacobCMDArgs = {
	playerName?: string,
	profileName?: string
	server?: ServerData,
	ign?: string,
}