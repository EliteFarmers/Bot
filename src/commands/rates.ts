import {
	ButtonBuilder,
	ButtonStyle,
	ChatInputCommandInteraction,
	CheckboxGroupBuilder,
	LabelBuilder,
	MessageFlags,
	ModalBuilder,
	ModalSubmitInteraction,
	StringSelectMenuBuilder,
	StringSelectMenuInteraction,
	TextInputBuilder,
	TextInputStyle,
} from 'discord.js';
import {
	BEST_FARMING_TOOLS,
	CROP_INFO,
	Crop,
	calculateAverageSpecialCrops,
	calculateDetailedDropsFromEffects,
	createFarmingPlayer,
	type DetailedDropsFromEffectsResult,
	FarmingPet,
	getCropDisplayName,
	getPossibleResultsFromCrops,
	MAX_CROP_FORTUNE,
	Rarity,
	REFORGES,
	Stat,
} from 'farming-weight';
import { FetchProducts, UserSettings } from '../api/elite';
import { CommandAccess, CommandType, EliteCommand, SlashCommandOptionType } from '../classes/commands/index';
import { EliteContainer } from '../classes/components';
import { NotYoursReply } from '../classes/embeds';
import { CropSelectRow, EliteCropEmojis, GetCropEmoji } from '../classes/Util';

const TIME_OPTIONS = {
	24_000: 'Jacob Contest',
	72_000: '1 Hour',
	288_000: '4 Hours',
	864_000: '12 Hours',
	1_728_000: '24 Hours',
};

type RatesReforge = 'bountiful' | 'blessed';
type RatesPet = 'rose_dragon' | 'mooshroom' | 'elephant';

type RatesCalculatorInput = {
	fortuneInput?: number;
	blocks: number;
	reforge: RatesReforge;
	pet: RatesPet;
	bps: number;
	useLevel50Tool: boolean;
	rarefinder: boolean;
	mechamind: boolean;
	cropeetle: boolean;
	wartyBug: boolean;
};

type RatesCalculatorState = RatesCalculatorInput & {
	timeName: (typeof TIME_OPTIONS)[keyof typeof TIME_OPTIONS];
	blocksBroken: number;
	petName: string;
	petData?: FarmingPet;
};

type FormattedCropRate = ReturnType<typeof formatCropRate>;
type FormattedRatesResult = ReturnType<typeof formatRatesForDisplay>;

const command = new EliteCommand({
	name: 'rates',
	description: 'Get NPC profit rates for a given amount of fortune!',
	access: CommandAccess.Everywhere,
	type: CommandType.Slash,
	options: {
		fortune: {
			name: 'fortune',
			description: 'The amount of fortune to calculate rates for!',
			type: SlashCommandOptionType.Integer,
			builder: (b) => b.setMinValue(0).setMaxValue(5000),
		},
		time: {
			name: 'time',
			description: 'The amount of time to calculate rates for!',
			type: SlashCommandOptionType.Integer,
			builder: (b) =>
				b.addChoices(
					...Object.entries(TIME_OPTIONS).map(([value, name]) => ({
						name,
						value: +value,
					})),
				),
		},
		reforge: {
			name: 'reforge',
			description: 'The reforge to calculate rates for!',
			type: SlashCommandOptionType.String,
			builder: (b) => b.addChoices({ name: 'Bountiful', value: 'bountiful' }, { name: 'Blessed', value: 'blessed' }),
		},
		pet: {
			name: 'pet',
			description: 'The pet to calculate rates for!',
			type: SlashCommandOptionType.String,
			builder: (b) =>
				b.addChoices(
					{ name: 'Rose Dragon', value: 'rose_dragon' },
					{ name: 'Mooshroom Cow', value: 'mooshroom' },
					{ name: 'Elephant', value: 'elephant' },
				),
		},
		'max-tool': {
			name: 'max-tool',
			description: 'Whether to use a level 50 farming tool! (default: true)',
			type: SlashCommandOptionType.Boolean,
			builder: (b) => b.setRequired(false),
		},
		bps: {
			name: 'bps',
			description: 'Your blocks broken per second! (10-20)',
			type: SlashCommandOptionType.Number,
			builder: (b) => b.setMinValue(10).setMaxValue(20),
		},
	},
	execute: execute,
});

