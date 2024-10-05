// eslint-disable-next-line @typescript-eslint/no-unused-vars
namespace NodeJS {
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	interface ProcessEnv {
		BOT_TOKEN: string;
		CLIENT_ID: string;

		ELITE_API_URL: string;
		ENTITLEMENT_CHANNEL: string;

		SENTRY_DSN?: string;

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