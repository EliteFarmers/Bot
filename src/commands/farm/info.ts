import {
	ActionRowBuilder,
	AutocompleteInteraction,
	ButtonBuilder,
	ButtonStyle,
	ChatInputCommandInteraction,
	MessageActionRowComponentBuilder,
	MessageFlags,
	StringSelectMenuBuilder,
	StringSelectMenuOptionBuilder,
} from 'discord.js';
import { Direction, FARM_DESIGNS, FarmDesignInfo, FarmingMethod, MinecraftVersion, ResourceType } from 'farming-weight';
import { UserSettings } from '../../api/elite.js';
import { CommandAccess, CommandType, EliteCommand, SlashCommandOptionType } from '../../classes/commands/index.js';
import { EliteContainer } from '../../classes/components.js';
import { ErrorEmbed, NotYoursReply } from '../../classes/embeds.js';

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
	const options = Object.entries(FARM_DESIGNS).map(([key, data]) => ({
		name: data.name,
		value: key,
	}));
	if (!options) return;

	const input = option.value.toLowerCase();

	const filtered = options.filter((opt) => opt.name.toLowerCase().startsWith(input));

	await interaction.respond(filtered);
}

export default command;

interface FarmSettings {
	active: boolean;
	direction: Direction;
	version: MinecraftVersion;
}

const noDesign = ErrorEmbed('Design Not Found!').setDescription(
	"The design you're looking for doesn't exist! If you believe this to be a mistake or want a design added, make a suggestion in the discord.",
);

export async function execute(
	interaction: ChatInputCommandInteraction,
	settings?: UserSettings,
	designOverride?: string,
	skipDefer?: boolean,
) {
	if (!skipDefer) await interaction.deferReply();

	const farmSettings: FarmSettings = {
		active: true,
		direction: 'South',
		version: '1.8.9',
	};

	const designId = designOverride ?? interaction.options.getString('design', false) ?? '';
	const design = FARM_DESIGNS[designId];

	if (!design) {
		await interaction.editReply({
			embeds: [noDesign],
			allowedMentions: { repliedUser: false },
		});
		return;
	}

	const components = await getFarmInfoComponents(design, farmSettings, settings);

	const reply = await interaction.editReply({
		components,
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

		await inter.deferReply();

		collector.resetTimer();

		if (inter.isStringSelectMenu()) {
			if (inter.customId === 'design-direction') {
				farmSettings.direction = inter.values[0] as Direction;
			} else if (inter.customId === 'design-version') {
				farmSettings.version = inter.values[0] as MinecraftVersion;
			}
		} else if (inter.isButton()) {
			if (inter.customId === 'design-settings') {
				farmSettings.active = !farmSettings.active;
			}
		}

		const components = await getFarmInfoComponents(design, farmSettings, settings);

		await interaction.editReply({
			components,
			allowedMentions: { repliedUser: false },
			flags: [MessageFlags.IsComponentsV2],
		});

		await inter.deleteReply();

		return;
	});
}

async function getFarmInfoComponents(
	design: FarmDesignInfo,
	farmSettings: FarmSettings,
	settings?: UserSettings,
): Promise<(EliteContainer | ActionRowBuilder<MessageActionRowComponentBuilder>)[]> {
	const components: (EliteContainer | ActionRowBuilder<MessageActionRowComponentBuilder>)[] = [];

	const resources = design.resources
		?.filter((r) => r.type !== ResourceType.Schematic)
		.map((r) => {
			let source: string;
			if (r.type === ResourceType.Garden) {
				source = `\`/visit ${r.source}\``;
			} else {
				source = r.source;
			}
			return `**${ResourceType[r.type]}**: ${source}`;
		})
		.join('\n');

	const replacedBy = design.replacedBy
		?.map((d) => {
			return FARM_DESIGNS[d].name;
		})
		.join('\n');

	const speed = design.speed.soulSand ? design.speed[farmSettings.version] : design.speed['1.8.9'];

	const blocksPerSecond = await calcBlocksPerSecond(design.angle.yaw, design.speed.method, speed);

	const yaw = await fixDesignAngle(design.angle.yaw, farmSettings.direction);

	const FarmDesignInfoComponent = new EliteContainer(settings)
		.addTitle(`# ${design.name}`)
		.addDescription(
			`**Yaw**: ${yaw}, **Pitch**: ${design.angle.pitch}\n**Speed**: ${speed ?? '1.21 speed has not yet been determined'}${design.speed.depthStrider ? `\n**Depth Strider level**: ${design.speed.depthStrider}` : ''}`,
		)
		.addSeparator()
		.addDescription(`**bps**: ${design.bps}${blocksPerSecond ? `\n**Lane time**: ${480 / blocksPerSecond}` : ''}`);

	if (replacedBy) {
		FarmDesignInfoComponent.addSeparator().addDescription(`**Design is outdated, use one of these**:\n${replacedBy}`);
	}

	if (resources) {
		FarmDesignInfoComponent.addSeparator().addDescription(resources);
	}

	if (design.notes) {
		FarmDesignInfoComponent.addSeparator().addDescription(design.notes.join('\n'));
	}

	if (design.authors) {
		const authors = design.authors
			.map((author) => {
				if (author.url) {
					return `[${author.name}](${author.url})`;
				} else {
					return author.name;
				}
			})
			.join(', ');

		FarmDesignInfoComponent.addSeparator().addDescription(`-# **Authors**: ${authors}`);
	}

	FarmDesignInfoComponent.addFooter();

	components.push(FarmDesignInfoComponent);

	if (farmSettings.active) {
		const settingsComponent = new EliteContainer(settings)
			.addTitle('# Settings')
			.addActionRowComponents(
				new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
					new StringSelectMenuBuilder()
						.setCustomId('design-direction')
						.setPlaceholder('Select the direction your farm faces')
						.addOptions(
							new StringSelectMenuOptionBuilder()
								.setLabel('North')
								.setValue('North')
								.setDefault(farmSettings.direction == 'North'),
							new StringSelectMenuOptionBuilder()
								.setLabel('South')
								.setValue('South')
								.setDefault(farmSettings.direction == 'South'),
							new StringSelectMenuOptionBuilder()
								.setLabel('East')
								.setValue('East')
								.setDefault(farmSettings.direction == 'East'),
							new StringSelectMenuOptionBuilder()
								.setLabel('West')
								.setValue('West')
								.setDefault(farmSettings.direction == 'West'),
						),
				),
			)
			.addActionRowComponents(
				new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
					new StringSelectMenuBuilder()
						.setCustomId('design-version')
						.setPlaceholder('Select Minecaft version')
						.addOptions(
							new StringSelectMenuOptionBuilder()
								.setLabel('1.8.9')
								.setValue('1.8.9')
								.setDefault(farmSettings.version == '1.8.9'),
							new StringSelectMenuOptionBuilder()
								.setLabel('1.21')
								.setValue('1.21')
								.setDefault(farmSettings.version == '1.21'),
						),
				),
			)
			.addFooter();

		components.push(settingsComponent);
	}

	const settingsButton = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
		new ButtonBuilder()
			.setStyle(ButtonStyle.Secondary)
			.setLabel(`${farmSettings.active ? 'Close' : 'Open'} Settings`)
			.setCustomId('design-settings'),
	);

	components.push(settingsButton);

	return components;
}

async function calcBlocksPerSecond(yaw: number, method: FarmingMethod, speed?: number): Promise<number | undefined> {
	if (!speed) return undefined;
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