export default command;

const ElephantFortuneDiff = 396.7 - 210;
const MooshroomFortuneDiff = 396.7 - 217;
const fortuneEmoji = '<:ff:1450022749631287330>';
const DescriptionSeparator = ' \u2022 ';

async function execute(interaction: ChatInputCommandInteraction, settings?: UserSettings) {
	const calculatorInput = getRatesCalculatorInput(interaction);
	let calculatorState = buildRatesCalculatorState(calculatorInput);
	let rates = await getFormattedRatesResult(calculatorState);

	await interaction.deferReply();

	const row = CropSelectRow('crop-select-rates', 'Select a crop to view its rates!');
	let container = buildCompactRatesContainer(settings, interaction.user.id, calculatorState, rates, row);
	const cropList = Object.keys(EliteCropEmojis) as Crop[];

	const reply = await interaction.editReply({
		components: [container],
		flags: [MessageFlags.IsComponentsV2],
	});

	const collector = reply.createMessageComponentCollector({
		time: 120_000,
	});

	let cropContainer: EliteContainer | undefined;

	collector.on('collect', async (inter) => {
		if (inter.user.id !== interaction.user.id) {
			return NotYoursReply(inter);
		}

		collector.resetTimer();

		if (cropContainer?.handleCollapsibleInteraction(inter)) {
			return inter.update({ components: [cropContainer, row] });
		}

		if (inter.customId == 'back') {
			await inter.update({
				components: [container],
				flags: [MessageFlags.IsComponentsV2],
			});
			cropContainer = undefined;
			return;
		}

		if (inter.customId === 'rates-settings') {
			const modalCustomId = `rates-settings-modal-${inter.id}`;
			const settingsModal = buildRatesSettingsModal(calculatorState, modalCustomId);
			await inter.showModal(settingsModal);

			const filter = (i: ModalSubmitInteraction) => i.customId === modalCustomId && i.user.id === interaction.user.id;

			const submitted = await interaction
				.awaitModalSubmit({
					filter,
					time: 120_000,
				})
				.catch(() => null);

			if (submitted && submitted.isFromMessage()) {
				const other = submitted.fields.getCheckboxGroup('other-modifiers') || [];
				const fortuneValue = parseInt(submitted.fields.getTextInputValue('fortune-input'));
				try {
					const newState = buildRatesCalculatorState({
						fortuneInput: isFinite(fortuneValue)
							? Math.max(0, Math.min(5000, fortuneValue))
							: calculatorState.fortuneInput,
						blocks: +submitted.fields.getStringSelectValues('time-input')[0] || calculatorState.blocks,
						reforge:
							(submitted.fields.getStringSelectValues('reforge-input')[0] as RatesReforge) || calculatorState.reforge,
						pet: (submitted.fields.getStringSelectValues('pet-input')[0] as RatesPet) || calculatorState.pet,
						bps: calculatorState.bps,
						useLevel50Tool: other.includes('max-tool'),
						rarefinder: other.includes('rarefinder'),
						mechamind: other.includes('mechamind'),
						cropeetle: other.includes('cropeetle'),
						wartyBug: other.includes('warty_bug'),
					});
					calculatorState = newState;
				} catch (e) {
					console.error('Error parsing settings modal input', e);
				}
				rates = await getFormattedRatesResult(calculatorState);
				container = buildCompactRatesContainer(settings, interaction.user.id, calculatorState, rates, row);

				await submitted.update({
					components: [container],
					flags: [MessageFlags.IsComponentsV2],
				});
			} else {
				console.error('No settings submitted');
			}

			return;
		}

		if (inter.customId !== 'crop-select-rates' && !inter.customId.startsWith('crop-select-rates-')) return;

		const selected = inter instanceof StringSelectMenuInteraction ? +inter.values[0] : +inter.customId.split('-')[3];
		const selectedCrop = cropList[selected] as Crop;
		const cropInfo = rates.formatted.find((c) => c.crop === selectedCrop) || rates.formatted[selected];

		cropContainer = buildCropRatesContainer(settings, calculatorState, cropInfo);

		inter.update({ components: [cropContainer, row] });
	});

	collector.on('end', async () => {
		if (cropContainer) {
			cropContainer.disableEverything();
			await interaction.editReply({ components: [cropContainer] });
		} else {
			interaction.editReply({ components: [container.disableEverything()] }).catch(() => undefined);
		}
	});
}

