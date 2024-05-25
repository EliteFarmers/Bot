import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { Command, CommandAccess, CommandType } from "../classes/Command.js";
import { commands } from "../bot.js";

const command: Command = {
	name: 'help',
	description: 'All commands',
	usage: '(command name)',
	access: CommandAccess.Everywhere,
	type: CommandType.Slash,
	slash: new SlashCommandBuilder()
		.setName('help')
		.setDescription('Get the help menu!')
		.addStringOption(option => option.setName('command')
			.setDescription('Specify a command for more info.')
			.setRequired(false)
			.addChoices(...generateCommandNameChoices())),
	execute: execute,
}

export default command;

async function execute(interaction: ChatInputCommandInteraction) {

	const hCommand = interaction.options.getString('command', false) ?? undefined;

	const newPrefix = '/';
	let helpMenu;

	if (!hCommand) {
		helpMenu = getHelpEmbed();
		return interaction.reply({ embeds: [helpMenu], allowedMentions: { repliedUser: false }, ephemeral: true  });
	} else {
		const name = hCommand.toLowerCase();
		const command = commands.get(name);

		if (!command) {
			const embed = getHelpEmbed()
			return interaction.reply({ content: 'That\'s not a valid command! Here\'s the menu instead.', embeds: [embed], allowedMentions: { repliedUser: false }, ephemeral: true });
		}

		const embed = new EmbedBuilder()
			.setColor('#03fc7b')
			.setTitle(`Usage for ${command.name}`);
		
		const data = [];
		data.push(`**Name:** ${command.name}`);

		if (command.description) data.push(`**Description:** ${command.description}`);
		if ('usage' in command && command.usage) data.push(`**Usage:** ${newPrefix}${command.name} ${command.usage}`);

		embed.addFields({
			name: 'Command Information',
			value: `${data.join('\n')}`,
			inline: false
		})

		return interaction.reply({ embeds: [embed], allowedMentions: { repliedUser: false }, ephemeral: true  });
	}

	function getHelpEmbed() {
		const helpMenu = new EmbedBuilder().setColor('#03fc7b');

		helpMenu.setTitle('Here\'s a list of all the commands:')

		commands.forEach(command => {
			if (command.type === CommandType.Button) return;
			let value = command.description;

			if ('usage' in command && command.usage) {
				value += `\nUsage: ${newPrefix}${command.name} ${command.usage}`;
			}
			
			helpMenu.addFields({
				name: `${newPrefix}${command.name}`,
				value,
				inline: false
			});
		});

		helpMenu.setFooter({ text: `\nYou can send "/help [command name]" to get info on a specific command!` });
		return helpMenu;
	}
}

function generateCommandNameChoices(): { name: string, value: string }[] {
	const choices = [];

	for (const cmdName in commands) {
		choices.push({ name: cmdName, value: cmdName });
	}

	return choices;
}