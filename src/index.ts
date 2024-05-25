import { ShardingManager } from 'discord.js';
import dotenv from 'dotenv';

dotenv.config();
const proccessArgs = process.argv.slice(2);

const manager = new ShardingManager('./bot.js', {
	token: process.env.TOKEN,
	shardArgs: proccessArgs
});

manager.on('shardCreate', (shard) => {
	console.log(`Launched shard ${shard.id}`);
});

process.on('unhandledRejection', (reason, p) => {
	console.error(reason, 'Unhandled Rejection at Promise', p);
}).on('uncaughtException', err => {
	console.error(err, 'Uncaught Exception thrown');
	process.exit(1);
});