function getRatesCalculatorInput(interaction: ChatInputCommandInteraction): RatesCalculatorInput {
	const fortuneRaw = interaction.options.getInteger('fortune', false) ?? undefined;

	return {
		fortuneInput: fortuneRaw ? fortuneRaw : undefined,
		blocks: interaction.options.getInteger('time', false) ?? 72_000,
		reforge: (interaction.options.getString('reforge', false) ?? 'bountiful') as RatesReforge,
		pet: (interaction.options.getString('pet', false) ?? 'rose_dragon') as RatesPet,
		bps: interaction.options.getNumber('bps', false) ?? 20,
		useLevel50Tool: interaction.options.getBoolean('max-tool', false) ?? true,
		rarefinder: true,
		mechamind: true,
		cropeetle: true,
		wartyBug: false,
	};
}

function buildRatesCalculatorState(input: RatesCalculatorInput): RatesCalculatorState {
	return {
		...input,
		timeName: TIME_OPTIONS[input.blocks as keyof typeof TIME_OPTIONS],
		blocksBroken: Math.round(input.blocks * (input.bps / 20)),
		petName: getPetName(input.pet),
		petData: getPetData(input.pet),
	};
}

function getPetName(pet: RatesPet) {
	return pet === 'mooshroom' ? 'Mooshroom Cow' : pet === 'elephant' ? 'Elephant' : 'Rose Dragon';
}

function getPetData(pet: RatesPet) {
	if (pet !== 'rose_dragon') return undefined;

	return new FarmingPet({
		type: 'ROSE_DRAGON',
		exp: 1708399946,
		active: true,
		tier: 'LEGENDARY',
		heldItem: 'GREEN_BANDANA',
	});
}

async function getFormattedRatesResult(state: RatesCalculatorState) {
	const expectedDrops = getExpectedDrops(state);
	const bazaar = await fetchRatesBazaarProducts(expectedDrops);

	return formatRatesForDisplay(expectedDrops, bazaar);
}

function getExpectedDrops(state: RatesCalculatorState): Partial<Record<Crop, DetailedDropsFromEffectsResult>> {
	const cropFortune = getPetCropFortuneOverride(state);
	const expectedDrops: Partial<Record<Crop, DetailedDropsFromEffectsResult>> = {};

	for (const crop of Object.keys(CROP_INFO) as Crop[]) {
		if (crop === Crop.Seeds) continue;
		expectedDrops[crop] = calculateCropDrops(state, crop, cropFortune);
	}

	return expectedDrops;
}

