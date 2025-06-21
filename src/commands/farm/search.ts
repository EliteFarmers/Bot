import { UserSettings } from 'api/elite.js';
import { eliteCropOption } from 'autocomplete/crops.js';
import { CommandAccess, CommandType, EliteCommand } from 'classes/commands/index.js';
import { EliteContainer } from 'classes/components.js';
import { NotYoursReply } from 'classes/embeds.js';
import { CROP_ARRAY } from 'classes/Util.js';
import { ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, MessageFlags, SectionBuilder } from 'discord.js';
import { farmsData, getCropDisplayName } from 'farming-weight';
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

	const crop = CROP_ARRAY[parseInt(interaction.options.getString('crop', false)!)];

	const farms = Object.fromEntries(
		Object.entries(farmsData)
			.filter(([, farm]) => farm.crops.includes(crop))
			.sort(([, a], [, b]) => b.bps - a.bps),
	);

	const component = new EliteContainer(settings).addTitle(`# Farm designs for ${getCropDisplayName(crop)}`);

	Object.entries(farms).forEach(([id, data], i) => {
		if (i !== 0) {
			component.addSeparator();
		}

		component
			.addDescription(`### ${data.name}`)
			.addSectionComponents(
				new SectionBuilder()
					.addTextDisplayComponents((t) => t.setContent(`bps: ${data.bps}`))
					.setButtonAccessory(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setLabel(data.name).setCustomId(id)),
			);
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

		await farmInfoCommand(interaction, settings, inter.customId, true);

		collector.stop();

		return;
	});
}
