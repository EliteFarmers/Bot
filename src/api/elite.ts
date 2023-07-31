import createClient from 'openapi-fetch';
import { components, paths } from './api.d';
import { User } from 'discord.js';

const { GET, PUT, POST, DELETE, PATCH } = createClient<paths>({
	baseUrl: process.env.ELITE_API_URL,
	headers: {
		'User-Agent': 'EliteDiscordBot',
		Authorization: `Bearer EliteDiscordBot ${process.env.BOT_TOKEN}`,
	},
});

export const FetchAccount = (id: string) =>
	GET('/Account/{playerUuidOrIgn}', {
		params: {
			path: {
				playerUuidOrIgn: id,
			},
		},
	});

export const FetchUpdateAccount = (user: User, locale?: string) =>
	PATCH('/Bot/account', {
		body: {
			id: user.id as unknown as number,
			username: user.username,
			discriminator: user.discriminator,
			avatar: user.avatar,
			locale: locale,
		},
	});

export const FetchWeight = (playerUuid: string) =>
	GET('/Weight/{playerUuid}', {
		params: {
			path: { playerUuid },
		},
	});

export const FetchProfile = (playerUuid: string, profileUuid: string) =>
	GET('/Profile/{playerUuid}/{profileUuid}', {
		params: {
			path: {
				playerUuid,
				profileUuid,
			},
		},
	});

export const FetchSelectedProfile = (playerUuid: string) =>
	GET('/Profile/{uuid}/Selected', {
		params: {
			path: {
				uuid: playerUuid,
			},
		},
	});

export const FetchContests = (playerUuid: string) =>
	GET('/Contests/{playerUuid}', {
		params: {
			path: {
				playerUuid,
			},
		},
	});

export const FetchWeightLeaderboardRank = (
	playerUuid: string,
	profileUuid: string
) =>
	GET('/Leaderboard/rank/{leaderboardId}/{playerUuid}/{profileUuid}', {
		params: {
			path: {
				leaderboardId: 'farmingweight',
				playerUuid,
				profileUuid,
			},
		},
	});

export const FetchLeaderboardRank = (
	leaderboardId: string,
	playerUuid: string,
	profileUuid: string
) =>
	GET('/Leaderboard/rank/{leaderboardId}/{playerUuid}/{profileUuid}', {
		params: {
			path: {
				leaderboardId,
				playerUuid,
				profileUuid,
			},
		},
	});

export const FetchLeaderboardSlice = (
	leaderboardId: string,
	offset = 0,
	limit = 20
) =>
	GET('/Leaderboard/{id}', {
		params: {
			path: {
				id: leaderboardId,
			},
			query: {
				offset,
				limit,
			},
		},
	});

export const FetchSkillLeaderboardSlice = (
	leaderboardId: string,
	offset = 0,
	limit = 20
) =>
	GET('/Leaderboard/skill/{skillName}', {
		params: {
			path: {
				skillName: leaderboardId,
			},
			query: {
				offset,
				limit,
			},
		},
	});

export const FetchCollectionLeaderboardSlice = (
	leaderboardId: string,
	offset = 0,
	limit = 20
) =>
	GET('/Leaderboard/collection/{collection}', {
		params: {
			path: {
				collection: leaderboardId,
			},
			query: {
				offset,
				limit,
			},
		},
	});

export const FetchGuild = (id: string) =>
	GET('/Bot/{guildId}', {
		params: {
			path: {
				guildId: id as unknown as number,
			},
		},
		headers: {
			Authorization: `Bearer EliteDiscordBot ${process.env.BOT_TOKEN}`,
		},
	});

export const FetchGuildJacob = (id: string) =>
	GET('/Bot/{guildId}/jacob', {
		params: {
			path: {
				guildId: id as unknown as number,
			},
		},
		headers: {
			Authorization: `Bearer EliteDiscordBot ${process.env.BOT_TOKEN}`,
		},
	});

export const UpdateGuildJacob = (
	id: string,
	data: components['schemas']['GuildJacobLeaderboardFeature']
) =>
	PUT('/Bot/{guildId}/jacob', {
		params: {
			path: {
				guildId: id as unknown as number,
			},
		},
		body: data,
		headers: {
			Authorization: `Bearer EliteDiscordBot ${process.env.BOT_TOKEN}`,
		},
	});

export const LinkAccount = (id: string, player: string) =>
	POST('/Bot/account/{discordId}/{playerIgnOrUuid}', {
		params: {
			path: {
				discordId: id as unknown as number,
				playerIgnOrUuid: player,
			},
		},
	});

export const UnlinkAccount = (id: string, player: string) =>
	DELETE('/Bot/account/{discordId}/{playerIgnOrUuid}', {
		params: {
			path: {
				discordId: id as unknown as number,
				playerIgnOrUuid: player,
			},
		},
	});

export const MakeAccountPrimary = (id: string, player: string) =>
	POST('/Bot/account/{discordId}/{playerIgnOrUuid}/primary', {
		params: {
			path: {
				discordId: id as unknown as number,
				playerIgnOrUuid: player,
			},
		},
	});
