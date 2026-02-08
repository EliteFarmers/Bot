import { UserContextMenuCommandInteraction } from 'discord.js';
import { FetchAccount } from '../api/elite.js';
import { CommandAccess, CommandType, EliteCommand } from '../classes/commands/index.js';

const settings = new EliteCommand({
	name: 'Get Linked Account',
	description: "Get a user's linked account if they have one.",
	type: CommandType.UserContextMenu,
	access: CommandAccess.Everywhere,
	execute: execute,
});

export default settings;

async function execute(interaction: UserContextMenuCommandInteraction) {
	const user = interaction.targetUser;

	await interaction.deferReply({ ephemeral: true });

	const { data: found } = await FetchAccount(user.id).catch(() => ({
		data: undefined,
	}));

	if (!found) {
		interaction.editReply({
			content: `Linked account for ${user} not found!`,
		});
		return;
	}

	interaction.editReply({
		content: `${user} https://elitesb.gg/@${found.name}`,
	});
}
