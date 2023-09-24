// This is to allow the generic "Function" to be used, as it's the easiest way to allow both types of commands
/* eslint-disable @typescript-eslint/ban-types */
import { SlashCommandBuilder, SlashCommandSubcommandsOnlyBuilder } from "discord.js";

export interface Command {
	name: string,
	description: string,
	access: CommandAccess,
	type: CommandType,
	aliases?: string[],
	usage?: string,
	permissions?: bigint,
	adminRoleOverride?: boolean,
	slash?: SlashCommandBuilder | Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'> | SlashCommandSubcommandsOnlyBuilder

	execute: Function
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
