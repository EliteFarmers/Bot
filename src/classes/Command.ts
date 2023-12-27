// This is to allow the generic "Function" to be used, as it's the easiest way to allow both types of commands
/* eslint-disable @typescript-eslint/ban-types */
import { Interaction, SlashCommandBuilder, SlashCommandSubcommandBuilder, SlashCommandSubcommandsOnlyBuilder } from "discord.js";

export interface CommandBase {
	name: string,
	description: string,
}

export interface Command extends CommandBase {
	slash?: SlashCommandBuilder | Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'> | SlashCommandSubcommandsOnlyBuilder
	
	aliases?: string[],
	usage?: string,
	permissions?: bigint,
	adminRoleOverride?: boolean,
	access: CommandAccess,
	type: CommandType,
	
	execute: Function
}

export interface SubCommand extends CommandBase {
	slash?: SlashCommandSubcommandBuilder | ((group: SlashCommandSubcommandBuilder) => SlashCommandSubcommandBuilder),
	execute: Function
}

export interface CommandGroupSettings extends CommandBase {
	slash?: SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder;

	permissions?: bigint,
	adminRoleOverride?: boolean,
	access?: CommandAccess,
	type?: CommandType,
	
	execute?: Function,
	addSubcommand?: (subCommand: SubCommand) => void,
}

export class CommandGroup implements CommandGroupSettings {
	declare public name: string;
	declare public description: string;
	declare public access: CommandAccess;
	declare public type: CommandType;
	declare public permissions?: bigint;

	declare public slash: SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder;

	declare private selfExecute: Function;
	declare private subcommands: Record<string, SubCommand>;

	constructor(settings: CommandGroupSettings) {
		this.name = settings.name;
		this.description = settings.description;

		this.access = settings.access ?? CommandAccess.Everywhere;
		this.type = settings.type ?? CommandType.Slash;
		this.permissions = settings.permissions;

		this.slash = settings.slash ?? new SlashCommandBuilder()
			.setName(this.name)
			.setDescription(this.description);

		this.selfExecute = settings.execute ?? (() => undefined);
		this.subcommands = {};
	}

	public execute(interaction: Interaction, ...args: unknown[]) {
		if (!interaction.isChatInputCommand()) {
			return this.selfExecute(interaction, ...args);
		}
		
		const category = interaction.options.getSubcommand() ?? '';

		if (!category) {
			return this.selfExecute(interaction, ...args);
		}

		this.subcommands[category]?.execute(interaction, ...args);
	}

	public addSubcommand(subCommand: SubCommand) {
		subCommand.slash ??= new SlashCommandSubcommandBuilder()
			.setName(subCommand.name)
			.setDescription(subCommand.description);

		const slash = subCommand.slash;

		if (typeof slash === 'object') {
			if (!slash.name) slash.setName(subCommand.name);
			if (!slash.description) slash.setDescription(subCommand.description);
		}

		this.slash.addSubcommand(slash);
		this.subcommands[subCommand.name] = subCommand;
	}
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
