import { FetchLeaderboardSlice, SearchUsers } from '#api/elite.js';
import { AutocompleteInteraction, SlashCommandStringOption } from 'discord.js';

export function playerOption(description = 'The player to get results for!', required = false) {
	return (builder: SlashCommandStringOption) => 
		builder.setName('player')
			.setDescription(description)
			.setAutocomplete(true)
			.setRequired(required);
}

export async function autocomplete(interaction: AutocompleteInteraction) {
	if (interaction.responded) return;

	const option = interaction.options.getFocused(true);

	if (!option || option.name !== 'player') return;

	const player = option.value.replace(/[^a-zA-Z0-9_]/g, '') || undefined;

	if (!player) {
		const { data: leaderboard } = await FetchLeaderboardSlice('farmingweight', 0, 10).catch(() => ({ data: undefined }));

		const values = leaderboard?.entries?.slice(0, 10).map((entry) => ({
			name: entry.ign ?? 'N/A',
			value: entry.ign ?? 'N/A',
		}));

		interaction.respond(values ?? [
			{
				name: 'No results found',
				value: 'No results found',
			}
		]);

		return;
	}

	const { data: search = [] } = await SearchUsers(player).catch(() => ({ data: undefined }));

	const values = search.map((name) => ({
		name: name,
		value: name,
	}));

	if (player) {
		values.unshift({
			name: player,
			value: player,
		});
	}

	interaction.respond(values.slice(0, 10));
}