function calculateCropDrops(
	state: RatesCalculatorState,
	crop: Crop,
	cropFortune?: Partial<Record<Crop, number>>,
): DetailedDropsFromEffectsResult {
	const player = createFarmingPlayer({
		selectedCrop: crop,
		pets: state.petData ? [state.petData] : [],
		chips: {
			rarefinder: state.rarefinder ? 20 : 0,
			mechamind: state.mechamind ? 20 : 0,
		},
		attributes: {
			crop_bug: state.cropeetle ? 64 : 0,
			wart_eater: state.wartyBug ? 24 : 0,
		},
	});

	if (state.petData) {
		player.selectPet(state.petData);
	}

	const env = player.buildEnvironment(crop);

	return calculateDetailedDropsFromEffects({
		crop,
		farmingFortune: getSyntheticFarmingFortune(state, crop, cropFortune),
		blocksBroken: state.blocksBroken,
		bountiful: state.reforge === 'bountiful',
		mooshroom: state.pet === 'mooshroom',
		maxTool: state.useLevel50Tool,
		pet: state.petData,
		chips: {
			rarefinder: state.rarefinder ? 20 : 0,
			mechamind: state.mechamind ? 20 : 0,
		},
		effects: player.collectEffects(env),
		env,
	});
}

function getSyntheticFarmingFortune(
	state: RatesCalculatorState,
	crop: Crop,
	cropFortune?: Partial<Record<Crop, number>>,
) {
	if (state.fortuneInput !== undefined || cropFortune?.[crop] === undefined) {
		return state.fortuneInput;
	}

	if (state.reforge === 'bountiful') {
		return cropFortune[crop];
	}

	const maxRarity = BEST_FARMING_TOOLS[crop]?.maxRarity ?? Rarity.Mythic;
	const bountifulFortune = REFORGES.bountiful?.tiers[maxRarity]?.stats?.[Stat.FarmingFortune] ?? 0;
	const blessedFortune = REFORGES.blessed?.tiers[maxRarity]?.stats?.[Stat.FarmingFortune] ?? 0;

	return cropFortune[crop] + blessedFortune - bountifulFortune;
}

function getPetCropFortuneOverride(state: RatesCalculatorState) {
	// Subtract difference from not using rose dragon pet if we don't have it
	// selected (default behavior already uses MAX_CROP_FORTUNE)
	if (state.fortuneInput !== undefined || state.pet === 'rose_dragon') {
		return undefined;
	}

	const diff = state.pet === 'mooshroom' ? MooshroomFortuneDiff : ElephantFortuneDiff;

	return Object.fromEntries(
		Object.entries(MAX_CROP_FORTUNE).map(([crop, max]) => [crop, max - diff]),
	) as typeof MAX_CROP_FORTUNE;
}

async function fetchRatesBazaarProducts(expectedDrops: Partial<Record<Crop, DetailedDropsFromEffectsResult>>) {
	const craftIds = Object.values(CROP_INFO)
		.map((info) => info.crafts.map((c) => c.item))
		.flat();
	const dropIds = Object.values(expectedDrops)
		.flatMap((details) => Object.keys(details?.items ?? {}))
		.filter((id) => id !== Crop.Seeds);
	const rareDropIds = Object.values(expectedDrops).flatMap((details) => Object.keys(details?.rngItems ?? {}));
	const allIds = [...new Set([...craftIds, ...dropIds, ...rareDropIds])] as string[];
	const { data } = await FetchProducts(allIds);

	return data;
}

function formatRatesForDisplay(
	expectedDrops: Partial<Record<Crop, DetailedDropsFromEffectsResult>>,
	bazaar: Awaited<ReturnType<typeof fetchRatesBazaarProducts>>,
) {
	let profitLength = 0;
	let bzLength = 0;

	const formatted = Object.entries(expectedDrops)
		.map(([crop, details]) => {
			const cropRate = formatCropRate(crop as Crop, details as DetailedDropsFromEffectsResult, bazaar);
			const highestBz = cropRate.bz[0];

			if (cropRate.profit.toLocaleString().length > profitLength) {
				profitLength = cropRate.profit.toLocaleString().length;
			}

			if (highestBz && highestBz.total.toLocaleString().length > bzLength) {
				bzLength = highestBz.total.toLocaleString().length;
			}

			return cropRate;
		})
		.sort((a, b) => b.profit - a.profit);

	return {
		formatted,
		profitLength,
		bzLength,
	};
}

