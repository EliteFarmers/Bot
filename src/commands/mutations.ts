import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, ComponentType } from 'discord.js';
import { FetchProduct, FetchProducts, UserSettings } from '../api/elite.js';
import { CommandAccess, CommandType, EliteCommand, SlashCommandOptionType } from '../classes/commands/index.js';
import { EliteEmbed } from 'classes/embeds.js';

export interface MutationAnalysis {
	id: string;
	analysisCost: number;
	copper: number;
}

export interface MutationCopperRatio {
	id: string;
	name: string;
	buyCoinPerCopper: number;
	buyOrderCoinPerCopper: number;
}

let mutations: MutationAnalysis[] = [
	{ id: "ASHWREATH", analysisCost: 10000, copper: 5 },
	{ id: "CHOCONUT", analysisCost: 10000, copper: 5 },
	{ id: "DUSTGRAIN", analysisCost: 10000, copper: 5 },
	{ id: "GLOOMGOURD", analysisCost: 10000, copper: 5 },
	{ id: "LONELILY", analysisCost: 50000, copper: 25 },
	{ id: "SCOURROOT", analysisCost: 10000, copper: 5 },
	{ id: "SHADEVINE", analysisCost: 10000, copper: 5 },
	{ id: "VEILSHROOM", analysisCost: 10000, copper: 5 },
	{ id: "WITHERBLOOM", analysisCost: 40000, copper: 20 },
	{ id: "CHOCOBERRY", analysisCost: 60000, copper: 30 },
	{ id: "CINDERSHADE", analysisCost: 80000, copper: 40 },
	{ id: "COALROOT", analysisCost: 80000, copper: 40 },
	{ id: "CREAMBLOOM", analysisCost: 60000, copper: 30 },
	{ id: "DUSKBLOOM", analysisCost: 80000, copper: 40 },
	{ id: "THORNSHADE", analysisCost: 80000, copper: 40 },
	{ id: "BLASTBERRY", analysisCost: 240000, copper: 120 },
	{ id: "CHEESEBITE", analysisCost: 80000, copper: 80 },
	{ id: "CHLORONITE", analysisCost: 40000, copper: 20 },
	{ id: "DO_NOT_EAT_SHROOM", analysisCost: 240000, copper: 120 },
	{ id: "FLESHTRAP", analysisCost: 360000, copper: 180 },
	{ id: "MAGIC_JELLYBEAN", analysisCost: 160000, copper: 80 },
	{ id: "NOCTILUME", analysisCost: 300000, copper: 150 },
	{ id: "SNOOZLING", analysisCost: 600000, copper: 300 },
	{ id: "SOGGYBUD", analysisCost: 60000, copper: 30 },
	{ id: "CHORUS_FRUIT", analysisCost: 600000, copper: 300 },
	{ id: "PLANTBOY_ADVANCE", analysisCost: 700000, copper: 350 },
	{ id: "PUFFERCLOUD", analysisCost: 1000000, copper: 500 },
	{ id: "SHELLFRUIT", analysisCost: 500000, copper: 250 },
	{ id: "STARTLEVINE", analysisCost: 500000, copper: 250 },
	{ id: "STOPLIGHT_PETAL", analysisCost: 4000000, copper: 2000 },
	{ id: "THUNDERLING", analysisCost: 800000, copper: 400 },
	{ id: "TURTLELLINI", analysisCost: 240000, copper: 120 },
	{ id: "ZOMBUD", analysisCost: 1000000, copper: 500 },
	{ id: "ALL_IN_ALOE", analysisCost: 4600000, copper: 2300 },
	{ id: "DEVOURER", analysisCost: 10000000, copper: 5000 },
	{ id: "GLASSCORN", analysisCost: 4000000, copper: 2000 },
	{ id: "GODSEED", analysisCost: 1000000, copper: 500 },
	{ id: "JERRYFLOWER", analysisCost: 20000, copper: 10 },
	{ id: "PHANTOMLEAF", analysisCost: 3000000, copper: 1500 },
	{ id: "TIMESTALK", analysisCost: 19000000, copper: 9500 }
];

const command = new EliteCommand({
	name: 'mutations',
	description: 'Shows best mutations to analyse for copper',
	access: CommandAccess.Everywhere,
	type: CommandType.Slash,
	options: {
		synthesis: {
			name: 'synthesis',
			description: 'Synthesis Chip Bonus (%)',
			type: SlashCommandOptionType.Number,
			builder: (b) => b.setMinValue(0).setMaxValue(40),
		},
		rose_dragon: {
			name: 'rose_dragon',
			description: 'Rose Dragon Bonus (%)',
			type: SlashCommandOptionType.Number,
			builder: (b) => b.setMinValue(0).setMaxValue(20),
		},
	},
	execute: execute,
});

export default command;

