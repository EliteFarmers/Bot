const Discord = require('discord.js');
const { DataHandler } = require('../database.js');
let { prefix } = require('../config.json');
module.exports = {
	name: 'help',
	aliases: ['h', 'commands'],
	description: 'All commands',
	usage: '[command name]',
	guildOnly: false,
	async execute(interaction) {

		const options = interaction?.options?._hoistedOptions;
		const hCommand = options[0]?.value;

		const data = [];
		const { commands } = interaction.client;
		let newPrefix = '/';

		if (!hCommand) {
			helpMenu = getHelpEmbed();
			return interaction.reply({ embeds: [helpMenu], allowedMentions: { repliedUser: false } });
		} else {
			const name = hCommand.toLowerCase();
			const command = commands.get(name) || commands.find(c => c.aliases && c.aliases.includes(name));

			if (!command) {
				let embed = getHelpEmbed()
				return interaction.reply({ content: 'That\'s not a valid command! Here\'s the menu instead.', embeds: [embed], allowedMentions: { repliedUser: false }});
			}

			let embed = new Discord.MessageEmbed()
				.setColor('#03fc7b')
				.setTitle(`Usage for ${command.name}`);
			
			let data = [];
			data.push(`**Name:** ${command.name}`);

			if (command.aliases) data.push(`**Aliases:** ${command.aliases.join(', ')}`);
			if (command.description) data.push(`**Description:** ${command.description}`);
			if (command.usage) data.push(`**Usage:** ${newPrefix}${command.name} ${command.usage}`);

			embed.fields.push({
				name: 'Command Information',
				value: `${data.join('\n')}`,
				inline: false
			})

			return interaction.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
		}

		function getHelpEmbed() {
			const helpMenu = new Discord.MessageEmbed().setColor('#03fc7b');

			helpMenu.setTitle('Here\'s a list of all the commands:')

			commands.forEach(command => {
				helpMenu.fields.push({
					name: `${newPrefix}${command.name} (${command.aliases.join(', ')})`,
					value: `${command.description}\n${newPrefix}${command.name} ${command.usage}`,
					inline: false
				});
			});

			helpMenu.setFooter(`\nYou can send \`${newPrefix ?? prefix}help [command name]\` to get info on a specific command!`);
			return helpMenu;
		}
	}
}