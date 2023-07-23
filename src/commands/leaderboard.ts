import { components } from "../api/api.js";
import { FetchAccount, FetchCollectionLeaderboardSlice, FetchLeaderboardRank, FetchLeaderboardSlice, FetchSkillLeaderboardSlice } from "../api/elite.js";
import { Command, CommandAccess, CommandType } from "../classes/Command.js";
import { EliteEmbed, ErrorEmbed } from "../classes/embeds.js";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, ComponentType, SlashCommandBuilder } from 'discord.js';

const command: Command = {
	name: 'leaderboard',
	description: 'Get a leaderboard',
	usage: '(username)',
	access: CommandAccess.Everywhere,
	type: CommandType.Slash,
	slash: new SlashCommandBuilder()
		.setName('leaderboard')
		.setDescription('Get a leaderboard!')
		.addSubcommand(subcommand => subcommand
			.setName('farmingweight')
			.setDescription('Get the farming weight leaderboard!'))
		.addSubcommandGroup(subcommandGroup => subcommandGroup
			.setName('crop')
			.setDescription('Get a crop leaderboard!')
			.addSubcommand(subcommand => subcommand
				.setName('cactus')
				.setDescription('Get the Cactus collection leaderboard!'))
			.addSubcommand(subcommand => subcommand
				.setName('carrot')
				.setDescription('Get the Carrot collection leaderboard!'))
			.addSubcommand(subcommand => subcommand
				.setName('cocoa')
				.setDescription('Get the Cocoa collection leaderboard!'))
			.addSubcommand(subcommand => subcommand
				.setName('melon')
				.setDescription('Get the Melon collection leaderboard!'))
			.addSubcommand(subcommand => subcommand
				.setName('mushroom')
				.setDescription('Get the Mushroom collection leaderboard!'))
			.addSubcommand(subcommand => subcommand
				.setName('netherwart')
				.setDescription('Get the Nether Wart collection leaderboard!'))
			.addSubcommand(subcommand => subcommand
				.setName('potato')
				.setDescription('Get the Potato ollection leaderboard!'))
			.addSubcommand(subcommand => subcommand
				.setName('pumpkin')
				.setDescription('Get the Pumpkin collection leaderboard!'))
			.addSubcommand(subcommand => subcommand
				.setName('sugarcane')
				.setDescription('Get the sugarcane collection leaderboard!'))
			.addSubcommand(subcommand => subcommand
				.setName('wheat')
				.setDescription('Get the Wheat collection leaderboard!'))),
	execute: execute
}

export default command;
    
async function execute(interaction: ChatInputCommandInteraction) {
	let playerName = interaction.options.getString('player', false) ?? undefined;

	const category = interaction.options.getSubcommandGroup() ?? '';
	const leaderboardId = interaction.options.getSubcommand() ?? '';

	await interaction.deferReply();

	let givenIndex = 0;

	if (playerName !== undefined) {
		const player = await FetchAccount(playerName).then(res => { return res.data; }).catch(() => undefined);
		const selectedProfile = player?.profiles?.find(p => p?.selected) ?? player?.profiles?.[0];

		if (!selectedProfile?.profileId) {
			const embed = ErrorEmbed('Invalid User!')
				.setDescription(`User "${playerName}" does not exist.`)
				.addFields({ name: 'Proper Usage:', value: '`/leaderboard` `player:`(player name)' });
			await interaction.deleteReply().catch(() => undefined);
			interaction.followUp({ embeds: [embed], ephemeral: true });
			return;
		}
			
		const rank = await FetchLeaderboardRank(leaderboardId, player?.id ?? '', selectedProfile?.profileId)
			.then(res => { return res.data?.rank; }).catch(() => undefined);

		if (player) {
			givenIndex = rank ?? 0;
			playerName = player.name;
		}
	} else {
		givenIndex = interaction.options.getInteger('rank', false) ?? 0;
	}

	let index = Math.floor(givenIndex / 10) * 10;
	let maxIndex = 1000;
	let entries: components['schemas']['LeaderboardEntryDto'][] = [];

	const lb = await FetchLeaderboard(category, leaderboardId, index, 12)
		.then(res => { return res.data; }).catch(() => undefined);

	if (!lb) {
		const embed = ErrorEmbed('Failed to Fetch Leaderboard!')
			.setDescription('Please try again later. If this issue persists, contact `kaeso.dev` on Discord.');
		await interaction.deleteReply().catch(() => undefined);
		interaction.followUp({ embeds: [embed], ephemeral: true });
		return;
	}
	const title = (lb.title ?? '') + ' Leaderboard';

	maxIndex = (lb.maxEntries ?? 1000) - 12;
	entries = lb.entries ?? [];

	const embed = await getEmbed(index, maxIndex, leaderboardId, category, title, entries);
	if (!embed) {
		const errorEmbed = ErrorEmbed('Failed to Fetch Leaderboard!')
			.setDescription('Please try again later. If this issue persists, contact `kaeso.dev` on Discord.')
			.addFields({ name: 'Proper Usage:', value: '`/leaderboard` `player:`(player name)' })
			.addFields({ name: 'Want to view the leaderboard online?', value: 'Please go to [elitebot.dev/leaderboard/farmingweight](https://elitebot.dev/leaderboard/farmingweight)' });
		interaction.editReply({ embeds: [errorEmbed] });
		return;
	}

	const reply = await interaction.editReply({ embeds: [embed], components: [getButtonRow(index, maxIndex)] });

	const collector = reply.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60_000 });

	collector.on('collect', async i => {
		if (i.user.id === interaction.user.id) {
			collector.resetTimer({time: 30_000});

			if (i.customId === 'first') {
				index = 0;
			} else if (i.customId === 'back') {
				if (index >= 12) {
					index -= 12;
				}
			} else if (i.customId === 'forward') {
				if (index < maxIndex) {
					index += 12;
				}
			} else if (i.customId === 'last') {
				if (index !== maxIndex) {
					index = maxIndex; 
				}
			}

			const newEmbed = await getEmbed(index, maxIndex, leaderboardId, category, title);

			if (!newEmbed) {
				const errorEmbed = ErrorEmbed('Failed to Fetch Leaderboard!')
					.setDescription('Please try again later. If this issue persists, contact `kaeso.dev` on Discord.')
					.addFields({ name: 'Proper Usage:', value: '`/leaderboard` `player:`(player name)' })
					.addFields({ name: 'Want to view the leaderboard online?', value: `Please go to [elitebot.dev/leaderboard/${leaderboardId}](https://elitebot.dev/leaderboard/${leaderboardId})` });
		
				i.followUp({ embeds: [errorEmbed], ephemeral: true });
				collector.stop();
			} else {
				i.update({ embeds: [newEmbed], components: [getButtonRow(index, maxIndex)] }).catch(() => { 
					collector.stop(); 
				});
			}
		} else {
			i.reply({ content: `These buttons aren't for you!`, ephemeral: true });
		}
	});

	collector.on('end', async () => { 
		interaction.editReply({ components: [] }).catch(() => undefined);
	});
}

