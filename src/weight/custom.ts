import { components } from "../api/api.js";
import { AttachmentBuilder, EmbedBuilder } from "discord.js";
import { createWeightEmbed } from "./embed.js";
import { UserSettings } from "../api/elite.js";
import { createFromData } from "./maker.js";
import { validStyle, WeightStyle } from "../schemas/style.js";
import { ErrorEmbed } from "../classes/embeds.js";

// Styles will be fetched from the API in the future
import * as DefaultStyle from './default.json';

export interface CustomFormatterOptions {
	settings?: UserSettings;
	account: components['schemas']['MinecraftAccountDto'];
	profile: components['schemas']['FarmingWeightDto'];
	profileId: string;
	badgeUrl?: string;
	weightRank?: number;
	data?: WeightStyle;
}
type CustomFormatter = (opt: CustomFormatterOptions) => Promise<AttachmentBuilder | EmbedBuilder | null> | AttachmentBuilder | EmbedBuilder | null;

const formatters: Record<string, CustomFormatter> = {
	'embed': createWeightEmbed,
	'default': createFromData,
	'data': createFromData
}

export function getCustomFormatter(options: CustomFormatterOptions, style: string | undefined = undefined): Promise<AttachmentBuilder | EmbedBuilder | null> | AttachmentBuilder | EmbedBuilder | null {
	const weightImage = style ?? options.account.settings?.features?.weightStyle ?? 'default';

	const formatter = formatters[weightImage] ?? createFromData;
	const selected = DefaultStyle;

	if (validStyle(selected)) {
		options.data = selected;
	} else {
		return ErrorEmbed('Invalid style data!', 'The style data provided from the server is invalid, this should be reported!\n' + `Style ID: \`${weightImage}\``);
	}

	return formatter(options);
}
