import { components } from "api/api";
import { FetchAccount, FetchLeaderboardSlice, FetchWeightLeaderboardRank, Leaderboard } from "api/elite";
import { Command, CommandAccess, CommandType } from "classes/Command";
import { EliteEmbed, ErrorEmbed } from "classes/embeds";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, ComponentType, SlashCommandBuilder } from 'discord.js';

const command: Command = {
	name: 'leaderboard',
	description: 'Get the farming weight leaderboard',
	usage: '(username)',
	access: CommandAccess.Everywhere,
	type: CommandType.Slash,
	slash: new SlashCommandBuilder()
		.setName('leaderboard')
		.setDescription('Get the farming weight leaderboard!')
		.addStringOption(option => option.setName('player')
			.setDescription('Jump to a specific player!')
			.setRequired(false))
		.addIntegerOption(option => option.setName('rank')
			.setDescription('Jump to a specific rank!')
			.setRequired(false)),
	execute: execute
}

export default command;
    
async function execute(interaction: ChatInputCommandInteraction) {
	let playerName = interaction.options.getString('player', false) ?? undefined;

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
			
		const rank = await FetchWeightLeaderboardRank(player?.id ?? '', selectedProfile?.profileId)
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

	const lb = await FetchLeaderboardSlice(Leaderboard.FarmingWeight, index, 10)
		.then(res => { return res.data; }).catch(() => undefined);

	if (!lb) {
		const embed = ErrorEmbed('Failed to Fetch Leaderboard!')
			.setDescription('Please try again later. If this issue persists, contact `kaeso.dev` on Discord.');
		await interaction.deleteReply().catch(() => undefined);
		interaction.followUp({ embeds: [embed], ephemeral: true });
		return;
	}

	maxIndex = (lb.maxEntries ?? 1000) - 10;
	entries = lb.entries ?? [];

	const embed = EliteEmbed()
		.setTitle('Farming Weight Leaderboard')
		.setDescription(`Showing **${index + 1}** - **${index + entries.length}** of **${lb.maxEntries ?? 1000}**`)
		.addFields(entries.map((entry, i) => ({
			name: `${index + i + 1}. ${entry.ign ?? 'Unknown'}`,
			value: `**Weight:** ${entry.amount ?? 0}\n**Profile:** ${entry.profile ?? 'Unknown'}`
		})));

	const reply = await interaction.editReply({ embeds: [embed], components: [getButtonRow(index, maxIndex)] });

	const collector = reply.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60_000 });

	collector.on('collect', async i => {
		if (i.user.id === interaction.user.id) {
			collector.resetTimer({time: 30_000});

			if (i.customId === 'first') {
				index = 0;
			} else if (i.customId === 'back') {
				if (index >= 10) {
					index -= 10;
				}
			} else if (i.customId === 'forward') {
				if (index < maxIndex) {
					index += 10;
				}
			} else if (i.customId === 'last') {
				if (index !== 990) {
					index = maxIndex; 
				}
			}

			const newEmbed = await getEmbed(index, maxIndex)

			if (!newEmbed) {
				const errorEmbed = ErrorEmbed('Failed to Fetch Leaderboard!')
					.setDescription('Please try again later. If this issue persists, contact `kaeso.dev` on Discord.')
					.addFields({ name: 'Proper Usage:', value: '`/leaderboard` `player:`(player name)' })
					.addFields({ name: 'Want to view the leaderboard online?', value: 'Please go to [elitebot.dev/leaderboard/farmingweight](https://elitebot.dev/leaderboard/farmingweight)' });
		
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
		interaction.editReply({ embeds: [embed], components: [] }).catch(() => undefined);
	});
}

async function getEmbed(index: number, maxIndex: number, entries?: components['schemas']['LeaderboardEntryDto'][]) {
	if (!entries) {
		entries = await FetchLeaderboardSlice(Leaderboard.FarmingWeight, index, 10)
			.then(res => { return res.data?.entries; }).catch(() => undefined);
	}

	if (!entries) return undefined; 

	const embed = EliteEmbed()
		.setTitle('Farming Weight Leaderboard')
		.setDescription(`Showing **${index + 1}** - **${index + entries.length}** of **${maxIndex}**`)
		.addFields(entries.map((entry, i) => ({
			name: `${index + i + 1}. ${entry.ign ?? 'Unknown'}`,
			value: `**Weight:** ${entry.amount ?? 0}\n**Profile:** ${entry.profile ?? 'Unknown'}`
		})));

	return embed;
}

function getButtonRow(index: number, maxIndex = 1000) {
	return new ActionRowBuilder<ButtonBuilder>()
		.addComponents(
			new ButtonBuilder()
				.setCustomId('first')
				.setLabel('First')
				.setStyle(ButtonStyle.Primary)
				.setDisabled(index < 10),
			new ButtonBuilder()
				.setCustomId('back')
				.setLabel('Back')
				.setStyle(ButtonStyle.Primary)
				.setDisabled(index < 10),
			new ButtonBuilder()
				.setCustomId('forward')
				.setLabel('Next')
				.setStyle(ButtonStyle.Primary)
				.setDisabled(index + 10 > maxIndex),
			new ButtonBuilder()
				.setCustomId('last')
				.setLabel('Last')
				.setStyle(ButtonStyle.Primary)
				.setDisabled(index + 10 > maxIndex),
			new ButtonBuilder()
				.setURL(`https://elitebot.dev/leaderboard/farmingweight/${index}`)
				.setLabel('View Online')
		);
}