async function execute(interaction: ChatInputCommandInteraction, settings?: UserSettings) {
	await interaction.deferReply();

	const synthesis = interaction.options.getNumber('synthesis', false) ?? 0;
	const rose_dragon = interaction.options.getNumber('rose_dragon', false) ?? 0;
	const mutationIds = mutations.map(m => m.id);
	const { data: bazaar } = await FetchProducts(mutationIds);

	let mutationRatios: MutationCopperRatio[] = mutations.map(mutation => {
		const bazaarItem = bazaar?.items?.[mutation.id];
		const buy = bazaarItem?.bazaar?.buy as number | undefined;
		const buyOrder = bazaarItem?.bazaar?.buyOrder as number | undefined;
		if (buy === undefined && buyOrder === undefined) {
			//if neither buy nor buy order exist, return infinite ratio (Jerryflower)
			return {
				id: mutation.id,
				name: bazaarItem?.name ?? mutation.id,
				buyCoinPerCopper: Infinity,
				buyOrderCoinPerCopper: Infinity,
			};
		}
		const copper = mutation.copper * (1 + synthesis / 100 + rose_dragon / 100);
		return {
			id: mutation.id,
			name: bazaarItem?.name ?? mutation.id,
			buyCoinPerCopper: (mutation.analysisCost + (buy ?? 0)) / copper,
			buyOrderCoinPerCopper: (mutation.analysisCost + (buyOrder ?? 0)) / copper,
		};
	});

	mutationRatios = mutationRatios.sort((a, b) => a.buyCoinPerCopper - b.buyCoinPerCopper);

	const allItems = Object.values(mutationRatios);
	const ITEMS_PER_PAGE = 10;
	let page = 0;
	const maxPage = Math.max(0, Math.ceil(allItems.length / ITEMS_PER_PAGE) - 1);

	function getPageItems(page: number) {
		return allItems.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE);
	}

	function getMutationIndex(page: number, index: number) {
		return page * ITEMS_PER_PAGE + index + 1;
	}

	function buildEmbed(settings: UserSettings | undefined, page: number) {
		const pageItems = getPageItems(page);
		const names = pageItems.map((item, i) => `**\`#${getMutationIndex(page, i)}\`** ${item.name}`).join('\n');
		const buyRatios = pageItems.map(item => isFinite(item.buyCoinPerCopper) ?
			`:coin: \`${item.buyCoinPerCopper.toFixed(2)}\`` : 'N/A').join('\n');
		const sellRatios = pageItems.map(item => isFinite(item.buyOrderCoinPerCopper) ?
			`:coin: \`${item.buyOrderCoinPerCopper.toFixed(2)}\`` : 'N/A').join('\n');
		const embed = EliteEmbed(settings)
			.setTitle('Mutation Analysis - Coin/Copper Ratios')
			.setDescription(`Synthesis Bonus: **${synthesis}%**\nRose Dragon Bonus: **${rose_dragon}%**\nShowing **${page + 1}** - ${maxPage + 1} pages.`)
			.addFields([
				{ name: 'Mutation', value: names, inline: true },
				{ name: 'Cost (Insta Buy)', value: buyRatios, inline: true },
				{ name: 'Cost (Buy Order)', value: sellRatios, inline: true },
			]);
		return embed;
	}

	function getButtonRow(page: number, maxPage: number) {
		return new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder()
				.setCustomId('first')
				.setLabel('First')
				.setStyle(ButtonStyle.Secondary)
				.setDisabled(page === 0),
			new ButtonBuilder()
				.setCustomId('back')
				.setLabel('Back')
				.setStyle(ButtonStyle.Secondary)
				.setDisabled(page === 0),
			new ButtonBuilder()
				.setCustomId('forward')
				.setLabel('Next')
				.setStyle(ButtonStyle.Secondary)
				.setDisabled(page === maxPage),
			new ButtonBuilder()
				.setCustomId('last')
				.setLabel('Last')
				.setStyle(ButtonStyle.Secondary)
				.setDisabled(page === maxPage),
		);
	}

	const embed = buildEmbed(settings, page);
	const reply = await interaction.editReply({
		embeds: [embed],
		components: [getButtonRow(page, maxPage)],
	});

	const collector = reply.createMessageComponentCollector({
		componentType: ComponentType.Button,
		time: 60_000,
	});

	collector.on('collect', async (i) => {
		if (i.user.id === interaction.user.id) {
			collector.resetTimer({ time: 30_000 });

			if (i.customId === 'first') {
				page = 0;
			} else if (i.customId === 'back') {
				if (page > 0) {
					page -= 1;
				}
			} else if (i.customId === 'forward') {
				if (page < maxPage) {
					page += 1;
				}
			} else if (i.customId === 'last') {
				if (page !== maxPage) {
					page = maxPage;
				}
			}

			const newEmbed = buildEmbed(settings, page);
			await i.update({
				embeds: [newEmbed],
				components: [getButtonRow(page, maxPage)],
			}).catch(() => {
				collector.stop();
			});
		} else {
			i.reply({ content: `These buttons aren't for you!`, ephemeral: true });
		}
	});

	collector.on('end', async () => {
		const finalEmbed = buildEmbed(settings, page);
		await interaction.editReply({
			embeds: [finalEmbed],
			components: [],
		});
	});
}

function getButtonRow(index: number, maxIndex = 1000, leaderboardId?: string) {
	return new ActionRowBuilder<ButtonBuilder>().addComponents(
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
	);
}