function formatCropRate(
	crop: Crop,
	details: DetailedDropsFromEffectsResult,
	bazaar: Awaited<ReturnType<typeof fetchRatesBazaarProducts>>,
) {
	const cropName = getCropDisplayName(crop);
	const profit = details.npcCoins ?? 0;
	const cropItems = details.items?.[crop] ?? 0;
	const otherCoinsNpc = (details.npcCoins ?? 0) - cropItems * details.npcPrice;

	const { sellToBazaar, sellToBazaarCoins, sellToBazaarDelta } = getSellToBazaarData(crop, details, bazaar);
	const otherCoinsTotal = otherCoinsNpc + sellToBazaarDelta;
	const otherCoinsNpcRemaining = Math.max(0, otherCoinsTotal - sellToBazaarCoins);
	const bz = getBazaarRates(crop, details, bazaar, otherCoinsTotal);

	return {
		crop,
		emoji: GetCropEmoji(cropName),
		bz: bz.length ? bz : [{ name: 'N/A', items: 0, cost: 0, per: 0, profit: 0, total: 0 }],
		other: {
			total: Math.floor(otherCoinsTotal),
			npc: Math.floor(otherCoinsNpcRemaining),
			bazaar: Math.floor(sellToBazaarCoins),
			sellToBazaar: sellToBazaar.map((x) => ({ ...x, items: x.items })),
		},
		details,
		profit,
	};
}

function getSellToBazaarData(
	crop: Crop,
	details: DetailedDropsFromEffectsResult,
	bazaar: Awaited<ReturnType<typeof fetchRatesBazaarProducts>>,
) {
	const sellToBazaar = [];
	let sellToBazaarCoins = 0;
	let sellToBazaarDelta = 0;

	for (const [itemId, items] of [...Object.entries(details.items ?? {}), ...Object.entries(details.rngItems ?? {})]) {
		if (itemId === crop) continue;
		if (!items || items <= 0) continue;

		const itemData = bazaar?.items?.[itemId];
		const bzData = itemData?.bazaar;
		if (!bzData) continue;

		const npc = bzData.npc ?? 0;
		const per = bzData.averageSellOrder ?? 0;
		if (per <= npc || per <= 0) continue;

		const gain = items * (per - npc);
		sellToBazaarDelta += gain;
		sellToBazaarCoins += items * per;
		sellToBazaar.push({
			itemId,
			name: itemData?.name ?? itemId,
			items,
			npc,
			per,
			gain,
		});
	}

	sellToBazaar.sort((a, b) => b.gain - a.gain);

	return {
		sellToBazaar,
		sellToBazaarCoins,
		sellToBazaarDelta,
	};
}

function getBazaarRates(
	crop: Crop,
	details: DetailedDropsFromEffectsResult,
	bazaar: Awaited<ReturnType<typeof fetchRatesBazaarProducts>>,
	otherCoinsTotal: number,
) {
	const crafts = getPossibleResultsFromCrops(crop, details.items[crop] ?? details.collection);
	const bz = [];

	for (const [itemId, craft] of Object.entries(crafts)) {
		if (itemId === crop) continue;
		const bzData = bazaar?.items?.[itemId];
		if (!bzData?.bazaar) continue;

		const profit = craft.fractionalItems * bzData.bazaar.averageSellOrder - craft.fractionalCost;

		bz.push({
			name: bzData.name ?? itemId,
			items: craft.fractionalItems,
			cost: craft.fractionalCost,
			per: bzData.bazaar.averageSellOrder,
			profit: Math.floor(profit),
			total: Math.floor(profit + otherCoinsTotal),
		});
	}

	bz.sort((a, b) => b.total - a.total);

	return bz;
}

