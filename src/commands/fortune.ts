import { ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { Crop, GearSlot, getCropDisplayName, STAT_ICONS, STAT_NAMES, Stat } from 'farming-weight';
import { FetchFortuneProgress, UserSettings } from '../api/elite';
import type {
	CropFortuneDto,
	FortuneGearEntryDto,
	FortuneNextUpgradeDto,
	FortuneProgressDto,
	FortuneSourceDto,
	FortuneSourceEffectDto,
} from '../api/schemas';
import { elitePlayerOption } from '../autocomplete/player';
import { CommandAccess, CommandType, EliteCommand, SlashCommandOptionType } from '../classes/commands/index';
import { EliteContainer } from '../classes/components';
import { ErrorEmbed, NotYoursReply } from '../classes/embeds';
import { progressBar } from '../classes/progressbar';
import { CROP_ARRAY, CropSelectRow, escapeIgn, GEAR_ARRAY, GetCropEmoji } from '../classes/Util';
import { getAccount } from '../classes/validate';

const command = new EliteCommand({
	name: 'fortune',
	description: 'Get a players farming fortune progress!',
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

const fortuneEmoji = '<:ff:1450022749631287330>';
const disclaimer = `-# Sources with ":warning:" don't exist in the Hypixel API and can only be set on eliteskyblock.com.`;

const CROP_OVERVIEW_ROWS: [Crop, Crop?][] = [
	[Crop.Cactus, Crop.Carrot],
	[Crop.CocoaBeans, Crop.Melon],
	[Crop.Moonflower, Crop.Mushroom],
	[Crop.NetherWart, Crop.Potato],
	[Crop.Pumpkin, Crop.SugarCane],
	[Crop.Sunflower, Crop.Wheat],
	[Crop.WildRose],
];

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
	const response = await FetchFortuneProgress(account.id, profile.profileId).catch(() => undefined);

	if (!response?.ok) {
		const unavailable = response?.response.status === 503;
		const embed = ErrorEmbed(unavailable ? 'Fortune is temporarily unavailable!' : "Couldn't fetch data!")
			.setDescription(
				unavailable
					? 'Fortune calculations are offline right now. Please try again in a few minutes.'
					: `Something went wrong when getting data for "${escapeIgn(playerName)}".`,
			)
			.setFooter({ text: 'Contact kaeso.dev if this continues to happen' });
		await interaction.deleteReply().catch(() => undefined);
		interaction.followUp({ embeds: [embed], ephemeral: true });
		return;
	}

	const views = createFortuneViews(response.data, {
		settings,
		playerName: escapeIgn(playerName) ?? '',
		profileName: profile.profileName,
		url: `https://elitesb.gg/@${account.id}/${profile.profileId}/rates#fortune`,
	});

	const container = views.overview();
	const reply = await interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });

	const collector = reply.createMessageComponentCollector({
		time: 120_000,
	});

	let cropContainer: EliteContainer | undefined;
	let currentContainer: EliteContainer | undefined;

	collector.on('collect', async (inter) => {
		if (inter.user.id !== interaction.user.id) {
			return NotYoursReply(inter);
		}

		collector.resetTimer();

		if (cropContainer?.handleCollapsibleInteraction(inter)) {
			return inter.update({ components: [cropContainer] });
		}

		if (inter.customId === 'crop-select-fortune') {
			if (!inter.isStringSelectMenu()) return;

			cropContainer = views.crop(CROP_ARRAY[+inter.values[0]] as Crop);
			if (!cropContainer) {
				await inter.reply({ content: 'Invalid crop selected!', ephemeral: true });
				return;
			}

			await inter.update({ components: [cropContainer] });
			return;
		}
		cropContainer = undefined;

		if (inter.customId.startsWith('crop-page-')) {
			cropContainer = views.crop(inter.customId.slice('crop-page-'.length) as Crop);
			if (!cropContainer) {
				await inter.reply({ content: 'Invalid crop selected!', ephemeral: true });
				return;
			}

			await inter.update({ components: [cropContainer] });
			return;
		}

		const sourcePage = views.sourcePage(inter.customId);
		if (sourcePage) {
			currentContainer = sourcePage;
			await inter.update({ components: [currentContainer] });
			return;
		}

		if (inter.customId === 'general') {
			currentContainer = views.general();
			await inter.update({ components: [currentContainer] });
			return;
		}

		if (inter.customId === 'gear') {
			currentContainer = views.gear();
			await inter.update({ components: [currentContainer] });
			return;
		}

		if (inter.customId === 'pets') {
			currentContainer = views.pets();
			await inter.update({ components: [currentContainer] });
			return;
		}

		if (inter.customId.startsWith('gear-')) {
			if (!inter.isButton()) return;
			const passed = inter.customId.split('-')[1];
			const slot = GEAR_ARRAY.find((g) => g.toLowerCase() == passed);
			const piece = slot ? views.gearPiece(slot) : undefined;

			if (!piece) {
				await inter.reply({ content: 'Invalid gear slot selected!', ephemeral: true });
				return;
			}

			currentContainer = piece;
			await inter.update({ components: [currentContainer] });
			return;
		}

		currentContainer = undefined;

		if (inter.customId === 'back') {
			await inter.update({ components: [container] });
			return;
		}
	});

	collector.on('end', async () => {
		const last = cropContainer ?? currentContainer ?? container;
		last.disableEverything();
		interaction.editReply({ components: [last] }).catch(() => undefined);
	});
}

