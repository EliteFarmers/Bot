// This is to allow the generic "Function" to be used, as it's the easiest way to allow both types of commandss
/* eslint-disable @typescript-eslint/ban-types */
import { ApplicationCommandOptionType, CommandInteractionOption, PermissionResolvable, SlashCommandBuilder } from "discord.js";

export interface Command {
	name: string,
	description: string,
	access: CommandAccess,
	type: CommandType,
	aliases?: string[],
	usage?: string,
	permissions?: PermissionResolvable[],
	adminRoleOverride?: boolean,
	slash?: SlashCommandBuilder | Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'>

	execute: Function
}

export interface CommandArgument extends CommandInteractionOption {
	name: string,
	type: ApplicationCommandOptionType,
	description: string,
	required: boolean,
	choices?: {}[]
}

export enum CommandType {
	Slash,
	GuildSlash,
	Button,
	Combo,
	Autocomplete
}

export enum CommandAccess {
	Everywhere,
	Guild,
	DirectMessage
}
