import { UserSettings } from 'api/elite.js';
import { eliteCropOption } from 'autocomplete/crops.js';
import { CommandAccess, CommandType, EliteCommand, SlashCommandOptionType } from 'classes/commands/index.js';
import { EliteContainer } from 'classes/components.js';
import { ChatInputCommandInteraction } from 'discord.js';
import { farmsData, getCropFromName } from 'farming-weight';

const command = new EliteCommand({
	name: 'search',
	description: 'Search for a farm design!',
	access: CommandAccess.Everywhere,
	type: CommandType.Slash,
	subCommand: true,
	options: {
		crop: eliteCropOption,
	},
	execute: execute,
});

export default command;

async function execute(interaction: ChatInputCommandInteraction, settings?: UserSettings) {
	const cropName = interaction.options.getString('crop', false);
	if (!cropName) return;
	const crop = getCropFromName(cropName);
	if (!crop) return;

	const farms = Object.fromEntries(
		Object.entries(farmsData)
			.filter(([, farm]) => farm.crops.includes(crop))
			.sort(([, a], [, b]) => b.bps - a.bps),
	);

	const component = new EliteContainer(settings).addTitle(`# Farm designs for ${cropName}`);

	Object.entries(farms).forEach(([, data], i) => {
		if (i !== 1) {
			component.addSeperator();
		}

		component.addDescription(`### ${data.name}`).addDescription(`bps: ${data.bps}`);
	});

	await interaction
		.reply({
			components: [component],
			allowedMentions: { repliedUser: false },
		})
		.catch(() => undefined);
}
