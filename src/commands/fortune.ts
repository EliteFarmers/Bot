import { ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import {
	Crop,
	createFarmingPlayer,
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
	UpgradeReason,
	ZorroMode,
} from 'farming-weight';
import { FetchProfile, UserSettings } from '../api/elite.js';
import { elitePlayerOption } from '../autocomplete/player.js';
import { CommandAccess, CommandType, EliteCommand, SlashCommandOptionType } from '../classes/commands/index.js';
import { EliteContainer } from '../classes/components.js';
import { ErrorEmbed, NotYoursReply } from '../classes/embeds.js';
import { progressBar } from '../classes/progressbar.js';
import {
	CROP_ARRAY,
	CropSelectRow,
	escapeIgn,
	GEAR_ARRAY,
	GetCropEmoji,
	LEVELING_XP,
	removeColorCodes,
} from '../classes/Util.js';
import { getAccount } from '../classes/validate.js';

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
	const { data: member } = await FetchProfile(account.id, profile.profileId).catch(() => ({ data: undefined }));

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
		tools: (member.farmingWeight.inventory?.tools ?? []) as PlayerOptions['tools'],
		armor: (member.farmingWeight.inventory?.armor ?? []) as PlayerOptions['armor'],
		equipment: (member.farmingWeight.inventory?.equipment ?? []) as PlayerOptions['equipment'],
		accessories: (member.farmingWeight.inventory?.accessories ?? []) as PlayerOptions['accessories'],
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
		milestones: getCropMilestoneLevels(member.garden?.crops ?? {}),
		refinedTruffles: member.chocolateFactory?.refinedTrufflesConsumed,
		cocoaFortuneUpgrade: member.chocolateFactory?.cocoaFortuneUpgrades,
		exportableCrops: saved?.exported ?? {},
		attributes: saved?.attributes ?? {},
		communityCenter: saved?.communityCenter ?? 0,
	};

	const player = createFarmingPlayer(options);

	if (player.pets.length) {
		player.selectPet(player.pets.sort((a, b) => b.fortune - a.fortune)[0]);
	}

	const url = `https://elitebot.dev/@${account.id}/${profile.profileId}/rates#fortune`;

	const cropOverview = (crop: Crop) => {
		const tool = player.getBestTool(crop);
		if (tool) player.selectTool(tool);

		const progress = player.getCropProgress(crop);
		const total = progress.reduce((acc, curr) => acc + curr.fortune, 0);
		const max = progress.reduce((acc, curr) => acc + curr.maxFortune, 0);

		return `${GetCropEmoji(crop)} ${progressBar(Math.min(total / max, 1))}`;
	};

	const sourceProgress = (source: FortuneSourceProgress) => {
		const total = source.fortune;
		const max = source.maxFortune;
		const missing =
			source.api === false && !total
				? ':warning:'
				: (source.api === false ? ':warning: **' : '** ') + total.toLocaleString() + '**';

		const name = source.wiki ? `${source.name} [⧉](${source.wiki})` : source.name;

		return (
			`**${name}** \n` +
			(source.api === false && !total
				? `-# Configure [on elitebot.dev!](${url})  ${missing} **/ ${max.toLocaleString()}** ${fortuneEmoji}`
				: `${progressBar(Math.min(total / max, 1), 10)}  ${missing} / ${max.toLocaleString()} ${fortuneEmoji}`)
		);
	};

	const categoryProgress = (sources: FortuneSourceProgress[]) => {
		let total = 0;
		let max = 0;

		for (const source of sources) {
			total += source.fortune;
			max += source.maxFortune;
		}

		return (
			`${progressBar(Math.min(total / max, 1), 8)} • ` +
			`**${total.toLocaleString()}** / ${max.toLocaleString()} ${fortuneEmoji}`
		);
	};

	const apiWarning =
		member.api?.inventories === false
			? `:x: ${escapeIgn(playerName)} has **Inventory API** access disabled. Most data is missing. :x:\n`
			: '';

	const row = CropSelectRow('crop-select-fortune', 'Select a crop to view its fortune!');

	const containerTitleSuffix = `for ${escapeIgn(playerName)} (${profile.profileName})\n${apiWarning}-# View more [on elitebot.dev!](${url})`;

	const container = new EliteContainer(settings)
		.addTitle(`## ${fortuneEmoji} Farming Fortune ` + containerTitleSuffix)
		.addButtonSection(
			new ButtonBuilder().setCustomId('general').setLabel('Open').setStyle(ButtonStyle.Primary),
			`### General Fortune\n${categoryProgress(player.getProgress())}`,
		)
		.addSeparator()
		.addButtonSection(
			new ButtonBuilder().setCustomId('gear').setLabel('Open').setStyle(ButtonStyle.Primary),
			`### Armor & Equipment Fortune\n${categoryProgress(player.armorSet.getProgress())}`,
		)
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

	const disclaimer = `-# Sources with \":warning:\" don't exist in the Hypixel API and can only be set on elitebot.dev.`;
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

		const cropFortune = player.getCropFortune(crop);
		const progress = player.getCropProgress(crop);

		const thisSource = progress.find((source) => source.name === 'Farming Tool');

		const container = new EliteContainer(settings)
			.addTitle(`## ${GetCropEmoji(crop)} Fortune ${containerTitleSuffix}`, false)
			.addDescription(
				`${getCropDisplayName(crop)} Fortune • **${cropFortune.fortune.toLocaleString()}** / ${progress.reduce((acc, curr) => acc + curr.maxFortune, 0).toLocaleString()}`,
			)
			.addSeparator();

		let needsDisclaimer = thisSource?.progress?.some((source) => source.api === false) ?? false;

		if (thisSource) {
			container.addCollapsible({
				header: `### ${removeColorCodes(tool?.item.name ?? '') || 'Farming Tool Progress'}`,
				collapsed: {
					text: sourceProgress(thisSource).split('\n')[1] || 'No progress found.',
					button: 'Open',
				},
				expanded: {
					text: thisSource.progress?.map(sourceProgress).join('\n') || 'No progress found.',
					button: 'Close',
				},
			});
			container.addSeparator();
		}

		for (const source of progress) {
			if (source === thisSource) continue;
			if (source.api === false) {
				needsDisclaimer = true;
			}
			container.addText(sourceProgress(source));
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
		const progress = piece.getProgress();

		const container = new EliteContainer(settings)
			.addTitle(`## ${fortuneEmoji} ${slot} Fortune ${containerTitleSuffix}`, false)
			.addSeparator();

		const armorSources = player.armorSet.getProgress();
		const thisSource = armorSources.find((source) => source.name === slot);

		if (thisSource) {
			container.addText(
				`### ${removeColorCodes(piece?.item.name ?? '') || slot}\n${sourceProgress(thisSource).split('\n')[1] || 'No progress found.'}`,
			);
			container.addSeparator();
		}

		for (const source of progress) {
			container.addText(sourceProgress(source));
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

	function getGeneralFortuneProgress() {
		const total = player.getProgress();
		const current = total.reduce((acc, curr) => acc + curr.fortune, 0);
		const max = total.reduce((acc, curr) => acc + curr.maxFortune, 0);

		const container = new EliteContainer(settings)
			.addTitle(`## ${fortuneEmoji} General Fortune ` + containerTitleSuffix, false)
			.addDescription(`Progress • **${current.toLocaleString()}** / ${max.toLocaleString()}`)
			.addSeparator();

		let needsDisclaimer = false;
		for (let i = 0; i < total.length; i++) {
			const source = total[i];
			container.addText(sourceProgress(source));
			if (source.api === false) {
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
		const total = player.armorSet.getProgress();
		const current = player.armorSet.fortune;
		const max = total.reduce((acc, curr) => acc + curr.maxFortune, 0);

		const container = new EliteContainer(settings)
			.addTitle(`## ${fortuneEmoji} Armor & Equipment Fortune ` + containerTitleSuffix, false)
			.addDescription(`Progress • **${current.toLocaleString()}** / ${max.toLocaleString()}`)
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
				container.addText(sourceProgress(source));
			}
			if (source.api === false) {
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
