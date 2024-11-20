import { AttachmentBuilder, EmbedBuilder } from 'discord.js';
import { components } from '../api/api.js';
import { FetchWeightStyles, UserSettings } from '../api/elite.js';
import { ErrorEmbed } from '../classes/embeds.js';
import { WeightStyle, validStyle } from '../schemas/style.js';
import { DEFAULT_STYLE } from './defaultstyle.js';
import { createWeightEmbed } from './embed.js';
import { createFromData } from './maker.js';

export interface CustomFormatterOptions {
	settings?: UserSettings;
	account: components['schemas']['MinecraftAccountDto'];
	profile: components['schemas']['FarmingWeightDto'];
	profileId: string;
	badgeUrl?: string;
	weightRank?: number;
	data?: WeightStyle;
}
type CustomFormatter = (
	opt: CustomFormatterOptions,
) => Promise<AttachmentBuilder | EmbedBuilder | null> | AttachmentBuilder | EmbedBuilder | null;

const formatters: Record<string, CustomFormatter> = {
	embed: createWeightEmbed,
	data: createFromData,
};

// import * as TestStyle from './testing.json';

let stylesCache: Record<number, components['schemas']['WeightStyleWithDataDto']> = {};

export function getCustomFormatter(
	options: CustomFormatterOptions,
	style: number | undefined = undefined,
): Promise<AttachmentBuilder | EmbedBuilder | null> | AttachmentBuilder | EmbedBuilder | null {
	let formatterName = 'data';
	const styleId = style ?? options.account.settings?.weightStyle?.id;

	// let styleData = TestStyle as unknown as WeightStyle;
	let styleData = DEFAULT_STYLE;
	if (styleId) {
		const cached = stylesCache[styleId];

		formatterName = cached?.styleFormatter ?? formatterName;
		styleData = (cached?.data as WeightStyle) ?? styleData;
	}

	const formatter = formatters[formatterName] ?? createFromData;
	const selected = styleData;

	if (validStyle(selected)) {
		options.data = selected;
	} else {
		return ErrorEmbed(
			'Invalid style data!',
			'The style data provided from the server is invalid, this should be reported!\n' + `Style ID: \`${styleId}\``,
		);
	}

	return formatter(options);
}

export async function LoadWeightStyles() {
	const { data: styles } = await FetchWeightStyles();

	const newStyles = styles?.reduce<Record<number, components['schemas']['WeightStyleWithDataDto']>>((acc, style) => {
		if (!style.id || !validStyle(style.data)) return acc;
		acc[style.id] = style;
		return acc;
	}, {});

	if (!newStyles) return;

	stylesCache = newStyles;
}
