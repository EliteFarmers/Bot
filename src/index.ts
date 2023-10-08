import { Client, GatewayIntentBits, Collection, ApplicationCommandDataResolvable, ActivityType, RESTPostAPIChatInputApplicationCommandsJSONBody, Events, PermissionsBitField } from 'discord.js';
import { Command, CommandType } from './classes/Command.js';
import { SignalRecieverOptions } from './classes/Signal.js';
import { ConnectToRMQ } from './api/rabbit.js';
import { GlobalFonts } from '@napi-rs/canvas';

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();
const proccessArgs = process.argv.slice(2);

export const client = new Client({ 
	intents: [GatewayIntentBits.Guilds]
});

export const commands = new Collection<string, Command>();
export const signals = new Collection<string, SignalRecieverOptions>();

/* 
* There is surely a better way to load these, but this is fine for now
* as it only runs once on startup and allows you to only create a new file.
*/
(async function() {
	const filter = (fileName: string) => fileName.endsWith('.ts') || fileName.endsWith('.js');

	registerFiles('commands', filter, (cmd) => {
		commands.set(cmd.name, cmd);
	});

	registerFiles('buttons', filter, (btn) => {
		commands.set(btn.name, btn);
	});

	registerFiles('events', filter, (event) => {
		client.on(event.event, event.execute);
	});

	registerFiles('signals', filter, (signal) => {
		signals.set(signal.name, signal);
	});

	GlobalFonts.loadFontsFromDir(path.resolve('./src/assets/fonts/'));
}());

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function registerFiles(folder: string, filter: (fileName: string) => boolean, callback: (data: any) => void) {
	const files = fs.readdirSync(`./src/${folder}`).filter(filter);

	for (const file of files) {
		const imported = await import(`./${folder}/${file.replace('.ts', '.js')}`);
		callback(imported.default);
	}
}

client.once(Events.ClientReady, async () => {
	if (client.user) {
		client.user.setActivity(`${client.guilds.cache.size} farming guilds`, { type: ActivityType.Watching });
	}

	// Update count every 2 hours
	setInterval(() => {
		if (client.user) {
			client.user.setActivity(`${client.guilds.cache.size} farming guilds`, { type: ActivityType.Watching });
		}
	}, 1000 * 60 * 60 * 2);

	console.log('Ready!');

	ConnectToRMQ();
	
	if (proccessArgs[0] === 'deploy') {
		console.log('Deploying slash commands...');
		deploySlashCommands();
	}
});

client.login(process.env.BOT_TOKEN);

process.on('unhandledRejection', (reason, p) => {
	console.error(reason, 'Unhandled Rejection at Promise', p);
}).on('uncaughtException', err => {
	console.error(err, 'Uncaught Exception thrown');
	process.exit(1);
});

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
	const slashCommandsData: RESTPostAPIChatInputApplicationCommandsJSONBody[] = [];

	for (const [, command ] of commands) {
		if (command.type !== CommandType.Slash && command.type !== CommandType.Combo) continue;

		if (!command.slash) continue;

		const slash = command.slash;
		
		if (command.permissions) {
			slash.setDefaultMemberPermissions(PermissionsBitField.resolve(command.permissions));
		}

		slashCommandsData.push(command.slash.toJSON());
	}

	if (proccessArgs[1] === 'global') {
		setTimeout(async function() {
			await client.application?.commands.set([]);
			await client.application?.commands.set(slashCommandsData as ApplicationCommandDataResolvable[]);
			console.log('Probably updated slash commands globally');
		}, 3000);
	} else if (proccessArgs[1] === 'single') {
		const name = proccessArgs[2];
		const command = slashCommandsData.find(cmd => cmd.name === name);

		if (!command) return console.log('Could not find command with the name "' + name + '"');

		setTimeout(async function() {
			const current = await client.application?.commands.fetch();
			const existing = current?.find(cmd => cmd.name === name);

			if (!existing) {
				await client.application?.commands.create(command);
				console.log('Probably created that slash command globally');
			} else {
				await client.application?.commands.edit(existing, command);
				console.log('Probably updated that slash command globally');
			}
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
