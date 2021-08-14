const Discord = require('discord.js');
const { PlayerHandler } = require('../calc.js');

module.exports = {
	name: 'weight',
	aliases: [ 'w' ],
	description: 'Calculate a players farming weight',
	usage: '[username] (profile name)',
	guildOnly: false,
	dmOnly: false,
	execute(interaction) {
		const options = interaction?.options?._hoistedOptions;

		const playerName = options[0]?.value;
		const profileName = options[1]?.value;

		if (playerName) {
			const embed = new Discord.MessageEmbed()
			.setColor('#03fc7b')
			.setTitle(`Calculating weight for ${playerName}...`)
			.setFooter('Created by Kaeso#5346');

			PlayerHandler.getWeight(interaction, playerName, profileName ?? null);
		}
	}
};