function buildCompactRatesContainer(
	settings: UserSettings | undefined,
	userId: string,
	state: RatesCalculatorState,
	rates: FormattedRatesResult,
	row: ReturnType<typeof CropSelectRow>,
) {
	const compactContainer = new EliteContainer(settings)
		.addTitle('## Farming Rates Calculator', false)
		.addButtonSection(
			new ButtonBuilder().setCustomId('rates-settings').setLabel('Settings').setStyle(ButtonStyle.Primary),
			buildSummaryDescription(state),
		)
		.addSeparator();

	for (const cropRate of rates.formatted) {
		compactContainer.addText(getCompactRateText(cropRate, rates));
	}

	compactContainer.addActionRowComponents(row);
	compactContainer.addSeparator();
	compactContainer.addText("**What's my fortune?**\n-# " + getFortuneDetailsText(settings, userId, state.fortuneInput));
	compactContainer.addFooter();

	return compactContainer;
}

function getCompactRateText(cropRate: FormattedCropRate, rates: FormattedRatesResult) {
	const values = `:coin: \`${cropRate.profit.toLocaleString().padStart(rates.profitLength, ' ')}\` **BZ** \`${(
		cropRate.bz[0]?.total ?? 0
	)
		.toLocaleString()
		.padStart(rates.bzLength, ' ')}\` ${fortuneEmoji} \`${cropRate.details.fortune.toLocaleString()}\``;

	return `${cropRate.emoji} ${values}`;
}

function getFortuneDetailsText(settings: UserSettings | undefined, userId: string, fortuneInput?: number) {
	let details = settings
		? `You can view your rates with your farming gear on the [website here](<https://elitesb.gg/@${userId}/rates>)!`
		: `You can view your rates with your farming gear on the "**Fortune**" tab of your [online stats](<https://elitesb.gg/>)!`;

	if (fortuneInput !== undefined) {
		details +=
			'\n\n**Custom Fortune Warning**\n-# The amount of fortune available varies depending on the crop. For the best results, only look at the crop your entered fortune is for.';
	}

	return details;
}

function buildCropRatesContainer(
	settings: UserSettings | undefined,
	state: RatesCalculatorState,
	cropInfo: FormattedCropRate,
) {
	const cropName = getCropDisplayName(cropInfo.crop);
	const coinSources = sortEntryValues(cropInfo.details.coinSources);
	const collections = sortEntryValues(cropInfo.details.otherCollection);
	const threeFourths = calculateAverageSpecialCrops(state.blocksBroken, cropInfo.crop, 3);
	const fromSpecial = cropInfo.details.coinSources[threeFourths.type] ?? 0;
	const specialDifference = fromSpecial - threeFourths.npc;
	const threeFourthsTotal = cropInfo.details.npcCoins - specialDifference;

	return new EliteContainer(settings)
		.addTitle('## ' + cropName + ' Rates', false)
		.addButtonSection(
			new ButtonBuilder().setCustomId('rates-settings').setLabel('Settings').setStyle(ButtonStyle.Primary),
			buildCropDescription(state, cropInfo.details.fortune),
		)
		.addSeparator()
		.addCollapsible({
			header: '**NPC Profit**',
			collapsed: {
				text: '### :coin: ' + cropInfo.details.npcCoins.toLocaleString() || '0',
			},
			expanded: {
				text: buildNpcProfitText(
					coinSources,
					threeFourthsTotal,
					specialDifference,
					threeFourths.amount,
					threeFourths.type,
				),
			},
		})
		.addSeparator()
		.addCollapsible({
			header: '**Bazaar Profit**',
			collapsed: {
				text: '### <:bz:1376714811894796328> ' + cropInfo.bz[0].total.toLocaleString() || '0',
			},
			expanded: {
				text: buildBazaarProfitText(cropInfo),
			},
		})
		.addSeparator()
		.addCollapsible({
			header: '**Collection Gain**',
			collapsed: {
				text: '### ' + GetCropEmoji(cropName) + ' ' + cropInfo.details.collection.toLocaleString(),
			},
			expanded: {
				text: buildCollectionGainText(collections),
			},
		})
		.addFooter(true, 'back');
}

