import { fromUnixTime, getUnixTime, startOfDay } from 'date-fns';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction } from 'discord.js';
import { FetchCollectionGraphs, UserSettings } from '../api/elite.js';
import { elitePlayerOption } from '../autocomplete/player.js';
import { GetCropEmoji, escapeIgn } from '../classes/Util.js';
import { CommandAccess, CommandType, EliteCommand, SlashCommandOptionType } from '../classes/commands/index.js';
import { EliteEmbed, EmptyField, ErrorEmbed, WarningEmbed } from '../classes/embeds.js';
import { getAccount } from '../classes/validate.js';

const command = new EliteCommand({
	name: 'gain',
	description: 'Get the collection gain of a player over the past week!',
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

	const { data: collections } = await FetchCollectionGraphs(account.id, profile.profileId, 9, 1).catch(() => ({
		data: undefined,
	}));

	// const { data: skills } = await FetchSkillGraphs(account.id, profile.profileId)
	// 	.catch(() => ({ data: undefined }));

	if (!collections) {
		const embed = ErrorEmbed("Couldn't fetch data!")
			.setDescription(`Something went wrong when getting data for "${escapeIgn(playerName)}".`)
			.setFooter({ text: 'Contact kaeso.dev if this continues to happen' });
		await interaction.deleteReply().catch(() => undefined);
		interaction.followUp({ embeds: [embed], ephemeral: true });
		return;
	}

	if (collections.length === 0) {
		const embed = WarningEmbed(`Crop Gain for ${escapeIgn(account.name)} (${profile.profileName})`)
			.setDescription(
				`No collection data found. ${escapeIgn(account.name)} may not have farmed recently or has collections API disabled.` +
					` [Check Online Profile](https://elitebot.dev/@${account.id})`,
			)
			.setThumbnail(`https://mc-heads.net/head/${account.id}/left`);

		interaction.editReply({ embeds: [embed] });
		return;
	}

	const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder().setLabel('Information').setCustomId('GAININFO|').setStyle(ButtonStyle.Secondary),
		new ButtonBuilder()
			.setLabel(`@${account.name}/${profile.profileName}`)
			.setURL(`https://elitebot.dev/@${account.name}/${encodeURIComponent(profile.profileName)}`)
			.setStyle(ButtonStyle.Link),
	);

	const dataPoints = collections.sort((a, b) => +(a.timestamp ?? 0) - +(b.timestamp ?? 0));

	type dayProgress = {
		start: number;
		crops: Record<string, number>;
		weight: number;
	};

	const days = [] as dayProgress[];

	for (let i = 0; i < dataPoints.length; i++) {
		const point = dataPoints[i];
		const start = +(point.timestamp ?? 0);

		// Find next point that's under 24 hours later
		const lastPoint = dataPoints.at(i + 1) ?? point;

		const cropGains = Object.entries(lastPoint.crops ?? {}).reduce<Record<string, number>>((gains, current) => {
			const [crop, last = 0] = current;
			gains[crop] = last - (point.crops?.[crop] ?? 0);
			return gains;
		}, {});

		days.push({
			start: getUnixTime(startOfDay(fromUnixTime(start))),
			crops: cropGains,
			weight: +(lastPoint.cropWeight ?? 0) - +(point.cropWeight ?? 0),
		});
	}

	// Remove last day if it's empty
	if (days.length > 1 && Object.values(days.at(-1)?.crops ?? {}).every((c) => c === 0)) {
		days.pop();
	}

	// Limit to 9 days
	while (days.length > 9) {
		days.shift();
	}

	const embed = EliteEmbed(settings)
		.setTitle(`Crop Gain for ${escapeIgn(account.name)} (${profile.profileName})`)
		.setDescription(
			`-# View charts and older data for ${escapeIgn(account.name)} [here!](https://elitebot.dev/@${account.id}/${profile.profileId}/charts)`,
		);

	const fields = [];

	for (const day of days) {
		const crops = Object.entries(day.crops)
			.filter(([, amount]) => amount > 0)
			.sort((a, b) => b[1] - a[1]);

		if (crops.length <= 0) {
			fields.push({
				name: `<t:${day.start}:d>`,
				value: 'None!',
				inline: true,
			});
			continue;
		}

		fields.push({
			name: `<t:${day.start}:d>`,
			value:
				`**Weight:** ${day.weight.toFixed(2)}\n` +
				crops
					.slice(0, 3)
					.map(([crop, amount]) => `${GetCropEmoji(crop)} ${amount.toLocaleString()}`)
					.join('\n'),
			inline: true,
		});
	}

	while (fields.length % 3 !== 0) {
		fields.push(EmptyField());
	}

	embed.addFields(fields);

	interaction.editReply({ embeds: [embed], components: [row] });
}
