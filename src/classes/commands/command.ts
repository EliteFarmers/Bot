// This is to allow the generic "Function" to be used, as it's the easiest way to allow both types of commands
/* eslint-disable @typescript-eslint/ban-types */
import {
	ApplicationCommandType,
	AutocompleteInteraction,
	ContextMenuCommandBuilder,
	ContextMenuCommandType,
	SlashCommandBuilder,
	SlashCommandOptionsOnlyBuilder,
	SlashCommandSubcommandsOnlyBuilder,
} from 'discord.js';
import { Command, CommandAccess, CommandGroup, CommandType, SlashCommand } from './index.js';

export class EliteCommand implements SlashCommand {
	declare slash?: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder | ContextMenuCommandBuilder;
	declare permissions?: bigint | undefined;
	declare adminRoleOverride?: boolean | undefined;
	declare access: CommandAccess;
	declare type: CommandType;
	declare execute: Function;
	declare name: string;
	declare description: string;
	declare fetchSettings?: boolean | undefined;

	constructor(settings: Command) {
		this.name = settings.name;
		this.description = settings.description;
		this.fetchSettings = settings.fetchSettings ?? false;

		this.access = settings.access;
		this.type = settings.type;
		this.permissions = settings.permissions;
		this.adminRoleOverride = settings.adminRoleOverride;

		this.slash = settings.slash;
		this.execute = settings.execute;

		this.buildSlashCommand();
	}

	public async getAutocomplete(interaction: AutocompleteInteraction) {
		return getAutocompleteFunction(this, interaction);
	}

	public isChatInputCommand(): this is SlashCommand & {
		slash: SlashCommandBuilder;
	} {
		return this.type === CommandType.Slash || this.type === CommandType.GuildSlash || this.type === CommandType.Combo;
	}

	public isContextMenuCommand(): this is SlashCommand & {
		slash: ContextMenuCommandBuilder;
	} {
		return this.type === CommandType.UserContextMenu || this.type === CommandType.MessageContextMenu;
	}

	public buildSlashCommand() {
		if (this.isChatInputCommand()) {
			this.buildChatSlashCommand();
			return this.slash;
		}

		if (this.isContextMenuCommand()) {
			this.buildContextMenuCommand();
			return this.slash;
		}

		return undefined;
	}

	private buildChatSlashCommand() {
		if (!this.isChatInputCommand()) return;

		this.slash ??= new SlashCommandBuilder();
		this.slash.setName(this.name).setDescription(this.description);

		for (const option of this.options ?? []) {
			option.builder(this.slash);
		}
	}

	private buildContextMenuCommand() {
		if (!this.isContextMenuCommand()) return;

		this.slash ??= new ContextMenuCommandBuilder();
		const type: ContextMenuCommandType =
			this.type === CommandType.UserContextMenu
				? (ApplicationCommandType.User as ContextMenuCommandType)
				: (ApplicationCommandType.Message as ContextMenuCommandType);

		this.slash.setName(this.name).setType(type);
	}
}

export const getAutocomplete = getAutocompleteFunction;
export async function getAutocompleteFunction(cmd: Command | CommandGroup, interaction: AutocompleteInteraction) {
	if (cmd instanceof CommandGroup) {
		cmd.autocomplete(interaction);
		return undefined;
	}

	const auto = cmd.autocomplete;
	if (!auto) return undefined;

	if (typeof auto === 'function') {
		return auto;
	}

	const focused = interaction.options.getFocused(true);
	if (!focused) undefined;

	return auto[focused.name];
}
