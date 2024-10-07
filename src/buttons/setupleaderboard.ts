import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, PermissionFlagsBits } from 'discord.js';
import { FetchGuildJacob } from '../api/elite.js';
import { Command, CommandAccess, CommandType } from '../classes/commands/index.js';
import { EliteEmbed, ErrorEmbed } from '../classes/embeds.js';
import { getLeaderboardEmbed } from './submitscores.js';

const command: Command = {
	name: 'LBSETUP',
	description: 'Setup a jacob leaderboard!',
	permissions: PermissionFlagsBits.Administrator | PermissionFlagsBits.ManageGuild,
	access: CommandAccess.Guild,
	type: CommandType.Button,
	execute: execute,
};

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

	const embed = EliteEmbed().setTitle('Leaderboard Setup').setDescription('Congrat!');
	interaction.editReply({ embeds: [embed] });

	const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder().setCustomId(`LBSUBMIT|${lbId}`).setLabel('Submit Scores').setStyle(ButtonStyle.Secondary),
		new ButtonBuilder()
			.setLabel('View Online')
			.setURL(`https://elitebot.dev/server/${interaction.guildId}`)
			.setStyle(ButtonStyle.Link),
	);

	interaction.message.edit({ embeds: [getLeaderboardEmbed(leaderboard)], components: [row] }).catch(() => undefined);
}
