import { AutocompleteInteraction, ButtonInteraction, ChatInputCommandInteraction, CommandInteraction, ContextMenuCommandInteraction, Events, GuildMember, Interaction, StringSelectMenuInteraction } from 'discord.js';
import { commands } from '#src/bot.js';
import { Command, CommandGroup, CommandType, getAutocomplete } from '#classes/Command.js';
import { HasRole, isValidAccess } from '#classes/Util.js';
import { FetchGuild, FetchUserSettings } from '#api/elite.js';
import * as Sentry from '@sentry/node';

const settings = {
	event: Events.InteractionCreate,
	execute: execute
}

export default settings;

async function execute(interaction: Interaction) {
	if (interaction.isChatInputCommand() || interaction.isContextMenuCommand()) {
		return OnCommandInteraction(interaction);
	}
	if (interaction.isButton() || interaction.isStringSelectMenu()) {
		return OnButtonInteraction(interaction);
	}
	if (interaction.isAutocomplete()) return OnAutocompleteInteraction(interaction);
}

async function OnCommandInteraction(interaction: ChatInputCommandInteraction | ContextMenuCommandInteraction) {
	const command = (interaction.isChatInputCommand()) 
		? GetCommand(interaction.commandName, CommandType.Slash)
		: GetCommand(interaction.commandName, CommandType.ContextMenu);
		
	if (!command) return;

	const hasPerms = await HasPermsAndAccess(command, interaction);
	if (!hasPerms) return;

	try {
		if (interaction.entitlements.size > 0) {
			const { data: settings } = await FetchUserSettings(interaction.user.id).catch(() => ({ data: undefined }));

			command.execute(interaction, settings);
		} else {
			command.execute(interaction);
		}
	} catch (error) {
		Sentry.captureException(error);

		await interaction.reply({ 
			content: 'There was an error while executing this command!', 
			ephemeral: true 
		}).catch(() => undefined);
	}
}

async function OnButtonInteraction(interaction: ButtonInteraction | StringSelectMenuInteraction) {
	const args = interaction.customId.split('|');
	const commandName = args[0];

	const command = GetCommand(commandName, CommandType.Button);
	if (!command) return;

	const hasPerms = await HasPermsAndAccess(command, interaction);
	if (!hasPerms) return;

	try {
		if (command.fetchSettings && interaction.entitlements.size > 0) {
			const { data: settings } = await FetchUserSettings(interaction.user.id).catch(() => ({ data: undefined }));

			command.execute(interaction, settings);
		} else {
			command.execute(interaction);
		}
	} catch (error) {
		Sentry.captureException(error);
		
		await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true }).catch(() => undefined);
	}
}

async function OnAutocompleteInteraction(interaction: AutocompleteInteraction) {
	if (interaction.responded) return;
	const command = GetCommand(interaction.commandName, CommandType.Autocomplete);

	if (!command || !('autocomplete' in command)) return;

	try {
		const auto = await getAutocomplete(command, interaction);
		await auto?.(interaction);
	} catch (error) {
		console.log(error);
	}
}

function GetCommand(name: string, type: CommandType): Command | CommandGroup | undefined {
	const command: Command | CommandGroup | undefined = commands.get(name);

	if (!command) return undefined;
	// If type and command type are autocomplete it's valid
	if (type === CommandType.Autocomplete && 'autocomplete' in command) return command;
	// If the types don't match or the type isn't combo than it's invalid
	if (command.type !== type && type !== CommandType.Combo) return undefined;

	return command;
}

async function HasPermsAndAccess(command: Command | CommandGroup, interaction: CommandInteraction | ButtonInteraction | StringSelectMenuInteraction) {
	if (interaction.channel && !isValidAccess(command.access, interaction.channel.type)) return false;

	if (!interaction.guildId || !command.permissions || !(interaction.member instanceof GuildMember)) return true;

	if ('adminRoleOverride' in command && command.adminRoleOverride) {
		const { data: server } = await FetchGuild(interaction.guildId).catch(() => ({ data: undefined }));

		if (server && server.adminRole) {
			const hasRole = HasRole(interaction.member, server.adminRole as unknown as string);

			if (!hasRole) {
				await interaction.reply({ 
					content: 'You don\'t have the required permissions for this command.', 
					allowedMentions: { repliedUser: true }, 
					ephemeral: true 
				});
			}

			return hasRole;
		}
	}

	// Get user permissions
	const perms = interaction.memberPermissions;
	// Return if lacking one
	if (!perms || !perms.has(command.permissions)) {
		await interaction.reply({ 
			content: 'You don\'t have the required permissions for this command.', 
			allowedMentions: { repliedUser: true }, 
			ephemeral: true 
		});
		return false;
	}

	return true;
}

/*
import { BaseInteraction, ChatInputCommandInteraction, Events } from "discord.js";
import { commands } from "../bot.js";

const settings = {
	event: Events.InteractionCreate,
	condition: (interaction: BaseInteraction) => interaction.isChatInputCommand(),
	execute: execute
}

export default settings;

async function execute(interaction: ChatInputCommandInteraction) {
	const command = commands.get(interaction.commandName);
	if (!command) return;

	try {
		await command.execute(interaction);
	} catch (error) {
		console.error(error);
		await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true }).catch(() => undefined);
	}
}
*/