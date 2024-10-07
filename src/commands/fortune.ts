import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
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
import { autocomplete, playerOption } from '../autocomplete/player.js';
import { LEVELING_XP } from '../classes/Util.js';
import { Command, CommandAccess, CommandType } from '../classes/commands/index.js';
import { EliteEmbed, ErrorEmbed, WarningEmbed } from '../classes/embeds.js';

const command: Command = {
	name: 'fortune',
	description: 'Get a players farming fortune progress!',
	access: CommandAccess.Everywhere,
	type: CommandType.Slash,
	slash: new SlashCommandBuilder()
		.addStringOption(playerOption())
		.addStringOption((option) =>
			option.setName('profile').setDescription('Optionally specify a profile!').setRequired(false),
		),
	execute: execute,
	autocomplete: autocomplete,
};

export default command;

async function execute(interaction: ChatInputCommandInteraction, settings?: UserSettings) {
	let playerName = interaction.options.getString('player', false)?.trim();
	const _profileName = interaction.options.getString('profile', false)?.trim();

	await interaction.deferReply();

	const { data: account } = await FetchAccount(playerName ?? interaction.user.id).catch(() => ({ data: undefined }));

	if (!account?.id || !account?.name) {
		const embed = WarningEmbed('Invalid Username!').addFields({
			name: 'Proper Usage:',
			value: '`/weight` `player:`(player name)\nOr link your account with </verify:1135100641560248334> first!',
		});

		if (playerName) {
			embed.setDescription(`Player \`${playerName}\` does not exist (or an error occured)`);
		} else {
			embed.setDescription('You need to link your account or enter a playername!');
		}

		await interaction.deleteReply().catch(() => undefined);
		interaction.followUp({ embeds: [embed], ephemeral: true });
		return;
	}

	playerName = account.name;

	const profile = _profileName
		? account.profiles?.find((p) => p?.profileName?.toLowerCase() === _profileName.toLowerCase())
		: (account.profiles?.find((p) => p.selected) ?? account.profiles?.[0]);

	if (!profile?.profileId || !profile.profileName) {
		const embed = ErrorEmbed('Invalid Profile!').setDescription(`Profile "${_profileName}" does not exist.`).addFields({
			name: 'Proper Usage:',
			value: '`/weight` `player:`(player name) `profile:`(profile name)',
		});

		if (!_profileName) {
			embed.setDescription('This player has no profiles!');
		}

		await interaction.deleteReply().catch(() => undefined);
		interaction.followUp({ embeds: [embed], ephemeral: true });
		return;
	}

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
					.map(([name, value]) => `**${name}**: ${value}`)
					.join('\n'),
			},
			{
				name: 'Wart Breakdown',
				value: Object.entries(player.getCropFortune(Crop.NetherWart, player.getBestTool(Crop.NetherWart)).breakdown)
					.map(([name, value]) => `**${name}**: ${value}`)
					.join('\n'),
			},
		);

	interaction.editReply({ embeds: [embed] });
}
