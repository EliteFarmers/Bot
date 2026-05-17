import { ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import {
	CROP_INFO,
	Crop,
	createFarmingPlayer,
	EffectSummary,
	FarmingArmor,
	FarmingEquipment,
	FortuneSourceProgress,
	GearSlot,
	getCropDisplayName,
	getCropFromName,
	getCropMilestoneLevels,
	getGardenLevel,
	getLevel,
	PlayerOptions,
	STAT_ICONS,
	STAT_NAMES,
	Stat,
	UpgradeReason,
	ZorroMode,
} from 'farming-weight';
import { FetchProfile, FetchVirtualFarmingInventory, UserSettings } from '../api/elite';
import { elitePlayerOption } from '../autocomplete/player';
import { CommandAccess, CommandType, EliteCommand, SlashCommandOptionType } from '../classes/commands/index';
import { EliteContainer } from '../classes/components';
import { ErrorEmbed, NotYoursReply } from '../classes/embeds';
import { progressBar } from '../classes/progressbar';
import {
	CROP_ARRAY,
	CropSelectRow,
	escapeIgn,
	GEAR_ARRAY,
	GetCropEmoji,
	LEVELING_XP,
	removeColorCodes,
} from '../classes/Util';
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
	const [{ data: member }, farmingInventory] = await Promise.all([
		FetchProfile(account.id, profile.profileId).catch(() => ({ data: undefined })),
		FetchVirtualFarmingInventory(account.id, profile.profileId),
	]);

	if (!member) {
		const embed = ErrorEmbed("Couldn't fetch data!")
			.setDescription(`Something went wrong when getting data for "${escapeIgn(playerName)}".`)
			.setFooter({ text: 'Contact kaeso.dev if this continues to happen' });
		await interaction.deleteReply().catch(() => undefined);
		interaction.followUp({ embeds: [embed], ephemeral: true });
		return;
	}

	const farmingLevel = getLevel(member?.skills?.farming ?? 0, LEVELING_XP, 50 + (member?.jacob.perks?.levelCap ?? 0));

	const saved = account.settings?.fortune?.accounts?.[account.id]?.[profile.profileId];

	const options: PlayerOptions = {
		collection: member.collections,
		farmingXp: member.skills?.farming ?? 0,
		farmingLevel: farmingLevel.level,
		tools: farmingInventory.tools as PlayerOptions['tools'],
		armor: farmingInventory.armor as PlayerOptions['armor'],
		equipment: farmingInventory.equipment as PlayerOptions['equipment'],
		accessories: farmingInventory.accessories as PlayerOptions['accessories'],
		pets: member.pets ?? [],
		personalBests: member.jacob.stats?.personalBests,
		personalBestsUnlocked: member.jacob.perks?.personalBests ?? false,
		bestiaryKills: (member.unparsed?.bestiary as { kills?: Record<string, number> })?.kills,
		anitaBonus: member.jacob.perks?.doubleDrops,
		uniqueVisitors: member.garden?.uniqueVisitors,
		zorro: {
			enabled: member.chocolateFactory?.unlockedZorro ?? false,
			mode: ZorroMode.Normal,
		},
		cropUpgrades: Object.fromEntries(
			Object.entries(member.garden?.cropUpgrades ?? {}).map(([key, value]) => [getCropFromName(key), value]),
		),
		gardenLevel: getGardenLevel(member.garden?.experience ?? 0).level,
		plotsUnlocked: member.garden?.plots?.length,
		milestones: getCropMilestoneLevels((member.garden?.crops ?? {}) as Record<string, number>),
		refinedTruffles: member.chocolateFactory?.refinedTrufflesConsumed,
		cocoaFortuneUpgrade: member.chocolateFactory?.cocoaFortuneUpgrades,
		exportableCrops: member.unparsed.exportedCrops ?? {},
		chips: member.memberData?.garden?.chips ?? {},
		attributes: member.memberData?.attributes ?? {},
		dnaMilestone: member.memberData?.garden?.dnaMilestone ?? 0,
		communityCenter: saved?.communityCenter ?? 0,
		filledRosewaterFlask: saved?.rosewaterFlasks ?? 0,
	};

	const player = createFarmingPlayer(options);

	if (player.pets.length) {
		player.selectPet(player.pets.sort((a, b) => b.fortune - a.fortune)[0]);
	}

	const url = `https://elitesb.gg/@${account.id}/${profile.profileId}/rates#fortune`;
	const broadStats = [Stat.FarmingFortune, Stat.Overbloom];
	const cropStats = (crop: Crop) => [Stat.FarmingFortune, CROP_INFO[crop].fortuneType];

	const cropOverview = (crop: Crop) => {
		const tool = player.getBestTool(crop);
		if (tool) player.selectTool(tool);

		const progress = player.getCropProgress(crop, cropStats(crop));
		const total = sumProgressStats(progress, cropStats(crop));

		return `${GetCropEmoji(crop)} ${progressBar(formatRatio(total.current, total.max))}`;
	};

	const formatRatio = (current: number, max: number) => Math.min(max > 0 ? current / max : 0, 1);
	const formatValue = (value: number) => (+value.toFixed(2)).toLocaleString();
	const formatStatLabel = (stat: Stat) => `${STAT_ICONS[stat] ?? ''} *${STAT_NAMES[stat] ?? stat}*`.trim();

	const statProgressLine = (current: number, max: number, stat: Stat) => {
		return `${progressBar(formatRatio(current, max), 10)}  **${formatValue(current)}** / ${formatValue(
			max,
		)} ${formatStatLabel(stat)}`;
	};

	const genericProgressLine = (source: FortuneSourceProgress) => {
		if (source.api === false && !source.current) {
			return `-# Configure [on eliteskyblock.com!](${url})  :warning: **/ ${formatValue(source.max)}**`;
		}

		const warning = source.api === false ? ':warning: ' : '';
		return `${progressBar(formatRatio(source.current, source.max), 10)}  ${warning}**${formatValue(
			source.current,
		)}** / ${formatValue(source.max)}`;
	};

	const effectValue = (effect: EffectSummary) => {
		if (effect.value === undefined) return undefined;
		if (effect.valueDisplay === 'stat') return formatValue(effect.value);
		if (effect.valueDisplay === 'factor') return `${formatValue(effect.value)}x`;
		if (effect.valueDisplay === 'percent') return `+${formatValue(effect.value)}%`;
		if (effect.op === 'mul-rare' || effect.op === 'mul-drop') return `+${formatValue((effect.value - 1) * 100)}%`;
		if (effect.op === 'add-rare-pct') return `+${formatValue(effect.value)}%`;
		return formatValue(effect.value);
	};

	const effectLine = (effect: EffectSummary) => {
		const value = effectValue(effect);
		const stat = effect.valueStat ?? effect.relatedStats?.[0];
		const icon = stat ? STAT_ICONS[stat] : undefined;
		const text = value ? `**${value}**${icon ? ` ${icon}` : ''}` : (effect.description ?? effect.source);
		return `${progressBar(1, 10)}  ${text}${effect.description && value ? ` *${effect.description}*` : ''}`;
	};

	const effectDuplicatesStatProgress = (effect: EffectSummary, source: FortuneSourceProgress) => {
		if (effect.valueDisplay !== 'stat' || effect.value === undefined) return false;

		const stat = effect.valueStat ?? effect.relatedStats?.find((relatedStat) => source.stats?.[relatedStat]);
		const progressValue = stat ? source.stats?.[stat]?.current : undefined;

		return progressValue !== undefined && Math.abs(progressValue - effect.value) < 0.001;
	};

	const sourceTitle = (source: FortuneSourceProgress, title = source.name) =>
		source.wiki ? `${title} [\`Wiki\`](${source.wiki})` : title;

	const sourceProgress = (source: FortuneSourceProgress): string => {
		const name = sourceTitle(source);
		const lines: string[] = [];

		for (const [stat, statProgress] of Object.entries(source.stats ?? {}) as [
			Stat,
			{ current: number; max: number; ratio: number },
		][]) {
			lines.push(statProgressLine(statProgress.current, statProgress.max, stat));
		}

		for (const effect of source.effects ?? []) {
			if (effectDuplicatesStatProgress(effect, source)) continue;
			lines.push(effectLine(effect));
		}

		if (lines.length === 0 && (source.max !== 0 || source.current !== 0 || source.api === false)) {
			lines.push(genericProgressLine(source));
		}

		return `**${name}**\n${lines.join('\n') || 'No progress found.'}`;
	};

	const sourceProgressBody = (source: FortuneSourceProgress) =>
		sourceProgress(source).split('\n').slice(1).join('\n') || 'No progress found.';

	const sumProgressStats = (sources: FortuneSourceProgress[], stats: Stat[]) => {
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

	const categoryProgress = (sources: FortuneSourceProgress[], stats: Stat[]) => {
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

	const progressScore = (source: FortuneSourceProgress) => {
		const statTotal = Object.values(source.stats ?? {}).reduce((total, stat) => total + (stat?.current ?? 0), 0);
		return statTotal || source.current;
	};

	const bestProgressBySource = (sources: FortuneSourceProgress[]) => {
		const best = new Map<string, FortuneSourceProgress>();

		for (const source of sources) {
			const key = source.item?.skyblockId ?? source.name;
			const current = best.get(key);
			if (!current || progressScore(source) > progressScore(current)) {
				best.set(key, source);
			}
		}

		return [...best.values()];
	};

	const apiWarning =
		member.api?.inventories === false
			? `:x: ${escapeIgn(playerName)} has **Inventory API** access disabled. Most data is missing. :x:\n`
			: '';

	type ProgressPageEntry = {
		id: string;
		parentId: string;
		source: FortuneSourceProgress;
		title?: string;
	};

	const progressPages = new Map<string, ProgressPageEntry>();
	let progressPageCounter = 0;

	const hasNestedProgress = (source: FortuneSourceProgress) => (source.progress?.length ?? 0) > 0;
	const sourceNeedsDisclaimer = (source: FortuneSourceProgress): boolean =>
		source.api === false || (source.progress?.some(sourceNeedsDisclaimer) ?? false);

	const addProgressSource = (
		target: EliteContainer,
		source: FortuneSourceProgress,
		parentId: string,
		title = source.name,
	) => {
		if (!hasNestedProgress(source)) {
			target.addText(sourceProgress(source));
			return;
		}

		const id = `progress-${progressPageCounter++}`;
		progressPages.set(id, { id, parentId, source, title });

		target.addButtonSection(
			new ButtonBuilder().setCustomId(id).setLabel('Open').setStyle(ButtonStyle.Primary),
			`### ${sourceTitle(source, title)}\n${sourceProgressBody(source)}`,
		);
	};

	const row = CropSelectRow('crop-select-fortune', 'Select a crop to view its fortune!');

	const containerTitleSuffix = `for ${escapeIgn(playerName)} (${profile.profileName})\n${apiWarning}-# View more [on eliteskyblock.com!](${url})`;
	const petProgress = bestProgressBySource(player.getPetProgress(broadStats));

	let container = new EliteContainer(settings)
		.addTitle(`## ${fortuneEmoji} Farming Fortune ` + containerTitleSuffix)
		.addButtonSection(
			new ButtonBuilder().setCustomId('general').setLabel('Open').setStyle(ButtonStyle.Primary),
			`### General Fortune\n${categoryProgress(player.getProgress(broadStats), broadStats)}`,
		)
		.addSeparator()
		.addButtonSection(
			new ButtonBuilder().setCustomId('gear').setLabel('Open').setStyle(ButtonStyle.Primary),
			`### Armor & Equipment Fortune\n${categoryProgress(player.armorSet.getProgress(broadStats), broadStats)}`,
		);

	if (petProgress.length > 0) {
		container = container
			.addSeparator()
			.addButtonSection(
				new ButtonBuilder().setCustomId('pets').setLabel('Open').setStyle(ButtonStyle.Primary),
				`### Pet Fortune\n${categoryProgress(petProgress, broadStats)}`,
			);
	}

	container = container
		.addSeparator()
		.addText(
			`### Crop Specific Fortune\n` +
				`${cropOverview(Crop.Cactus)}  ${cropOverview(Crop.Carrot)}\n` +
				`${cropOverview(Crop.CocoaBeans)}  ${cropOverview(Crop.Melon)}\n` +
				`${cropOverview(Crop.Moonflower)}  ${cropOverview(Crop.Mushroom)}\n` +
				`${cropOverview(Crop.NetherWart)}  ${cropOverview(Crop.Potato)}\n` +
				`${cropOverview(Crop.Pumpkin)}  ${cropOverview(Crop.SugarCane)}\n` +
				`${cropOverview(Crop.Sunflower)}  ${cropOverview(Crop.Wheat)}\n` +
				`${cropOverview(Crop.WildRose)}`,
		)
		.addActionRowComponents(row)
		.addFooter();

	const disclaimer = `-# Sources with \":warning:\" don't exist in the Hypixel API and can only be set on eliteskyblock.com.`;
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

			const selected = CROP_ARRAY[+inter.values[0]] as Crop;
			cropContainer = getCropFortuneProgress(selected);

			await inter.update({ components: [cropContainer] });
			return;
		}
		cropContainer = undefined;

		if (inter.customId.startsWith('crop-page-')) {
			const crop = inter.customId.slice('crop-page-'.length) as Crop;
			if (!Object.values(Crop).includes(crop)) {
				await inter.reply({ content: 'Invalid crop selected!', ephemeral: true });
				return;
			}

			cropContainer = getCropFortuneProgress(crop);
			await inter.update({ components: [cropContainer] });
			return;
		}

		const progressPage = progressPages.get(inter.customId);
		if (progressPage) {
			currentContainer = getProgressSourcePage(progressPage);
			await inter.update({ components: [currentContainer] });
			return;
		}

		if (inter.customId === 'general') {
			currentContainer = getGeneralFortuneProgress();
			await inter.update({ components: [currentContainer] });
			return;
		}

		if (inter.customId === 'gear') {
			currentContainer = getGearFortuneProgress();
			await inter.update({ components: [currentContainer] });
			return;
		}

		if (inter.customId === 'pets') {
			currentContainer = getPetFortuneProgress();
			await inter.update({ components: [currentContainer] });
			return;
		}

		if (inter.customId.startsWith('gear-')) {
			if (!inter.isButton()) return;
			const passed = inter.customId.split('-')[1];
			const slot = GEAR_ARRAY.find((g) => g.toLowerCase() == passed) as GearSlot;
			const piece = player.armorSet.getPiece(slot);

			if (!GEAR_ARRAY.includes(slot) || !piece) {
				await inter.reply({ content: 'Invalid gear slot selected!', ephemeral: true });
				return;
			}

			currentContainer = getGearPieceFortuneProgress(slot, piece);

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
		if (cropContainer) {
			cropContainer.disableEverything();
			interaction.editReply({ components: [cropContainer] }).catch(() => undefined);
		} else if (currentContainer) {
			currentContainer.disableEverything();
			interaction.editReply({ components: [currentContainer] }).catch(() => undefined);
		} else {
			container.disableEverything();
			interaction.editReply({ components: [container] }).catch(() => undefined);
		}
	});

	function getCropFortuneProgress(crop: Crop) {
		const tool = player.getBestTool(crop);
		if (tool) player.selectTool(tool);

		const progress = player.getCropProgress(crop, cropStats(crop));
		const progressTotal = sumProgressStats(progress, cropStats(crop));

		const thisSource = progress.find((source) => source.name === 'Farming Tool');

		const container = new EliteContainer(settings)
			.addTitle(`## ${GetCropEmoji(crop)} Fortune ${containerTitleSuffix}`, false)
			.addDescription(
				`${getCropDisplayName(crop)} Progress - **${formatValue(progressTotal.current)}** / ${formatValue(progressTotal.max)}`,
			)
			.addSeparator();

		let needsDisclaimer = thisSource ? sourceNeedsDisclaimer(thisSource) : false;

		if (thisSource) {
			addProgressSource(
				container,
				thisSource,
				`crop-page-${crop}`,
				removeColorCodes(tool?.item.name ?? '') || 'Farming Tool Progress',
			);
			container.addSeparator();
		}

		for (const source of progress) {
			if (source === thisSource) continue;
			if (sourceNeedsDisclaimer(source)) {
				needsDisclaimer = true;
			}
			addProgressSource(container, source, `crop-page-${crop}`);
		}

		if (thisSource?.nextInfo) {
			const next = thisSource.nextInfo;
			const reason = thisSource.info?.upgrade;

			let reasonText = '';
			switch (reason?.reason) {
				case UpgradeReason.DeadEnd:
					reasonText = 'Switch To';
					break;
				case UpgradeReason.Situational:
					reasonText = 'Also Consider';
					break;
				case UpgradeReason.NextTier:
				default:
					reasonText = 'Upgrade To';
					break;
			}

			container.addSeparator();
			container.addText(`${reasonText} [${next.name}](${next.wiki})` + (reason?.why ? `\n-# ${reason.why}` : ''));
		}

		container.addSeparator();
		if (needsDisclaimer) {
			container.addText(disclaimer);
		}
		container.addFooter(false, 'back');

		return container;
	}

	function getGearPieceFortuneProgress(slot: GearSlot, piece: FarmingArmor | FarmingEquipment) {
		const progress = piece.getProgress(broadStats);

		const container = new EliteContainer(settings)
			.addTitle(`## ${fortuneEmoji} ${slot} Fortune ${containerTitleSuffix}`, false)
			.addSeparator();

		const armorSources = player.armorSet.getProgress(broadStats);
		const thisSource = armorSources.find((source) => source.name === slot);

		if (thisSource) {
			container.addText(`### ${removeColorCodes(piece?.item.name ?? '') || slot}\n${sourceProgressBody(thisSource)}`);
			container.addSeparator();
		}

		for (const source of progress) {
			addProgressSource(container, source, `gear-${slot.toLowerCase()}`);
		}

		if (thisSource?.nextInfo) {
			const next = thisSource.nextInfo;
			const reason = thisSource.info?.upgrade;

			let reasonText = '';
			switch (reason?.reason) {
				case UpgradeReason.DeadEnd:
					reasonText = 'Switch To';
					break;
				case UpgradeReason.Situational:
					reasonText = 'Also Consider';
					break;
				case UpgradeReason.NextTier:
				default:
					reasonText = 'Upgrade To';
					break;
			}

			container.addSeparator();
			container.addText(`${reasonText} [${next.name}](${next.wiki})` + (reason?.why ? `\n-# ${reason.why}` : ''));
		}

		container.addFooter(true, 'gear');

		return container;
	}

	function getProgressSourcePage(entry: ProgressPageEntry) {
		const container = new EliteContainer(settings)
			.addTitle(`## ${entry.title ?? entry.source.name} ${containerTitleSuffix}`, false)
			.addDescription(sourceProgressBody(entry.source))
			.addSeparator();

		let needsDisclaimer = sourceNeedsDisclaimer(entry.source);

		for (const child of entry.source.progress ?? []) {
			addProgressSource(container, child, entry.id);
			if (sourceNeedsDisclaimer(child)) {
				needsDisclaimer = true;
			}
		}

		container.addSeparator();
		if (needsDisclaimer) {
			container.addText(disclaimer);
		}
		container.addFooter(false, entry.parentId);

		return container;
	}

	function getGeneralFortuneProgress() {
		const total = player.getProgress(broadStats);
		const summary = categoryProgress(total, broadStats);

		const container = new EliteContainer(settings)
			.addTitle(`## ${fortuneEmoji} General Fortune ` + containerTitleSuffix, false)
			.addDescription(summary)
			.addSeparator();

		let needsDisclaimer = false;
		for (let i = 0; i < total.length; i++) {
			const source = total[i];
			addProgressSource(container, source, 'general');
			if (sourceNeedsDisclaimer(source)) {
				needsDisclaimer = true;
			}
		}

		container.addSeparator();
		if (needsDisclaimer) {
			container.addText(disclaimer);
		}
		container.addFooter(false, 'back');

		return container;
	}

	function getPetFortuneProgress() {
		const total = bestProgressBySource(player.getPetProgress(broadStats));
		const summary = categoryProgress(total, broadStats);

		const container = new EliteContainer(settings)
			.addTitle(`## ${fortuneEmoji} Pet Fortune ` + containerTitleSuffix, false)
			.addDescription(summary)
			.addText('-# Pet fortune is still a work in progress and only shows pets you currently own. :warning:')
			.addSeparator();

		let needsDisclaimer = false;
		for (const source of total) {
			addProgressSource(container, source, 'pets');
			if (sourceNeedsDisclaimer(source)) {
				needsDisclaimer = true;
			}
		}

		container.addSeparator();
		if (needsDisclaimer) {
			container.addText(disclaimer);
		}
		container.addFooter(false, 'back');

		return container;
	}

	function getGearFortuneProgress() {
		const total = player.armorSet.getProgress(broadStats);
		const summary = categoryProgress(total, broadStats);

		const container = new EliteContainer(settings)
			.addTitle(`## ${fortuneEmoji} Armor & Equipment Fortune ` + containerTitleSuffix, false)
			.addDescription(summary)
			.addSeparator();

		let needsDisclaimer = false;
		for (let i = 0; i < total.length; i++) {
			const source = total[i];
			const slot = GEAR_ARRAY.find((s) => s === source.name);
			if (slot) {
				const piece = player.armorSet.getPiece(slot);
				if (piece?.item?.name) {
					source.name = removeColorCodes(piece.item.name);
				}
				container.addButtonSection(
					new ButtonBuilder()
						.setLabel(slot)
						.setCustomId('gear-' + slot.toLowerCase())
						.setStyle(ButtonStyle.Primary),
					sourceProgress(source),
				);
			} else {
				addProgressSource(container, source, 'gear');
			}
			if (sourceNeedsDisclaimer(source)) {
				needsDisclaimer = true;
			}
		}

		container.addSeparator();
		if (needsDisclaimer) {
			container.addText(disclaimer);
		}
		container.addFooter(false, 'back');

		return container;
	}
}
