import {
	AutocompleteInteraction,
	SlashCommandAttachmentOption,
	SlashCommandBooleanOption,
	SlashCommandChannelOption,
	SlashCommandIntegerOption,
	SlashCommandMentionableOption,
	SlashCommandNumberOption,
	SlashCommandRoleOption,
	SlashCommandStringOption,
	SlashCommandUserOption,
} from 'discord.js';

export type AutocompleteHandler = (interaction: AutocompleteInteraction) => Promise<void>;

export interface EliteCommandOption {
	name: string;
	description: string;
	required?: boolean;
	alternative?: string;
}

export enum SlashCommandOptionType {
	Boolean,
	Integer,
	Number,
	User,
	Channel,
	Role,
	Attachment,
	Mentionable,
	String,
}

export type EliteSlashCommandOption =
	| EliteSlashCommandOptionType<SlashCommandOptionType.Integer, SlashCommandIntegerOption, true>
	| EliteSlashCommandOptionType<SlashCommandOptionType.Number, SlashCommandNumberOption, true>
	| EliteSlashCommandOptionType<SlashCommandOptionType.String, SlashCommandStringOption, true>
	| EliteSlashCommandOptionType<SlashCommandOptionType.Boolean, SlashCommandBooleanOption>
	| EliteSlashCommandOptionType<SlashCommandOptionType.User, SlashCommandUserOption>
	| EliteSlashCommandOptionType<SlashCommandOptionType.Channel, SlashCommandChannelOption>
	| EliteSlashCommandOptionType<SlashCommandOptionType.Role, SlashCommandRoleOption>
	| EliteSlashCommandOptionType<SlashCommandOptionType.Attachment, SlashCommandAttachmentOption>
	| EliteSlashCommandOptionType<SlashCommandOptionType.Mentionable, SlashCommandMentionableOption>;

type EliteSlashCommandOptionType<Type, OptionType, Autocomplete = false> = EliteCommandOption & {
	type: Type;
	builder?: (builder: OptionType) => OptionType;
	autocomplete?: Autocomplete extends true ? AutocompleteHandler : undefined;
};
