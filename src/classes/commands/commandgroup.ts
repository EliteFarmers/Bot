import {
	BaseInteraction,
	Interaction,
	PermissionsBitField,
	RESTPostAPIApplicationCommandsJSONBody,
	SlashCommandBuilder,
	SlashCommandSubcommandBuilder,
	SlashCommandSubcommandsOnlyBuilder,
} from 'discord.js';
import { CommandAccess, CommandGroupSettings, CommandType, SubCommand } from './index.js';

export class CommandGroup implements CommandGroupSettings {
	public declare name: string;
	public declare description: string;
	public declare access: CommandAccess;
	public declare type: CommandType;
	public declare permissions?: bigint;
	public declare fetchSettings?: boolean | undefined;

	public declare slash: SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder;

	private declare selfExecute: Function;
	private declare subcommands: Record<string, SubCommand>;

	constructor(settings: CommandGroupSettings) {
		this.name = settings.name;
		this.description = settings.description;
		this.fetchSettings = settings.fetchSettings ?? false;

		this.access = settings.access ?? CommandAccess.Everywhere;
		this.type = settings.type ?? CommandType.Slash;
		this.permissions = settings.permissions;

		this.slash = settings.slash ?? new SlashCommandBuilder().setName(this.name);
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
		if (
			this.type !== CommandType.Slash &&
			this.type !== CommandType.Combo &&
			this.type !== CommandType.UserContextMenu
		) {
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
