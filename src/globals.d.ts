namespace NodeJS {
	interface ProcessEnv {
		BOT_TOKEN: string;
		CLIENT_ID: string;

		ELITE_API_URL: string;
		ENTITLEMENT_CHANNEL: string;

		REDIS_URL: string;
		REDIS_PASSWORD: string;

		RABBITMQ_PORT: string;
		RABBITMQ_HOSTNAME: string;
		RABBITMQ_USERNAME: string;
		RABBITMQ_PASSWORD: string;

		ELITE_DISCORD_ID: string;
		ELITE_FARMER_ROLE: string;
	}
}
