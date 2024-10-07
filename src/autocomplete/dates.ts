import { AutocompleteInteraction, SlashCommandIntegerOption } from 'discord.js';
import { SkyBlockTime } from 'farming-weight';

export function yearOption(description = 'The skyblock year to get results for!', required = false) {
	return (builder: SlashCommandIntegerOption) =>
		builder.setName('year').setDescription(description).setAutocomplete(true).setMinValue(100).setRequired(required);
}

export function monthOption(description = 'The skyblock month to get results for!', required = false) {
	return (builder: SlashCommandIntegerOption) =>
		builder
			.setName('month')
			.setDescription(description)
			.setMinValue(1)
			.setMaxValue(12)
			.setChoices(SkyBlockTime.MonthNames.map((name, i) => ({ name, value: i + 1 })))
			.setRequired(required);
}

export function dayOption(description = 'The skyblock day to get results for!', required = false) {
	return (builder: SlashCommandIntegerOption) =>
		builder.setName('day').setDescription(description).setMinValue(1).setMaxValue(31).setRequired(required);
}

export async function yearAutocomplete(interaction: AutocompleteInteraction) {
	if (interaction.responded) return;

	const option = interaction.options.getFocused(true);

	if (!option || option.name !== 'year') return;

	const year = option.value.replace(/[^0-9]/g, '') || '';
	const currentYear = SkyBlockTime.now.year;
	const yearNum = +year;

	if (!year || isNaN(yearNum) || yearNum > currentYear) {
		const values = Array.from({ length: 5 }, (_, i) => ({
			name: (currentYear - i).toString(),
			value: (currentYear - i).toString(),
		}));

		interaction.respond(values);
		return;
	}

	const values = Array.from({ length: 5 }, (_, i) => ({
		name: (yearNum + i).toString(),
		value: (yearNum + i).toString(),
	}));

	interaction.respond(values);
}
