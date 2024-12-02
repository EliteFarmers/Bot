import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, ComponentType } from 'discord.js';
import {
	Crop,
	GARDEN_VISITORS,
	GardenVisitor,
	Rarity,
	compareRarity,
	getCropDisplayName,
	getCropFromName,
	getCropMilestones,
	getCropUpgrades,
	getGardenLevel,
	groupGardenVisitors,
} from 'farming-weight';
import { FetchProfile, UserSettings } from '../api/elite.js';
import { elitePlayerOption } from '../autocomplete/player.js';
import { GetCropEmoji, escapeIgn } from '../classes/Util.js';
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
			await button.update(getVisitorsPayload(true));
		}

		if (button.customId === 'overflow') {
			overflow = !overflow;
			await button.update(getGardenPayload());
		}

		if (button.customId === 'missing') {
			await button.update(getMissingVisitors());
		}

		if (button.customId === 'missing-uncommon') {
			await button.update(getMissingVisitors(true));
		}
	});

	collector.on('end', () => {
		const linkRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder()
				.setLabel(`@${account?.name}/${profile?.profileName}`)
				.setURL(`https://elitebot.dev/@${account?.name}/${encodeURIComponent(profile?.profileName ?? '')}`)
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
		levelText += `\nUnique • **${(garden?.uniqueVisitors ?? 0).toLocaleString()}**/84`;
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
			value: cropText.slice(0, 5).join('\n') || 'No crop milestone progress yet!',
			inline: true,
		});

		embed.addFields(EmptyField());

		const milestonesValues = Object.values(milestones);
		const milestoneAvg = Object.values(milestones).reduce((acc, v) => acc + v.level, 0) / milestonesValues.length;

		if (cropText.length > 5) {
			embed.addFields({
				name: `Average • ${(+milestoneAvg.toFixed(1)).toLocaleString()}`,
				value: cropText.slice(5).join('\n'),
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
				.setURL(`https://elitebot.dev/@${account?.name}/${encodeURIComponent(profile?.profileName ?? '')}`)
				.setStyle(ButtonStyle.Link),
		);

		if (overflow) {
			PrefixFooter(embed, 'Showing overflow milestones and garden level!');
		}

		return { embeds: [embed], components: [linkRow] };
	}

	function getVisitorsPayload(uncommon = false) {
		const visitorsByRarity = groupGardenVisitors(
			(garden?.visitors ?? {}) as Record<string, { visits: number; accepted: number }>,
		);

		let fieldCount = 0;
		const visitorsList = Object.entries(visitorsByRarity)
			.sort(([a], [b]) => compareRarity(b as Rarity, a as Rarity))
			.map(([rarity, visitors]) => {
				if (uncommon && rarity !== Rarity.Uncommon) return undefined;

				const accepted = visitors.reduce((acc, v) => acc + v.accepted, 0);
				const visits = visitors.reduce((acc, v) => acc + v.visits, 0);

				const skipText = rarity === Rarity.Uncommon && !uncommon;
				const splitBy = visitors.length > 5 ? Math.ceil(visitors.length / 3) : 5;
				const result = [];

				if (rarity !== Rarity.Special && rarity !== Rarity.Mythic) {
					while (fieldCount % 3 !== 0) {
						fieldCount++;
						result.push(EmptyField());
					}
				}

				for (let i = 0; i < visitors.length; i += splitBy) {
					const chunk = visitors.slice(i, i + splitBy);

					fieldCount++;
					result.push({
						name: i === 0 ? `**${rarity}** • **${accepted.toLocaleString()}**/${visits.toLocaleString()}` : EmptyString,
						value: skipText
							? '-# Click "Uncommon" to see these!'
							: chunk.map((v) => `-# ${v.short ?? v.name} • **${v.accepted}**/${v.visits}`).join('\n'),
						inline: true,
					});

					if (skipText) break;
				}

				return result;
			})
			.filter((a) => a)
			.flat() as { name: string; value: string; inline: boolean }[];

		const embed = EliteEmbed(settings)
			.setTitle(`Visitors for ${escapeIgn(playerName)} (${profile?.profileName})`)
			.setDescription(
				`Unique • **${(garden?.uniqueVisitors ?? 0).toLocaleString()}**/84 ${EmptyString} • ${EmptyString} Accepted • **${(garden?.completedVisitors ?? 0).toLocaleString()}** ${EmptyString} • ${EmptyString} Rejected • **${(rejectedVisitors ?? 0).toLocaleString()}**` +
					'\nAcceptance Rate • **' +
					(((garden?.completedVisitors ?? 0) / ((garden?.completedVisitors ?? 0) + rejectedVisitors)) * 100).toFixed(
						2,
					) +
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

		linkRow.addComponents(
			new ButtonBuilder()
				.setLabel(uncommon ? 'Back' : 'Uncommon')
				.setCustomId(uncommon ? 'visitors' : 'uncommon')
				.setStyle(ButtonStyle.Secondary),
			new ButtonBuilder()
				.setLabel(`@${account?.name}/${profile?.profileName}`)
				.setURL(`https://elitebot.dev/@${account?.name}/${encodeURIComponent(profile?.profileName ?? '')}`)
				.setStyle(ButtonStyle.Link),
		);

		return { embeds: [embed], components: [linkRow] };
	}

	function getMissingVisitors(uncommon = false) {
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

		let fieldCount = 0;
		const skipUncommon = !uncommon && (missingVisitors[Rarity.Uncommon]?.length ?? 0) > 15;

		const visitorsList = Object.entries(missingVisitors)
			.sort(([a], [b]) => compareRarity(b as Rarity, a as Rarity))
			.map(([rarity, visitors]) => {
				if (uncommon && rarity !== Rarity.Uncommon) return undefined;

				const skipText = rarity === Rarity.Uncommon && skipUncommon;
				const splitBy = visitors.length > 5 ? Math.ceil(visitors.length / 3) : 5;
				const result = [];

				if (rarity !== Rarity.Special && rarity !== Rarity.Mythic) {
					while (fieldCount % 3 !== 0) {
						fieldCount++;
						result.push(EmptyField());
					}
				}

				for (let i = 0; i < visitors.length; i += splitBy) {
					const chunk = visitors.slice(i, i + splitBy);

					fieldCount++;
					result.push({
						name: i === 0 ? `**${rarity}** • **${visitors.length} Missing**` : EmptyString,
						value: skipText
							? '-# Click "Missing Uncommon" to see these!'
							: chunk.map((v) => `-# ${v.short ?? v.name} [⧉](${v.wiki})`).join('\n'),
						inline: true,
					});

					if (skipText) break;
				}

				return result;
			})
			.filter((a) => a)
			.flat() as { name: string; value: string; inline: boolean }[];

		const embed = EliteEmbed(settings)
			.setTitle(`Missing Visitors for ${escapeIgn(playerName)} (${profile?.profileName})`)
			.setDescription(
				`Unique • **${(garden?.uniqueVisitors ?? 0).toLocaleString()}**/84 ${EmptyString} • ${EmptyString} Accepted • **${(garden?.completedVisitors ?? 0).toLocaleString()}** ${EmptyString} • ${EmptyString} Rejected • **${(rejectedVisitors ?? 0).toLocaleString()}**` +
					'\nAcceptance Rate • **' +
					(((garden?.completedVisitors ?? 0) / ((garden?.completedVisitors ?? 0) + rejectedVisitors)) * 100).toFixed(
						2,
					) +
					'%**',
			);

		embed.addFields(visitorsList);

		const linkRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder().setLabel('Visitor Stats').setCustomId('visitors').setStyle(ButtonStyle.Success),
		);

		if (skipUncommon || uncommon) {
			linkRow.addComponents(
				new ButtonBuilder()
					.setLabel(uncommon ? 'Back' : 'Missing Uncommon')
					.setCustomId(uncommon ? 'missing' : 'missing-uncommon')
					.setStyle(ButtonStyle.Secondary),
			);
		}

		linkRow.addComponents(
			new ButtonBuilder()
				.setLabel(`@${account?.name}/${profile?.profileName}`)
				.setURL(`https://elitebot.dev/@${account?.name}/${encodeURIComponent(profile?.profileName ?? '')}`)
				.setStyle(ButtonStyle.Link),
		);

		return { embeds: [embed], components: [linkRow] };
	}
}