function buildRatesSettingsModal(state: RatesCalculatorState, modalCustomId: string) {
	// Build a modal to update fortune, reforge, pet, bps, and max tool settings
	// Pre-fill the inputs with the current settings
	// On submit, update the rates display with the new settings

	const modal = new ModalBuilder().setCustomId(modalCustomId).setTitle('Rates Calculator Settings');

	// Fortune input

	const fortuneInput = new TextInputBuilder()
		.setCustomId('fortune-input')
		.setStyle(TextInputStyle.Short)
		.setPlaceholder('Enter a custom fortune amount')
		.setValue(state.fortuneInput?.toString() ?? '')
		.setRequired(false);

	const label = new LabelBuilder().setLabel('Farming Fortune').setTextInputComponent(fortuneInput);
	modal.addLabelComponents(label);

	// Time input

	const timeInput = new StringSelectMenuBuilder()
		.setCustomId('time-input')
		.setPlaceholder('Select time period')
		.addOptions(
			...Object.entries(TIME_OPTIONS).map(([value, name]) => ({
				label: name,
				value,
				default: state.blocks === +value,
			})),
		);

	modal.addLabelComponents(new LabelBuilder().setLabel('Time Period').setStringSelectMenuComponent(timeInput));

	// Reforge input

	const reforgeInput = new StringSelectMenuBuilder()
		.setCustomId('reforge-input')
		.setPlaceholder('Select a reforge')
		.addOptions(
			{
				label: 'Bountiful',
				value: 'bountiful',
				default: state.reforge === 'bountiful',
			},
			{
				label: 'Blessed',
				value: 'blessed',
				default: state.reforge === 'blessed',
			},
		);

	modal.addLabelComponents(new LabelBuilder().setLabel('Reforge').setStringSelectMenuComponent(reforgeInput));

	// Pet input

	const petInput = new StringSelectMenuBuilder()
		.setCustomId('pet-input')
		.setPlaceholder('Select a pet')
		.addOptions(
			{
				label: 'Rose Dragon',
				value: 'rose_dragon',
				default: state.pet === 'rose_dragon',
			},
			{
				label: 'Mooshroom Cow',
				value: 'mooshroom',
				default: state.pet === 'mooshroom',
			},
			{
				label: 'Elephant',
				value: 'elephant',
				default: state.pet === 'elephant',
			},
		);

	modal.addLabelComponents(new LabelBuilder().setLabel('Pet').setStringSelectMenuComponent(petInput));

	// Other modifiers

	const otherSelect = new CheckboxGroupBuilder().setRequired(false).setCustomId('other-modifiers').setOptions(
		{
			label: 'Level 50 farming tool',
			value: 'max-tool',
			default: state.useLevel50Tool,
		},
		{
			label: 'Max Rarefinder Chip',
			value: 'rarefinder',
			default: state.rarefinder,
		},
		{
			label: 'Max Mechamind Chip',
			value: 'mechamind',
			default: state.mechamind,
		},
		{
			label: 'Max Cropeetle Shard',
			value: 'cropeetle',
			default: state.cropeetle,
		},
		{
			label: 'Max Warty Bug Shard',
			value: 'warty_bug',
			default: state.wartyBug,
		},
	);

	modal.addLabelComponents(new LabelBuilder().setLabel('Other Modifiers').setCheckboxGroupComponent(otherSelect));

	return modal;
}

function buildSummaryDescription(state: RatesCalculatorState) {
	return buildRatesDescription(state, state.fortuneInput);
}

function buildCropDescription(state: RatesCalculatorState, cropFortune: number) {
	return buildRatesDescription(state, state.fortuneInput ?? cropFortune);
}

function buildRatesDescription(state: RatesCalculatorState, fortune: number | undefined) {
	return [getRatesHeadlineText(state, fortune), getRatesSetupText(state), getRatesModifiersText(state)].join('\n');
}

function getRatesHeadlineText(state: RatesCalculatorState, fortune: number | undefined) {
	return `Expected rates for **${fortune?.toLocaleString() ?? 'MAX'}** Farming Fortune in **${state.timeName}**!`;
}

