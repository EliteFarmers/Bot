import { Command, CommandAccess, CommandType } from "#classes/Command.js";
import { ContextMenuCommandBuilder, UserContextMenuCommandInteraction } from "discord.js";
import { FetchAccount } from "#api/elite.js";

const settings: Command = {
	name: 'Get Linked Account',
	description: 'Get a user\'s linked account if they have one.',
	type: CommandType.ContextMenu,
	access: CommandAccess.Everywhere,
	slash: new ContextMenuCommandBuilder().setType(2),
	execute: execute
}

export default settings;

async function execute(interaction: UserContextMenuCommandInteraction) {
	const user = interaction.targetUser;

	await interaction.deferReply({ ephemeral: true });

	const { data: found } = await FetchAccount(user.id).catch(() => ({ data: undefined }));

	if (!found) {
		interaction.editReply({
			content: `Linked account for ${user} not found!`
		});
		return;
	}

	interaction.editReply({
		content: `${user} https://elitebot.dev/@${found.name}`
	})
}