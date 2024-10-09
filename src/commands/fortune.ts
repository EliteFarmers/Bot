import { getAccount } from 'classes/validate.js';
import { ChatInputCommandInteraction } from 'discord.js';
import {
	Crop,
	PlayerOptions,
	ZorroMode,
	createFarmingPlayer,
	getCropFromName,
	getCropMilestoneLevels,
	getGardenLevel,
	getLevel,
} from 'farming-weight';
import { FetchAccount, FetchProfile, UserSettings } from '../api/elite.js';
import { elitePlayerOption } from '../autocomplete/player.js';
import { LEVELING_XP } from '../classes/Util.js';
import { CommandAccess, CommandType, EliteCommand, SlashCommandOptionType } from '../classes/commands/index.js';
import { EliteEmbed, ErrorEmbed, WarningEmbed } from '../classes/embeds.js';

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

	const result = await getAccount(playerNameInput ?? interaction.user.id, profileNameInput, command);

	if (!result.success) {
		await interaction.editReply({ embeds: [result.embed] });
		return;
	}

	const { account, profile, name: playerName } = result;
	const { data: member } = await FetchProfile(account.id, profile.profileId).catch(() => ({ data: undefined }));

	if (!member) {
		const embed = ErrorEmbed("Couldn't fetch data!")
			.setDescription(`Something went wrong when getting data for "${playerName}".`)
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

	const embed = EliteEmbed(settings)
		.setTitle(`Farming Fortune for ${playerName} (${profile.profileName})`)
		.setDescription(
			player.fortune +
				'General Farming Fortune' +
				player.getCropFortune(Crop.NetherWart, player.getBestTool(Crop.NetherWart)).fortune +
				'Nether Wart Fortune',
		)
		.addFields(
			{
				name: 'Breakdown',
				value: Object.entries(player.breakdown)
					.map(([name, value]) => `**${name}**: ${value.toLocaleString()}`)
					.join('\n'),
				inline: true,
			},
			{
				name: 'Wart Breakdown',
				value: Object.entries(player.getCropFortune(Crop.NetherWart, player.getBestTool(Crop.NetherWart)).breakdown)
					.map(([name, value]) => `**${name}**: ${value.toLocaleString()}`)
					.join('\n'),
				inline: true,
			},
			{
				name: 'Gear Breakdown',
				value: Object.entries(player.armorSet.getFortuneBreakdown())
					.map(([name, value]) => `**${name}**: ${value.toLocaleString()}`)
					.join('\n'),
				inline: true,
			},
		);

	interaction.editReply({ embeds: [embed] });
}
