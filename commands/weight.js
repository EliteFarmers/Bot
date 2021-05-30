const Discord = require('discord.js');
const { PlayerHandler } = require('../calc.js');

module.exports = {
	name: 'weight',
	aliases: [ 'w' ],
	description: 'Calculate a players Weight!',
	usage: 'weight [username] (profile name)',
	guildOnly: true,
	dmOnly: false,
	execute(message, args) {
		if (!(args[0] === null || args[0] === undefined)) {
			const embed = new Discord.MessageEmbed()
				.setColor('#03fc7b')
				.setTitle(`Calculating weight for ${args[0]}...`)
				.setFooter('Created by Kaeso#5346');

			message.channel.send(embed).then((sentEmbed) => {
				PlayerHandler.getWeight(sentEmbed, args[0], args[1] ?? null);
			});
		}
	}
};

