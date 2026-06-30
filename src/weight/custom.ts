import {
	FarmingWeightDto,
	MinecraftAccountDto,
	WeightStyleListDto,
	WeightStyleWithDataDtoImageRefs,
} from 'api/schemas';
import { AttachmentBuilder, EmbedBuilder } from 'discord.js';
import { FetchWeightStyles, UserSettings } from '../api/elite';
import { ErrorEmbed } from '../classes/embeds';
import { validStyle, WeightStyle } from '../schemas/style';
import { DEFAULT_STYLE } from './defaultstyle';
import { createWeightEmbed } from './embed';
import { createFromData } from './maker';

export interface CustomFormatterOptions {
	settings?: UserSettings;
	account: MinecraftAccountDto;
	profile: FarmingWeightDto;
	profileId: string;
	badgeUrl?: string;
	weightRank?: number;
	data?: WeightStyle;
	imageRefs?: WeightStyleWithDataDtoImageRefs;
}
type CustomFormatter = (
	opt: CustomFormatterOptions,
) => Promise<AttachmentBuilder | EmbedBuilder | null> | AttachmentBuilder | EmbedBuilder | null;

const formatters: Record<string, CustomFormatter> = {
	embed: createWeightEmbed,
	data: createFromData,
};

// import * as TestStyle from './testing.json';

let stylesCache: Record<number, WeightStyleListDto> = {};

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
		options.imageRefs = stylesCache[styleId ?? -1]?.imageRefs;
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

	const newStyles = styles?.reduce<Record<number, WeightStyleListDto>>((acc, style) => {
		if (!style.id || !validStyle(style.data)) return acc;
		acc[style.id] = style;
		return acc;
	}, {});

	if (!newStyles) return;

	stylesCache = newStyles;
}
