const fs = require('fs');
const Discord = require('discord.js');
const { prefix, token } = require('./config.json');
const { Player, PlayerHandler } = require('./calc.js');
const { DataHandler } = require('./database.js')

const client = new Discord.Client();
client.commands = new Discord.Collection();

const commandFiles = fs.readdirSync('./commands').filter((file) => file.endsWith('.js'));

for (const file of commandFiles) {
	const command = require(`./commands/${file}`);
	client.commands.set(command.name, command);
}

client.once('ready', () => {
	DataHandler.syncTables();
	console.log('Ready!');
	client.user.setActivity('skyblock players', { type: 'WATCHING' });
});

client.on('message', async (message) => {
	if (message.author.bot) return;

	let customPrefix = prefix;
	if (message.guild !== null) {
		let customPrefixObj = await DataHandler.getPrefix(message.guild.id);
		if (customPrefixObj !== null) {
			customPrefix = customPrefixObj.dataValues.prefix;
		}
	}

	if (!message.content.startsWith(customPrefix)) return;

	const args = message.content.slice(customPrefix.length).split(/ +/);
	const commandName = args.shift().toLowerCase();

	const command =
		client.commands.get(commandName) ||
		client.commands.find((cmd) => cmd.aliases && cmd.aliases.includes(commandName));

	if (!command) return;

	if (command.dmOnly) {
		return message.reply("I can't execute that command outside DMs!");
	}

	if (command.permissions) {
		const authorPerms = message.channel.permissionsFor(message.author);
		if (!authorPerms || !authorPerms.has(command.permissions)) {
			return message.reply('You don\'t have the required permissions for this command.');
		}
	}

	if (command.args && !args.length) {
		let reply = `You didn't provide any arguments, ${message.author}!`;

		if (command.usage) {
			reply += `\nThe proper usage would be: \`${customPrefix}${command.name} ${command.usage}\``;
		}

		return message.channel.send(reply);
	}

	try {
		command.execute(message, args);
	} catch (error) {
		console.error(error);
		message.reply('There was an error trying to execute that command!');
	}
});

var minutes = 15, interval = minutes * 60 * 1000;
setInterval(function () {
	PlayerHandler.clearCache(minutes);
}, interval);
 

client.login(token);