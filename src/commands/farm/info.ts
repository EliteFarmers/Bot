import { createCanvas } from '@napi-rs/canvas';
import {
	ActionRowBuilder,
	AttachmentBuilder,
	AutocompleteInteraction,
	ButtonBuilder,
	ButtonStyle,
	ChatInputCommandInteraction,
	MessageActionRowComponentBuilder,
	MessageFlags,
	StringSelectMenuBuilder,
	StringSelectMenuOptionBuilder,
} from 'discord.js';
import { Direction, FARM_DESIGNS, FarmDesignInfo, MinecraftVersion, ResourceType } from 'farming-weight';
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

	const yaw = await fixDesignAngle(design.angle.yaw, farmSettings.direction);
	const image = pitchAndYawImage({ pitch: design.angle.pitch, yaw }, farmSettings.direction);

	const reply = await interaction.editReply({
		components,
		allowedMentions: { repliedUser: false },
		flags: [MessageFlags.IsComponentsV2],
		files: [image],
	});

	const collector = reply.createMessageComponentCollector({
		time: 120_000,
	});

	collector.on('collect', async (inter) => {
		if (inter.user.id !== interaction.user.id) {
			return NotYoursReply(inter);
		}

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

		await inter.update({
			components,
			files: [
				pitchAndYawImage(
					{ pitch: design.angle.pitch, yaw: await fixDesignAngle(design.angle.yaw, farmSettings.direction) },
					farmSettings.direction,
				),
			],
		});

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

	const notes = design.notes
		?.map((n) => {
			return '- ' + n;
		})
		.join('\n');

	const speed = design.speed.soulSand ? design.speed[farmSettings.version] : design.speed['1.8.9'];

	const yaw = await fixDesignAngle(design.angle.yaw, farmSettings.direction);

	const laneTime = Math.round((480 / (20 / design.laneDepth)) * 10) / 10;
	const laneTimeMinutes = Math.floor(laneTime / 60);
	const laneTimeSeconds = laneTime % 60;

	const FarmDesignInfoComponent = new EliteContainer(settings)
		.addTitle(`# ${design.name}`)
		.addDescription(
			`**Yaw**: ${yaw}, **Pitch**: ${design.angle.pitch}\n**Speed**: ${speed ?? '1.21 speed has not yet been determined'}${design.speed.depthStrider ? `\n**Depth Strider level**: ${design.speed.depthStrider}` : ''}`,
		)
		.addSeparator()
		.addText(`**Max BPS**: \`${design.bps}\``)
		.addImage(
			'attachment://yaw-pitch.webp',
			`Farm with [Yaw: ${yaw}, Pitch: ${design.angle.pitch}] while facing ${farmSettings.direction}`,
		)
		.addSeparator()
		.addDescription(
			`**bps**: ${design.bps}\n**Lane Time**: ${laneTimeMinutes !== 0 ? `${laneTimeMinutes}m ${laneTimeSeconds}s` : laneTimeSeconds + 's'}`,
		);

	if (replacedBy) {
		FarmDesignInfoComponent.addSeparator().addDescription(`**Design is outdated, use one of these**:\n${replacedBy}`);
	}

	if (resources) {
		const youtube = design.resources?.find((r) => r.type === ResourceType.Video)?.source;
		if (youtube) {
			const id = youtube.split('/').pop();
			FarmDesignInfoComponent.addImageSection(`https://img.youtube.com/vi/${id}/mqdefault.jpg`, resources);
		} else {
			FarmDesignInfoComponent.addSeparator().addDescription(resources);
		}
	}

	if (notes) {
		FarmDesignInfoComponent.addSeparator().addDescription(notes);
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
			);

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

function pitchAndYawImage(angle: { pitch: number; yaw: number }, direction: Direction = 'South') {
	const bgWidth = 1200;
	const bgHeight = 100;

	const canvas = createCanvas(bgWidth, bgHeight);
	const ctx = canvas.getContext('2d');

	ctx.fillStyle = '#84baff';
	ctx.rect(0, 0, bgWidth, bgHeight);
	ctx.fill();

	ctx.fillStyle = '#ffffff';
	ctx.font = '65px "Open Sans"';
	ctx.fillText(`F3 Angle: (${angle.yaw.toFixed(1)} / ${angle.pitch.toFixed(1)})`, 10, 72);

	// Draw a basic compass shape in the right middle
	ctx.fillStyle = '#bfbfbf';
	ctx.beginPath();
	ctx.arc(bgWidth - 60, bgHeight / 2, bgHeight / 2 - 10, 0, Math.PI * 2);
	ctx.fill();
	ctx.lineWidth = 4;
	ctx.strokeStyle = '#ffffff';
	ctx.stroke();

	// 2. A rounded red line from the center of the circle to the top
	ctx.strokeStyle = '#a20508';
	ctx.beginPath();
	switch (direction) {
		case 'North':
			ctx.moveTo(bgWidth - 60, bgHeight / 2);
			ctx.lineTo(bgWidth - 60, bgHeight / 2 - 25);
			break;
		case 'East':
			ctx.moveTo(bgWidth - 60, bgHeight / 2);
			ctx.lineTo(bgWidth - 60 + 25, bgHeight / 2);
			break;
		case 'South':
			ctx.moveTo(bgWidth - 60, bgHeight / 2);
			ctx.lineTo(bgWidth - 60, bgHeight / 2 + 25);
			break;
		case 'West':
			ctx.moveTo(bgWidth - 60, bgHeight / 2);
			ctx.lineTo(bgWidth - 60 - 25, bgHeight / 2);
			break;
	}
	ctx.lineWidth = 4;
	ctx.lineCap = 'round';
	ctx.stroke();

	ctx.fillStyle = '#FFFFFF';
	ctx.font = '14px "Open Sans"';

	ctx.fillText('N', bgWidth - 64, bgHeight / 2 - 25);
	ctx.fillText('E', bgWidth - 64 + 30, bgHeight / 2 + 4);
	ctx.fillText('S', bgWidth - 64, bgHeight / 2 + 35);
	ctx.fillText('W', bgWidth - 64 - 30, bgHeight / 2 + 4);

	const attachment = new AttachmentBuilder(canvas.toBuffer('image/webp'), {
		name: `yaw-pitch.webp`,
	});

	return attachment;
}
