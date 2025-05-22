import { UserSettings } from 'api/elite.js';
import { CommandAccess, CommandType, EliteCommand, SlashCommandOptionType } from 'classes/commands/index.js';
import {
	ActionRowBuilder,
	AutocompleteInteraction,
	ButtonBuilder,
	ButtonStyle,
	ChatInputCommandInteraction,
	ContainerBuilder,
	MessageActionRowComponentBuilder,
	StringSelectMenuBuilder,
	StringSelectMenuOptionBuilder,
	TextDisplayBuilder,
} from 'discord.js';
import { DepthStriderLevels, MinecraftVersion, farmDesigns } from 'farming-weight';

const command = new EliteCommand({
	name: 'info',
	description: 'Get info about a farm design!',
	access: CommandAccess.Everywhere,
	type: CommandType.Slash,
	subCommand: true,
	options: {
		design: {
			name: 'design',
			description: 'Select a farm design!',
			type: SlashCommandOptionType.String,
			required: true,
			autocomplete: autocomplete,
		},
	},
	execute: execute,
});

async function autocomplete(interaction: AutocompleteInteraction) {
	if (interaction.responded) return;

	const option = interaction.options.getFocused(true);
	const options = farmDesigns.map(([key, data]) => ({ name: data.name, value: key }));
	if (!options) return;

	const input = option.value.toLowerCase();

	const filtered = options.filter((opt) => opt.name.toLowerCase().startsWith(input));

	await interaction.respond(filtered);
}

export default command;

async function execute(interaction: ChatInputCommandInteraction, settings?: UserSettings) {
	const components = [
		new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent('stuff goes here')),
		new ContainerBuilder()
			.addTextDisplayComponents(new TextDisplayBuilder().setContent('Settings'))
			.addActionRowComponents(
				new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
					new StringSelectMenuBuilder()
						.setCustomId('depth_strider')
						.setPlaceholder('Select the depth strider level you use')
						.addOptions(
							new StringSelectMenuOptionBuilder().setLabel('Depth Strider 1').setValue('1'),
							new StringSelectMenuOptionBuilder().setLabel('Depth Strider 2').setValue('2'),
							new StringSelectMenuOptionBuilder().setLabel('Depth Strider 3').setValue('3'),
						),
				),
			)
			.addActionRowComponents(
				new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
					new StringSelectMenuBuilder()
						.setCustomId('direction')
						.setPlaceholder('Select the direction your farm faces')
						.addOptions(
							new StringSelectMenuOptionBuilder().setLabel('North').setValue('North'),
							new StringSelectMenuOptionBuilder().setLabel('South').setValue('South'),
							new StringSelectMenuOptionBuilder().setLabel('East').setValue('East'),
							new StringSelectMenuOptionBuilder().setLabel('West').setValue('West'),
						),
				),
			)
			.addActionRowComponents(
				new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
					new StringSelectMenuBuilder()
						.setCustomId('version')
						.setPlaceholder('Select Minecaft version')
						.addOptions(
							new StringSelectMenuOptionBuilder().setLabel('1.8.9').setValue('1.8.9'),
							new StringSelectMenuOptionBuilder().setLabel('1.21').setValue('1.21'),
						),
				),
			)
			.addActionRowComponents(
				new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
					new ButtonBuilder().setStyle(ButtonStyle.Secondary).setLabel('Remember my choices').setCustomId('save'),
				),
			),
	];

	await interaction
		.reply({
			components: components,
			allowedMentions: { repliedUser: false },
		})
		.catch(() => undefined);
}

async function calcSpeed(
	currentSpeed: number,
	usesSoulSand?: boolean,
	designVersion?: MinecraftVersion,
	targetVersion?: MinecraftVersion,
	currentDepthStrider?: DepthStriderLevels,
	targetDepthStrider?: DepthStriderLevels,
): Promise<number> {
	const versionMultiplier = {
		'1.8.9': 0.4,
		'1.21': 0.5,
	};

	let speed = currentSpeed;

	if (currentDepthStrider && targetDepthStrider) {
		speed *= targetDepthStrider / currentDepthStrider;
	}

	if (usesSoulSand && designVersion && targetVersion) {
		speed *= versionMultiplier[targetVersion] / versionMultiplier[designVersion];
	}

	return speed;
}
