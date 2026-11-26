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
import { Crop, getCropDisplayName } from 'farming-weight';
import { FetchRates, UserSettings } from '../api/elite';
import type { CropRateDto, RatesDto } from '../api/schemas';
import { CommandAccess, CommandType, EliteCommand, SlashCommandOptionType } from '../classes/commands/index';
import { EliteContainer } from '../classes/components';
import { ErrorEmbed, NotYoursReply } from '../classes/embeds';
import { CropSelectRow, EliteCropEmojis, GetCropEmoji } from '../classes/Util';

const TIME_OPTIONS = {
	24_000: 'Jacob Contest',
	72_000: '1 Hour',
	288_000: '4 Hours',
	864_000: '12 Hours',
	1_728_000: '24 Hours',
};

const MaxFortune = 5000;
const MaxOverbloom = 500;

type RatesReforge = 'bountiful' | 'blessed';
type RatesPet = 'rose_dragon' | 'mooshroom' | 'elephant';

export type RatesCalculatorInput = {
	fortune?: number;
	overbloom?: number;
	blocks: number;
	reforge: RatesReforge;
	pet: RatesPet;
	bps: number;
	maxTool: boolean;
	rarefinder: boolean;
	mechamind: boolean;
	cropeetle: boolean;
	wartyBug: boolean;
};

