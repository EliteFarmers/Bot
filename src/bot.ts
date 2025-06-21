import './sentry.js';
import { GlobalFonts } from '@napi-rs/canvas';
import * as Sentry from '@sentry/node';
import { CronJob } from 'cron';
import { ActivityType, Client, ClientEvents, Collection, Events, GatewayIntentBits } from 'discord.js';
import dotenv from 'dotenv';
import path from 'path';
import { ConnectToRedis } from './api/redis.js';
import { CommandGroup, CronTask, EliteCommand } from './classes/commands/index.js';
import { registerCommandGroups, registerFiles } from './classes/register.js';
import { SignalRecieverOptions } from './classes/Signal.js';
import { LoadWeightStyles } from './weight/custom.js';

dotenv.config();

export const client = new Client({
	intents: [GatewayIntentBits.Guilds],
});

export const commands = new Collection<string, CommandGroup | EliteCommand>();
export const signals = new Collection<string, SignalRecieverOptions>();

const deploying = process.argv.some((arg) => arg.includes('deploy'));

/*
 * There is surely a better way to load these, but this is fine for now
 * as it only runs once on startup and allows you to only create a new file.
 */
(async function () {
	if (deploying) {
		return;
	}

	const filter = (fileName: string) => fileName.endsWith('.ts') || fileName.endsWith('.js');

	registerFiles<EliteCommand>('commands', filter, (cmd) => {
		commands.set(cmd.name, cmd);
	});

	const subFilter = (fileName: string) => filter(fileName) && !fileName.includes('command');

	registerCommandGroups('commands', async (folder, group) => {
		const command = new CommandGroup(group);

		await registerFiles<EliteCommand>(folder, subFilter, (cmd) => {
			command.addSubcommand(cmd);
		});

		commands.set(command.name, command);
	});

	registerFiles<EliteCommand>('buttons', filter, (btn) => {
		commands.set(btn.name, btn);
	});

	registerFiles<{
		event: keyof ClientEvents;
		execute: Parameters<typeof client.on<keyof ClientEvents>>[1];
	}>('events', filter, (event) => {
		client.on(event.event, event.execute);
	});

	registerFiles<SignalRecieverOptions>('signals', filter, (signal) => {
		signals.set(signal.name, signal);
	});

	registerFiles<CronTask>('tasks', filter, (task) => {
		CronJob.from({
			cronTime: task.cron,
			onTick: () => task.execute(client),
			start: true,
		});
	});

	GlobalFonts.loadFontsFromDir(path.resolve('./src/assets/fonts/'));
})();

client.once(Events.ClientReady, async () => {
	setTimeout(updateActivity, 1000 * 30); // 30 seconds to wait for shards to be ready
	setInterval(updateActivity, 1000 * 60 * 60 * 2); // Update count every 2 hours

	LoadWeightStyles();
	setInterval(LoadWeightStyles, 1000 * 60 * 30); // Update weight styles every 30 minutes

	console.log('Ready!');

	ConnectToRedis();
});

async function updateActivity() {
	if (!client.user) return;

	await client.application?.fetch();
	const guilds = client.application?.approximateGuildCount ?? 0;
	const users = client.application?.approximateUserInstallCount ?? 0;
	const installs = guilds + users;

	console.log(
		`Updating activity to ${installs.toLocaleString()} installs (${guilds} guilds, ${users} users) (𝚫${client.shard?.ids[0] ?? '0'})`,
	);
	client.user.setActivity(`${installs.toLocaleString()} installs (𝚫${client.shard?.ids[0] ?? '0'})`, {
		type: ActivityType.Watching,
	});
}

if (!deploying) {
	client.login(process.env.BOT_TOKEN);
}

process
	.on('unhandledRejection', (reason, p) => {
		console.error(reason, 'Unhandled Rejection at Promise', p);
	})
	.on('uncaughtException', (err) => {
		Sentry.captureException(err);
		console.error(err, 'Uncaught Exception thrown');
		process.exit(1);
	});
