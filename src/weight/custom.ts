import { components } from "../api/api.js";
import { AttachmentBuilder, EmbedBuilder } from "discord.js";
import { createDefaultWeightImage } from "./default.js";
import { createWeightEmbed } from "./embed.js";

export interface CustomFormatterOptions {
	account: components['schemas']['MinecraftAccountDto'];
	profile: components['schemas']['FarmingWeightDto'];
	profileId: string;
	badgeUrl?: string;
	weightRank?: number;
}
type CustomFormatter = (opt: CustomFormatterOptions) => Promise<AttachmentBuilder | EmbedBuilder | null> | AttachmentBuilder | EmbedBuilder | null;

const formatters: Record<string, CustomFormatter> = {
	'embed': createWeightEmbed,
	'default': createDefaultWeightImage
}

export function getCustomFormatter(options: CustomFormatterOptions, style: string | undefined = undefined): Promise<AttachmentBuilder | EmbedBuilder | null> | AttachmentBuilder | EmbedBuilder | null {
	const weightImage = style ?? options.account.settings?.features?.weightStyle ?? 'default';

	const formatter = formatters[weightImage];
	if (!formatter) {
		return createDefaultWeightImage(options);
	}

	return formatter(options);
}