interface FortuneViewContext {
	settings?: UserSettings;
	playerName: string;
	profileName: string;
	url: string;
}

interface SourcePageEntry {
	id: string;
	parentId: string;
	source: FortuneSourceDto;
	title?: string;
}

export function createFortuneViews(fortune: FortuneProgressDto, context: FortuneViewContext) {
	const { settings, url } = context;
	const broadStats = fortune.stats as Stat[];

	const apiWarning =
		fortune.inventoryApiEnabled === false
			? `:x: ${context.playerName} has **Inventory API** access disabled. Most data is missing. :x:\n`
			: '';
	const titleSuffix = `for ${context.playerName} (${context.profileName})\n${apiWarning}-# View more [on eliteskyblock.com!](${url})`;

	const sourcePages = new Map<string, SourcePageEntry>();
	let sourcePageCounter = 0;

	const formatRatio = (current: number, max: number) => Math.min(max > 0 ? current / max : 0, 1);
	const formatValue = (value: number) => (+value.toFixed(2)).toLocaleString();
	const formatStatLabel = (stat: Stat) => `${STAT_ICONS[stat] ?? ''} *${STAT_NAMES[stat] ?? stat}*`.trim();

	const statProgressLine = (current: number, max: number, stat: Stat) => {
		return `${progressBar(formatRatio(current, max), 10)}  **${formatValue(current)}** / ${formatValue(
			max,
		)} ${formatStatLabel(stat)}`;
	};

	const genericProgressLine = (source: FortuneSourceDto) => {
		if (source.api === false && !source.current) {
			return `-# Configure [on eliteskyblock.com!](${url})  :warning: **/ ${formatValue(source.max)}**`;
		}

		const warning = source.api === false ? ':warning: ' : '';
		return `${progressBar(formatRatio(source.current, source.max), 10)}  ${warning}**${formatValue(
			source.current,
		)}** / ${formatValue(source.max)}`;
	};

	const effectValue = (effect: FortuneSourceEffectDto) => {
		if (effect.value === undefined || effect.value === null) return undefined;
		if (effect.display === 'factor') return `${formatValue(effect.value)}x`;
		if (effect.display === 'percent') return `+${formatValue(effect.value)}%`;
		if (effect.display === 'none') return undefined;
		return formatValue(effect.value);
	};

	const effectLine = (effect: FortuneSourceEffectDto) => {
		const value = effectValue(effect);
		const icon = effect.stat ? STAT_ICONS[effect.stat as Stat] : undefined;
		const text = value ? `**${value}**${icon ? ` ${icon}` : ''}` : (effect.description ?? effect.source);
		return `${progressBar(1, 10)}  ${text}${effect.description && value ? ` *${effect.description}*` : ''}`;
	};

	const sourceTitle = (source: FortuneSourceDto, title = source.name) =>
		source.wiki ? `${title} [\`Wiki\`](${source.wiki})` : title;

	const sourceProgressBody = (source: FortuneSourceDto) => {
		const lines: string[] = [];

		for (const [stat, progress] of Object.entries(source.stats ?? {})) {
			lines.push(statProgressLine(progress.current, progress.max, stat as Stat));
		}

		for (const effect of source.effects ?? []) {
			lines.push(effectLine(effect));
		}

		if (lines.length === 0 && (source.max !== 0 || source.current !== 0 || source.api === false)) {
			lines.push(genericProgressLine(source));
		}

		return lines.join('\n') || 'No progress found.';
	};

	const sourceProgress = (source: FortuneSourceDto, title = source.name) =>
		`**${sourceTitle(source, title)}**\n${sourceProgressBody(source)}`;

	const sumProgressStats = (sources: FortuneSourceDto[], stats: Stat[]) => {
		let current = 0;
		let max = 0;

		for (const source of sources) {
			for (const stat of stats) {
				current += source.stats?.[stat]?.current ?? 0;
				max += source.stats?.[stat]?.max ?? 0;
			}
		}

		return { current, max };
	};

	const categoryProgress = (sources: FortuneSourceDto[], stats: Stat[]) => {
		const lines = stats
			.map((stat) => {
				const total = sumProgressStats(sources, [stat]);
				if (total.max <= 0 && total.current <= 0) return undefined;
				return `${progressBar(formatRatio(total.current, total.max), 8)} • **${formatValue(
					total.current,
				)}** / ${formatValue(total.max)} ${formatStatLabel(stat)}`;
			})
			.filter((line): line is string => Boolean(line));

		if (lines.length) return lines.join('\n');

		const total = sources.reduce(
			(acc, source) => ({
				current: acc.current + source.current,
				max: acc.max + source.max,
			}),
			{ current: 0, max: 0 },
		);

		return `${progressBar(formatRatio(total.current, total.max), 8)} • **${formatValue(
			total.current,
		)}** / ${formatValue(total.max)}`;
	};

	const hasNestedProgress = (source: FortuneSourceDto) => (source.progress?.length ?? 0) > 0;
	const sourceNeedsDisclaimer = (source: FortuneSourceDto): boolean =>
		source.api === false || (source.progress?.some(sourceNeedsDisclaimer) ?? false);

	const addProgressSource = (
		target: EliteContainer,
		source: FortuneSourceDto,
		parentId: string,
		title = source.name,
	) => {
		if (!hasNestedProgress(source)) {
			target.addText(sourceProgress(source));
			return;
		}

		const id = `progress-${sourcePageCounter++}`;
		sourcePages.set(id, { id, parentId, source, title });

		target.addButtonSection(
			new ButtonBuilder().setCustomId(id).setLabel('Open').setStyle(ButtonStyle.Primary),
			`### ${sourceTitle(source, title)}\n${sourceProgressBody(source)}`,
		);
	};

	const addNextUpgrade = (target: EliteContainer, next: FortuneNextUpgradeDto | null | undefined) => {
		if (!next) return;

		const reasonText =
			next.reason === 'dead' ? 'Switch To' : next.reason === 'situational' ? 'Also Consider' : 'Upgrade To';
		const name = next.wiki ? `[${next.name}](${next.wiki})` : next.name;

		target.addSeparator();
		target.addText(`${reasonText} ${name}` + (next.why ? `\n-# ${next.why}` : ''));
	};

	const addSources = (target: EliteContainer, sources: FortuneSourceDto[], parentId: string) => {
		let needsDisclaimer = false;
		for (const source of sources) {
			addProgressSource(target, source, parentId);
			needsDisclaimer ||= sourceNeedsDisclaimer(source);
		}
		return needsDisclaimer;
	};

	const cropOverview = (crop?: Crop) => {
		if (!crop) return '';
		const data = fortune.crops[crop];
		return `${GetCropEmoji(crop)} ${progressBar(formatRatio(data?.current ?? 0, data?.max ?? 0))}`;
	};

	const gearSources = fortune.gear.map((entry) => entry.source);

	function overview() {
		let container = new EliteContainer(settings)
			.addTitle(`## ${fortuneEmoji} Farming Fortune ` + titleSuffix)
			.addButtonSection(
				new ButtonBuilder().setCustomId('general').setLabel('Open').setStyle(ButtonStyle.Primary),
				`### General Fortune\n${categoryProgress(fortune.general, broadStats)}`,
			)
			.addSeparator()
			.addButtonSection(
				new ButtonBuilder().setCustomId('gear').setLabel('Open').setStyle(ButtonStyle.Primary),
				`### Armor & Equipment Fortune\n${categoryProgress(gearSources, broadStats)}`,
			);

		if (fortune.pets.length > 0) {
			container = container
				.addSeparator()
				.addButtonSection(
					new ButtonBuilder().setCustomId('pets').setLabel('Open').setStyle(ButtonStyle.Primary),
					`### Pet Fortune\n${categoryProgress(fortune.pets, broadStats)}`,
				);
		}

		return container
			.addSeparator()
			.addText(
				`### Crop Specific Fortune\n` +
					CROP_OVERVIEW_ROWS.map(([left, right]) => `${cropOverview(left)}  ${cropOverview(right)}`.trimEnd()).join(
						'\n',
					),
			)
			.addActionRowComponents(CropSelectRow('crop-select-fortune', 'Select a crop to view its fortune!'))
			.addFooter();
	}

	function crop(crop: Crop) {
		const data: CropFortuneDto | undefined = fortune.crops[crop];
		if (!data) return undefined;

		const container = new EliteContainer(settings)
			.addTitle(`## ${GetCropEmoji(crop)} Fortune ${titleSuffix}`, false)
			.addDescription(
				`${getCropDisplayName(crop)} Progress - **${formatValue(data.current)}** / ${formatValue(data.max)}`,
			)
			.addSeparator();

		const parentId = `crop-page-${crop}`;
		let needsDisclaimer = data.tool ? sourceNeedsDisclaimer(data.tool) : false;

		if (data.tool) {
			addProgressSource(container, data.tool, parentId, data.toolName || 'Farming Tool Progress');
			container.addSeparator();
		}

		needsDisclaimer = addSources(container, data.sources, parentId) || needsDisclaimer;
		addNextUpgrade(container, data.tool?.next);

		container.addSeparator();
		if (needsDisclaimer) {
			container.addText(disclaimer);
		}
		container.addFooter(false, 'back');

		return container;
	}

	function gearPiece(slot: GearSlot) {
		const entry: FortuneGearEntryDto | undefined = fortune.gear.find((gear) => gear.slot === slot);
		if (!entry?.breakdown) return undefined;

		const container = new EliteContainer(settings)
			.addTitle(`## ${fortuneEmoji} ${slot} Fortune ${titleSuffix}`, false)
			.addSeparator();

		container.addText(`### ${entry.itemName || slot}\n${sourceProgressBody(entry.source)}`);
		container.addSeparator();

		addSources(container, entry.breakdown, `gear-${slot.toLowerCase()}`);
		addNextUpgrade(container, entry.source.next);

		container.addFooter(true, 'gear');

		return container;
	}

	function sourcePage(id: string) {
		const entry = sourcePages.get(id);
		if (!entry) return undefined;

		const container = new EliteContainer(settings)
			.addTitle(`## ${entry.title ?? entry.source.name} ${titleSuffix}`, false)
			.addDescription(sourceProgressBody(entry.source))
			.addSeparator();

		const needsDisclaimer =
			addSources(container, entry.source.progress ?? [], entry.id) || sourceNeedsDisclaimer(entry.source);

		container.addSeparator();
		if (needsDisclaimer) {
			container.addText(disclaimer);
		}
		container.addFooter(false, entry.parentId);

		return container;
	}

	function sourceList(title: string, sources: FortuneSourceDto[], pageId: string, note?: string) {
		const container = new EliteContainer(settings)
			.addTitle(`## ${fortuneEmoji} ${title} ` + titleSuffix, false)
			.addDescription(categoryProgress(sources, broadStats));

		if (note) {
			container.addText(note);
		}
		container.addSeparator();

		const needsDisclaimer = addSources(container, sources, pageId);

		container.addSeparator();
		if (needsDisclaimer) {
			container.addText(disclaimer);
		}
		container.addFooter(false, 'back');

		return container;
	}

	function general() {
		return sourceList('General Fortune', fortune.general, 'general');
	}

	function pets() {
		return sourceList(
			'Pet Fortune',
			fortune.pets,
			'pets',
			'-# Pet fortune is still a work in progress and only shows pets you currently own. :warning:',
		);
	}

	function gear() {
		const container = new EliteContainer(settings)
			.addTitle(`## ${fortuneEmoji} Armor & Equipment Fortune ` + titleSuffix, false)
			.addDescription(categoryProgress(gearSources, broadStats))
			.addSeparator();

		let needsDisclaimer = false;
		for (const entry of fortune.gear) {
			if (entry.slot && entry.breakdown) {
				container.addButtonSection(
					new ButtonBuilder()
						.setLabel(entry.slot)
						.setCustomId('gear-' + entry.slot.toLowerCase())
						.setStyle(ButtonStyle.Primary),
					sourceProgress(entry.source, entry.itemName || entry.source.name),
				);
			} else {
				addProgressSource(container, entry.source, 'gear');
			}
			needsDisclaimer ||= sourceNeedsDisclaimer(entry.source);
		}

		container.addSeparator();
		if (needsDisclaimer) {
			container.addText(disclaimer);
		}
		container.addFooter(false, 'back');

		return container;
	}

	return { overview, crop, gearPiece, sourcePage, general, pets, gear };
}
