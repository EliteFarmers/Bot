import { AutocompleteInteraction, ChatInputCommandInteraction } from 'discord.js';
import { UserSettings } from '../api/elite.js';
import { commands } from '../bot.js';
import {
	CommandAccess,
	CommandGroup,
	CommandType,
	EliteCommand,
	SlashCommandOptionType,
} from '../classes/commands/index.js';
import { EliteEmbed } from '../classes/embeds.js';

const command = new EliteCommand({
	name: 'help',
	description: 'All commands',
	access: CommandAccess.Everywhere,
	type: CommandType.Slash,
	options: {
		command: {
			name: 'command',
			description: 'Specify a command for more info.',
			type: SlashCommandOptionType.String,
			autocomplete,
			required: false,
		},
	},
	execute: execute,
});

export default command;

async function execute(interaction: ChatInputCommandInteraction, settings?: UserSettings) {
	const hCommand = interaction.options.getString('command', false) ?? undefined;

	let helpMenu;
	if (!hCommand) {
		helpMenu = getHelpEmbed();
		return interaction.reply({
			embeds: [helpMenu],
			allowedMentions: { repliedUser: false },
			ephemeral: true,
		});
	} else {
		const [name, sub = ''] = hCommand.toLowerCase().replace('/', '').trim().split('_');
		const cmd = commands.get(name);
		const command = cmd instanceof CommandGroup ? cmd.subcommands[sub] : cmd;

		if (!command || command instanceof CommandGroup || !command.isChatInputCommand()) {
			const embed = getHelpEmbed();
			return interaction.reply({
				content: "That's not a valid command! Here's the menu instead.",
				embeds: [embed],
				allowedMentions: { repliedUser: false },
				ephemeral: true,
			});
		}

		const embed = EliteEmbed(settings).setTitle(`Usage for /${command.displayName}`);

		embed.addFields({
			name: 'Command Information',
			value: command.getUsage(true) ?? 'No usage information available.',
			inline: false,
		});

		return interaction.reply({
			embeds: [embed],
			allowedMentions: { repliedUser: false },
			ephemeral: true,
		});
	}

	function getHelpEmbed() {
		const helpMenu = EliteEmbed(settings);

		helpMenu.setTitle('All Commands');
		const fields = [] as { name: string; value: string; inline: boolean }[];

		const cmds = Array.from(commands.values())
			.filter((cmd) => cmd instanceof CommandGroup || cmd.isChatInputCommand() || cmd.isSubCommand())
			.map((cmd) => (cmd instanceof CommandGroup ? Object.values(cmd.subcommands) : cmd))
			.flat()
			.sort((a, b) => a.displayName.localeCompare(b.displayName));

		cmds.forEach((command) => {
			fields.push({
				name: '/' + command.displayName,
				value: command.description,
				inline: true,
			});
		});

		helpMenu.addFields(fields.slice(0, 25));

		helpMenu.setFooter({
			text: `\nYou can send "/help [command name]" to get info on a specific command!`,
		});
		return helpMenu;
	}
}

export async function autocomplete(interaction: AutocompleteInteraction) {
	if (interaction.responded) return;

	const option = interaction.options.getFocused(true);
	if (!option || option.name !== 'command') return;

	const searchString = option.value.replace(/[^a-zA-Z0-9-]/g, '') || undefined;

	if (!searchString) {
		interaction.respond([
			{ name: '/weight', value: 'weight' },
			{ name: '/garden', value: 'garden' },
			{ name: '/gain', value: 'gain' },
		]);
		return;
	}

	const results = await getCommandOptions(searchString);

	if (!results) {
		interaction.respond([
			{ name: '/weight', value: 'weight' },
			{ name: '/garden', value: 'garden' },
			{ name: '/gain', value: 'gain' },
		]);
		return;
	}

	interaction.respond(results);
}

async function getCommandOptions(commandName: string) {
	commandName = commandName.toLowerCase().replace('/', '').trim();

	const matchIndex = (str: string) => str.toLowerCase().indexOf(commandName);

	const results = Array.from(commands.values())
		.filter((cmd) => cmd instanceof CommandGroup || cmd.isChatInputCommand() || cmd.isSubCommand())
		.map((cmd) => (cmd instanceof CommandGroup ? Object.values(cmd.subcommands) : cmd))
		.flat()
		.map((cmd) => cmd.displayName)
		.filter((name) => name.includes(commandName) || name.toLowerCase().includes(commandName))
		.sort((a, b) => matchIndex(a) - matchIndex(b))
		.slice(0, 5);

	return results?.map((name) => ({
		name: '/' + name,
		value: name.replaceAll(' ', '_'),
	}));
}
