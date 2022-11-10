import { Client, GatewayIntentBits, Partials, Collection, ApplicationCommandDataResolvable, ApplicationCommandData, ActivityType } from 'discord.js';
import { Command } from './classes/Command';

import fs from 'fs';
import path from 'path';

import dotenv from 'dotenv';
dotenv.config();

const proccessArgs = process.argv.slice(2);

export const client = new Client({ 
	intents: [GatewayIntentBits.Guilds, GatewayIntentBits.DirectMessages],
	partials: [Partials.Channel]
});

export const commands = new Collection<string, Command>();

/* 
* There is surely a better way to load these, but this is fine for now
* as it only runs once on startup and allows you to only create a new file.
*/
(async function() {
	const filter = (fileName: string) => fileName.endsWith('.ts');

	const commandFiles = fs.readdirSync(path.resolve('./src/commands/')).filter(filter);

	for (const file of commandFiles) {
		const command = await import(`./commands/${file}`);
		commands.set(command.default.name, command.default);
	}

	const buttonFiles = fs.readdirSync('../buttons/').filter(filter);

	for (const file of buttonFiles) {
		const command = await import(`buttons/${file.replace('.ts', '')}`);
		commands.set(command.default.name, command.default);
	}
	
	const eventFiles = fs.readdirSync('../events/').filter(filter);
	
	for (const file of eventFiles) {
		const event = await import(`events/${file.replace('.ts', '')}`);
		client.on(file.split('.')[0], event.default);
	}
}()); 


client.once('ready', async () => {
	if (client.user) {
		client.user.setActivity('skyblock players', { type: ActivityType.Watching });
	}

	console.log('Ready!');
	
	if (proccessArgs[0] === 'deploy') {
		console.log('Deploying slash commands...');
		deploySlashCommands();
	}
});

client.login(process.env.BOT_TOKEN);

/*
*  ===================================================================
*	Command arguments on startup of script to do one-time operations
*
*		"deploy global" 	 - updates slash commands globally
*		"deploy <server id>" - updates slash commands in that server
*		Append "clear" to remove slash commands from a server
*  ===================================================================
*/

function deploySlashCommands() {
	const slashCommandsData: ApplicationCommandData[] = [];

	for (const [, command ] of commands) {
		if (command.type === 'AUTOCOMPLETE' || command.type === 'BUTTON') continue;

		if (command.slash) slashCommandsData.push(command.slash);
	}

	if (proccessArgs[1] === 'global') {
		setTimeout(async function() {
			await client.application?.commands.set([]);
			await client.application?.commands.set(slashCommandsData as ApplicationCommandDataResolvable[]);
			console.log('Probably updated slash commands globally');
		}, 3000);
	} else if (proccessArgs[1]) {
		setTimeout(async function() {
			const guild = await client.guilds.fetch('' + proccessArgs[1]);
			const guildCommands = guild.commands;
			if (proccessArgs[2] !== 'clear') {
				guildCommands.set(slashCommandsData as ApplicationCommandDataResolvable[]);
			} else {
				guildCommands.set([]);
			}
			console.log('Probably updated slash commands on that server');
		}, 3000);
	}
}
