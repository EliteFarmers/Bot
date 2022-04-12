import { ApplicationCommandOptionChoice, CommandInteraction, MessageEmbed } from "discord.js";
import { Command } from "../classes/Command";
import { commands } from "index";

const command: Command = {
	name: 'help',
	description: 'All commands',
	usage: '(command name)',
	access: 'ALL',
	type: 'SLASH',
	execute: execute,
	slash: {
		name: 'help',
		description: 'Get the help menu!',
		options: [{
			name: 'command',
			type: 'STRING',
			description: 'Specify a command for more info.',
			required: false,
			choices: generateCommandNameChoices()
		}]
	},
}

export default command;

async function execute(interaction: CommandInteraction) {

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

		const embed = new MessageEmbed()
			.setColor('#03fc7b')
			.setTitle(`Usage for ${command.name}`);
		
		const data = [];
		data.push(`**Name:** ${command.name}`);

		if (command.description) data.push(`**Description:** ${command.description}`);
		if (command.usage) data.push(`**Usage:** ${newPrefix}${command.name} ${command.usage}`);

		embed.fields.push({
			name: 'Command Information',
			value: `${data.join('\n')}`,
			inline: false
		})

		return interaction.reply({ embeds: [embed], allowedMentions: { repliedUser: false }, ephemeral: true  });
	}

	function getHelpEmbed() {
		const helpMenu = new MessageEmbed().setColor('#03fc7b');

		helpMenu.setTitle('Here\'s a list of all the commands:')

		commands.forEach(command => {
			helpMenu.fields.push({
				name: `${newPrefix}${command.name}`,
				value: `${command.description}\nUsage: ${newPrefix}${command.name} ${command.usage}`,
				inline: false
			});
		});

		helpMenu.setFooter({ text: `\nYou can send "/help [command name]" to get info on a specific command!` });
		return helpMenu;
	}
}

function generateCommandNameChoices(): ApplicationCommandOptionChoice[] {
	const choices = [];

	for (const cmdName in commands) {
		choices.push({ name: cmdName, value: cmdName });
	}

	return choices;
}