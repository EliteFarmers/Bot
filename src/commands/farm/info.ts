import { UserSettings } from 'api/elite.js';
import { CommandAccess, CommandType, EliteCommand, SlashCommandOptionType } from 'classes/commands/index.js';
import { EliteContainer } from 'classes/components.js';
import {
	ActionRowBuilder,
	AutocompleteInteraction,
	ButtonBuilder,
	ButtonStyle,
	ChatInputCommandInteraction,
	MessageActionRowComponentBuilder,
	StringSelectMenuBuilder,
	StringSelectMenuOptionBuilder,
} from 'discord.js';
import {
	DepthStriderLevels,
	Direction,
	FarmingMethod,
	MinecraftVersion,
	ResourceType,
	farmDesigns,
	farmInfo,
	farmsData,
} from 'farming-weight';

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
	const design = farmsData[interaction.options.getString('design', false) ?? -1];
	if (!design) return;

	const depthStriderLevel = design.speed.depthStrider;
	const direction = 'North' as Direction;
	const version = '1.8.9' as MinecraftVersion;

	const resources = design.resources
		?.filter((r) => r.type !== ResourceType.Schematic)
		.map((r) => `${r.type}: ${r.source}`)
		.join('\n');

	const speed = await calcSpeed(design.speed, version, depthStriderLevel);

	const blocksPerSecond = await calcBlocksPerSecond(speed, design.angle.yaw, design.speed.method);

	const yaw = await fixDesignAngle(design.angle.yaw, direction);

	const farmInfoComponent = new EliteContainer(settings)
		.addTitle(`# ${design.name}`)
		.addDescription(`Yaw: ${yaw}, Pitch: ${design.angle.pitch}\nSpeed: ${speed}, Depth strider level: ${depthStriderLevel}`)
		.addSeperator()
		.addDescription(`bps: ${design.bps}\nLane time: ${480 / blocksPerSecond}\nKeys used: `);

	if (resources) {
		farmInfoComponent
			.addSeperator()
			.addDescription(resources);
	}

	if (design.authors) {
		farmInfoComponent
			.addSeperator()
			.addDescription(`-# Authors: ${design.authors.join(', ')}`);
	}

	farmInfoComponent.addFooter();

	const settingsComponent = new EliteContainer(settings)
		.addTitle('# Settings')
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
		.addFooter();

	await interaction
		.reply({
			components: [farmInfoComponent, settingsComponent],
			allowedMentions: { repliedUser: false },
		})
		.catch(() => undefined);
}

async function calcSpeed(
	designSpeed: farmInfo['speed'],
	targetVersion?: MinecraftVersion,
	targetDepthStrider?: DepthStriderLevels,
): Promise<number> {
	// todo: fix
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

async function calcBlocksPerSecond(speed: number, yaw: number, method: FarmingMethod): Promise<number> {
	if (method === 'running into wall' && yaw === 0) {
		speed *= 1.02042464775;
		yaw = 45;
	}

	const angleOffset = Math.abs(yaw) % 90;

	const effectiveSpeed = angleOffset === 0 ? speed : speed * Math.cos((angleOffset * Math.PI) / 180);

	// https://minecraft.fandom.com/wiki/Walking
	return (effectiveSpeed * 4.3171) / 100;
}

async function fixDesignAngle(designYaw: number, direction: Direction): Promise<number> {
	const yaw = designYaw + directionYawOffset('South', direction);

	return normalizeAngle(yaw);
}

function directionYawOffset(from: Direction, to: Direction): number {
	const yawMap: Record<Direction, number> = {
		North: 180,
		East: -90,
		South: 0,
		West: 90,
	};

	return normalizeAngle(yawMap[to] - yawMap[from]);
}

function normalizeAngle(angle: number) {
	return ((angle + 180) % 360) - 180;
}
