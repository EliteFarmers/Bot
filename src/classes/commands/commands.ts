import {
	AutocompleteInteraction,
	BaseInteraction,
	Client,
	ContextMenuCommandBuilder,
	Interaction,
	PermissionsBitField,
	RESTPostAPIApplicationCommandsJSONBody,
	SlashCommandBuilder,
	SlashCommandOptionsOnlyBuilder,
	SlashCommandSubcommandBuilder,
	SlashCommandSubcommandsOnlyBuilder,
} from 'discord.js';

export interface CommandBase {
	name: string;
	description: string;
	fetchSettings?: boolean;
	execute: Function;

	permissions?: bigint;
	adminRoleOverride?: boolean;
	access: CommandAccess;
	type: CommandType;
}

export type AutocompleteHandler = (interaction: AutocompleteInteraction) => Promise<void>;

export interface EliteCommandOption<T extends SlashCommandBuilder = SlashCommandBuilder> {
	name: string;
	description: string;
	required?: boolean;
	autocomplete?: AutocompleteHandler;
	builder: (builder: T) => T | SlashCommandOptionsOnlyBuilder;
}

export interface SlashCommand extends CommandBase {
	slash?: SlashCommandBuilder | ContextMenuCommandBuilder | SlashCommandOptionsOnlyBuilder;

	autocomplete?: AutocompleteHandler | Record<string, AutocompleteHandler>;

	options?: EliteCommandOption[];
}

export type Command = SlashCommand;

export interface CommandGroupSettings extends CommandBase {
	slash?: SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder;

	addSubcommand?: (subCommand: SlashCommand) => void;
}

export enum CommandType {
	Slash,
	GuildSlash,
	Button,
	Combo,
	Group,
	Autocomplete,
	UserContextMenu,
	MessageContextMenu,
}

export enum CommandAccess {
	Everywhere,
	Guild,
	DirectMessage,
}

export interface CronTask {
	cron: string;
	execute: (client: Client) => void;
}
