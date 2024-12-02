// This is to allow the generic "Function" to be used, as it's the easiest way to allow both types of commands
/* eslint-disable @typescript-eslint/ban-types */
import {
	ApplicationCommandType,
	ApplicationIntegrationType,
	AutocompleteInteraction,
	ContextMenuCommandBuilder,
	ContextMenuCommandType,
	InteractionContextType,
	PermissionsBitField,
	SharedNameAndDescription,
	SlashCommandBuilder,
	SlashCommandOptionsOnlyBuilder,
	SlashCommandSubcommandBuilder,
	SlashCommandSubcommandsOnlyBuilder,
} from 'discord.js';
import {
	ButtonCommand,
	Command,
	CommandAccess,
	CommandBase,
	CommandGroup,
	CommandType,
	ContextMenuCommand,
	EliteSlashCommandOption,
	SlashCommand,
	SlashCommandOptionType,
	SubCommand,
} from './index.js';

export class EliteCommand implements CommandBase {
	declare slash?:
		| SlashCommandBuilder
		| SlashCommandOptionsOnlyBuilder
		| ContextMenuCommandBuilder
		| SlashCommandSubcommandsOnlyBuilder
		| SlashCommandSubcommandBuilder;
	declare permissions?: bigint | undefined;
	declare adminRoleOverride?: boolean | undefined;
	declare access: CommandAccess[];
	declare type: CommandType;
	declare execute: Function;
	declare name: string;
	declare description: string;
	declare fetchSettings?: boolean | undefined;
	declare options?: Record<string, EliteSlashCommandOption>;
	declare subCommand: boolean;
	declare parent?: CommandGroup;

	get displayName() {
		return this.parent ? this.parent?.name + ' ' + this.name : this.name;
	}

	constructor(settings: Command) {
		this.name = settings.name;
		this.description = settings.description;
		this.fetchSettings = settings.fetchSettings ?? false;

		this.access = settings.access instanceof Array ? settings.access : [settings.access];
		this.type = settings.type;
		this.permissions = settings.permissions;
		this.adminRoleOverride = settings.adminRoleOverride;

		this.execute = settings.execute;

		if ('slash' in settings) {
			this.slash = settings.slash;
		}

		if ('subCommand' in settings) {
			this.subCommand = settings.subCommand ?? false;
		} else {
			this.subCommand = false;
		}

		if ('options' in settings) {
			this.options = settings.options;
		}

		this.buildSlashCommand();
	}

	public getAutocomplete(interaction: AutocompleteInteraction) {
		const focused = interaction.options.getFocused(true);
		if (!focused) undefined;

		return this.options?.[focused.name]?.autocomplete;
	}

	public isChatInputCommand(): this is SlashCommand {
		return this.type === CommandType.Slash || this.type === CommandType.GuildSlash || this.type === CommandType.Combo;
	}

	public isSubCommand(): this is SubCommand {
		return this.subCommand;
	}

	public isContextMenuCommand(): this is ContextMenuCommand {
		return this.type === CommandType.UserContextMenu || this.type === CommandType.MessageContextMenu;
	}

	public isButtonCommand(): this is ButtonCommand {
		return this.type === CommandType.Button;
	}

	public setParent(parent: CommandGroup) {
		this.parent = parent;
	}

	public buildSlashCommand() {
		if (this.isSubCommand()) {
			this.buildChatSlashSubCommand();
			return this.slash;
		}

		if (this.isChatInputCommand()) {
			this.buildChatSlashCommand();
			return this.slash;
		}

		if (this.isContextMenuCommand()) {
			this.buildContextMenuCommand();
			return this.slash;
		}

		if (!this.slash) return undefined;

		return undefined;
	}

	private buildChatSlashCommand() {
		if (!this.isChatInputCommand()) return;

		this.slash ??= new SlashCommandBuilder();
		this.slash.setName(this.name).setDescription(this.description);

		if (!this.isSubCommand()) {
			EliteCommand.setCommandAccess(this.slash, this.access);
		}

		if (this.permissions) {
			this.slash.setDefaultMemberPermissions(PermissionsBitField.resolve(this.permissions));
		}

		for (const option in this.options ?? {}) {
			const opt = this.options?.[option];
			if (!opt) continue;
			this.buildSlashCommandOption(opt);
		}
	}

	private buildChatSlashSubCommand() {
		this.slash ??= new SlashCommandSubcommandBuilder();
		this.buildChatSlashCommand();
	}