const command = new EliteCommand({
	name: 'rates',
	description: 'Get farming rates for a given Farming Fortune and Overbloom!',
	access: CommandAccess.Everywhere,
	type: CommandType.Slash,
	options: {
		fortune: {
			name: 'fortune',
			description: 'The amount of fortune to calculate rates for!',
			type: SlashCommandOptionType.Integer,
			builder: (b) => b.setMinValue(0).setMaxValue(MaxFortune),
		},
		overbloom: {
			name: 'overbloom',
			description: 'The total Overbloom to calculate rates for! (default: the max setup)',
			type: SlashCommandOptionType.Number,
			builder: (b) => b.setMinValue(0).setMaxValue(MaxOverbloom),
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

const fortuneEmoji = '<:ff:1450022749631287330>';
const DescriptionSeparator = ' • ';

async function execute(interaction: ChatInputCommandInteraction, settings?: UserSettings) {
	let input = getRatesCalculatorInput(interaction);

	await interaction.deferReply();

	let rates = await fetchRates(input);
	if (!rates) {
		const embed = ErrorEmbed('Rates are temporarily unavailable!')
			.setDescription('Rate calculations are offline right now. Please try again in a few minutes.')
			.setFooter({ text: 'Contact kaeso.dev if this continues to happen' });
		await interaction.editReply({ embeds: [embed] });
		return;
	}

	const row = CropSelectRow('crop-select-rates', 'Select a crop to view its rates!');
	let container = buildCompactRatesContainer(settings, interaction.user.id, rates, row);
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
			await inter.showModal(buildRatesSettingsModal(input, modalCustomId));

			const filter = (i: ModalSubmitInteraction) => i.customId === modalCustomId && i.user.id === interaction.user.id;

			const submitted = await interaction
				.awaitModalSubmit({
					filter,
					time: 120_000,
				})
				.catch(() => null);

			if (!submitted || !submitted.isFromMessage()) {
				console.error('No settings submitted');
				return;
			}

			await submitted.deferUpdate();

			const newInput = readRatesSettingsModal(submitted, input);
			const newRates = newInput ? await fetchRates(newInput) : undefined;

			if (!newInput || !newRates) {
				const embed = ErrorEmbed(newInput ? 'Rates are temporarily unavailable!' : "Couldn't read those settings!")
					.setDescription(
						newInput
							? 'Your new settings were not applied, so the rates shown are still the previous ones. Please try again in a few minutes.'
							: 'Your new settings were not applied, so the rates shown are still the previous ones.',
					)
					.setFooter({ text: 'Contact kaeso.dev if this continues to happen' });
				await submitted.followUp({ embeds: [embed], flags: [MessageFlags.Ephemeral] }).catch(() => undefined);
				return;
			}

			input = newInput;
			rates = newRates;
			cropContainer = undefined;
			container = buildCompactRatesContainer(settings, interaction.user.id, rates, row);

			await submitted.editReply({
				components: [container],
				flags: [MessageFlags.IsComponentsV2],
			});

			return;
		}

		if (inter.customId !== 'crop-select-rates' && !inter.customId.startsWith('crop-select-rates-')) return;
		if (!rates) return;

		const selected = inter instanceof StringSelectMenuInteraction ? +inter.values[0] : +inter.customId.split('-')[3];
		const selectedCrop = cropList[selected] as Crop;
		const cropRate = rates.crops.find((c) => c.crop === selectedCrop) || rates.crops[selected];
		if (!cropRate) return;

		cropContainer = buildCropRatesContainer(settings, rates, cropRate);

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
	return {
		fortune: interaction.options.getInteger('fortune', false) ?? undefined,
		overbloom: interaction.options.getNumber('overbloom', false) ?? undefined,
		blocks: interaction.options.getInteger('time', false) ?? 72_000,
		reforge: (interaction.options.getString('reforge', false) ?? 'bountiful') as RatesReforge,
		pet: (interaction.options.getString('pet', false) ?? 'rose_dragon') as RatesPet,
		bps: interaction.options.getNumber('bps', false) ?? 20,
		maxTool: interaction.options.getBoolean('max-tool', false) ?? true,
		rarefinder: true,
		mechamind: true,
		cropeetle: true,
		wartyBug: false,
	};
}

async function fetchRates(input: RatesCalculatorInput) {
	const response = await FetchRates(input).catch(() => undefined);
	return response?.ok ? response.data : undefined;
}

function parseOptionalNumber(raw: string, max: number, parse: (value: string) => number) {
	const trimmed = raw.trim();
	if (trimmed === '') return { valid: true, value: undefined };

	const value = parse(trimmed);
	if (!Number.isFinite(value)) return { valid: false, value: undefined };

	return { valid: true, value: Math.max(0, Math.min(max, value)) };
}

function readRatesSettingsModal(
	submitted: ModalSubmitInteraction,
	current: RatesCalculatorInput,
): RatesCalculatorInput | undefined {
	try {
		const other = submitted.fields.getCheckboxGroup('other-modifiers') || [];
		const fortune = parseOptionalNumber(submitted.fields.getTextInputValue('fortune-input'), MaxFortune, (value) =>
			Number.parseInt(value, 10),
		);
		const overbloom = parseOptionalNumber(
			submitted.fields.getTextInputValue('overbloom-input'),
			MaxOverbloom,
			Number.parseFloat,
		);

		return {
			fortune: fortune.valid ? fortune.value : current.fortune,
			overbloom: overbloom.valid ? overbloom.value : current.overbloom,
			blocks: +submitted.fields.getStringSelectValues('time-input')[0] || current.blocks,
			reforge: other.includes('bountiful') ? 'bountiful' : 'blessed',
			pet: (submitted.fields.getStringSelectValues('pet-input')[0] as RatesPet) || current.pet,
			bps: current.bps,
			maxTool: other.includes('max-tool'),
			rarefinder: other.includes('rarefinder'),
			mechamind: other.includes('mechamind'),
			cropeetle: other.includes('cropeetle'),
			wartyBug: other.includes('warty_bug'),
		};
	} catch (e) {
		console.error('Error parsing settings modal input', e);
		return undefined;
	}
}

const formatCoins = (value: number) => Math.floor(value).toLocaleString();
const formatAmount = (value: number) => (+value.toFixed(2)).toLocaleString();

export function buildCompactRatesContainer(
	settings: UserSettings | undefined,
	userId: string,
	rates: RatesDto,
	row: ReturnType<typeof CropSelectRow>,
) {
	const compactContainer = new EliteContainer(settings)
		.addTitle('## Farming Rates Calculator', false)
		.addButtonSection(
			new ButtonBuilder().setCustomId('rates-settings').setLabel('Settings').setStyle(ButtonStyle.Primary),
			buildRatesDescription(rates, rates.inputs.fortune ?? undefined, getSharedOverbloom(rates)),
		)
		.addSeparator();

	const npcLength = Math.max(0, ...rates.crops.map((crop) => formatCoins(crop.npc.total).length));
	const bzLength = Math.max(0, ...rates.crops.map((crop) => formatCoins(getBestBazaarTotal(crop)).length));

	for (const crop of rates.crops) {
		const values = `:coin: \`${formatCoins(crop.npc.total).padStart(npcLength, ' ')}\` **BZ** \`${formatCoins(
			getBestBazaarTotal(crop),
		).padStart(bzLength, ' ')}\` ${fortuneEmoji} \`${formatAmount(crop.fortune)}\``;

		compactContainer.addText(`${GetCropEmoji(getCropDisplayName(crop.crop as Crop))} ${values}`);
	}

	compactContainer.addActionRowComponents(row);
	compactContainer.addSeparator();
	compactContainer.addText(
		"**What's my fortune?**\n-# " + getFortuneDetailsText(settings, userId, rates.inputs.fortune ?? undefined),
	);
	compactContainer.addFooter();

	return compactContainer;
}

function getBestBazaarTotal(crop: CropRateDto) {
	return crop.bazaar.crafts[0]?.total ?? 0;
}

function getSharedOverbloom(rates: RatesDto) {
	if (rates.inputs.overbloom !== undefined && rates.inputs.overbloom !== null) return rates.inputs.overbloom;

	const first = rates.crops[0]?.overbloom;
	return rates.crops.every((crop) => crop.overbloom === first) ? first : undefined;
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

export function buildCropRatesContainer(settings: UserSettings | undefined, rates: RatesDto, crop: CropRateDto) {
	const cropName = getCropDisplayName(crop.crop as Crop);

	return new EliteContainer(settings)
		.addTitle('## ' + cropName + ' Rates', false)
		.addButtonSection(
			new ButtonBuilder().setCustomId('rates-settings').setLabel('Settings').setStyle(ButtonStyle.Primary),
			buildRatesDescription(rates, rates.inputs.fortune ?? crop.fortune, crop.overbloom),
		)
		.addSeparator()
		.addCollapsible({
			header: '**NPC Profit**',
			collapsed: {
				text: '### :coin: ' + formatCoins(crop.npc.total),
			},
			expanded: {
				text: buildNpcProfitText(crop),
			},
		})
		.addSeparator()
		.addCollapsible({
			header: '**Bazaar Profit**',
			collapsed: {
				text: '### <:bz:1376714811894796328> ' + formatCoins(getBestBazaarTotal(crop)),
			},
			expanded: {
				text: buildBazaarProfitText(crop),
			},
		})
		.addSeparator()
		.addCollapsible({
			header: '**Collection Gain**',
			collapsed: {
				text: '### ' + GetCropEmoji(cropName) + ' ' + formatCoins(crop.collection.total),
			},
			expanded: {
				text: crop.collection.sources
					.map((source) => `- **${source.name}:** ${formatAmount(source.amount)}`)
					.join('\n'),
			},
		})
		.addFooter(true, 'back');
}

export function buildRatesSettingsModal(input: RatesCalculatorInput, modalCustomId: string) {
	const modal = new ModalBuilder().setCustomId(modalCustomId).setTitle('Rates Calculator Settings');

	const fortuneInput = new TextInputBuilder()
		.setCustomId('fortune-input')
		.setStyle(TextInputStyle.Short)
		.setPlaceholder('Leave empty for max fortune')
		.setValue(input.fortune?.toString() ?? '')
		.setRequired(false);

	modal.addLabelComponents(new LabelBuilder().setLabel('Farming Fortune').setTextInputComponent(fortuneInput));

	const overbloomInput = new TextInputBuilder()
		.setCustomId('overbloom-input')
		.setStyle(TextInputStyle.Short)
		.setPlaceholder('Leave empty for the max setup')
		.setValue(input.overbloom?.toString() ?? '')
		.setRequired(false);

	modal.addLabelComponents(new LabelBuilder().setLabel('Overbloom').setTextInputComponent(overbloomInput));

	const timeInput = new StringSelectMenuBuilder()
		.setCustomId('time-input')
		.setPlaceholder('Select time period')
		.addOptions(
			...Object.entries(TIME_OPTIONS).map(([value, name]) => ({
				label: name,
				value,
				default: input.blocks === +value,
			})),
		);

	modal.addLabelComponents(new LabelBuilder().setLabel('Time Period').setStringSelectMenuComponent(timeInput));

	const petInput = new StringSelectMenuBuilder()
		.setCustomId('pet-input')
		.setPlaceholder('Select a pet')
		.addOptions(
			{
				label: 'Rose Dragon',
				value: 'rose_dragon',
				default: input.pet === 'rose_dragon',
			},
			{
				label: 'Mooshroom Cow',
				value: 'mooshroom',
				default: input.pet === 'mooshroom',
			},
			{
				label: 'Elephant',
				value: 'elephant',
				default: input.pet === 'elephant',
			},
		);

	modal.addLabelComponents(new LabelBuilder().setLabel('Pet').setStringSelectMenuComponent(petInput));

	const otherSelect = new CheckboxGroupBuilder()
		.setRequired(false)
		.setCustomId('other-modifiers')
		.setOptions(
			{
				label: 'Bountiful reforge (otherwise Blessed)',
				value: 'bountiful',
				default: input.reforge === 'bountiful',
			},
			{
				label: 'Level 50 farming tool',
				value: 'max-tool',
				default: input.maxTool,
			},
			{
				label: 'Max Rarefinder Chip',
				value: 'rarefinder',
				default: input.rarefinder,
			},
			{
				label: 'Max Mechamind Chip',
				value: 'mechamind',
				default: input.mechamind,
			},
			{
				label: 'Max Beetle Shard',
				value: 'cropeetle',
				default: input.cropeetle,
			},
			{
				label: 'Max Warty Bug Shard',
				value: 'warty_bug',
				default: input.wartyBug,
			},
		);

	modal.addLabelComponents(new LabelBuilder().setLabel('Other Modifiers').setCheckboxGroupComponent(otherSelect));

	return modal;
}

function buildRatesDescription(rates: RatesDto, fortune: number | undefined, overbloom: number | undefined) {
	const { inputs, setup } = rates;
	const timeName =
		TIME_OPTIONS[inputs.blocks as keyof typeof TIME_OPTIONS] ?? `${inputs.blocks.toLocaleString()} blocks`;

	const headline = `Expected rates for **${fortune === undefined ? 'MAX' : formatAmount(fortune)}** Farming Fortune and **${
		overbloom === undefined ? 'MAX' : formatAmount(overbloom)
	}** Overbloom in **${timeName}**!`;

	const setupLine =
		'-# ' +
		[
			`**${formatBps(inputs.bps)}**/20 BPS (${((inputs.bps / 20) * 100).toFixed(1)}%)`,
			`**${setup.reforgeName}**`,
			`**${setup.petName}**`,
			`**${setup.armor}**`,
		].join(DescriptionSeparator);

	const modifiersLine =
		'-# ' +
		[
			`Tool **${inputs.maxTool ? 'Level 50' : 'Not Level 50'}**`,
			`Chips **${getEnabledOptionNames([inputs.rarefinder && 'Rarefinder', inputs.mechamind && 'Mechamind'])}**`,
			`Shards **${getEnabledOptionNames([inputs.cropeetle && 'Beetle', inputs.wartyBug && 'Warty Bug'])}**`,
		].join(DescriptionSeparator);

	return [headline, setupLine, modifiersLine].join('\n');
}

function formatBps(bps: number) {
	return bps % 1 === 0 ? bps.toString() : bps.toFixed(2);
}

function getEnabledOptionNames(options: Array<string | false>) {
	const enabled = options.filter((option): option is string => Boolean(option));
	return enabled.length ? enabled.join(', ') : 'None';
}

function buildNpcProfitText(crop: CropRateDto) {
	const { sources, threeFourths } = crop.npc;

	return (
		sources.map((source) => `- **${source.name}:** ${formatAmount(source.amount)}`).join('\n') +
		`\n### 3/4ths Helianthus Armor\n:coin: ${formatCoins(threeFourths.total)} ⠀ ${formatCoins(
			threeFourths.difference,
		)} less coins (~${formatAmount(threeFourths.amount)} ${threeFourths.specialCrop})`
	);
}

function buildBazaarProfitText(crop: CropRateDto) {
	const { crafts, sellToBazaar, other } = crop.bazaar;

	const craftText = crafts.length
		? crafts
				.map(({ name, items, profit, total, per }, i) => {
					return `${i === 0 ? ':star: ' : ''}**${name}:** ${formatCoins(total)} :coin:\n-# **${Math.floor(
						items,
					).toLocaleString()}** items at **${formatAmount(per)}** coins each for **${formatCoins(
						profit,
					)}** coins plus other items`;
				})
				.join('\n')
		: '**N/A:** 0 :coin:';

	const sellText = sellToBazaar.length
		? `\n\n**Sell these other drops to BZ:**\n` +
			sellToBazaar
				.map((item) => {
					return `**${item.name}:** ${formatCoins(item.items * item.per)} :coin:\n-# **${formatAmount(
						item.items,
					)}** items at **${formatAmount(item.per)}** coins each instead of **${formatAmount(
						item.npc,
					)}** to NPC (+**${formatCoins(item.gain)}**)`;
				})
				.join('\n')
		: '';

	return (
		craftText +
		sellText +
		`\n\n-# Included in totals: Other items = **${formatCoins(other.total)}** coins (**${formatCoins(
			other.npc,
		)}** to NPC, **${formatCoins(other.bazaar)}** to BZ)` +
		`\n-# Prices used are averaged sell order prices, not insta-sell prices.`
	);
}
