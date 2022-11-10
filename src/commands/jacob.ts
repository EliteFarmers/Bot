import { Command } from "../classes/Command";
import { CanUpdateAndFlag } from "../classes/Util";
import { ServerData } from "../database/models/servers";
import { ActionRowBuilder, ApplicationCommandOptionType, ButtonBuilder, ButtonInteraction, ButtonStyle, ChatInputCommandInteraction, CommandInteraction, ComponentType, Embed, EmbedBuilder, Message, SelectMenuBuilder } from 'discord.js';
import Data, { CropString } from '../classes/Data';
import DataHandler from '../classes/Database';
import { FetchAccount, FetchAccountFromDiscord, FetchProfiles } from "src/classes/Elite";
import { ImproperUsageError } from "src/classes/Errors";
import { AccountData } from "src/classes/skyblock";

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
				type: ApplicationCommandOptionType.String,
				description: 'The player in question.',
				required: false,
				autocomplete: true
			},
			{
				name: 'profile',
				type: ApplicationCommandOptionType.String,
				description: 'Optionally specify a profile!',
				required: false
			}
		]
	},
	execute: execute
}

export default command;

async function execute(interaction: ButtonInteraction | ChatInputCommandInteraction) {
	if (interaction instanceof CommandInteraction) {

		const args: JacobCMDArgs = {
			playerName: interaction.options.getString('player', false) ?? undefined,
			profileName: interaction.options.getString('profile', false) ?? undefined
		}

		return await commandExecute(interaction, args);
		
	} else return await commandExecute(interaction, { playerName: interaction.customId.split('|')[1] });
}

