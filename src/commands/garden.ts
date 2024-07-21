import { ChatInputCommandInteraction, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import { Command, CommandAccess, CommandType } from '../classes/Command.js';
import { FetchAccount, FetchProfile, UserSettings } from '../api/elite.js';
import { EliteEmbed, EmptyField, EmptyString, ErrorEmbed, NotYoursReply, PrefixFooter, WarningEmbed } from '../classes/embeds.js';
import { GetCropEmoji } from '../classes/Util.js';
import playerAutocomplete from '../autocomplete/player.js';
import { compareRarity, Crop, getCropDisplayName, getCropFromName, getCropMilestones, getCropUpgrades, getGardenLevel, groupGardenVisitors, Rarity } from 'farming-weight';

const command: Command = {
	name: 'garden',
	description: 'Get garden stats for a player\'s profile!',
	usage: '(username) (profile name)',
	access: CommandAccess.Everywhere,
	type: CommandType.Slash,
	slash: new SlashCommandBuilder()
		.addStringOption(option => option.setName('player')
			.setDescription('The player in question.')
			.setAutocomplete(true)
			.setRequired(false))
		.addStringOption(option => option.setName('profile')
			.setDescription('Optionally specify a profile!')
			.setRequired(false)),
	execute: execute,
	autocomplete: playerAutocomplete
}

export default command;

const plots: Record<string, number[]> = {
	"beginner_2": [ 2, 1 ], 
	"beginner_1": [ 1, 2 ], 
	"beginner_4": [ 3, 2 ], 
	"beginner_3": [ 2, 3 ], 
	"intermediate_1": [ 1, 1 ], 
	"intermediate_3": [ 3, 1 ], 
	"intermediate_2": [ 1, 3 ], 
	"intermediate_4": [ 3, 3 ], 
	"advanced_6": [ 2, 0 ], 
	"advanced_2": [ 0, 2 ], 
	"advanced_11": [ 4, 2 ], 
	"advanced_7": [ 2, 4 ], 
	"advanced_4": [ 1, 0 ], 
	"advanced_8": [ 3, 0 ], 
	"advanced_1": [ 0, 1 ], 
	"advanced_10": [ 4, 1 ], 
	"advanced_3": [ 0, 3 ], 
	"advanced_12": [ 4, 3 ], 
	"advanced_5": [ 1, 4 ], 
	"advanced_9": [ 3, 4 ], 
	"expert_1": [ 0, 0 ], 
	"expert_3": [ 4, 0 ], 
	"expert_2": [ 0, 4 ], 
	"expert_4": [ 4, 4 ], 
}

async function execute(interaction: ChatInputCommandInteraction, settings?: UserSettings) {
	let playerName = interaction.options.getString('player', false)?.trim();
	const _profileName = interaction.options.getString('profile', false)?.trim();

	await interaction.deferReply();

	const { data: account } = await FetchAccount(playerName ?? interaction.user.id).catch(() => ({ data: undefined }));

	if (!account?.id || !account?.name) {
		const embed = WarningEmbed('Invalid Username!')
			.addFields({ name: 'Proper Usage:', value: '`/garden` `player:`(player name)\nOr link your account with </verify:1135100641560248334> first!' });

		if (playerName) {
			embed.setDescription(`Player \`${playerName}\` does not exist (or an error occured)`);
		} else {
			embed.setDescription('You need to link your account or enter a playername!');
		}

		await interaction.deleteReply().catch(() => undefined);
		interaction.followUp({ embeds: [embed], ephemeral: true });
		return;
	}

	playerName = account.name;

	const profile = _profileName 
		? account.profiles?.find(p => p?.profileName?.toLowerCase() === _profileName.toLowerCase())
		: account.profiles?.find(p => p.selected) ?? account.profiles?.[0];

	if (!profile?.profileId || !profile.profileName) {
		const embed = ErrorEmbed('Invalid Profile!')
			.setDescription(`Profile "${_profileName}" does not exist.`)
			.addFields({ name: 'Proper Usage:', value: '`/weight` `player:`(player name) `profile:`(profile name)' });
		await interaction.deleteReply().catch(() => undefined);
		interaction.followUp({ embeds: [embed], ephemeral: true });
		return;
	}

	const { data: member } = await FetchProfile(account.id, profile.profileId).catch(() => ({ data: undefined }));
	const garden = member?.garden;

	if (!member) {
		const embed = ErrorEmbed('Couldn\'t fetch data!')
			.setDescription(`Something went wrong when getting garden data for "${playerName}".`)
			.setFooter({ text: 'Contact kaeso.dev if this continues to happen' });
		await interaction.deleteReply().catch(() => undefined);
		interaction.followUp({ embeds: [embed], ephemeral: true });
		return;
	}

	if (!garden) {
		const embed = WarningEmbed(`Stats for ${playerName.replace(/_/g, '\\_')}`)
			.addFields({ 
				name: 'Garden data not found!', 
				value: 'If garden is unlocked, please wait a moment and try again.' 
			})
			.setThumbnail(`https://mc-heads.net/head/${account.id}/left`);

		interaction.editReply({ embeds: [embed] });
		return;
	}

	const rejectedVisitors = Object.values(garden?.visitors ?? {})
		.reduce((acc, v) => acc + ((v?.visits ?? 0) - (v?.accepted ?? 0)), 0);
	
	const reply = await interaction.editReply(getGardenPayload());

	const collector = reply.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60_000 });

	collector.on('collect', async (button) => {
		collector.resetTimer();

		if (button.user.id !== interaction.user.id) {
			NotYoursReply(button);
			return;
		}

		if (button.customId === 'garden') {
			await button.update(getGardenPayload());
		}

		if (button.customId === 'visitors') {
			await button.update(getVisitorsPayload());
		}

		if (button.customId === 'uncommon') {
			await button.update(getVisitorsPayload(true));
		}
	});

	collector.on('end', () => {
		const linkRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder()
				.setLabel(`@${account?.name}/${profile?.profileName}`)
				.setURL(`https://elitebot.dev/@${account?.name}/${encodeURIComponent(profile?.profileName ?? '')}`)
				.setStyle(ButtonStyle.Link)
		);

		reply.edit({ components: [linkRow] }).catch(() => undefined);
	});

	function getGardenPayload() {
		const embed = EliteEmbed(settings)
			.setTitle(`Garden Stats for ${playerName?.replace(/_/g, '\\_')} (${profile?.profileName})`)

		const gardenLevel = getGardenLevel(garden?.experience ?? 0);

		let levelText = '';
		if (gardenLevel.goal) {
			levelText += `\n${(gardenLevel.ratio * 100).toFixed(2)}% to level **${gardenLevel.next}**`;
		}
		levelText += `\n-# ${(garden?.experience ?? 0).toLocaleString()} Total XP`;

		levelText += `\n\n**Visitors**`;
		levelText += `\nUnique • **${garden?.uniqueVisitors ?? 0}**/84`;
		levelText += `\nAccepted • **${garden?.completedVisitors ?? 0}**`;
		levelText += `\nRejected • **${rejectedVisitors ?? 0}**`;

		embed.addFields({
			name: `Garden Level **${gardenLevel.level}**`,
			value: levelText,
			inline: true
		});

		embed.addFields(EmptyField());

		const unlockedPlots = [
			[ '⬛', '⬛', '⬛', '⬛', '⬛' ],
			[ '⬛', '⬛', '⬛', '⬛', '⬛' ],
			[ '⬛', '⬛', '🏡', '⬛', '⬛' ],
			[ '⬛', '⬛', '⬛', '⬛', '⬛' ],
			[ '⬛', '⬛', '⬛', '⬛', '⬛' ],
		];

		for (const plotname of (garden?.plots ?? [])) {
			const plot = plots[plotname as keyof typeof plots];
			if (!plot) continue;
			const [ x, y ] = plot;
			unlockedPlots[y][x] = '🟩';
		}

		const plotText = unlockedPlots.map(row => row.join('')).join('\n');

		embed.addFields({
			name: `Plots • ${garden?.plots?.length ?? 0}/24`,
			value: plotText,
			inline: true
		});

		const cropUpgrades = getCropUpgrades((garden?.cropUpgrades ?? {}) as Record<string, number>);
		const milestones = getCropMilestones((garden?.crops ?? {}) as Record<string, number>);
		const cropText = Object.entries(milestones)
			.sort(([, a], [, b]) => {
				if (a.level === b.level) return b.total - a.total;
				return b.level - a.level;
			})
			.map(([ key, value ]) => {
				const crop = getCropFromName(key) ?? Crop.Wheat;
				const name = getCropDisplayName(crop);
				const emoji = GetCropEmoji(name);
				const upgrade = cropUpgrades[crop] ?? 0;

				return `${emoji} **${value.level}** ${EmptyString} ${EmptyString} **${upgrade}**/9`
					+ `\n-# ${value.total.toLocaleString()} ${name}`;
			});

		embed.addFields({
			name: 'Crop Milestones',
			value: cropText.slice(0, 5).join('\n') || 'No crop milestone progress yet!',
			inline: true
		});

		embed.addFields(EmptyField());

		if (cropText.length > 5) {
			embed.addFields({
				name: EmptyString,
				value: cropText.slice(5).join('\n'),
				inline: true
			});
		}

		const linkRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder()
				.setLabel('Visitor Stats')
				.setCustomId('visitors')
				.setStyle(ButtonStyle.Success),
			new ButtonBuilder()
				.setLabel(`@${account?.name}/${profile?.profileName}`)
				.setURL(`https://elitebot.dev/@${account?.name}/${encodeURIComponent(profile?.profileName ?? '')}`)
				.setStyle(ButtonStyle.Link)
		);

		return { embeds: [embed], components: [linkRow] };
	}

	function getVisitorsPayload(uncommon = false) {
		const visitorsByRarity = groupGardenVisitors((garden?.visitors ?? {}) as Record<string, { visits: number; accepted: number; }>);

		let fieldCount = 0;
		const visitorsList = Object.entries(visitorsByRarity)
			.sort(([ a ], [ b ]) => compareRarity(b as Rarity, a as Rarity))
			.map(([ rarity, visitors ], i) => {
				if (uncommon && rarity !== Rarity.Uncommon) return undefined;

				const accepted = visitors.reduce((acc, v) => acc + v.accepted, 0);
				const visits = visitors.reduce((acc, v) => acc + v.visits, 0);

				const skipText = rarity === Rarity.Uncommon && !uncommon;
				const splitBy = visitors.length > 5 ? Math.ceil(visitors.length / 3) : 5;
				const result = [];

				if (rarity === Rarity.Legendary && i > 0) {
					fieldCount++;
					result.push(EmptyField());
				}

				if (!uncommon && rarity === Rarity.Uncommon && fieldCount < 3) {
					fieldCount++;
					result.push(EmptyField());
					if (fieldCount < 3) {
						fieldCount++;
						result.push(EmptyField());
					}
				}

				for (let i = 0; i < visitors.length; i += splitBy) {
					const chunk = visitors.slice(i, i + splitBy);

					fieldCount++;
					result.push({
						name: i === 0 ? `**${rarity}** • **${accepted}**/${visits}` : EmptyString,
						value: skipText 
							? '-# Click "Uncommon Visitors" to see these!'
							: chunk.map(v => `-# ${v.short ?? v.name} • **${v.accepted}**/${v.visits}`).join('\n'),
						inline: true
					});

					if (skipText) break;
				}

				return result;
			}).filter(a => a).flat() as { name: string; value: string; inline: boolean }[];
		
		const embed = EliteEmbed(settings)
			.setTitle(`Visitors for ${playerName?.replace(/_/g, '\\_')} (${profile?.profileName})`)
			.setDescription(
				`Unique • **${garden?.uniqueVisitors ?? 0}**/84 ${EmptyString} • ${EmptyString} Accepted • **${garden?.completedVisitors ?? 0}** ${EmptyString} • ${EmptyString} Rejected • **${rejectedVisitors ?? 0}**`
				+ '\nAcceptance Rate • **' + ((garden?.completedVisitors ?? 0) / ((garden?.completedVisitors ?? 0) + rejectedVisitors) * 100).toFixed(2) + '%**'
			)

		embed.addFields(visitorsList);

		PrefixFooter(embed, 'Numbers are (accepted/visits) for each visitor and rarity');

		const linkRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder()
				.setLabel('Garden Stats')
				.setCustomId('garden')
				.setStyle(ButtonStyle.Success),
			new ButtonBuilder()
				.setLabel(uncommon ? 'Back' : 'Uncommon Visitors')
				.setCustomId(uncommon ? 'visitors' : 'uncommon')
				.setStyle(ButtonStyle.Secondary),
			new ButtonBuilder()
				.setLabel(`@${account?.name}/${profile?.profileName}`)
				.setURL(`https://elitebot.dev/@${account?.name}/${encodeURIComponent(profile?.profileName ?? '')}`)
				.setStyle(ButtonStyle.Link),
		);

		return { embeds: [embed], components: [linkRow] };
	}
}