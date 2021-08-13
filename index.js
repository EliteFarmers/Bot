const fs = require('fs');
const Discord = require('discord.js');
const { prefix, token } = require('./config.json');
const { Player, PlayerHandler } = require('./calc.js');
const { DataHandler } = require('./database.js')

const client = new Discord.Client({ intents: [Discord.Intents.FLAGS.GUILDS, Discord.Intents.FLAGS.GUILD_MESSAGES] });
client.commands = new Discord.Collection();

const commandFiles = fs.readdirSync('./commands').filter((file) => file.endsWith('.js'));

for (const file of commandFiles) {
	const command = require(`./commands/${file}`);
	client.commands.set(command.name, command);
}

client.once('ready', async () => {
	DataHandler.syncTables();
	client.user.setActivity('skyblock players', { type: 'WATCHING' });

	console.log('Ready!');
});

client.on('messageCreate', async (message) => {
	//if (!client.application?.owner) await client.application?.fetch();

	// if (message.content.toLowerCase() === 'it doesn\'t' && message.author.id === '174265140357627904') {
	// 	message.channel.send('I didn\'t');
		/*const commandData = [
			{
				name: 'weight',
				description: 'Get a Skyblock user\'s farming weight!',
				options: [
					{
						name: 'playername',
						type: 'STRING',
						description: 'The player in question.',
						required: true,
					}
				]
			},
			{
				name: 'lb',
				description: 'Get the farming weight leaderboard!',
				options: [
					{
						name: 'player',
						type: 'STRING',
						description: 'Jump to a specific player!',
						required: false,
					}
				]
			}
		];
		//const commands = await client.application?.commands.set(commandData);
		const commands = await client.guilds.cache.get('602004419571220500')?.commands.set(commandData);

		console.log(commands);
		*/
	// }
	
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

	if (command.permissions) {
		const authorPerms = message.channel.permissionsFor(message.author);
		if (!authorPerms || !authorPerms.has(command.permissions)) {
			return message.reply({ content: 'You don\'t have the required permissions for this command.', allowedMentions: { repliedUser: true } });
		}
	}

	if (command.args && !args.length) {
		let reply = `You didn't provide any arguments, ${message.author}!`;

		if (command.usage) {
			reply += `\nThe proper usage would be: \`${customPrefix}${command.name} ${command.usage}\``;
		}

		return message.channel.send({ content: reply, allowedMentions: { repliedUser: true } });
	}

	try {
		command.execute(message, args);
	} catch (error) {
		console.error(error);
		message.reply({ content: 'There was an error trying to execute that command!', allowedMentions: { repliedUser: true } });
	}
});

client.on('interactionCreate', async interaction => {
	if (!interaction.isCommand()) return;

	console.log(interaction);
});

var minutes = 15, interval = minutes * 60 * 1000;
setInterval(function () {
	PlayerHandler.clearCache(minutes);
}, interval);

setInterval(function () {
	DataHandler.updateLeaderboard();
}, 60 * 1000);
 

client.login(token);