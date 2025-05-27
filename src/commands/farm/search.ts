import { UserSettings } from 'api/elite.js';
import { eliteCropOption } from 'autocomplete/crops.js';
import { CommandAccess, CommandType, EliteCommand, SlashCommandOptionType } from 'classes/commands/index.js';
import { AutocompleteInteraction, ChatInputCommandInteraction } from 'discord.js';

const command = new EliteCommand({
	name: 'search',
	description: 'Search for a farm design!',
	access: CommandAccess.Everywhere,
	type: CommandType.Slash,
	subCommand: true,
	options: {
		crop: eliteCropOption,
	},
	execute: execute,
});

export default command;

async function execute(interaction: ChatInputCommandInteraction, settings?: UserSettings) {}
