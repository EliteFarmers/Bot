// This is to allow the generic "Function" to be used, as it's the easiest way to allow both types of commandss
/* eslint-disable @typescript-eslint/ban-types */
import { ApplicationCommandData, ApplicationCommandOptionType, CommandInteractionOption } from "discord.js";

export interface Command {
	name: string,
	description: string,
	access: CommandAccess,
	type: CommandType,
	aliases?: string[],
	usage?: string,
	permissions?: string[],
	adminRoleOverride?: boolean,
	slash?: ApplicationCommandData,

	execute: Function
}

export interface CommandArgument extends CommandInteractionOption {
	name: string,
	type: ApplicationCommandOptionType,
	description: string,
	required: boolean,
	choices?: {}[]
}

export type CommandType = 'SLASH' | 'BUTTON' | 'AUTOCOMPLETE';

export type CommandAccess = 'ALL' | 'DIRECT' | 'GUILD';
