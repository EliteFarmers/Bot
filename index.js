const fs = require('fs');
const Discord = require('discord.js');
const { token, adminid } = require('./config.json');
const { Player, PlayerHandler } = require('./calc.js');
const { DataHandler } = require('./database.js')

const client = new Discord.Client({ intents: [Discord.Intents.FLAGS.GUILDS, Discord.Intents.FLAGS.GUILD_MESSAGES, Discord.Intents.FLAGS.DIRECT_MESSAGES] });
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

client.on('interactionCreate', async (interaction) => {	
	if (!interaction.isCommand()) return;
	if (!client.commands.has(interaction.commandName)) return;

	let command;
	try {
		command = await client.commands.get(interaction.commandName);
	} catch (error) {
		console.log(error);
	}

	if (command.permissions) {
		if (!interaction.member.permissions.has(command.permissions)) {
			return await interaction.reply({ content: 'You don\'t have the required permissions for this command.', allowedMentions: { repliedUser: true }, ephemeral: true });
		}
	}

	if (command.args && !args.length) {
		let reply = `You didn't provide any arguments, ${interaction.user.username}!`;

		if (command.usage) {
			reply += `\nThe proper usage would be: \`/${command.name} ${command.usage}\``;
		}

		return await interaction.reply({ content: reply, allowedMentions: { repliedUser: true }, ephemeral: true });
	}

	try {
		await client.commands.get(interaction.commandName).execute(interaction);
	} catch (error) {
		console.log(error);
		await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
	}
});

client.on('messageCreate', async message => {
	if (!client.application?.owner) await client.application?.fetch();

	if (message.content.toLowerCase() === '!deploy' && message.author.id === client.application?.owner.id) {
		const data = [
			{
				name: 'weight',
				description: 'Get a players farming weight!',
				options: [
					{
						name: 'player',
						type: 'STRING',
						description: 'The player in question.',
						required: true
					},
					{
						name: 'profile',
						type: 'STRING',
						description: 'Optionally specify a profile!',
						required: false
					}
				]
			},
			{
				name: 'leaderboard',
				description: 'Get the farming weight leaderboard!',
				options: [{
					name: 'player',
					type: 'STRING',
					description: 'Jump to a specific player!',
					required: false
				}]
			}, 
			{
				name: 'help',
				description: 'Get the help menu!',
				options: [{
					name: 'command',
					type: 'STRING',
					description: 'Specify a command for more info.',
					required: false
				}]
			},
			{
				name: 'info',
				description: 'Get bot information!'
			}
		];

		const commands = await client.application?.commands.create(data);

		// const guild = await client.guilds.fetch('602004419571220500');
		// const commands = guild.commands;
		// commands.set([]);

		//const commands = await client.application?.commands.set(data);
		console.log(commands);
	}
});

var minutes = 15, interval = minutes * 60 * 1000;
setInterval(function () {
	PlayerHandler.clearCache(minutes);
}, interval);

setInterval(function () {
	DataHandler.updateLeaderboard();
}, 60 * 1000);
 

client.login(token);