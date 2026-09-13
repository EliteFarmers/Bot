import * as Sentry from '@sentry/node';
import { RemoveGuild, RequestGuildUpdate } from './elite';

const retryDelays = [250, 1_000, 3_000];

export async function syncGuildPresence(guildId: string, hasBot: boolean) {
	const operation = hasBot ? RequestGuildUpdate : RemoveGuild;
	let lastError: unknown;

	for (let attempt = 0; attempt <= retryDelays.length; attempt++) {
		try {
			const result = await operation(guildId);
			if (result.ok) return;
			if (result.response.status < 500) {
				capturePresenceError(
					new Error(`Guild presence update was rejected with HTTP ${result.response.status}`),
					guildId,
					hasBot,
				);
				return;
			}
			lastError = new Error(`Guild presence update failed with HTTP ${result.response.status}`);
		} catch (error) {
			lastError = error;
		}

		if (attempt < retryDelays.length) await delay(retryDelays[attempt]);
	}

	capturePresenceError(lastError, guildId, hasBot);
}

function capturePresenceError(error: unknown, guildId: string, hasBot: boolean) {
	Sentry.withScope((scope) => {
		scope.setTag('discord.guild_presence', hasBot ? 'joined' : 'left');
		scope.setContext('guild', { id: guildId });
		Sentry.captureException(error);
	});
}

function delay(milliseconds: number) {
	return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
