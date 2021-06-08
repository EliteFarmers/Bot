const Discord = require('discord.js');
const { PlayerHandler } = require('../calc.js');
const { DataHandler } = require('../database.js');

module.exports = {
    name: 'prefix',
    aliases: ['p'],
    description: 'Change the prefix for your server',
    usage: '[new prefix]',
    permissions: 'ADMINISTRATOR',
    guildOnly: true,
    execute(message, args) {
        let prefix = args[0];

        if (prefix.length > 3) {
            return message.reply('The prefix may not be more than 3 characters long');
        } else {
            if (args[0] !== null && args[0] !== undefined) {
                console.log('Changing prefix');
                DataHandler.setPrefix(message, message.guild.id, args[0]);
            } else {
                message.reply('You must specify a new prefix');
            }
        }
    }
};

