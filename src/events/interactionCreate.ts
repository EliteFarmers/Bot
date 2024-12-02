import * as Sentry from '@sentry/node';
import {
	AutocompleteInteraction,
	ButtonInteraction,
	ChatInputCommandInteraction,
	CommandInteraction,
	ContextMenuCommandInteraction,
	Events,
	GuildMember,
	Interaction,
	StringSelectMenuInteraction,
} from 'discord.js';
import { FetchGuild, FetchUserSettings } from '../api/elite.js';
import { commands } from '../bot.js';
import { HasRole, isValidAccess } from '../classes/Util.js';
import { CommandGroup, EliteCommand } from '../classes/commands/index.js';

const settings = {
	event: Events.InteractionCreate,
	execute: execute,
};

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
	const command = GetCommand(interaction.commandName);
	if (command instanceof EliteCommand) {
		if (command.isChatInputCommand() && !interaction.isChatInputCommand()) return;
		if (command.isContextMenuCommand() && !interaction.isContextMenuCommand()) return;
	}

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

		await interaction
			.reply({
				content: 'There was an error while executing this command!',
				ephemeral: true,
			})
			.catch(() => undefined);
	}
}

async function OnButtonInteraction(interaction: ButtonInteraction | StringSelectMenuInteraction) {
	const args = interaction.customId.split('|');
	const commandName = args[0];

	const command = GetCommand(commandName);
	if (!command || command instanceof CommandGroup || !command.isButtonCommand()) return;

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

		await interaction
			.reply({
				content: 'There was an error while executing this command!',
				ephemeral: true,
			})
			.catch(() => undefined);
	}
}

async function OnAutocompleteInteraction(interaction: AutocompleteInteraction) {
	if (interaction.responded) return;

	const command = GetCommand(interaction.commandName);
	if (!command || command instanceof CommandGroup) return;

	try {
		const auto = command.getAutocomplete(interaction);
		await auto?.(interaction);
	} catch (error) {
		console.log(error);
	}
}

function GetCommand(name: string): EliteCommand | CommandGroup | undefined {
	return commands.get(name);
}

async function HasPermsAndAccess(
	command: EliteCommand | CommandGroup,
	interaction: CommandInteraction | ButtonInteraction | StringSelectMenuInteraction,
) {
	if (interaction.channel && !isValidAccess(command.access, interaction.channel.type)) return false;

	if (!interaction.guildId || !command.permissions || !(interaction.member instanceof GuildMember)) return true;

	if ('adminRoleOverride' in command && command.adminRoleOverride) {
		const { data: server } = await FetchGuild(interaction.guildId).catch(() => ({ data: undefined }));

		if (server && server.adminRole) {
			const hasRole = HasRole(interaction.member, server.adminRole as unknown as string);

			if (!hasRole) {
				await interaction.reply({
					content: "You don't have the required permissions for this command.",
					allowedMentions: { repliedUser: true },
					ephemeral: true,
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
			content: "You don't have the required permissions for this command.",
			allowedMentions: { repliedUser: true },
			ephemeral: true,
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
