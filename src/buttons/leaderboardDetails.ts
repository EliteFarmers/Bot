import { StringSelectMenuInteraction } from 'discord.js';
import { getCropDisplayName } from 'farming-weight';
import { components } from '../api/api.js';
import { FetchGuildJacob } from '../api/elite.js';
import { CommandAccess, CommandType, EliteCommand } from '../classes/commands/index.js';
import { EliteEmbed, ErrorEmbed } from '../classes/embeds.js';
import { CROP_ARRAY, GetCropEmoji, GetEmbeddedTimestamp, UserHyperLink } from '../classes/Util.js';

const command = new EliteCommand({
	name: 'LB_DETAILS',
	description: 'Get detailed stats for a crop!',
	access: CommandAccess.Guild,
	type: CommandType.Button,
	execute: execute,
});

export default command;

async function execute(interaction: StringSelectMenuInteraction) {
	if (!interaction.inCachedGuild()) return;

	await interaction.deferReply({ ephemeral: true });

	const guild = await FetchGuildJacob(interaction.guildId)
		.then((data) => data.data)
		.catch(() => undefined);

	if (!guild) {
		const embed = ErrorEmbed('Jacob Leaderboards not available!');
		interaction.editReply({ embeds: [embed] });
		return;
	}

	const [, lbId] = interaction.customId.split('|');
	const leaderboard = guild.leaderboards?.find((lb) => lb.id === lbId);

	if (!leaderboard) {
		const embed = ErrorEmbed('Leaderboard not found!');
		interaction.editReply({ embeds: [embed] });
		return;
	}

	const selectedCropIndex = parseInt(interaction.values[0], 10);
	const selectedCrop = getCropDisplayName(CROP_ARRAY[selectedCropIndex]);
	const propName = getCropProperty(selectedCrop);
	const scores = leaderboard.crops?.[
		propName as keyof typeof leaderboard.crops
	] as components['schemas']['GuildJacobLeaderboardEntry'][];

	const embed = EliteEmbed()
		.setTitle(`${GetCropEmoji(selectedCrop)} ${selectedCrop} Placements`)
		.setDescription(getDetailedField(selectedCrop, scores));

	interaction.editReply({ embeds: [embed] });
}

function getDetailedField(crop: string, scores?: components['schemas']['GuildJacobLeaderboardEntry'][]) {
	if (!scores || scores.length === 0) {
		return `No Scores Set Yet!`;
	}

	return scores
		.map((s, i) => {
			const rank = i + 1;
			const prefix = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;

			return (
				`${prefix} **${scoreFormat(s.record?.collected)}** - ${UserHyperLink(s.discordId)} (${s.ign})\n` +
				`-# ${GetEmbeddedTimestamp(s.record?.timestamp ?? 0)} • [View Contest](https://elitesb.gg/contest/${s.record?.timestamp ?? 0})`
			);
		})
		.join('\n\n');
}

function getCropProperty(cropName: string) {
	switch (cropName) {
		case 'Sugar Cane':
			return 'sugarCane';
		case 'Cocoa Beans':
			return 'cocoaBeans';
		case 'Nether Wart':
			return 'netherWart';
		case 'Wild Rose':
			return 'wildRose';
		default:
			return cropName.toLowerCase();
	}
}

const scoreFormat = (collected = 0) => {
	return collected.toLocaleString();
};
