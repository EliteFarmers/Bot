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
	SeparatorBuilder,
	SeparatorSpacingSize,
	StringSelectMenuBuilder,
	StringSelectMenuOptionBuilder,
	TextDisplayBuilder,
} from 'discord.js';
import { DepthStriderLevels, Direction, MinecraftVersion, farmDesigns, farmInfo, farmsData } from 'farming-weight';
import { $ZodAny } from 'zod/v4/core';

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
	const design = farmsData.chisslMelon;
	const depthStriderLevel = 1 as DepthStriderLevels;
	const orienation = 'North' as Direction;
	const version = '1.8.9' as MinecraftVersion;

	const speed = await calcSpeed(
		design.speed,
		version,
		depthStriderLevel,
	);

	const blocksPerSecond = await calcBlocksPerSecond(
		speed,
		design.angle.yaw,
	);

	const farmInfoComponent = new ContainerBuilder()
		.addTextDisplayComponents(new TextDisplayBuilder().setContent(`# ${design.name}`))
		.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(
				`Yaw: ${design.angle.yaw}, Pitch: ${design.angle.pitch}\nSpeed: ${speed}, Depth strider level: ${depthStriderLevel}`,
			),
		)
		.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
		.addTextDisplayComponents(new TextDisplayBuilder().setContent(`bps: ${design.bps}\nLane time: ${480 / blocksPerSecond}\nKeys used: `))
		.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
		.addTextDisplayComponents(
			// todo: dont have field/value if there isnt an example
			new TextDisplayBuilder().setContent(
				`Tutorial video: ${design.tutorials?.video ?? 'n/a'}\nDiscussion thread: ${design.tutorials?.thread ?? 'n/a'}\nVisitable  example: ${design.tutorials?.garden ?? 'n/a'}`,
			),
		)
		.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
		.addTextDisplayComponents(
			// todo: dont have field if there isnt any authors
			new TextDisplayBuilder().setContent(`-# Authors: ${design.authors?.join(', ') ?? 'n/a'}`),
		);

	const settingsComponent = new ContainerBuilder()
		.addTextDisplayComponents(new TextDisplayBuilder().setContent('# Settings'))
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
		);

	await interaction
		.reply({
			components: [farmInfoComponent, settingsComponent],
			allowedMentions: { repliedUser: false },
		})
		.catch(() => undefined);
}

async function calcSpeed(
	designSpeed: farmInfo["speed"],
	targetVersion?: MinecraftVersion,
	targetDepthStrider?: DepthStriderLevels,
): Promise<number> {
	const versionMultiplier = {
		'1.8.9': 0.4,
		'1.21': 0.5,
	};

	let speed = designSpeed.speed;

	if (designSpeed.depthStrider && targetDepthStrider) {
		speed *= targetDepthStrider / designSpeed.depthStrider;
	}

	if (designSpeed.soulSand && designSpeed.buildVersion && targetVersion) {
		speed *= versionMultiplier[targetVersion] / versionMultiplier[designSpeed.buildVersion];
	}

	return speed;
}

async function calcBlocksPerSecond(speed: number, yaw: number): Promise<number> {
	if (speed <= 0) return Infinity;

	yaw = ((yaw % 360) + 360) % 360;

	const angleOffset = yaw % 90;
	const effectiveSpeed = angleOffset === 0 ? speed : speed * Math.cos((angleOffset * Math.PI) / 180);

	// https://minecraft.fandom.com/wiki/Walking
	return effectiveSpeed * 4.317 / 100;
}
