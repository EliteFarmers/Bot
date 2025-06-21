import { CROP_ARRAY } from 'classes/Util.js';
import { EliteSlashCommandOption, SlashCommandOptionType } from 'classes/commands/options.js';
import { AutocompleteInteraction } from 'discord.js';
import { getCropDisplayName } from 'farming-weight';

export const eliteCropOption: EliteSlashCommandOption = {
	name: 'crop',
	description: 'The crop to get results for.',
	type: SlashCommandOptionType.String,
	required: true,
	autocomplete,
};

export async function autocomplete(interaction: AutocompleteInteraction) {
	if (interaction.responded) return;

	const option = interaction.options.getFocused(true);
	const options = CROP_ARRAY.map((v, i) => ({
		name: getCropDisplayName(v),
		value: i.toString(),
	}));
	if (!options) return;

	const input = option.value.toLowerCase();

	const filtered = options.filter((opt) => opt.name.toLowerCase().startsWith(input));

	await interaction.respond(filtered);
}
