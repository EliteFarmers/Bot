import { Client, GatewayIntentBits, Collection, ApplicationCommandDataResolvable, ActivityType, Events, PermissionsBitField, SlashCommandBuilder, RESTPostAPIApplicationCommandsJSONBody } from 'discord.js';
import { Command, CommandGroup, CommandGroupSettings, CommandType, CronTask, SubCommand } from './classes/Command.js';
import { SignalRecieverOptions } from './classes/Signal.js';
import { ConnectToRMQ } from './api/rabbit.js';
import { GlobalFonts } from '@napi-rs/canvas';
import { CronJob } from 'cron';

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();
const proccessArgs = process.argv.slice(2);

export const client = new Client({
	intents: [GatewayIntentBits.Guilds]
});

export const commands = new Collection<string, Command | CommandGroup>();
export const signals = new Collection<string, SignalRecieverOptions>();

/* 
* There is surely a better way to load these, but this is fine for now
* as it only runs once on startup and allows you to only create a new file.
*/
(async function() {
	const filter = (fileName: string) => fileName.endsWith('.ts') || fileName.endsWith('.js');

	registerFiles<Command>('commands', filter, (cmd) => {
		commands.set(cmd.name, cmd);
	});

	const subFilter = (fileName: string) => filter(fileName) && !fileName.includes('command');

	registerCommandGroups('commands', (folder, group) => {
		const command = new CommandGroup(group);

		registerFiles<SubCommand>(folder, subFilter, (cmd) => {
			command.addSubcommand(cmd);
		});

		commands.set(command.name, command);
	});

	registerFiles<Command>('buttons', filter, (btn) => {
		commands.set(btn.name, btn);
	});

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	registerFiles<any>('events', filter, (event) => {
		client.on(event.event, event.execute);
	});

	registerFiles<SignalRecieverOptions>('signals', filter, (signal) => {
		signals.set(signal.name, signal);
	});

	registerFiles<CronTask>('tasks', filter, (task) => {
		CronJob.from({
			cronTime: task.cron,
			onTick: () => task.execute(client),
			start: true
		})
	});

	GlobalFonts.loadFontsFromDir(path.resolve('./src/assets/fonts/'));
}());

async function registerFiles<T>(folder: string, filter: (fileName: string) => boolean, callback: (data: T) => void) {
	const files = fs.readdirSync(`./src/${folder}`);
	
	for (const file of files.filter(filter)) {
		const imported = await import(`./${folder}/${file.replace('.ts', '.js')}`);
		callback(imported.default);
	}
}

async function registerCommandGroups(folder: string, callback: (folder: string, group: CommandGroupSettings) => void) {
	const files = fs.readdirSync(`./src/${folder}`).filter(fileName => fs.lstatSync(`./src/${folder}/${fileName}`).isDirectory());

	for (const file of files) {
		const imported = await import(`./${folder}/${file}/command.js`);
		callback(`${folder}/${file}`, imported.default);
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
	const slashCommandsData: RESTPostAPIApplicationCommandsJSONBody[] = [];

	for (const [, command ] of commands) {
		if (command.type !== CommandType.Slash 
			&& command.type !== CommandType.Combo 
			&& command.type !== CommandType.ContextMenu) 
			continue;

		if (!command.slash && command.type === CommandType.Slash) {
			command.slash = new SlashCommandBuilder();
		} else if (!command.slash) {
			continue;
		}

		const slash = command.slash;

		if (!slash.name) {
			slash.setName(command.name);
		}

		if ('setDescription' in slash && !slash.description) {
			slash.setDescription(command.description);
		}
		
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

		setTimeout(async function() {
			const current = await client.application?.commands.fetch();
			const existing = current?.find(cmd => cmd.name === name);

			if (!command && existing) {
				await client.application?.commands.delete(existing);
				console.log('Probably deleted that slash command globally');
				return;
			} else if (!command) {
				console.log('Could not find command with the name "' + name + '"');
				return;
			}

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
