import { ShardingManager } from 'discord.js';
import dotenv from 'dotenv';

dotenv.config();
const proccessArgs = process.argv.slice(1);

const manager = new ShardingManager('./dist/bot.js', {
	token: process.env.BOT_TOKEN,
	totalShards: 'auto',
	shardArgs: proccessArgs,
});

manager.on('shardCreate', (shard) => {
	console.log(`Launched shard ${shard.id}`);
});

manager.spawn();

process
	.on('unhandledRejection', (reason, p) => {
		console.error(reason, 'Unhandled Rejection at Promise', p);
	})
	.on('uncaughtException', (err) => {
		console.error(err, 'Uncaught Exception thrown');
		process.exit(1);
	});
