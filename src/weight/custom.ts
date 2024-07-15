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

export function getCustomFormatter(options: CustomFormatterOptions): Promise<AttachmentBuilder | EmbedBuilder | null> | AttachmentBuilder | EmbedBuilder | null {
	const weightImage = options.account.settings?.weightImage ?? 'embed';
	if (!weightImage) {
		return formatters['default'](options);
	}

	const formatter = formatters[weightImage];
	if (!formatter) {
		return formatters['default'](options);
	}

	return formatter(options);
}