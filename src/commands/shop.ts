import { EliteEmbed } from '../classes/embeds.js';
import { Command, CommandAccess, CommandType } from '../classes/Command.js';
import { ChatInputCommandInteraction } from 'discord.js';
import { UserSettings } from '../api/elite.js';

const command: Command = {
	name: 'shop',
	description: 'View the shop!',
	access: CommandAccess.Everywhere,
	type: CommandType.Slash,
	execute: execute
}

export default command;

async function execute(interaction: ChatInputCommandInteraction, settings?: UserSettings) {
	const embed = EliteEmbed(settings)
		.setTitle('Elite Farmers Shop');

	await interaction.reply({
		embeds: [embed],
		allowedMentions: { repliedUser: false },
		ephemeral: true
	}).catch(() => undefined);
}
