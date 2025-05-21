import { UserSettings } from 'api/elite.js';
import { CommandAccess, CommandType, EliteCommand, SlashCommandOptionType } from 'classes/commands/index.js';
import { AutocompleteInteraction, ChatInputCommandInteraction } from 'discord.js';

const command = new EliteCommand({
	name: 'info',
	description: 'Get info about a farm design!',
	access: CommandAccess.Everywhere,
	type: CommandType.Slash,
	subCommand: true,
	options: {
		design: {
			name: 'crop',
			description: 'Search for a farm design!',
			type: SlashCommandOptionType.String,
			required: true,
		},
	},
	execute: execute,
});

export default command;

async function execute(interaction: ChatInputCommandInteraction, settings?: UserSettings) {}
