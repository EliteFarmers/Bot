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
Sugar Cane: 200,000
Nether Wart: 250,000

*Pumpkin: 1.41x / 100,000
*Melon: 1.41x / 500,000
*Mushroom: 1.2x / 100,000
*Cocoa Beans: 1.36x / 300,000
*Cactus: 1.26x / 100,000

x = collection number
*These crops have a different calculation in order to equalize their their tools with mathematical hoes provided by Bankhier (Only rounded decimal shown)

Seeds are not included as they are simply a byproduct of wheat.
If you have suggestions for tweaking these numbers contact me with your reason.
Farming XP may be added soon.
			`)
			.setFooter('Created by Kaeso#5346');

		message.channel.send(embed);
	},
};
