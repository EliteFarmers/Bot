import { EliteEmbed, NotYoursReply } from 'classes/embeds.js';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, ComponentType, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';
import { GREENHOUSE_MUTATIONS } from 'farming-weight';
import { FetchProducts, UserSettings } from '../api/elite.js';
import { CommandAccess, CommandType, EliteCommand, SlashCommandOptionType } from '../classes/commands/index.js';

export interface MutationCopperRatio {
	id: string;
	name: string;
	copper: number;
	buyCoinPerCopper: number;
	buyCoinTotal: number;
	buyOrderCoinPerCopper: number;
	buyOrderCoinTotal: number;
}

type MutationBuyType = 'instabuy' | 'buyorder';

const mutations = Object.values(GREENHOUSE_MUTATIONS);

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

	       const mutationRatios: MutationCopperRatio[] = mutations.map(mutation => {
		       const bazaarItem = bazaar?.items?.[mutation.id];
		       const buy = bazaarItem?.bazaar?.buy as number | undefined;
		       const buyOrder = bazaarItem?.bazaar?.buyOrder as number | undefined;
		       const analysisCost = mutation.analysis.baseCost;
		       const copper = mutation.analysis.copper * (1 + synthesis / 100 + rose_dragon / 100);
		       if (buy === undefined && buyOrder === undefined) {
			       //if neither buy nor buy order exist, return infinite ratio (Jerryflower)
			       return {
				       id: mutation.id,
				       name: mutation.display.name ?? mutation.id,
				       copper: mutation.analysis.copper,
				       buyCoinPerCopper: Infinity,
				       buyCoinTotal: Infinity,
				       buyOrderCoinPerCopper: Infinity,
				       buyOrderCoinTotal: Infinity,
			       };
		       }
		       const buyCoinTotal = analysisCost + (buy ?? 0);
		       const buyOrderCoinTotal = analysisCost + (buyOrder ?? 0);
		       return {
			       id: mutation.id,
			       name: mutation.display.name ?? mutation.id,
			       copper: mutation.analysis.copper,
			       buyCoinPerCopper: buyCoinTotal / copper,
			       buyOrderCoinPerCopper: buyOrderCoinTotal / copper,
			       buyCoinTotal,
			       buyOrderCoinTotal,
		       };
	       });

	const ITEMS_PER_PAGE = 10;
	let page = 0;
	let selectedType: MutationBuyType = 'instabuy'; // default to instabuy

	function getSortedItems(type: MutationBuyType) {
		return mutationRatios.slice().sort((a, b) => {
			if (type === 'instabuy') return a.buyCoinPerCopper - b.buyCoinPerCopper;
			return a.buyOrderCoinPerCopper - b.buyOrderCoinPerCopper;
		});
	}

	function getPageItems(page: number, type: MutationBuyType) {
		const sorted = getSortedItems(type);
		return sorted.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE);
	}

	function getMutationIndex(page: number, index: number) {
		return page * ITEMS_PER_PAGE + index + 1;
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

	function getSelectRow(buyType: MutationBuyType) {
		const instaBuyLabel = 'Bazaar Insta Buy';
		const buyOrderLabel = 'Bazaar Buy Order';
		const instaBuyEmoji = '💸';
		const buyOrderEmoji = '📒';
		const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>()
		.addComponents(
			new StringSelectMenuBuilder()
				.setCustomId('mutation-select')
				.addOptions(
					new StringSelectMenuOptionBuilder()
						.setLabel(instaBuyLabel)
						.setValue('instabuy')
						.setEmoji(instaBuyEmoji),
					new StringSelectMenuOptionBuilder()
						.setLabel(buyOrderLabel)
						.setValue('buyorder')
						.setEmoji(buyOrderEmoji))
				.setPlaceholder(buyType === 'instabuy' 
					? `${instaBuyEmoji} ${instaBuyLabel}` 
					: `${buyOrderEmoji} ${buyOrderLabel}`)
		);

		return selectRow;
	}

	const maxPage = Math.max(0, Math.ceil(mutationRatios.length / ITEMS_PER_PAGE) - 1);
	function buildEmbed(page: number, type: MutationBuyType) {
		const pageItems = getPageItems(page, type);
		const description = `Synthesis Bonus: **${synthesis}%**\nRose Dragon Bonus: **${rose_dragon}%**`;
		let mutationsField = '';
		pageItems.forEach((item, i) => {
			const idx = getMutationIndex(page, i);
			let priceText, totalText = '';
			if (type === 'instabuy') {
				priceText = isFinite(item.buyCoinPerCopper) ? `\`${item.buyCoinPerCopper.toFixed(2)}\`` : '`N/A`';
				totalText = isFinite(item.buyCoinTotal) ? `${formatNumber(item.buyCoinTotal)}` : '`N/A`';
			} else {
				priceText = isFinite(item.buyOrderCoinPerCopper) ? `\`${item.buyOrderCoinPerCopper.toFixed(2)}\`` : '`N/A`';
				totalText = isFinite(item.buyOrderCoinTotal) ? `${formatNumber(item.buyOrderCoinTotal)}` : '`N/A`';
			}
			mutationsField += `\`#${idx}\` **${item.name}**: ${priceText} coins/Copper (\`${item.copper.toLocaleString()} Copper\`/\`${totalText}\`)\n`;
		});
		return EliteEmbed(settings)
			.setTitle('Mutation Analysis - Coin/Copper Ratios')
			.setDescription(description)
			.addFields({ name: `Mutations - ${type === 'instabuy' ? 'Bazaar Insta Buy' : 'Bazaar Buy Order'}`, value: mutationsField, inline: false });
	}

	const reply = await interaction.editReply({
		embeds: [buildEmbed(page, selectedType)],
		components: [getSelectRow(selectedType), getButtonRow(page, maxPage)],
	});

	const buttonCollector = reply.createMessageComponentCollector({
		componentType: ComponentType.Button,
		time: 60_000,
	});

	buttonCollector.on('collect', async (inter) => {
		if (inter.user.id !== interaction.user.id) {
			return NotYoursReply(inter);
		} else {
			resetCollectors();
			if (inter.customId === 'first') {
				page = 0;
			} else if (inter.customId === 'back') {
				if (page > 0) {
					page -= 1;
				}
			} else if (inter.customId === 'forward') {
				if (page < maxPage) {
					page += 1;
				}
			} else if (inter.customId === 'last') {
				if (page !== maxPage) {
					page = maxPage;
				}
			}

			await inter.update({
				embeds: [buildEmbed(page, selectedType)],
				components: [getSelectRow(selectedType), getButtonRow(page, maxPage)],
			}).catch(() => {
				buttonCollector.stop();
			});
		}
	});

	buttonCollector.on('end', async () => {
		clearComponents();
	});

	const selectCollector = reply.createMessageComponentCollector({
		componentType: ComponentType.StringSelect,
		time: 60_000,
	});

	selectCollector.on('collect', async (inter) => {
		if (inter.user.id !== interaction.user.id) {
			return NotYoursReply(inter);
		} else {
			resetCollectors();
			const value = inter.values[0];
			if (value === 'instabuy' || value === 'buyorder') {
				selectedType = value;
				page = 0; // reset page
				await inter.update({
					embeds: [buildEmbed(page, selectedType)],
					components: [getSelectRow(selectedType), getButtonRow(page, maxPage)],
				});
			}
		} 
	});

	selectCollector.on('end', async () => {
		clearComponents();
	});

	function resetCollectors() {
		buttonCollector.resetTimer({ time: 30_000 });
		selectCollector.resetTimer({ time: 30_000 });
	}

	async function clearComponents() {
		await interaction.editReply({
			embeds: [buildEmbed(page, selectedType)],
			components: [], //remove buttons & select menu
		});
	}
}

function formatNumber(num: number) {
	return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(num);
}