async function getEmbed(index: number, maxIndex: number, leaderboardId: string, category: string, title: string, entries?: components['schemas']['LeaderboardEntryDto'][]) {
	if (!entries) {
		entries = await FetchLeaderboard(category, leaderboardId, index, 12)
			.then(res => { return res.data?.entries; }).catch(() => undefined);
	}

	if (!entries) return undefined; 

	const embed = EliteEmbed()
		.setTitle(title)
		.setDescription(`Showing **${index + 1}** - **${index + entries.length}** of **${(maxIndex + 12).toLocaleString()}** ⠀ [View Online](https://elitebot.dev/leaderboard/${leaderboardId}/${index + 1})`)
		.addFields(entries.map((entry, i) => ({
			name: `#${index + i + 1} - ${entry.ign?.replaceAll('_', '\\_') ?? 'Unknown'}⠀`,
			value: `[⧉](https://elitebot.dev/@${entry.ign}/${encodeURIComponent(entry.profile ?? '')}) ${(entry.amount ?? 0).toLocaleString()}`,
			inline: true
		})));

	return embed;
}

function getButtonRow(index: number, maxIndex = 1000) {
	return new ActionRowBuilder<ButtonBuilder>()
		.addComponents(
			new ButtonBuilder()
				.setCustomId('first')
				.setLabel('First')
				.setStyle(ButtonStyle.Secondary)
				.setDisabled(index < 12),
			new ButtonBuilder()
				.setCustomId('back')
				.setLabel('Back')
				.setStyle(ButtonStyle.Secondary)
				.setDisabled(index < 12),
			new ButtonBuilder()
				.setCustomId('forward')
				.setLabel('Next')
				.setStyle(ButtonStyle.Secondary)
				.setDisabled(index + 12 > maxIndex),
			new ButtonBuilder()
				.setCustomId('last')
				.setLabel('Last')
				.setStyle(ButtonStyle.Secondary)
				.setDisabled(index + 12 > maxIndex),
			new ButtonBuilder()
				.setURL(`https://elitebot.dev/leaderboard/farmingweight/${index}`)
				.setStyle(ButtonStyle.Link)
				.setLabel('View Online')
		);
}

function FetchLeaderboard(category: string, leaderboardId: string, offset: number, limit: number) {
	if (category === 'skill') return FetchSkillLeaderboardSlice(leaderboardId, offset, limit);
	if (category === 'crop') return FetchCollectionLeaderboardSlice(leaderboardId, offset, limit);

	return FetchLeaderboardSlice(leaderboardId, offset, limit);
}