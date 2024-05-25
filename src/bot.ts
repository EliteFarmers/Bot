import { Client, GatewayIntentBits, Collection, ActivityType, Events } from 'discord.js';
import { Command, CommandGroup, CronTask, SubCommand, registerCommandGroups, registerFiles } from './classes/Command.js';
import { SignalRecieverOptions } from './classes/Signal.js';
import { ConnectToRMQ } from './api/rabbit.js';
import { GlobalFonts } from '@napi-rs/canvas';
import { CronJob } from 'cron';

import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

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
});

client.login(process.env.BOT_TOKEN);

process.on('unhandledRejection', (reason, p) => {
	console.error(reason, 'Unhandled Rejection at Promise', p);
}).on('uncaughtException', err => {
	console.error(err, 'Uncaught Exception thrown');
	process.exit(1);
});