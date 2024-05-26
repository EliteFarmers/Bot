import { connect } from 'amqplib';
import { Signal } from '../classes/Signal.js';
import { client, signals } from '../bot.js';

const errorMsg = 'Failed to connect to RabbitMQ, message queue from EliteAPI will not work.\nPlease check your RABBITMQ_URL env variable.\nThis is not an issue if you are not using EliteAPI\'s message queue.';

export async function ConnectToRMQ() {
	const url = process.env.RABBITMQ_HOSTNAME;

	if (url === 'skip') return;

	if (!url) {
		console.error(errorMsg);
		return;
	}

	let connection; 
	
	try {
		connection = await connect({
			hostname: process.env.RABBITMQ_HOSTNAME,
			port: process.env.RABBITMQ_PORT ? +process.env.RABBITMQ_PORT : undefined,
			password: process.env.RABBITMQ_PASSWORD,
			username: process.env.RABBITMQ_USERNAME,
		});
	} catch (error) {
		console.error(errorMsg);
		return;
	}

	if (!connection) {
		console.error(errorMsg);
		return;
	}

	const channel = await connection.createChannel();
	const exchange = 'eliteapi';

	channel.assertExchange(exchange, 'fanout', { durable: false });
	const queue = await channel.assertQueue('', { durable: false });
	channel.bindQueue(queue.queue, exchange, '');

	channel.consume(queue.queue, async (msg) => {
		if (!msg) return;
		const signal = new Signal(msg.content.toString());

		if (!signal.name || !signal.authorId || !signal.guildId) return;
		if (!client.guilds.cache.has(signal.guildId)) return; // Wrong shard

		const info = signals.get(signal.name);
		if (!info) return;

		if (!await hasPermissions(signal.authorId, signal.guildId, info.permissions)) return;

		try {
			info?.execute(signal, client);
		} catch (error) {
			console.error(error);
		}
	}, { noAck: true });
}

async function hasPermissions(userId: string, guildId: string, permissions?: bigint) {
	// Return true if no permissions are required
	if (!permissions) return true;

	// Get user permissions
	const guild = client.guilds.cache.get(guildId);
	if (!guild) return false;

	const member = guild.members.cache.get(userId) ?? (await guild.members.fetch(userId));
	if (!member) return false;

	const perms = member.permissions;
	if (!perms) return false;

	if (perms && perms.has(permissions)) {
		// User has permissions
		return true;
	}

	return false;
}