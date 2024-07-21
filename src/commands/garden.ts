import { ChatInputCommandInteraction, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { Command, CommandAccess, CommandType } from '../classes/Command.js';
import { FetchAccount, FetchProfile, UserSettings } from '../api/elite.js';
import { EliteEmbed, EmptyField, EmptyString, ErrorEmbed, WarningEmbed } from '../classes/embeds.js';
import { GetCropEmoji } from '../classes/Util.js';
import playerAutocomplete from '../autocomplete/player.js';
import { Crop, getCropDisplayName, getCropFromName, getCropMilestones, getCropUpgrades, getGardenLevel } from 'farming-weight';

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

	const embed = EliteEmbed(settings)
		.setTitle(`Garden Stats for ${playerName.replace(/_/g, '\\_')} (${profile.profileName})`)

	const gardenLevel = getGardenLevel(garden.experience ?? 0);
	
	const rejectedVisitors = Object.values(garden.visitors ?? {})
		.reduce((acc, v) => acc + ((v?.visits ?? 0) - (v?.accepted ?? 0)), 0);

	let levelText = '';
	if (gardenLevel.goal) {
		levelText += `\n${(gardenLevel.ratio * 100).toFixed(2)}% to level **${gardenLevel.next}**`;
	}
	levelText += `\n-# ${(garden.experience ?? 0).toLocaleString()} Total XP`;

	levelText += `\n\n**Visitors**`;
	levelText += `\nUnique • **${garden.uniqueVisitors ?? 0}**/84`;
	levelText += `\nAccepted • **${garden.completedVisitors ?? 0}**`;
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

	for (const plotname of (garden.plots ?? [])) {
		const plot = plots[plotname as keyof typeof plots];
		if (!plot) return;
		const [ x, y ] = plot;
		unlockedPlots[y][x] = '🟩';
	}

	const plotText = unlockedPlots.map(row => row.join('')).join('\n');

	embed.addFields({
		name: `Plots (${garden.plots?.length ?? 0}/24)`,
		value: plotText,
		inline: true
	});

	const cropUpgrades = getCropUpgrades((garden.cropUpgrades ?? {}) as Record<string, number>);
	const milestones = getCropMilestones((garden.crops ?? {}) as Record<string, number>);
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
			.setLabel(`@${account.name}/${profile.profileName}`)
			.setURL(`https://elitebot.dev/@${account.name}/${encodeURIComponent(profile.profileName ?? '')}`)
			.setStyle(ButtonStyle.Link)
	);
	
	interaction.editReply({ embeds: [embed], components: [linkRow] });
}