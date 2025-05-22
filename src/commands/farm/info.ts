import { UserSettings } from 'api/elite.js';
import { CommandAccess, CommandType, EliteCommand, SlashCommandOptionType } from 'classes/commands/index.js';
import { AutocompleteInteraction, ChatInputCommandInteraction } from 'discord.js';
import {
	DepthStriderLevels,
	Direction,
	MinecraftVersion,
	depthStriderLevels,
	directions,
	farmDesigns,
	farmsData,
	mcVersions,
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
		},
		direction: {
			name: 'direction',
			description: 'Optionally select the direction you face when farming, this helps to show the correct angles.',
			type: SlashCommandOptionType.String,
			autocomplete: autocomplete,
		},
		// maybe just put both possible yaws for farms that this would affect? this would probably just be confusing for most people
		flipped: {
			name: 'flipped',
			description:
				'Optionally select whether or not you flipped (mirrored) the original design, this helps to show the correct angles.',
			type: SlashCommandOptionType.String,
			autocomplete: autocomplete,
		},
		depth_strider: {
			name: 'depth strider',
			description: 'Optionally select the depth strider level you use, this helps to show the correct speed.',
			type: SlashCommandOptionType.String,
		},
		version: {
			name: 'version',
			description:
				'Optionally select the Minecraft version you play on, this helps to show the correct speed for farms that use soul sand.',
			type: SlashCommandOptionType.String,
		},
	},
	execute: execute,
});

const autocompleteData: Record<string, Array<{ name: string; value: string | number }>> = {
	direction: directions.map((v) => ({ name: v, value: v })),
	'depth strider': depthStriderLevels.map((n) => ({ name: `Depth Strider ${n}`, value: n })),
	version: mcVersions.map((v) => ({ name: v, value: v })),
	design: farmDesigns.map(([key, data]) => ({ name: data.name, value: key })),
};

async function autocomplete(interaction: AutocompleteInteraction) {
	if (interaction.responded) return;

	const option = interaction.options.getFocused(true);
	const options = autocompleteData[option.name];
	if (!options) return;

	const input = option.value.toLowerCase();

	const filtered = options.filter((opt) => opt.name.toLowerCase().startsWith(input));

	await interaction.respond(filtered);
}

export default command;

async function execute(interaction: ChatInputCommandInteraction, settings?: UserSettings) {
	const versionRaw = interaction.options.getString('version', false)?.trim();
	const version = mcVersions.includes(versionRaw as MinecraftVersion) ? (versionRaw as MinecraftVersion) : undefined;

	const dsRaw = interaction.options.getString('depth_strider', false)?.trim();
	const dsLevel = depthStriderLevels.includes(Number(dsRaw) as DepthStriderLevels)
		? (Number(dsRaw) as DepthStriderLevels)
		: undefined;

	const directionRaw = interaction.options.getString('direction', false)?.trim();
	const direction = directions.includes(directionRaw as Direction) ? (directionRaw as Direction) : undefined;

	const farm = farmsData[interaction.options.getString('design', true) as keyof typeof farmsData];

	await interaction
		.reply({
			content: `${calcSpeed(farm.speed.speed, farm.speed.soulSand, farm.speed.buildVersion, version, farm.speed.depthStrider, dsLevel)}`,
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
