import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	ChatInputCommandInteraction,
	ComponentType,
	MessageFlags,
	StringSelectMenuBuilder,
	StringSelectMenuOptionBuilder,
} from 'discord.js';
import { GREENHOUSE_MUTATIONS, Rarity } from 'farming-weight';
import { FetchProducts, UserSettings } from '../api/elite';
import { CommandAccess, CommandType, EliteCommand, SlashCommandOptionType } from '../classes/commands/index';
import { EliteContainer } from '../classes/components';
import { NotYoursReply } from '../classes/embeds';

export interface MutationCopperRatio {
	id: string;
	name: string;
	copper: number;
	buyCoinPerCopper: number;
	buyCoinTotal: number;
	buyOrderCoinPerCopper: number;
	buyOrderCoinTotal: number;
}

interface SynthesisChip {
	level: number;
	rarity: Rarity;
	bonus: number;
}

type MutationBuyType = 'instabuy' | 'buyorder';

const mutations = Object.values(GREENHOUSE_MUTATIONS);

const command = new EliteCommand({
	name: 'mutations',
	description: 'Shows best mutations to analyze for copper',
	access: CommandAccess.Everywhere,
	type: CommandType.Slash,
	options: {
		synthesis: {
			name: 'synthesis',
			description: 'Synthesis Chip Level',
			type: SlashCommandOptionType.Integer,
			builder: (b) => b.setMinValue(0).setMaxValue(20),
		},
		rose_dragon: {
			name: 'rose_dragon',
			description: 'Rose Dragon Level',
			type: SlashCommandOptionType.Integer,
			builder: (b) => b.setMinValue(0).setMaxValue(200),
		},
	},
	execute: execute,
});

export default command;

