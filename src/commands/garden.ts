import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, ComponentType } from 'discord.js';
import {
	Crop,
	compareRarity,
	GARDEN_VISITORS,
	GardenVisitor,
	getCropDisplayName,
	getCropFromName,
	getCropMilestones,
	getCropUpgrades,
	getGardenLevel,
	groupGardenVisitors,
	Rarity,
} from 'farming-weight';
import { FetchProfile, UserSettings } from '../api/elite.js';
import { elitePlayerOption } from '../autocomplete/player.js';
import { CommandAccess, CommandType, EliteCommand, SlashCommandOptionType } from '../classes/commands/index.js';
import {
	EliteEmbed,
	EmptyField,
	EmptyString,
	ErrorEmbed,
	NotYoursReply,
	PrefixFooter,
	WarningEmbed,
} from '../classes/embeds.js';
import { escapeIgn, GetCropEmoji } from '../classes/Util.js';
import { getAccount } from '../classes/validate.js';

const command = new EliteCommand({
	name: 'garden',
	description: "Get garden stats for a player's profile!",
	access: CommandAccess.Everywhere,
	type: CommandType.Slash,
	options: {
		player: elitePlayerOption,
		profile: {
			name: 'profile',
			description: 'Optionally specify a profile!',
			type: SlashCommandOptionType.String,
		},
	},
	execute: execute,
});

export default command;

const plots: Record<string, number[]> = {
	beginner_2: [2, 1],
	beginner_1: [1, 2],
	beginner_4: [3, 2],
	beginner_3: [2, 3],
	intermediate_1: [1, 1],
	intermediate_3: [3, 1],
	intermediate_2: [1, 3],
	intermediate_4: [3, 3],
	advanced_6: [2, 0],
	advanced_2: [0, 2],
	advanced_11: [4, 2],
	advanced_7: [2, 4],
	advanced_4: [1, 0],
	advanced_8: [3, 0],
	advanced_1: [0, 1],
	advanced_10: [4, 1],
	advanced_3: [0, 3],
	advanced_12: [4, 3],
	advanced_5: [1, 4],
	advanced_9: [3, 4],
	expert_1: [0, 0],
	expert_3: [4, 0],
	expert_2: [0, 4],
	expert_4: [4, 4],
};

