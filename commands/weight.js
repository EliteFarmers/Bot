const Discord = require('discord.js');
const { PlayerHandler } = require('../calc.js');

module.exports = {
	name: 'weight',
	aliases: [ 'w' ],
	description: 'Calculate a players farming weight',
	usage: '[username] (profile name)',
	guildOnly: false,
	dmOnly: false,
	async execute(interaction) {
		const options = interaction?.options?._hoistedOptions;

		const playerName = options[0]?.value.trim();
		const profileName = options[1]?.value.trim();

		if (playerName) {
			await interaction.deferReply();
			PlayerHandler.getWeight(interaction, playerName, profileName ?? null);
		}
	}
};

