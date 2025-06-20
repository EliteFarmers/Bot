import { createClient, RedisClientOptions, RedisFunctions, RedisModules, RedisScripts } from 'redis';
import { client, client as discordClient, signals } from '../bot.js';
import { Signal, SignalRecieverOptions } from '../classes/Signal.js';

// Channel name needs to match the one used in the EliteAPI
const REDIS_CHANNEL_NAME = 'eliteapi_messages';

const errorMsg =
	"Failed to connect to Redis, message queue from EliteAPI will not work.\nPlease check your REDIS_URL (or REDIS_HOST/PORT/PASSWORD) env variables.\nThis is not an issue if you are not using EliteAPI's message queue.";

export async function ConnectToRedis() {
	// --- Use Redis environment variables ---
	const redisUrl = process.env.REDIS_URL;
	const redisHost = process.env.REDIS_HOST;
	const redisPort = process.env.REDIS_PORT ? +process.env.REDIS_PORT : 6379;
	const redisPassword = process.env.REDIS_PASSWORD;

	if (redisUrl === 'skip' || redisHost === 'skip') {
		console.log('Skipping Redis connection!');
		return;
	}

	const redisOptions: RedisClientOptions<RedisModules, RedisFunctions, RedisScripts> = {};
	if (redisUrl) {
		redisOptions.url = redisUrl;
	} else if (redisHost) {
		redisOptions.socket = {
			host: redisHost,
			port: redisPort,
		};
	} else {
		console.error(errorMsg + '\nNeither REDIS_URL nor REDIS_HOST is defined.');
		return;
	}
	if (redisPassword) {
		redisOptions.password = redisPassword;
	}

	// Create the main redis client
	const redisClient = createClient(redisOptions);

	redisClient.on('error', (err) => {
		console.error('Redis Client Error:', err);
	});

	try {
		await redisClient.connect();
		console.log('Connected to Redis successfully.');
	} catch (err) {
		console.error('Failed to connect to Redis:', err);
		console.error(errorMsg);
		await redisClient.quit().catch(() => undefined);
		return;
	}

	// Use duplicate client to not block the main client
	const subscriber = redisClient.duplicate();

	subscriber.on('error', (err) => {
		console.error('Redis Subscriber Client Error:', err);
	});

	try {
		await subscriber.connect();
		console.log('Redis Subscriber client connected.');

		// Subscribe to the specific channel
		await subscriber.subscribe(REDIS_CHANNEL_NAME, async (message, channel) => {
			if (channel !== REDIS_CHANNEL_NAME) return;

			try {
				await handleMessage(message);
			} catch (error) {
				console.error('Error processing message from Redis:', error);
				console.error('Original message:', message); // Log the problematic message
			}
		});

		console.log(`Subscribed to Redis channel: ${REDIS_CHANNEL_NAME}`);
	} catch (err) {
		console.error('Failed to connect or subscribe with Redis subscriber client:', err);
		await subscriber.quit().catch(() => undefined);
		await redisClient.quit().catch(() => undefined);
	}
}

async function handleMessage(message: string) {
	const signal = new Signal(message);

	if (!signal.name || !signal.authorId || !signal.guildId) {
		console.warn('Received invalid signal (missing fields):', message);
		return;
	}

	// Check if the message is for a guild handled by this shard
	if (!discordClient.guilds.cache.has(signal.guildId)) {
		// console.debug(`Ignoring signal for guild ${signal.guildId} (different shard)`);
		return;
	}

	const info = signals.get(signal.name) as SignalRecieverOptions | undefined; // Ensure type safety
	if (!info) {
		console.warn(`No signal handler found for signal name: ${signal.name}`);
		return;
	}

	// Check permissions
	if (!(await hasPermissions(signal.authorId, signal.guildId, info.permissions))) {
		console.warn(`User ${signal.authorId} lacks permissions for signal ${signal.name} in guild ${signal.guildId}`);
		// await signal.fail('Permission Denied', 'You do not have the required permissions to trigger this action.');
		return;
	}

	await Promise.resolve(info.execute(signal, discordClient)).catch((error) => {
		console.error(`Error executing signal handler for ${signal.name}:`, error);

		signal.fail('Action Failed', 'An internal error occurred while processing your request.').catch(() => undefined);
	});
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
