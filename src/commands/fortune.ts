import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	ChatInputCommandInteraction,
	StringSelectMenuBuilder,
} from 'discord.js';
import {
	Crop,
	FarmingPlayer,
	FortuneSourceProgress,
	GearSlot,
	PlayerOptions,
	UpgradeReason,
	ZorroMode,
	createFarmingPlayer,
	getCropDisplayName,
	getCropFromName,
	getCropMilestoneLevels,
	getGardenLevel,
	getLevel,
} from 'farming-weight';
import { FetchProfile, UserSettings } from '../api/elite.js';
import { elitePlayerOption } from '../autocomplete/player.js';
import {
	CROP_ARRAY,
	CropSelectRow,
	GEAR_ARRAY,
	GetCropEmoji,
	LEVELING_XP,
	escapeIgn,
	removeColorCodes,
} from '../classes/Util.js';
import { CommandAccess, CommandType, EliteCommand, SlashCommandOptionType } from '../classes/commands/index.js';
import { EliteEmbed, ErrorEmbed, NotYoursReply, PrefixFooter } from '../classes/embeds.js';
import { progressBar } from '../classes/progressbar.js';
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

	const options: PlayerOptions = {
		collection: member.collections,
		farmingXp: member.skills?.farming ?? 0,
		farmingLevel: farmingLevel.level,
		tools: member.farmingWeight.inventory?.tools ?? [],
		armor: member.farmingWeight.inventory?.armor ?? [],
		equipment: member.farmingWeight.inventory?.equipment ?? [],
		accessories: member.farmingWeight.inventory?.accessories ?? [],
		pets: member.pets ?? [],
		personalBests: member.jacob.stats?.personalBests,
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
	};

	const player = createFarmingPlayer(options);

	if (player.pets.length) {
		player.selectPet(player.pets.sort((a, b) => b.fortune - a.fortune)[0]);
	}

	const url = `https://elitebot.dev/@${account.id}/${profile.profileId}/rates#fortune`;

	const cropProgress = (crop: Crop) => {
		const tool = player.getBestTool(crop);
		if (tool) player.selectTool(tool);

		const progress = player.getCropProgress(crop);
		const total = progress.reduce((acc, curr) => acc + curr.fortune, 0);
		const max = progress.reduce((acc, curr) => acc + curr.maxFortune, 0);

		return (
			`**${total.toLocaleString()}** / ${max.toLocaleString()} • ${GetCropEmoji(crop)}\n` +
			`-# ${progressBar(Math.min(total / max, 1))}`
		);
	};

	const sourceProgress = (source: FortuneSourceProgress) => {
		const total = source.fortune;
		const max = source.maxFortune;
		const missing = source.api === false ? '⚠' : '**' + total.toLocaleString() + '**';

		const name = source.wiki ? `[${source.name}](${source.wiki})` : source.name;

		return (
			`${missing} / ${max.toLocaleString()} • ${name} \n` +
			(source.api === false
				? `-# Configure this [on elitebot.dev!](${url})`
				: `${progressBar(Math.min(total / max, 1))}`)
		);
	};

	const embed = EliteEmbed(settings)
		.setTitle(`Farming Fortune for ${escapeIgn(playerName)} (${profile.profileName})`)
		.setDescription(`-# View more [on elitebot.dev!](${url})`)
		.addFields(
			{
				name: 'General Fortune',
				value: player.getProgress().map(sourceProgress).join('\n'),
				inline: true,
			},
			{
				name: 'Gear Fortune',
				value: player.armorSet.getProgress().map(sourceProgress).join('\n'),
				inline: true,
			},
			{
				name: 'Crop Specific Fortune',
				value:
					`${cropProgress(Crop.Cactus)}\n` +
					`${cropProgress(Crop.Carrot)}\n` +
					`${cropProgress(Crop.CocoaBeans)}\n` +
					`${cropProgress(Crop.Melon)}\n` +
					`${cropProgress(Crop.Mushroom)}\n` +
					`${cropProgress(Crop.NetherWart)}\n` +
					`${cropProgress(Crop.Potato)}\n` +
					`${cropProgress(Crop.Pumpkin)}\n` +
					`${cropProgress(Crop.SugarCane)}\n` +
					`${cropProgress(Crop.Wheat)}\n`,
				inline: true,
			},
		);

	PrefixFooter(embed, `Sources with \"⚠\" don't exist in the Hypixel API and can only be set on elitebot.dev.`);

	const row = CropSelectRow('crop-select-fortune', 'Select a crop to view its fortune!');
	const gearRow = getGearRow(player);
	const backButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder().setStyle(ButtonStyle.Secondary).setCustomId('home').setLabel('Main Page'),
	);

	const reply = await interaction.editReply({ embeds: [embed], components: [row, gearRow] });

	const collector = reply.createMessageComponentCollector({
		time: 120_000,
	});

	collector.on('collect', async (inter) => {
		if (inter.user.id !== interaction.user.id) {
			return NotYoursReply(inter);
		}

		collector.resetTimer();

		if (inter.customId === 'crop-select-fortune') {
			if (!inter.isStringSelectMenu()) return;

			const selected = CROP_ARRAY[+inter.values[0]] as Crop;
			const cropEmbed = getCropFortuneProgress(selected);

			await inter.update({ embeds: [cropEmbed], components: [row, gearRow, backButton] });
			return;
		}

		if (inter.customId === 'gear-select-fortune') {
			if (!inter.isStringSelectMenu()) return;

			const selected = GEAR_ARRAY[+inter.values[0]] as GearSlot;
			const gearEmbed = getGearFortuneProgress(selected);

			await inter.update({ embeds: [gearEmbed] });
			return;
		}

		if (inter.customId === 'home') {
			await inter.update({ embeds: [embed], components: [row, gearRow, backButton] });
			return;
		}
	});

	collector.on('end', async () => {
		reply.edit({ components: [] }).catch(() => undefined);
	});

	function getCropFortuneProgress(crop: Crop) {
		const tool = player.getBestTool(crop);
		if (tool) player.selectTool(tool);

		const cropFortune = player.getCropFortune(crop);
		const progress = player.getCropProgress(crop);

		const thisSource = progress.find((source) => source.name === 'Farming Tool');

		const embed = EliteEmbed(settings)
			.setTitle(`Farming Fortune for ${escapeIgn(playerName)} (${profile.profileName})`)
			.setDescription(
				`${GetCropEmoji(crop)} ${getCropDisplayName(crop)} Fortune • **${cropFortune.fortune.toLocaleString()}** / ${progress.reduce((acc, curr) => acc + curr.maxFortune, 0).toLocaleString()}` +
					`\n-# View more [on elitebot.dev!](${url})`,
			)
			.addFields({
				name: 'Fortune Sources',
				value: progress.map(sourceProgress).join('\n'),
				inline: true,
			});

		embed.addFields({
			name: removeColorCodes(tool?.name ?? thisSource?.name ?? 'Farming Tool'),
			value: thisSource?.progress?.map(sourceProgress)?.join('\n') ?? 'No Progress',
			inline: true,
		});

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

			embed.addFields({
				name: reasonText,
				value: `[${next.name}](${next.wiki})` + (reason?.why ? `\n-# ${reason.why}` : ''),
				inline: true,
			});
		}

		return embed;
	}

	function getGearFortuneProgress(slot: GearSlot) {
		const item = player.armorSet.getPiece(slot);
		const progress = player.armorSet.getPieceProgress(slot);

		const embed = EliteEmbed(settings)
			.setTitle(`Farming Fortune for ${escapeIgn(playerName)} (${profile.profileName})`)
			.setDescription(`Total Gear Fortune • **${player.armorSet.fortune.toLocaleString()}**`)
			.addFields({
				name: 'Gear Fortune',
				value: player.armorSet.getProgress().map(sourceProgress).join('\n'),
				inline: true,
			});

		if (progress?.length) {
			embed.addFields({
				name: removeColorCodes(item?.item.name ?? slot),
				value: progress.map(sourceProgress).join('\n'),
				inline: true,
			});
		} else {
			embed.addFields({
				name: 'No Progress',
				value: "This piece of gear has no fortune sources (or you don't have an item)!",
				inline: true,
			});
		}

		const armorSources = player.armorSet.getProgress();
		const thisSource = armorSources.find((source) => source.name === slot);

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

			embed.addFields({
				name: reasonText,
				value: `[${next.name}](${next.wiki})` + (reason?.why ? `\n-# ${reason.why}` : ''),
				inline: true,
			});
		}

		return embed;
	}
}

function getGearRow(player: FarmingPlayer) {
	const options = GEAR_ARRAY.map((slot, i) => ({
		label: removeColorCodes(player.armorSet.getPiece(slot)?.item.name ?? slot),
		value: i.toString(),
	}));

	return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
		new StringSelectMenuBuilder()
			.addOptions(...options)
			.setCustomId('gear-select-fortune')
			.setPlaceholder('Select a gear piece to view its fortune!'),
	);
}
