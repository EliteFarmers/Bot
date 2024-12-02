import { ChatInputCommandInteraction } from 'discord.js';
import { Crop, SkyBlockTime, getCropDisplayName, getCropFromName } from 'farming-weight';
import { FetchContest, UserSettings } from '../api/elite.js';
import { eliteDayOption, eliteMonthOption, eliteYearOption } from '../autocomplete/dates.js';
import { GetCropEmoji, GetMedalEmoji, escapeIgn } from '../classes/Util.js';
import { CommandAccess, CommandType, EliteCommand } from '../classes/commands/index.js';
import { EliteEmbed } from '../classes/embeds.js';

const command = new EliteCommand({
	name: 'contest',
	description: 'Get participants of a specific Jacob Contest!',
	access: CommandAccess.Everywhere,
	type: CommandType.Slash,
	options: {
		year: eliteYearOption,
		month: eliteMonthOption,
		day: eliteDayOption,
	},
	execute: execute,
});

export default command;

async function execute(interaction: ChatInputCommandInteraction, settings?: UserSettings) {
	const currentTime = SkyBlockTime.now;

	const year = interaction.options.getInteger('year', false) ?? currentTime.year;
	const month = interaction.options.getInteger('month', false) ?? currentTime.month;
	const day = interaction.options.getInteger('day', false) ?? currentTime.day;

	await interaction.deferReply();

	const date = SkyBlockTime.from(year, month, day).getLastContest();
	const { data: contests } = await FetchContest(date.dayUnixSeconds).catch(() => ({ data: undefined }));

	if (year === currentTime.year) {
		if (month === currentTime.month && day > currentTime.day) {
			await interaction.deleteReply();
			await interaction.followUp({
				ephemeral: true,
				content: 'That date is in the future!',
			});
			return;
		} else if (month > currentTime.month) {
			await interaction.deleteReply();
			await interaction.followUp({
				ephemeral: true,
				content: 'That date is in the future!',
			});
			return;
		}
	}

	if (!contests) {
		await interaction.deleteReply();
		await interaction.followUp({
			ephemeral: true,
			content: 'No contest found for that date!',
		});
		return;
	}

	const isOngoing = date.dayUnixSeconds === currentTime.dayUnixSeconds;

	const description =
		`<t:${date.dayUnixSeconds}:R> • [View Online](https://elitebot.dev/contest/${date.dayUnixSeconds})` +
		(isOngoing ? '\n-# This contest is currently active! Data is incomplete.' : '');

	const embed = EliteEmbed(settings).setTitle(date.toString()).setDescription(description);

	const fields = contests.map(({ crop, participants = -1, participations = [] }) => {
		const c = getCropFromName(crop) ?? Crop.Wheat;
		const displayName = getCropDisplayName(c);
		const part = participants !== -1 ? participants.toLocaleString() : 'N/A';

		const topParticipants = participations
			.sort((a, b) => (b.collected ?? 0) - (a.collected ?? 0))
			.slice(0, 5)
			.map(({ playerName, playerUuid, profileUuid, collected, position, medal }) => {
				return (
					`**${position === undefined || position === -1 ? '???' : position + 1}.** ${escapeIgn(playerName) ?? 'Unknown'}` +
					`\n-# [⧉](https://elitebot.dev/@${playerUuid}/${profileUuid}) ${collected?.toLocaleString()} ${medal ? GetMedalEmoji(medal) : ''}`
				);
			})
			.join('\n');

		return {
			name: `${GetCropEmoji(displayName)} ${displayName}${!isOngoing ? ` (${participations.length.toLocaleString()}/${part})` : ''}`,
			value: topParticipants,
			inline: true,
		};
	});

	embed.addFields(fields);

	await interaction.editReply({ embeds: [embed] });
}
