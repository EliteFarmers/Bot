const fs = require('fs');
const Discord = require('discord.js');
const { token } = require('./config.json');
const { DataHandler } = require('./classes/database.js')
const { ServerUtil } = require('./classes/serverutil.js');
const args = process.argv.slice(2);

const client = new Discord.Client({ partials: ['CHANNEL'], intents: [Discord.Intents.FLAGS.GUILDS, Discord.Intents.FLAGS.DIRECT_MESSAGES] });
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
	if (interaction.isButton()) {
		if (interaction.customId.includes('jacob')) {
			try {
				await client.commands.get('jacob').execute(interaction, undefined, interaction.customId.split('_')[1]);
			} catch (e) {
				error();
			}
		} else if (interaction.customId.startsWith('LBROLETOGGLE')) {
			try {
				ServerUtil.toggleRole(interaction);
			} catch (e) {
				error(e);
			}
			return;
		} else if (interaction.customId.startsWith('LBSUBMIT')) {
			try {
				ServerUtil.submitScores(interaction);
			} catch (e) {
				error(e);
			}
		} else if (interaction.customId.startsWith('WEIGHTROLEAPPROVE')) {
			const serverPromise = interaction.guildId ? DataHandler.getServer(interaction.guildId) : undefined;
			const userPromise = DataHandler.getPlayer(undefined, { discordid: interaction.customId.split('|')[1] });

			Promise.all([serverPromise, userPromise]).then(async (values) => {
				const server = values[0], user = values[1];

				if (!server || !user) return;
				if (!server.reviewerrole || !(interaction.member.permissions.has('ADMINISTRATOR') || interaction.member.roles.cache.has(server.reviewerrole))) {
					return interaction.reply({ content: '**Error!** You don\'t have permission to do this!', ephemeral: true }).catch();
				}
	
				try {
					ServerUtil.grantWeightRole(interaction, interaction.guild, user.discordid, server, user);
				} catch (e) {
					error(e);
				}
			}).catch((e) => error(e));

		} else if (interaction.customId === 'WEIGHTROLEDENY') {
			interaction.update({ content: `**Denied by** <@${interaction.user.id}>!`, components: [] }).catch(() => {});
		}
		return;
		async function error(error) {
			console.log(error);
			await interaction.editReply({ content: 'There was an error while executing this command!', ephemeral: true }).catch(() => {
				interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true }).catch(() => {});
			});
		}
	}
	if (!interaction.isCommand()) return;
	if (!client.commands.has(interaction.commandName)) return;

	const server = interaction.guildId ? await DataHandler.getServer(interaction.guildId) : undefined;

	if (server && server?.channels && !['admin', 'config'].includes(interaction.commandName)) {
		const channels = server.channels;
		const parentWhitelisted = (interaction?.channel?.parentId && channels.includes('C' + interaction.channel.parentId));
		if (!channels.includes(interaction.channelId) && !parentWhitelisted) {
			let content = '';
			channels.forEach(channel => { 
				content += channel[0] === 'C' ? `<#${channel.substring(1)}> ` : `<#${channel}> `; 
			});

			const embed = new Discord.MessageEmbed().setColor('#FF0000')
				.setTitle('Commands are disabled in this channel!')
				.setDescription('Please use the channels that this server whitelisted.')
				.addField(`Available Channel${channels.length > 1 ? 's' : ''}`, content.trim() === '' ? '**Something went wrong**' : content.trim());

			interaction.reply({ embeds: [embed], ephemeral: true}).catch(() => { });
			return;
		}
	}

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
		await client.commands.get(interaction.commandName).execute(interaction, server);
	} catch (error) {
		console.log(error);
		await interaction.editReply({ content: 'There was an error while executing this command!', ephemeral: true }).catch(() => {});
	}
});

setInterval(function () {
	DataHandler.updateLeaderboard();
}, 60 * 1000);
 

client.login(token);

/*
*  ===================================================================
*	Command arguments on startup of script to do one-time operations
*
*		"deploy global" 	 - updates slash commands globally
*		"deploy <server id>" - updates slash commands in that server
*		Append "clear" to remove slash commands from a server
*  ===================================================================
*/

const slashCommandsData = [
	{
		name: 'weight',
		description: 'Get a players farming weight!',
		options: [
			{
				name: 'player',
				type: 'STRING',
				description: 'The player in question.',
				required: false
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
	},
	{
		name: 'verify',
		description: 'Link your Minecraft account!',
		options: [{
			name: 'player',
			type: 'STRING',
			description: 'Your minecraft account name.',
			required: true
		}]
	},
	{
		name: 'jacob',
		description: 'Get jacob\'s high scores or leaderboard!',
		options: [
			{
				name: 'player',
				type: 'STRING',
				description: 'The player in question.',
				required: false
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
		name: 'admin',
		description: 'Get the admin panel!'
	},
];

if (args[0] === 'deploy') {
	if (args[1] === 'global') {
		setTimeout(async function() {
			await client.application?.commands.set([]);
			await client.application?.commands.set(slashCommandsData);
			console.log('Probably updated slash commands globally');
		}, 5000);
	} else if (args[1]) {
		setTimeout(async function() {
			const guild = await client.guilds.fetch('' + args[1]);
			const commands = guild.commands;
			if (args[2] !== 'clear') {
				commands.set(slashCommandsData);
			} else {
				commands.set([]);
			}
			console.log('Probably updated slash commands on that server');
		}, 5000);
	}
} else if (args[0] === 'cheating') {
	setTimeout(async function() {
		const user = await DataHandler.getPlayer(args[1]);
		if (user) {
			await DataHandler.update({ cheating: args[2], rank: 0 }, { uuid: args[1] });
			console.log(`Set ${user.dataValues?.ign}'s cheating status to ${args[2]}`);
			await DataHandler.getPlayer(args[1]).then(user => {
				console.log(user.dataValues);
			});
		}
	}, 5000);
}