// This is to allow the generic "Function" to be used, as it's the easiest way to allow both types of commands
/* eslint-disable @typescript-eslint/ban-types */
import { Interaction, SlashCommandBuilder, SlashCommandSubcommandBuilder, SlashCommandSubcommandsOnlyBuilder } from "discord.js";

export interface CommandBase {
	name: string,
	description: string,
	access: CommandAccess,
	type: CommandType,
	aliases?: string[],
	usage?: string,
	permissions?: bigint,
	adminRoleOverride?: boolean,
}

export interface Command extends CommandBase {
	slash?: SlashCommandBuilder | Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'> | SlashCommandSubcommandsOnlyBuilder
	execute: Function
}

export interface SubCommand extends CommandBase {
	slash?: SlashCommandSubcommandBuilder | ((group: SlashCommandSubcommandBuilder) => SlashCommandSubcommandBuilder),
	execute: Function
}

export interface CommandGroupSettings extends CommandBase {
	slash?: SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder;
	execute?: Function,
	addSubcommand?: (subCommand: SubCommand) => void,
}
export class CommandGroup implements CommandGroupSettings {
	declare public name: string;
	declare public description: string;
	declare public access: CommandAccess;
	declare public type: CommandType;
	declare public aliases?: string[];
	declare public usage?: string;
	declare public permissions?: bigint;
	declare public slash: SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder;

	declare private selfExecute: Function;
	declare private subcommands: Record<string, SubCommand>;

	constructor(settings: CommandGroupSettings) {
		this.name = settings.name;
		this.description = settings.description;
		this.access = settings.access;
		this.type = settings.type;
		this.aliases = settings.aliases;
		this.usage = settings.usage;
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

		console.log(`Added subcommand ${subCommand.name} to ${this.name}`);
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
