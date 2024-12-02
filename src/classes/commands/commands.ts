import {
	AutocompleteInteraction,
	Client,
	ContextMenuCommandBuilder,
	SlashCommandBuilder,
	SlashCommandOptionsOnlyBuilder,
	SlashCommandSubcommandBuilder,
	SlashCommandSubcommandsOnlyBuilder,
} from 'discord.js';
import { EliteCommand } from './command.js';
import { EliteCommandOption, EliteSlashCommandOption } from './index.js';

export interface CommandBase {
	name: string;
	description: string;
	fetchSettings?: boolean;
	execute: Function;

	permissions?: bigint;
	adminRoleOverride?: boolean;
	access: CommandAccess | CommandAccess[];
}

interface SlashCommandBase extends CommandBase {
	type: CommandType.Slash | CommandType.GuildSlash | CommandType.Combo;
	options?: Record<string, EliteSlashCommandOption>;
}

export interface SlashCommand extends SlashCommandBase {
	subCommand?: false;
	slash?: SlashCommandBuilder;
	options?: Record<string, EliteSlashCommandOption>;
}

export interface SubCommand extends SlashCommandBase {
	subCommand: true;
	slash?: SlashCommandSubcommandBuilder;
}

export interface ButtonCommand extends CommandBase {
	type: CommandType.Button;
	options?: Record<string, EliteSlashCommandOption>;
}

export interface ContextMenuCommand extends CommandBase {
	type: CommandType.UserContextMenu | CommandType.MessageContextMenu;
	slash?: ContextMenuCommandBuilder;
}

export interface GroupCommand extends CommandBase {
	type: CommandType.Group;
	slash?: SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder;
	addSubcommand?: (subCommand: EliteCommand) => void;
}

export type Command = SlashCommand | ContextMenuCommand | GroupCommand | ButtonCommand | SubCommand;

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
	BotDM,
	PrivateMessages,
}

export interface CronTask {
	cron: string;
	execute: (client: Client) => void;
}