async function execute(interaction: ChatInputCommandInteraction, settings?: UserSettings) {
	await interaction.deferReply();

	const synthesis: SynthesisChip = getSynthesisChipFromLevel(interaction.options.getInteger('synthesis', false) ?? 0);
	const roseDragonLevel = interaction.options.getInteger('rose_dragon', false) ?? 0;
	const roseDragonBonus = roseDragonLevel > 100 ? roseDragonLevel * 0.1 : 0;
	const mutationIds = mutations.map((m) => m.id);
	const { data: bazaar } = await FetchProducts(mutationIds);

	const mutationRatios: MutationCopperRatio[] = mutations.map((mutation) => {
		const bazaarItem = bazaar?.items?.[mutation.id];
		const buy = getPrice(bazaarItem?.bazaar?.averageBuy) ?? getPrice(bazaarItem?.bazaar?.buy);
		const buyOrder = getPrice(bazaarItem?.bazaar?.averageBuyOrder) ?? getPrice(bazaarItem?.bazaar?.buyOrder);
		const analysisCost = mutation.analysis.baseCost;
		const copper = mutation.analysis.copper * (1 + synthesis.bonus / 100 + roseDragonBonus / 100);

		if (buy === undefined && buyOrder === undefined) {
			// if neither buy nor buy order exist, return infinite ratio (Jerryflower)
			return {
				id: mutation.id,
				name: mutation.display.name ?? mutation.id,
				copper: copper,
				buyCoinPerCopper: Infinity,
				buyCoinTotal: Infinity,
				buyOrderCoinPerCopper: Infinity,
				buyOrderCoinTotal: Infinity,
			};
		}

		const buyCoinTotal = getCoinTotal(analysisCost, buy);
		const buyOrderCoinTotal = getCoinTotal(analysisCost, buyOrder);

		return {
			id: mutation.id,
			name: mutation.display.name ?? mutation.id,
			copper: copper,
			buyCoinPerCopper: buyCoinTotal / copper,
			buyOrderCoinPerCopper: buyOrderCoinTotal / copper,
			buyCoinTotal,
			buyOrderCoinTotal,
		};
	});

	const ITEMS_PER_PAGE = 10;
	const COLLECTOR_TIMEOUT = 60_000;
	const COLLECTOR_RESET = 30_000;

	const state = {
		page: 0,
		selectedType: 'instabuy' as MutationBuyType,
	}; // default to instabuy

	const sortedInstabuy = [...mutationRatios].sort((a, b) => a.buyCoinPerCopper - b.buyCoinPerCopper);

	const sortedBuyOrder = [...mutationRatios].sort((a, b) => a.buyOrderCoinPerCopper - b.buyOrderCoinPerCopper);

	function getSortedItems(type: MutationBuyType) {
		return type === 'instabuy' ? sortedInstabuy : sortedBuyOrder;
	}

	function getPageItems(page: number, type: MutationBuyType) {
		const sorted = getSortedItems(type);
		return sorted.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE);
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
		const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
			new StringSelectMenuBuilder()
				.setCustomId('mutation-select')
				.addOptions(
					new StringSelectMenuOptionBuilder().setLabel(instaBuyLabel).setValue('instabuy').setEmoji(instaBuyEmoji),
					new StringSelectMenuOptionBuilder().setLabel(buyOrderLabel).setValue('buyorder').setEmoji(buyOrderEmoji),
				)
				.setPlaceholder(
					buyType === 'instabuy' ? `${instaBuyEmoji} ${instaBuyLabel}` : `${buyOrderEmoji} ${buyOrderLabel}`,
				),
		);
		return selectRow;
	}

	const maxPage = Math.max(0, Math.ceil(mutationRatios.length / ITEMS_PER_PAGE) - 1);

	function buildContainer(page: number, type: MutationBuyType) {
		const pageItems = getPageItems(page, type);
		const rarity = `Synthesis Chip Rarity (determined by the level): **${synthesis.rarity}**\n`;
		const boosts = `${synthesis.level > 0 ? rarity : ''}Synthesis Bonus: **${synthesis.bonus.toFixed(1)}%**\nRose Dragon Bonus: **${roseDragonBonus.toFixed(1)}%**`;
		let mutationsField = '';
		pageItems.forEach((item, i) => {
			const idx = page * ITEMS_PER_PAGE + i + 1;
			let priceText,
				totalText = '';

			const price = type === 'instabuy' ? item.buyCoinPerCopper : item.buyOrderCoinPerCopper;

			const total = type === 'instabuy' ? item.buyCoinTotal : item.buyOrderCoinTotal;

			priceText = isFinite(price) ? `\`${price.toFixed(2)}\`` : '`N/A`';
			totalText = isFinite(total) ? `${formatNumber(total)}` : '`N/A`';
			mutationsField += `\`#${idx}\` **${item.name}**: ${priceText} coins/Copper (\`${item.copper.toLocaleString()} Copper\`/\`${totalText}\`)\n`;
		});

		const container = new EliteContainer(settings)
			.addTitle('**Mutation Analysis - Coin/Copper Ratios**')
			.addText(boosts)
			.addSeparator()
			.addDescription(mutationsField)
			.addFooter();
		return container;
	}

	let currentContainer = buildContainer(state.page, state.selectedType);
	let componentsCleared = false;

	const reply = await interaction.editReply({
		components: [currentContainer, getSelectRow(state.selectedType), getButtonRow(state.page, maxPage)],
		flags: MessageFlags.IsComponentsV2,
	});

	const buttonCollector = reply.createMessageComponentCollector({
		componentType: ComponentType.Button,
		time: COLLECTOR_TIMEOUT,
	});

	buttonCollector.on('collect', async (inter) => {
		if (inter.user.id !== interaction.user.id) {
			return NotYoursReply(inter);
		} else {
			resetCollectors();
			if (inter.customId === 'first') {
				state.page = 0;
			} else if (inter.customId === 'back') {
				if (state.page > 0) {
					state.page -= 1;
				}
			} else if (inter.customId === 'forward') {
				if (state.page < maxPage) {
					state.page += 1;
				}
			} else if (inter.customId === 'last') {
				if (state.page !== maxPage) {
					state.page = maxPage;
				}
			}

			currentContainer = buildContainer(state.page, state.selectedType);
			await inter
				.update({
					components: [currentContainer, getSelectRow(state.selectedType), getButtonRow(state.page, maxPage)],
				})
				.catch(() => {
					buttonCollector.stop();
				});
		}
	});

	buttonCollector.on('end', async () => {
		clearComponents();
	});

	const selectCollector = reply.createMessageComponentCollector({
		componentType: ComponentType.StringSelect,
		time: COLLECTOR_TIMEOUT,
	});

	selectCollector.on('collect', async (inter) => {
		if (inter.user.id !== interaction.user.id) {
			return NotYoursReply(inter);
		} else {
			resetCollectors();
			const value = inter.values[0];
			if (value === 'instabuy' || value === 'buyorder') {
				state.selectedType = value;
				state.page = 0; // reset page
				currentContainer = buildContainer(state.page, state.selectedType);
				await inter
					.update({
						components: [currentContainer, getSelectRow(state.selectedType), getButtonRow(state.page, maxPage)],
					})
					.catch(() => {
						selectCollector.stop();
					});
			}
		}
	});

	selectCollector.on('end', async () => {
		clearComponents();
	});

	function resetCollectors() {
		buttonCollector.resetTimer({ time: COLLECTOR_RESET });
		selectCollector.resetTimer({ time: COLLECTOR_RESET });
	}

	async function clearComponents() {
		if (componentsCleared) return;
		componentsCleared = true;
		currentContainer.disableEverything();
		await interaction
			.editReply({
				components: [currentContainer],
			})
			.catch(() => undefined);
	}
}

function formatNumber(num: number) {
	return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(num);
}

function getPrice(price: number | null | undefined) {
	return price !== undefined && price !== null && price > 0 ? price : undefined;
}

function getCoinTotal(baseCost: number, bazaarPrice: number | undefined) {
	return bazaarPrice === undefined ? Infinity : baseCost + bazaarPrice;
}

function getSynthesisChipFromLevel(level: number): SynthesisChip {
	let rarity: Rarity;

	if (level > 15 && level <= 20) {
		rarity = Rarity.Legendary;
	} else if (level > 10) {
		rarity = Rarity.Epic;
	} else {
		rarity = Rarity.Rare;
	}

	const synthesisBonusPerRarity: Record<Rarity.Rare | Rarity.Epic | Rarity.Legendary, number> = {
		[Rarity.Rare]: 1,
		[Rarity.Epic]: 1.5,
		[Rarity.Legendary]: 2,
	};

	const bonus = synthesisBonusPerRarity[rarity] * level;

	return {
		level,
		rarity,
		bonus,
	};
}
