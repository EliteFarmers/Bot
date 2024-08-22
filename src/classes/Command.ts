// This is to allow the generic "Function" to be used, as it's the easiest way to allow both types of commands
/* eslint-disable @typescript-eslint/ban-types */
import { AutocompleteInteraction, BaseInteraction, Client, ContextMenuCommandBuilder, Interaction, PermissionsBitField, RESTPostAPIApplicationCommandsJSONBody, SlashCommandBuilder, SlashCommandOptionsOnlyBuilder, SlashCommandSubcommandBuilder, SlashCommandSubcommandsOnlyBuilder } from "discord.js";
import fs from 'fs';

export interface CommandBase {
	name: string,
	description: string,
	fetchSettings?: boolean
}

export type AutocompleteHandler = (interaction: AutocompleteInteraction) => Promise<void>;

export interface Command extends CommandBase {
	slash?: SlashCommandBuilder | ContextMenuCommandBuilder | Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'> | SlashCommandSubcommandsOnlyBuilder | SlashCommandOptionsOnlyBuilder,
	
	aliases?: string[],
	usage?: string,
	permissions?: bigint,
	adminRoleOverride?: boolean,
	access: CommandAccess,
	type: CommandType,
	
	execute: Function
	autocomplete?: AutocompleteHandler | Record<string, AutocompleteHandler>
}

export interface SubCommand extends CommandBase {
	slash?: SlashCommandSubcommandBuilder | ((group: SlashCommandSubcommandBuilder) => SlashCommandSubcommandBuilder),
	execute: Function,
	autocomplete?: AutocompleteHandler | Record<string, AutocompleteHandler>
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
	declare public fetchSettings?: boolean | undefined;

	declare public slash: SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder;

	declare private selfExecute: Function;
	declare private subcommands: Record<string, SubCommand>;

	constructor(settings: CommandGroupSettings) {
		this.name = settings.name;
		this.description = settings.description;
		this.fetchSettings = settings.fetchSettings ?? false;

		this.access = settings.access ?? CommandAccess.Everywhere;
		this.type = settings.type ?? CommandType.Slash;
		this.permissions = settings.permissions;

		this.slash = settings.slash ?? new SlashCommandBuilder()
			.setName(this.name);
		// .setDescription(this.description);

		this.selfExecute = settings.execute ?? (() => undefined);
		this.subcommands = {};
	}

	public execute(interaction: BaseInteraction, ...args: unknown[]) {
		if (!interaction.isChatInputCommand()) {
			return this.selfExecute(interaction, ...args);
		}
		
		const category = interaction.options.getSubcommand() ?? '';

		if (!category) {
			return this.selfExecute(interaction, ...args);
		}

		this.subcommands[category]?.execute(interaction, ...args);
	}

	public autocomplete(interaction: Interaction, ...args: unknown[]) {
		if (!interaction.isAutocomplete()) {
			return this.selfExecute(interaction, ...args);
		}
		
		const category = interaction.options.getSubcommand() ?? '';
		const auto = this.subcommands[category]?.autocomplete;
		if (!auto) return;

		if (typeof auto === 'function') {
			auto(interaction);
			return;
		}
		
		const focused = interaction.options.getFocused(true);
		if (!focused) return;

		auto[focused.name]?.(interaction);
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

	public getCommandJSON(): RESTPostAPIApplicationCommandsJSONBody | undefined {
		if (this.type !== CommandType.Slash && this.type !== CommandType.Combo && this.type !== CommandType.ContextMenu) {
			return;
		}
		
		this.slash ??= new SlashCommandBuilder();
		const slash = this.slash;
	
		if (!slash.name) {
			slash.setName(this.name);
		}
	
		if ('setDescription' in slash && !slash.description) {
			slash.setDescription(this.description);
		}
		
		if (this.permissions) {
			slash.setDefaultMemberPermissions(PermissionsBitField.resolve(this.permissions));
		}

		return this.slash.toJSON();
	}
}

export enum CommandType {
	Slash,
	GuildSlash,
	Button,
	Combo,
	Autocomplete,
	ContextMenu
}

export enum CommandAccess {
	Everywhere,
	Guild,
	DirectMessage
}

export interface CronTask {
	cron: string, 
	execute: (client: Client) => void
}

export async function registerFiles<T>(folder: string, filter: (fileName: string) => boolean, callback: (data: T) => void) {
	const files = fs.readdirSync(`./src/${folder}`);
	
	for (const file of files.filter(filter)) {
		const imported = await import(`../${folder}/${file.replace('.ts', '.js')}`);
		callback(imported.default);
	}
}

export async function registerCommandGroups(folder: string, callback: (folder: string, group: CommandGroupSettings) => void) {
	const files = fs.readdirSync(`./src/${folder}`).filter(fileName => fs.lstatSync(`./src/${folder}/${fileName}`).isDirectory());

	for (const file of files) {
		const imported = await import(`../${folder}/${file}/command.js`);
		callback(`${folder}/${file}`, imported.default);
	}
}

export async function getAutocomplete(cmd: Command | CommandGroup, interaction: AutocompleteInteraction) {
	if (cmd instanceof CommandGroup) {
		cmd.autocomplete(interaction);
		return undefined;
	}

	const auto = cmd.autocomplete;
	if (!auto) return undefined;

	if (typeof auto === 'function') {
		return auto
	}

	const focused = interaction.options.getFocused(true);
	if (!focused) undefined;

	return auto[focused.name];
}