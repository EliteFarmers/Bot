import {
	BaseInteraction,
	Interaction,
	PermissionsBitField,
	RESTPostAPIApplicationCommandsJSONBody,
	SlashCommandBuilder,
	SlashCommandSubcommandBuilder,
	SlashCommandSubcommandsOnlyBuilder,
} from 'discord.js';
import { CommandAccess, CommandType, EliteCommand, GroupCommand } from './index.js';

export class CommandGroup implements GroupCommand {
	public declare name: string;
	public declare description: string;
	public declare access: CommandAccess[];
	public declare permissions?: bigint;
	public declare type: CommandType.Group;
	public declare fetchSettings?: boolean | undefined;
	public declare adminRoleOverride?: boolean | undefined;

	public declare slash: SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder;

	private declare selfExecute: Function;
	public declare subcommands: Record<string, EliteCommand>;

	constructor(settings: GroupCommand) {
		this.name = settings.name;
		this.description = settings.description;
		this.fetchSettings = settings.fetchSettings ?? false;

		this.access = settings.access instanceof Array ? settings.access : [settings.access];
		this.type = CommandType.Group;
		this.permissions = settings.permissions;
		this.adminRoleOverride = settings.adminRoleOverride;

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

		const auto = this.subcommands[category]?.getAutocomplete(interaction);
		auto?.(interaction);
		return;
	}

	public addSubcommand(subCommand: EliteCommand) {
		if (!subCommand.isSubCommand() || !(subCommand.slash instanceof SlashCommandSubcommandBuilder)) {
			return;
		}

		if (!this.subcommands[subCommand.name]) {
			this.subcommands[subCommand.name] = subCommand;
			this.slash.addSubcommand(() => subCommand.slash as SlashCommandSubcommandBuilder);
			subCommand.setParent(this);
		}
	}

	public getCommandJSON(): RESTPostAPIApplicationCommandsJSONBody | undefined {
		this.slash ??= new SlashCommandBuilder();

		if (!this.slash.name) {
			this.slash.setName(this.name);
		}

		if ('setDescription' in this.slash && !this.slash.description) {
			this.slash.setDescription(this.description);
		}

		if (this.permissions) {
			this.slash.setDefaultMemberPermissions(PermissionsBitField.resolve(this.permissions));
		}

		EliteCommand.setCommandAccess(this.slash, this.access);

		return this.slash.toJSON();
	}
}