function getRatesSetupText(state: RatesCalculatorState) {
	return (
		'-# ' +
		[
			`**${formatBps(state.bps)}**/20 BPS (${((state.bps / 20) * 100).toFixed(1)}%)`,
			`**${getReforgeName(state.reforge)}**`,
			`**${state.petName}**`,
			'**4/4 Helianthus Armor**',
		].join(DescriptionSeparator)
	);
}

function getRatesModifiersText(state: RatesCalculatorState) {
	return (
		'-# ' +
		[
			`Tool **${state.useLevel50Tool ? 'Level 50' : 'Not Level 50'}**`,
			`Chips **${getEnabledOptionNames([state.rarefinder && 'Rarefinder', state.mechamind && 'Mechamind'])}**`,
			`Shards **${getEnabledOptionNames([state.cropeetle && 'Cropeetle', state.wartyBug && 'Warty Bug'])}**`,
		].join(DescriptionSeparator)
	);
}

function formatBps(bps: number) {
	return bps % 1 === 0 ? bps.toString() : bps.toFixed(2);
}

function getEnabledOptionNames(options: Array<string | false>) {
	const enabled = options.filter((option): option is string => Boolean(option));
	return enabled.length ? enabled.join(', ') : 'None';
}

function getReforgeName(reforge: RatesReforge) {
	return reforge === 'bountiful' ? 'Bountiful' : 'Blessed';
}

function buildNpcProfitText(
	coinSources: [string, number][],
	threeFourthsTotal: number,
	specialDifference: number,
	specialAmount: number,
	specialType: string,
) {
	return (
		coinSources
			.map(([source, amount]) => {
				return `- **${source}:** ${amount?.toLocaleString()}`;
			})
			.join('\n') +
		`\n### 3/4ths Helianthus Armor\n:coin: ${threeFourthsTotal?.toLocaleString() ?? '0'} \u2800 ${specialDifference.toLocaleString()} less coins (~${specialAmount.toLocaleString()} ${specialType})`
	);
}

function buildBazaarProfitText(cropInfo: FormattedCropRate) {
	return (
		cropInfo.bz
			.map(({ name, items, profit, total, per }, i) => {
				return `${i === 0 ? ':star: ' : ''}**${name}:** ${total.toLocaleString()} :coin:\n-# **${Math.floor(items).toLocaleString()}** items at **${per.toLocaleString()}** coins each for **${profit.toLocaleString()}** coins plus other items`;
			})
			.join('\n') +
		(cropInfo.other.sellToBazaar.length
			? `\n\n**Sell these other drops to BZ:**\n` +
				cropInfo.other.sellToBazaar
					.map((x) => {
						const itemsText = x.items % 1 === 0 ? Math.floor(x.items).toLocaleString() : x.items.toFixed(2);
						const bzCoins = Math.floor(x.items * x.per);
						return `**${x.name}:** ${bzCoins.toLocaleString()} :coin:\n-# **${itemsText}** items at **${x.per.toLocaleString()}** coins each instead of **${x.npc.toLocaleString()}** to NPC (+**${Math.floor(x.gain).toLocaleString()}**)`;
					})
					.join('\n')
			: '') +
		`\n\n-# Included in totals: Other items = **${cropInfo.other.total.toLocaleString()}** coins (**${cropInfo.other.npc.toLocaleString()}** to NPC, **${cropInfo.other.bazaar.toLocaleString()}** to BZ)` +
		`\n-# Prices used are averaged sell order prices, not insta-sell prices.`
	);
}

function buildCollectionGainText(collections: [string, number][]) {
	return collections
		.map(([source, amount]) => {
			return `- **${source}:** ${amount?.toLocaleString()}`;
		})
		.join('\n');
}

function sortEntryValues(entries: Record<string, number>) {
	return Object.entries(entries).sort((a, b) => b[1] - a[1]);
}
