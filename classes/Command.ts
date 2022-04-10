// This is to allow the generic "Function" to be used, as it's the easiest way to allow both types of commandss
/* eslint-disable @typescript-eslint/ban-types */
import { ApplicationCommandData, ApplicationCommandOptionType, CommandInteractionOption } from "discord.js";

export type CommandOptions = {
	name: string,
	description: string,
	aliases?: string[],
	access?: 'ALL' | 'DIRECT' | 'GUILD' | CommandAccess,
	usage?: string,
	permissions?: string[],
	adminRoleOverride?: boolean,
	type: 'SLASH' | 'MESSAGE' | 'COMPONENT' | 'AUTOCOMPLETE' | CommandType,
	slash?: ApplicationCommandData,
}

export class Command {
	name: string;
	description: string;
	aliases?: string[];
	usage?: string;
	access: 'ALL' | 'DIRECT' | 'GUILD' | CommandAccess;
	type: 'SLASH' | 'MESSAGE' | 'COMPONENT' | 'AUTOCOMPLETE' | CommandType;
	permissions?: string[];
	adminRoleOverride: boolean;
	slash?: ApplicationCommandData;

	execute: Function;
	
	constructor(options: CommandOptions, execute: Function) {
		// Required values
		this.name = options.name;
		this.type = options.type;
		this.description = options.description;

		// Optional Values
		this.usage = options.usage;
		this.aliases = options.aliases;
		this.permissions = options.permissions;
		this.slash = options.slash;

		// Default Values
		this.access = options.access ?? 'ALL';
		this.adminRoleOverride = options.adminRoleOverride ?? true;

		this.execute = execute;
	}
}

export interface CommandArgument extends CommandInteractionOption {
	name: string,
	type: ApplicationCommandOptionType,
	description: string,
	required: boolean,
	choices?: {}[]
}

export enum CommandType {
	SLASH = 'SLASH',
	MESSAGE = 'MESSAGE',
	COMPONENT = 'COMPONENT',
	AUTOCOMPLETE = 'AUTOCOMPLETE'
}

export enum CommandAccess {
	ALL = 'ALL',
	DIRECT = 'DIRECT',
	GUILD = 'GUILD'
}