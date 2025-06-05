import { UserSettings } from 'api/elite.js';
import { eliteCropOption } from 'autocomplete/crops.js';
import { CommandAccess, CommandType, EliteCommand, SlashCommandOptionType } from 'classes/commands/index.js';
import { EliteContainer } from 'classes/components.js';
import { NotYoursReply } from 'classes/embeds.js';
import { ButtonStyle, ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { farmsData, getCropFromName } from 'farming-weight';
import { execute as farmInfoCommand } from './info.js';

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
	await interaction.deferReply();

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

	Object.entries(farms).forEach(([id, data], i, arr) => {
		component
			.addDescription(`### ${data.name}`)
			.addDescription(`bps: ${data.bps}`, i < arr.length - 1, [data.name, id, ButtonStyle.Secondary]);
	});

	const reply = await interaction.editReply({
		components: [component],
		allowedMentions: { repliedUser: false },
		flags: [MessageFlags.IsComponentsV2],
	});

	const collector = reply.createMessageComponentCollector({
		time: 120_000,
	});

	collector.on('collect', async (inter) => {
		if (inter.user.id !== interaction.user.id) {
			return NotYoursReply(inter);
		}

		collector.resetTimer();

		await farmInfoCommand(interaction, settings, inter.customId);

		await inter.deleteReply();

		return;
	});
}