async function commandExecute(interaction: ChatInputCommandInteraction | ButtonInteraction, cmdArgs: JacobCMDArgs) {
	let { playerName, profileName } = cmdArgs;

	let account: AccountData | undefined;

	if (!playerName) {
		const user = await FetchAccountFromDiscord(interaction.user.id);

		const embed = new EmbedBuilder()
			.setColor('#CB152B')
			.setTitle('Error: Specify a Username!')
			.addFields({ name: 'Proper Usage:', value: '`/weight` `player:`(player name)' })
			.setDescription('Checking for yourself?\nYou must use `/verify` `player:`(account name) before using this shortcut!')
			.setFooter({ text: 'Created by Kaeso#5346' });

		if (!user?.success || !user.account?.id || !user.account?.name) {
			interaction.reply({ embeds: [embed], ephemeral: true });
			return;
		}
		
		account = user.account;
		playerName = user.account.name;

		if (!playerName) {
			interaction.reply({ embeds: [embed], ephemeral: true });
			return;
		}
	}

	if (!account) {
		const acc = await FetchAccount(playerName);
		if (!acc?.success || !acc.account) {
			const embed = ImproperUsageError('Error: Invalid Username!', `Player "${playerName}" does not exist.`, '`/weight` `player:`(player name)');
			interaction.reply({ embeds: [embed], ephemeral: true });
			return;
		}
		account = acc.account;
	}

	const { id: uuid } = account;

	await interaction.deferReply();

	const user = await FetchProfiles(uuid);

	if (!user?.success) {
		const embed = new EmbedBuilder().setColor('#CB152B')
			.setTitle('Error: Couldn\'t Get User!')
			.setDescription(`Couldn't fetch user. Try again or look here: https://elitebot.dev/stats/${uuid}`)
			.setFooter({ text: 'Contact Kaeso#5346 if this continues to happen!' });
		return interaction.reply({ embeds: [embed], ephemeral: true });
	}

	const profiles = user.profiles;

	const profile = profiles.find(p => p.cute_name?.toLowerCase() === profileName?.toLowerCase()) 
		?? profiles.find(p => p.selected) 
		?? profiles[0];

	const jacob = profile.member.jacob;

	const embed = await getHighScoreEmbed();
	if (!embed) { return; }

	const scoresCount = Object.values(jacob.contests).reduce((a, b) => a + b.length, 0);

	const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder()
			.setCustomId('overall')
			.setLabel('Overall Stats')
			.setStyle(ButtonStyle.Success)
			.setDisabled(profileName !== undefined),
		new ButtonBuilder()
			.setCustomId('crops')
			.setLabel('All Crops')
			.setStyle(ButtonStyle.Secondary)
			.setDisabled(profileName !== undefined && scoresCount <= 3),
		new ButtonBuilder()
			.setCustomId('recents')
			.setLabel('Recent Contests')
			.setStyle(ButtonStyle.Primary)
	);

	const args = {
		components: [row],
		embeds: [embed],
		allowedMentions: { repliedUser: false },
		fetchReply: true
	}
	
	const select = new ActionRowBuilder<SelectMenuBuilder>().addComponents(
		new SelectMenuBuilder().setCustomId('select')
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
		const collector = reply.createMessageComponentCollector({ componentType: ComponentType.Button, time: 30_000 });

		collector.on('collect', async i => {
			if (i.user.id === interaction.user.id) {
				collector.resetTimer({ time: 30000 });

				const newRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
					new ButtonBuilder()
						.setCustomId('overall')
						.setLabel('Overall Stats')
						.setStyle(ButtonStyle.Success)
						.setDisabled(i.customId === 'overall'),
					new ButtonBuilder()
						.setCustomId('crops')
						.setLabel('All Crops')
						.setStyle(ButtonStyle.Primary)
						.setDisabled(i.customId === 'crops' || scoresCount > 3),
					new ButtonBuilder()
						.setCustomId('recents')
						.setLabel('Recent Contests')
						.setStyle(ButtonStyle.Primary)
						.setDisabled(i.customId === 'recents')
				);

				const recentRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
					new ButtonBuilder()
						.setCustomId('overall')
						.setLabel('Overall Stats')
						.setStyle(ButtonStyle.Secondary)
						.setDisabled(i.customId === 'overall'),
					new ButtonBuilder()
						.setCustomId('expand')
						.setLabel('Show More')
						.setStyle(ButtonStyle.Success)
						.setDisabled(i.customId === 'expand'),
					new ButtonBuilder()
						.setCustomId('recents')
						.setLabel('Recent Contests')
						.setStyle(ButtonStyle.Primary)
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
						const newCollector = reply.createMessageComponentCollector({ componentType: ComponentType.StringSelect, time: 30_000 });

						newCollector.on('collect', async inter => {
							if (inter.user.id === interaction.user.id) {
								collector.resetTimer({ time: 30_000 });
								newCollector.resetTimer({ time: 30_000 });

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
		if (!jacob) return;

		const newEmbed = new EmbedBuilder().setColor('#03fc7b')
			.setTitle(`Recent ${selectedCrop ? Data.getReadableCropName(selectedCrop) : 'Jacob\'s'} Contests for ${playerName?.replace(/_/g, '\\_')}${profileName ? ` on ${profileName}` : ``}`)
			.setFooter({ text: `Note: Highscores only valid after ${Data.getReadableDate(Data.CUTOFFDATE)}\nCreated by Kaeso#5346    Can take up to 10 minutes to update` });

		const contests = (selectedCrop) ? jacob.contests[selectedCrop] : Object.values(jacob.contests).flatMap(c => c);
		contests.sort((a, b) => b.timestamp - a.timestamp);

		let addedIndex = 0;
		const contestAmount = contests.length;

		if (!expand && contestAmount > 4) newEmbed.setDescription('Click "Show More" to see more contests!');

		for (let i = 0; i < Math.min(expand ? 10 : 4, contestAmount); i++) {
			const contest = contests[i];

			const details = (contest.participants && contest.position !== undefined) 
				? `\`#${(contest.position + 1).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}\` of \`${contest.participants.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}\` ${profileName ? ` on \`${profileName}\`!` : ` players!`}` 
				: `${profileName ? `Unclaimed on \`${profileName}\`!` : `Contest Still Unclaimed!`}`;

			if (!contest.collected) continue;
			addedIndex++;

			newEmbed.addFields({
				name: `${Data.getReadableDate(contest.collected)}`,
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