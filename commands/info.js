const Discord = require('discord.js');

module.exports = {
	name: 'info',
	aliases: ['i'],
	description: 'Information',
	usage: '[command name]',
	guildOnly: false,
	execute(message, args) {
		const embed = new Discord.MessageEmbed()
			.setColor('#03fc7b')
			.setTitle('Bot Information')
			.setDescription('Currently the bot only factors in crops collections')
			.addField('Amount of each crop per 1 farming weight', `
			Wheat: 100,000
			Carrot: 300,000
			Potato: 300,000
			Pumpkin: 100,000
			Melon: 100,000
			Mushroom: 100,000
			Cocoa Beans: 300,000
			Cactus: 100,000
			Sugar Cane: 200,000
			Nether Wart: 250,000

			These calculations are solely based off of the average drop chance per crop, if you have suggestions for tweaking them contact me with your reason.
			Farming XP may be added soon.
			`)
			.setFooter('Created by Kaeso#5346');

		message.channel.send(embed);
	},
};