	private buildSlashCommandOption(option: EliteSlashCommandOption) {
		if (!this.isChatInputCommand() || !this.slash) return;

		switch (option.type) {
			case SlashCommandOptionType.String:
				this.slash.addStringOption((opt) => {
					setNameAndDescription(opt, option);
					opt.setRequired(option.required ?? false);
					opt.setAutocomplete(option.autocomplete !== undefined);
					option.builder?.(opt);
					return opt;
				});
				break;
			case SlashCommandOptionType.Integer:
				this.slash.addIntegerOption((opt) => {
					setNameAndDescription(opt, option);
					opt.setRequired(option.required ?? false);
					opt.setAutocomplete(option.autocomplete !== undefined);
					option.builder?.(opt);
					return opt;
				});
				break;
			case SlashCommandOptionType.Number:
				this.slash.addNumberOption((opt) => {
					setNameAndDescription(opt, option);
					opt.setRequired(option.required ?? false);
					opt.setAutocomplete(option.autocomplete !== undefined);
					option.builder?.(opt);
					return opt;
				});
				break;
			case SlashCommandOptionType.Boolean:
				this.slash.addBooleanOption((opt) => {
					setNameAndDescription(opt, option);
					opt.setRequired(option.required ?? false);
					option.builder?.(opt);
					return opt;
				});
				break;
			case SlashCommandOptionType.User:
				this.slash.addUserOption((opt) => {
					setNameAndDescription(opt, option);
					opt.setRequired(option.required ?? false);
					option.builder?.(opt);
					return opt;
				});
				break;
			case SlashCommandOptionType.Channel:
				this.slash.addChannelOption((opt) => {
					setNameAndDescription(opt, option);
					opt.setRequired(option.required ?? false);
					option.builder?.(opt);
					return opt;
				});
				break;
			case SlashCommandOptionType.Role:
				this.slash.addRoleOption((opt) => {
					setNameAndDescription(opt, option);
					opt.setRequired(option.required ?? false);
					option.builder?.(opt);
					return opt;
				});
				break;
			case SlashCommandOptionType.Mentionable:
				this.slash.addMentionableOption((opt) => {
					setNameAndDescription(opt, option);
					opt.setRequired(option.required ?? false);
					option.builder?.(opt);
					return opt;
				});
				break;
			case SlashCommandOptionType.Attachment:
				this.slash.addAttachmentOption((opt) => {
					setNameAndDescription(opt, option);
					opt.setRequired(option.required ?? false);
					option.builder?.(opt);
					return opt;
				});
				break;
			default:
				break;
		}

		function setNameAndDescription(builder: SharedNameAndDescription, option: EliteSlashCommandOption) {
			return builder.setName(option.name).setDescription(option.description);
		}
	}

	private buildContextMenuCommand() {
		if (!this.isContextMenuCommand()) return;

		this.slash ??= new ContextMenuCommandBuilder();
		const type: ContextMenuCommandType =
			this.type === CommandType.UserContextMenu
				? (ApplicationCommandType.User as ContextMenuCommandType)
				: (ApplicationCommandType.Message as ContextMenuCommandType);

		this.slash.setName(this.name).setType(type);

		EliteCommand.setCommandAccess(this.slash, this.access);

		if (this.permissions) {
			this.slash.setDefaultMemberPermissions(PermissionsBitField.resolve(this.permissions));
		}
	}

	static setCommandAccess(
		slash: SlashCommandBuilder | ContextMenuCommandBuilder | SlashCommandSubcommandsOnlyBuilder,
		access: CommandAccess[],
	) {
		for (const a of access) {
			switch (a) {
				case CommandAccess.Everywhere:
					slash.setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall);
					slash.setContexts(
						InteractionContextType.Guild,
						InteractionContextType.BotDM,
						InteractionContextType.PrivateChannel,
					);
					break;
				case CommandAccess.Guild:
					slash.setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ...(slash.integration_types ?? []));
					slash.setContexts(InteractionContextType.Guild, ...(slash.contexts ?? []));
					break;
				case CommandAccess.BotDM:
					slash.setContexts(InteractionContextType.BotDM, ...(slash.contexts ?? []));
					break;
				case CommandAccess.PrivateMessages:
					slash.setContexts(InteractionContextType.PrivateChannel, ...(slash.contexts ?? []));
					slash.setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ...(slash.integration_types ?? []));
					break;
				default:
					break;
			}
		}
	}

	public toJSON() {
		return this.slash?.toJSON();
	}

	public getUsage(includeName = true) {
		const commandString = `**/${this.name}** - ${this.description}`;
		const options = Object.values(this.options ?? {});

		if (!options.length) return includeName ? commandString : 'Usage information not available.';

		const optionsString = options
			.map((option) => {
				return (
					'-# ' +
					(option.required ? `\`${option.name}\`` : `(\`${option.name}\`)`) +
					' - ' +
					option.description +
					(option.alternative ? `\n-# (${option.alternative})` : '')
				);
			})
			.join('\n');

		return includeName ? `${commandString}\n${optionsString}` : optionsString;
	}
}

export const getAutocomplete = getAutocompleteFunction;
export async function getAutocompleteFunction(cmd: EliteCommand | CommandGroup, interaction: AutocompleteInteraction) {
	if (cmd instanceof CommandGroup) {
		cmd.autocomplete(interaction);
		return undefined;
	}

	const auto = cmd.getAutocomplete(interaction);
	if (!auto) return undefined;

	return auto;
}