async function execute(interaction: ChatInputCommandInteraction, settings?: UserSettings) {
	const playerNameInput = interaction.options.getString('player', false)?.trim();
	const profileNameInput = interaction.options.getString('profile', false)?.trim();

	await interaction.deferReply();

	const result = await getAccount(playerNameInput, profileNameInput, command, interaction.user.id);

	if (!result.success) {
		await interaction.editReply({ embeds: [result.embed] });
		return;
	}

	const { account, profile, name: playerName } = result;

	const { data: member } = await FetchProfile(account.id, profile.profileId).catch(() => ({ data: undefined }));
	const garden = member?.garden;

	if (!member) {
		const embed = ErrorEmbed("Couldn't fetch data!")
			.setDescription(`Something went wrong when getting garden data for "${escapeIgn(playerName)}".`)
			.setFooter({ text: 'Contact kaeso.dev if this continues to happen' });
		await interaction.deleteReply().catch(() => undefined);
		interaction.followUp({ embeds: [embed], ephemeral: true });
		return;
	}

	if (!garden) {
		const embed = WarningEmbed(`Stats for ${escapeIgn(playerName)}`)
			.addFields({
				name: 'Garden data not found!',
				value: 'If garden is unlocked, please wait a moment and try again.',
			})
			.setThumbnail(`https://mc-heads.net/head/${account.id}/left`);

		interaction.editReply({ embeds: [embed] });
		return;
	}

	// Check if overflow should be included
	const gardenOverflow = getGardenLevel(garden?.experience ?? 0, true).level > 15;
	const milestoneOverflow = Object.values(
		getCropMilestones((garden?.crops ?? {}) as Record<string, number>, true),
	).some((v) => v.level > 46);

	const includeOverflow = gardenOverflow || milestoneOverflow;
	let overflow = includeOverflow;

	const rejectedVisitors = Object.values(garden?.visitors ?? {}).reduce(
		(acc, v) => acc + ((v?.visits ?? 0) - (v?.accepted ?? 0)),
		0,
	);

	const reply = await interaction.editReply(getGardenPayload());

	const collector = reply.createMessageComponentCollector({
		componentType: ComponentType.Button,
		time: 60_000,
	});

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
			await button.update(getVisitorsPayload('uncommon'));
		}

		if (button.customId === 'uncommon-2') {
			await button.update(getVisitorsPayload('uncommon-2'));
		}

		if (button.customId === 'rare') {
			await button.update(getVisitorsPayload('rare'));
		}

		if (button.customId === 'overflow') {
			overflow = !overflow;
			await button.update(getGardenPayload());
		}

		if (button.customId === 'missing') {
			await button.update(getMissingVisitors());
		}

		if (button.customId === 'missing-uncommon') {
			await button.update(getMissingVisitors('uncommon'));
		}

		if (button.customId === 'missing-uncommon-2') {
			await button.update(getMissingVisitors('uncommon-2'));
		}

		if (button.customId === 'missing-rare') {
			await button.update(getMissingVisitors('rare'));
		}
	});

	collector.on('end', () => {
		const linkRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder()
				.setLabel(`@${account?.name}/${profile?.profileName}`)
				.setURL(`https://elitesb.gg/@${account?.name}/${encodeURIComponent(profile?.profileName ?? '')}`)
				.setStyle(ButtonStyle.Link),
		);

		reply.edit({ components: [linkRow] }).catch(() => undefined);
	});

	function getGardenPayload() {
		const embed = EliteEmbed(settings).setTitle(`Garden Stats for ${escapeIgn(playerName)} (${profile?.profileName})`);

		const gardenLevel = getGardenLevel(garden?.experience ?? 0, overflow);

		let levelText = '';
		if (gardenLevel.goal) {
			levelText += `\n${(gardenLevel.ratio * 100).toFixed(2)}% to level **${gardenLevel.next}**`;
		}
		levelText += `\n-# ${(garden?.experience ?? 0).toLocaleString()} Total XP`;

		levelText += `\n**Visitors**`;
		levelText += `\nUnique • **${(garden?.uniqueVisitors ?? 0).toLocaleString()}**/137`;
		levelText += `\nAccepted • **${(garden?.completedVisitors ?? 0).toLocaleString()}**`;
		levelText += `\nRejected • **${(rejectedVisitors ?? 0).toLocaleString()}**`;

		embed.addFields({
			name: `Garden Level **${gardenLevel.level}**`,
			value: levelText,
			inline: true,
		});

		embed.addFields(EmptyField());

		const unlockedPlots = [
			['⬛', '⬛', '⬛', '⬛', '⬛'],
			['⬛', '⬛', '⬛', '⬛', '⬛'],
			['⬛', '⬛', '🏡', '⬛', '⬛'],
			['⬛', '⬛', '⬛', '⬛', '⬛'],
			['⬛', '⬛', '⬛', '⬛', '⬛'],
		];

		for (const plotname of garden?.plots ?? []) {
			const plot = plots[plotname as keyof typeof plots];
			if (!plot) continue;
			const [x, y] = plot;
			unlockedPlots[y][x] = '🟩';
		}

		const plotText = unlockedPlots.map((row) => row.join('')).join('\n');

		embed.addFields({
			name: `Plots • ${garden?.plots?.length ?? 0}/24`,
			value: plotText,
			inline: true,
		});

		const cropUpgrades = getCropUpgrades((garden?.cropUpgrades ?? {}) as Record<string, number>);
		const milestones = getCropMilestones((garden?.crops ?? {}) as Record<string, number>, overflow);
		const cropText = Object.entries(milestones)
			.sort(([, a], [, b]) => {
				if (a.level === b.level) return b.total - a.total;
				return b.level - a.level;
			})
			.map(([key, value]) => {
				const crop = getCropFromName(key) ?? Crop.Wheat;
				const name = getCropDisplayName(crop);
				const emoji = GetCropEmoji(name);
				const upgrade = cropUpgrades[crop] ?? 0;

				return (
					`${emoji} **${value.level.toLocaleString()}** ${EmptyString} ${EmptyString} **${upgrade}**/9` +
					`\n-# ${value.total.toLocaleString()} ${name}`
				);
			});

		embed.addFields({
			name: 'Crop Milestones',
			value: cropText.slice(0, 7).join('\n') || 'No crop milestone progress yet!',
			inline: true,
		});

		embed.addFields(EmptyField());

		const milestonesValues = Object.values(milestones);
		const milestoneAvg = Object.values(milestones).reduce((acc, v) => acc + v.level, 0) / milestonesValues.length;

		if (cropText.length > 7) {
			embed.addFields({
				name: `Average • ${(+milestoneAvg.toFixed(1)).toLocaleString()}`,
				value: cropText.slice(7).join('\n'),
				inline: true,
			});
		}

		const linkRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder().setLabel('Visitor Stats').setCustomId('visitors').setStyle(ButtonStyle.Success),
		);

		if (includeOverflow) {
			linkRow.addComponents(
				new ButtonBuilder().setLabel('Overflow').setCustomId('overflow').setStyle(ButtonStyle.Secondary),
			);
		}

		linkRow.addComponents(
			new ButtonBuilder()
				.setLabel(`@${account?.name}/${profile?.profileName}`)
				.setURL(`https://elitesb.gg/@${account?.name}/${encodeURIComponent(profile?.profileName ?? '')}`)
				.setStyle(ButtonStyle.Link),
		);

		if (overflow) {
			PrefixFooter(embed, 'Showing overflow milestones and garden level!');
		}

		return { embeds: [embed], components: [linkRow] };
	}

	function getVisitorsPayload(page: 'main' | 'uncommon' | 'uncommon-2' | 'rare' = 'main') {
		const visitorsByRarity = groupGardenVisitors(
			(garden?.visitors ?? {}) as Record<string, { visits: number; accepted: number }>,
		);

		const uncommonVisitors = visitorsByRarity[Rarity.Uncommon] ?? [];
		const rareVisitors = visitorsByRarity[Rarity.Rare] ?? [];
		const uncommonHalfLength = Math.ceil(uncommonVisitors.length / 2);

		let fieldCount = 0;
		const visitorsList = Object.entries(visitorsByRarity)
			.sort(([a], [b]) => compareRarity(b as Rarity, a as Rarity))
			.map(([rarity, visitors]) => {
				const isUncommon = rarity === Rarity.Uncommon;
				const isRare = rarity === Rarity.Rare;

				if (page === 'uncommon' && !isUncommon) return undefined;
				if (page === 'uncommon-2' && !isUncommon) return undefined;
				if (page === 'rare' && !isRare) return undefined;

				const accepted = visitors.reduce((acc, v) => acc + v.accepted, 0);
				const visits = visitors.reduce((acc, v) => acc + v.visits, 0);

				const skipUncommon = isUncommon && page === 'main';
				const skipRare = isRare && page === 'main';

				let displayVisitors = visitors;
				if (page === 'uncommon') {
					displayVisitors = visitors.slice(0, uncommonHalfLength);
				} else if (page === 'uncommon-2') {
					displayVisitors = visitors.slice(uncommonHalfLength);
				}

				const splitBy = displayVisitors.length > 5 ? Math.ceil(displayVisitors.length / 3) : 5;
				const result = [];

				if (rarity !== Rarity.Special && rarity !== Rarity.Mythic) {
					while (fieldCount % 3 !== 0) {
						fieldCount++;
						result.push(EmptyField());
					}
				}

				if (skipUncommon || skipRare) {
					fieldCount++;
					result.push({
						name: `**${rarity}** • **${accepted.toLocaleString()}**/${visits.toLocaleString()}`,
						value: `-# Click "${rarity}" to see these!`,
						inline: true,
					});
					return result;
				}

				for (let i = 0; i < displayVisitors.length; i += splitBy) {
					const chunk = displayVisitors.slice(i, i + splitBy);

					fieldCount++;
					const headerName =
						page === 'uncommon-2' && i === 0
							? `**${rarity}** (cont.)`
							: i === 0
								? `**${rarity}** • **${accepted.toLocaleString()}**/${visits.toLocaleString()}`
								: EmptyString;
					result.push({
						name: headerName,
						value: chunk.map((v) => `-# ${v.short ?? v.name} • **${v.accepted}**/${v.visits}`).join('\n'),
						inline: true,
					});
				}

				return result;
			})
			.filter((a) => a)
			.flat() as { name: string; value: string; inline: boolean }[];

		const acceptanceRate =
			((garden?.completedVisitors ?? 0) / ((garden?.completedVisitors ?? 0) + rejectedVisitors)) * 100;
		const acceptanceRateText = isNaN(acceptanceRate) ? '0.00' : `${acceptanceRate.toFixed(2)}`;

		let titleSuffix = '';
		if (page === 'uncommon') titleSuffix = ' - Uncommon (1/2)';
		else if (page === 'uncommon-2') titleSuffix = ' - Uncommon (2/2)';
		else if (page === 'rare') titleSuffix = ' - Rare';

		const embed = EliteEmbed(settings)
			.setTitle(`Visitors for ${escapeIgn(playerName)} (${profile?.profileName})${titleSuffix}`)
			.setDescription(
				`Unique • **${(garden?.uniqueVisitors ?? 0).toLocaleString()}**/137 ${EmptyString} • ${EmptyString} Accepted • **${(garden?.completedVisitors ?? 0).toLocaleString()}** ${EmptyString} • ${EmptyString} Rejected • **${(rejectedVisitors ?? 0).toLocaleString()}**` +
					'\nAcceptance Rate • **' +
					acceptanceRateText +
					'%**',
			);

		embed.addFields(visitorsList);

		PrefixFooter(embed, 'Numbers are (accepted/visits) for each visitor and rarity');

		const linkRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder().setLabel('Garden Stats').setCustomId('garden').setStyle(ButtonStyle.Success),
		);

		if (garden?.uniqueVisitors !== Object.keys(GARDEN_VISITORS).length) {
			linkRow.addComponents(
				new ButtonBuilder().setLabel('Missing').setCustomId('missing').setStyle(ButtonStyle.Success),
			);
		}

		if (page === 'main') {
			if (rareVisitors.length > 0) {
				linkRow.addComponents(new ButtonBuilder().setLabel('Rare').setCustomId('rare').setStyle(ButtonStyle.Secondary));
			}
			if (uncommonVisitors.length > 0) {
				linkRow.addComponents(
					new ButtonBuilder().setLabel('Uncommon').setCustomId('uncommon').setStyle(ButtonStyle.Secondary),
				);
			}
		} else if (page === 'rare') {
			linkRow.addComponents(
				new ButtonBuilder().setLabel('Back').setCustomId('visitors').setStyle(ButtonStyle.Secondary),
			);
		} else if (page === 'uncommon') {
			linkRow.addComponents(
				new ButtonBuilder().setLabel('Back').setCustomId('visitors').setStyle(ButtonStyle.Secondary),
				new ButtonBuilder().setLabel('Page 2').setCustomId('uncommon-2').setStyle(ButtonStyle.Secondary),
			);
		} else if (page === 'uncommon-2') {
			linkRow.addComponents(
				new ButtonBuilder().setLabel('Page 1').setCustomId('uncommon').setStyle(ButtonStyle.Secondary),
				new ButtonBuilder().setLabel('Back').setCustomId('visitors').setStyle(ButtonStyle.Secondary),
			);
		}

		linkRow.addComponents(
			new ButtonBuilder()
				.setLabel(`@${account?.name}/${profile?.profileName}`)
				.setURL(`https://elitesb.gg/@${account?.name}/${encodeURIComponent(profile?.profileName ?? '')}`)
				.setStyle(ButtonStyle.Link),
		);

		return { embeds: [embed], components: [linkRow] };
	}

	function getMissingVisitors(page: 'main' | 'uncommon' | 'uncommon-2' | 'rare' = 'main') {
		const visitedVisitors = (garden?.visitors ?? {}) as Record<
			string,
			{ visits: number; accepted: number } | undefined
		>;

		const missingVisitors = Object.entries(GARDEN_VISITORS).reduce<Partial<Record<Rarity, GardenVisitor[]>>>(
			(acc, [visitor, data]) => {
				const current = visitedVisitors[visitor];
				if ((current && current.accepted > 0) || !data) {
					return acc; // Not missing
				}
				acc[data.rarity] ??= [];
				acc[data.rarity]?.push(data);
				return acc;
			},
			{},
		);

		const missingUncommon = missingVisitors[Rarity.Uncommon] ?? [];
		const missingRare = missingVisitors[Rarity.Rare] ?? [];
		const uncommonHalfLength = Math.ceil(missingUncommon.length / 2);

		const skipUncommon = page === 'main' && missingUncommon.length > 15;
		const skipRare = page === 'main' && missingRare.length > 10;

		let fieldCount = 0;
		const visitorsList = Object.entries(missingVisitors)
			.sort(([a], [b]) => compareRarity(b as Rarity, a as Rarity))
			.map(([rarity, visitors]) => {
				const isUncommon = rarity === Rarity.Uncommon;
				const isRare = rarity === Rarity.Rare;

				if (page === 'uncommon' && !isUncommon) return undefined;
				if (page === 'uncommon-2' && !isUncommon) return undefined;
				if (page === 'rare' && !isRare) return undefined;

				const shouldSkip = (isUncommon && skipUncommon) || (isRare && skipRare);

				let displayVisitors = visitors;
				if (page === 'uncommon') {
					displayVisitors = visitors.slice(0, uncommonHalfLength);
				} else if (page === 'uncommon-2') {
					displayVisitors = visitors.slice(uncommonHalfLength);
				}

				const splitBy = displayVisitors.length > 5 ? Math.ceil(displayVisitors.length / 3) : 5;
				const result = [];

				if (rarity !== Rarity.Special && rarity !== Rarity.Mythic) {
					while (fieldCount % 3 !== 0) {
						fieldCount++;
						result.push(EmptyField());
					}
				}

				if (shouldSkip) {
					fieldCount++;
					result.push({
						name: `**${rarity}** • **${visitors.length} Missing**`,
						value: `-# Click "Missing ${rarity}" to see these!`,
						inline: true,
					});
					return result;
				}

				for (let i = 0; i < displayVisitors.length; i += splitBy) {
					const chunk = displayVisitors.slice(i, i + splitBy);

					fieldCount++;
					const headerName =
						page === 'uncommon-2' && i === 0
							? `**${rarity}** (cont.) • **${visitors.length} Missing**`
							: i === 0
								? `**${rarity}** • **${visitors.length} Missing**`
								: EmptyString;
					result.push({
						name: headerName,
						value: chunk.map((v) => `-# ${v.short ?? v.name} [⧉](${v.wiki})`).join('\n'),
						inline: true,
					});
				}

				return result;
			})
			.filter((a) => a)
			.flat() as { name: string; value: string; inline: boolean }[];

		const acceptanceRate =
			((garden?.completedVisitors ?? 0) / ((garden?.completedVisitors ?? 0) + rejectedVisitors)) * 100;
		const acceptanceRateText = isNaN(acceptanceRate) ? '0.00' : `${acceptanceRate.toFixed(2)}`;

		let titleSuffix = '';
		if (page === 'uncommon') titleSuffix = ' - Uncommon (1/2)';
		else if (page === 'uncommon-2') titleSuffix = ' - Uncommon (2/2)';
		else if (page === 'rare') titleSuffix = ' - Rare';

		const embed = EliteEmbed(settings)
			.setTitle(`Missing Visitors for ${escapeIgn(playerName)} (${profile?.profileName})${titleSuffix}`)
			.setDescription(
				`Unique • **${(garden?.uniqueVisitors ?? 0).toLocaleString()}**/137 ${EmptyString} • ${EmptyString} Accepted • **${(garden?.completedVisitors ?? 0).toLocaleString()}** ${EmptyString} • ${EmptyString} Rejected • **${(rejectedVisitors ?? 0).toLocaleString()}**` +
					'\nAcceptance Rate • **' +
					acceptanceRateText +
					'%**',
			);

		embed.addFields(visitorsList);

		const linkRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder().setLabel('Visitor Stats').setCustomId('visitors').setStyle(ButtonStyle.Success),
		);

		if (page === 'main') {
			if (skipRare) {
				linkRow.addComponents(
					new ButtonBuilder().setLabel('Missing Rare').setCustomId('missing-rare').setStyle(ButtonStyle.Secondary),
				);
			}
			if (skipUncommon) {
				linkRow.addComponents(
					new ButtonBuilder()
						.setLabel('Missing Uncommon')
						.setCustomId('missing-uncommon')
						.setStyle(ButtonStyle.Secondary),
				);
			}
		} else if (page === 'rare') {
			linkRow.addComponents(
				new ButtonBuilder().setLabel('Back').setCustomId('missing').setStyle(ButtonStyle.Secondary),
			);
		} else if (page === 'uncommon') {
			linkRow.addComponents(
				new ButtonBuilder().setLabel('Back').setCustomId('missing').setStyle(ButtonStyle.Secondary),
				new ButtonBuilder().setLabel('Page 2').setCustomId('missing-uncommon-2').setStyle(ButtonStyle.Secondary),
			);
		} else if (page === 'uncommon-2') {
			linkRow.addComponents(
				new ButtonBuilder().setLabel('Page 1').setCustomId('missing-uncommon').setStyle(ButtonStyle.Secondary),
				new ButtonBuilder().setLabel('Back').setCustomId('missing').setStyle(ButtonStyle.Secondary),
			);
		}

		linkRow.addComponents(
			new ButtonBuilder()
				.setLabel(`@${account?.name}/${profile?.profileName}`)
				.setURL(`https://elitesb.gg/@${account?.name}/${encodeURIComponent(profile?.profileName ?? '')}`)
				.setStyle(ButtonStyle.Link),
		);

		return { embeds: [embed], components: [linkRow] };
	}
}
