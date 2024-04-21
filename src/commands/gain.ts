import { ChatInputCommandInteraction, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { Command, CommandAccess, CommandType } from '../classes/Command.js';
import { FetchAccount, FetchCollectionGraphs } from '../api/elite.js';
import { EliteEmbed, ErrorEmbed, WarningEmbed } from '../classes/embeds.js';
import { GetCropEmoji } from '../classes/Util.js';
import playerAutocomplete from '../autocomplete/player.js';
import { Crop, createFarmingWeightCalculator, getCropFromName } from 'farming-weight';

const command: Command = {
	name: 'gain',
	description: 'Get the collection gain of a player over the past week!',
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

async function execute(interaction: ChatInputCommandInteraction) {
	let playerName = interaction.options.getString('player', false)?.trim();
	const _profileName = interaction.options.getString('profile', false)?.trim();

	await interaction.deferReply();

	const { data: account } = await FetchAccount(playerName ?? interaction.user.id).catch(() => ({ data: undefined }));

	if (!account?.id || !account?.name) {
		const embed = WarningEmbed('Invalid Username!')
			.addFields({ name: 'Proper Usage:', value: '`/gain` `player:`(player name)\nOr link your account with </verify:1135100641560248334> first!' });

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
	const discordPlayerName = playerName.replace(/_/g, '\\_');

	const profile = _profileName 
		? account.profiles?.find(p => p?.profileName?.toLowerCase() === _profileName.toLowerCase())
		: account.profiles?.find(p => p.selected) ?? account.profiles?.[0];

	if (!profile?.profileId || !profile.profileName) {
		const embed = ErrorEmbed('Invalid Profile!')
			.setDescription(`Profile "${_profileName}" does not exist.`)
			.addFields({ name: 'Proper Usage:', value: '`/gain` `player:`(player name) `profile:`(profile name)' });
		await interaction.deleteReply().catch(() => undefined);
		interaction.followUp({ embeds: [embed], ephemeral: true });
		return;
	}

	const { data: collections } = await FetchCollectionGraphs(account.id, profile.profileId, 9, 1)
		.catch(() => ({ data: undefined }));

	// const { data: skills } = await FetchSkillGraphs(account.id, profile.profileId)
	// 	.catch(() => ({ data: undefined }));

	if (!collections) {
		const embed = ErrorEmbed('Couldn\'t fetch data!')
			.setDescription(`Something went wrong when getting data for "${playerName}".`)
			.setFooter({ text: 'Contact kaeso.dev if this continues to happen' });
		await interaction.deleteReply().catch(() => undefined);
		interaction.followUp({ embeds: [embed], ephemeral: true });
		return;
	}

	if (collections.length === 0) {
		const embed = WarningEmbed(`Crop Gain for ${discordPlayerName} (${profile.profileName})`)
			.setDescription(
				`No collection data found. ${discordPlayerName} may not have farmed recently or has collections API disabled.`
				+ `[Check Online Profile](https://elitebot.dev/@${account.id})`
			)
			.setThumbnail(`https://mc-heads.net/head/${account.id}/left`);

		interaction.editReply({ embeds: [embed] });
		return;
	}

	const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder()
			.setLabel(`@${account.name}/${profile.profileName}`)
			.setURL(`https://elitebot.dev/@${account.name}/${encodeURIComponent(profile.profileName)}`)
			.setStyle(ButtonStyle.Link)
	);

	const dataPoints = collections.sort((a, b) => +(a.timestamp ?? 0) - +(b.timestamp ?? 0));

	type dayProgress = { start: number, end: number, crops: Record<string, number> };

	const days = [] as dayProgress[];

	for (let i = 0; i < dataPoints.length; i++) {
		const point = dataPoints[i];
		const start = +(point.timestamp ?? 0)

		// Find next point that's under 24 hours later
		const lastPoint = dataPoints.at(i + 1) ?? point;

		const cropGains = Object.entries(lastPoint.crops ?? {})
			.reduce<Record<string, number>>((gains, current) => {
				const [ crop, last ] = current;
				gains[crop] = last - (point.crops?.[crop] ?? 0);
				return gains;
			}, {});

		days.push({
			start: start,
			end: +(lastPoint.timestamp ?? 0),
			crops: cropGains
		});
	}

	// Remove last day if it's empty
	if (days.length > 1 && Object.values(days.at(-1)?.crops ?? {}).every(c => c === 0)) {
		days.pop();
	}

	// Limit to 9 days
	while (days.length > 9) {
		days.shift();
	}

	const embed = EliteEmbed()
		.setTitle(`Crop Gain for ${discordPlayerName} (${profile.profileName})`)
		// .setDescription(`From <t:${first?.timestamp}:d> to <t:${last?.timestamp}:d>`)

	for (const day of days) {
		const crops = Object.entries(day.crops).filter(([, amount]) => amount > 0).sort((a, b) => b[1] - a[1]);

		if (crops.length <= 0) {
			embed.addFields({
				name: `<t:${day.end}:d>`,
				value: 'None!',
				inline: true
			});
			continue;
		}

		const calc = createFarmingWeightCalculator({
			collection: crops.reduce<Record<string, number>>((acc, [crop, amount]) => { 
				acc[getCropFromName(crop) ?? Crop.Seeds] = amount;
				return acc;
			}, {}),
		})

		const weight = calc.getWeightInfo().cropWeight;

		embed.addFields({
			name: `<t:${day.end}:d>`,
			value: `**Weight:** ${weight.toFixed(2)}\n` + crops.slice(0, 3)
				.map(([crop, amount]) => `${GetCropEmoji(crop)} ${amount.toLocaleString()}`)
				.join('\n'),
			inline: true
		});
	}

	interaction.editReply({ embeds: [embed], components: [row] });
}
