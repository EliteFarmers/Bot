import { ButtonInteraction, MessageFlags, PermissionFlagsBits } from 'discord.js';
import { FetchGuildJacob } from '../api/elite.js';
import { CommandAccess, CommandType, EliteCommand } from '../classes/commands/index.js';
import { EliteEmbed, ErrorEmbed } from '../classes/embeds.js';
import { getLeaderboardPayload } from './submitscores.js';

const command = new EliteCommand({
	name: 'LBSETUP',
	description: 'Setup a jacob leaderboard!',
	permissions: PermissionFlagsBits.Administrator | PermissionFlagsBits.ManageGuild,
	access: CommandAccess.Guild,
	type: CommandType.Button,
	execute: execute,
});

export default command;

async function execute(interaction: ButtonInteraction) {
	if (!interaction.inCachedGuild()) {
		const embed = ErrorEmbed('This command can only be used in a server!').setDescription(
			'If you are in a server, please wait a few minutes and try again.\nOtherwise I have no idea how you got this error.',
		);
		interaction.reply({ embeds: [embed], ephemeral: true });
		return;
	}

	await interaction.deferReply({ ephemeral: true });

	const guild = await FetchGuildJacob(interaction.guildId)
		.then((data) => data.data)
		.catch(() => undefined);

	if (!guild) {
		const embed = ErrorEmbed('Jacob Leaderboards not available!').setDescription(
			'This server does not have Jacob Leaderboards enabled.\nIf you were expecting this to work, please contact "kaeso.dev" on Discord.\nThis feature is being remade currently, and will likely be a paid feature. Sorry for the inconvenience.',
		);
		interaction.editReply({ embeds: [embed] });
		return;
	}

	const [, lbId] = interaction.customId.split('|');
	const leaderboard = guild.leaderboards?.find((lb) => lb.id === lbId);

	if (!leaderboard) {
		const embed = ErrorEmbed('Leaderboard not found!').setDescription(
			'This leaderboard does not exist.\nIf you were expecting this to work, please contact "kaeso.dev" on Discord.\nThis feature is being remade currently, and will likely be a paid feature. Sorry for the inconvenience.',
		);
		interaction.editReply({ embeds: [embed] });
		return;
	}

	const embed = EliteEmbed().setTitle('Leaderboard Setup').setDescription('Setup!');
	interaction.editReply({ embeds: [embed] });

	const payload = await getLeaderboardPayload(leaderboard, interaction.guildId, interaction.guild.name);

	interaction.message.delete().catch(() => undefined);
	interaction.channel
		?.send({
			...payload,
			allowedMentions: { parse: [] },
			flags: [MessageFlags.IsComponentsV2, MessageFlags.SuppressNotifications],
		})
		.catch((e) => console.error(e));
}
