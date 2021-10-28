const Discord = require('discord.js');
const { Auth } = require('../auth.js');
const { PlayerHandler } = require('../calc.js');
const { DataHandler } = require('../database.js');
const { superusers } = require('../config.json');

module.exports = {
	name: 'admin',
	aliases: [ 'a' ],
	description: 'Access the admin panel.',
	usage: '(token)',
	guildOnly: false,
	dmOnly: false,
	async execute(interaction) {
		const options = interaction?.options?._hoistedOptions;

		const token = +(options[0]?.value.trim());

        const success = Auth.verifyTOTP(token);
        if (!success || !superusers.includes(interaction.user.id)) {
            interaction.reply({ content: 'Invalid 2 Factor Authentication code, you probably aren\'t authorized', ephemeral: true });
            return;
        }

        interaction.reply({ content: 'Hello there cool kid :)', ephemeral: true });
	}
};

