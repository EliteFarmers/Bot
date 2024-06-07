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
	GET('/account/{playerUuidOrIgn}', {
		params: {
			path: {
				playerUuidOrIgn: id,
			},
		},
	});

export const FetchUpdateAccount = (user: User, locale?: string) =>
	PATCH('/bot/account', {
		body: {
			id: user.id as unknown as number,
			username: user.username,
			discriminator: user.discriminator,
			avatar: user.avatar,
			locale: locale,
		},
	});

export const FetchWeight = (playerUuid: string) =>
	GET('/weight/{playerUuid}', {
		params: {
			path: { playerUuid },
		},
	});

export const FetchProfile = (playerUuid: string, profileUuid: string) =>
	GET('/profile/{playerUuid}/{profileUuid}', {
		params: {
			path: {
				playerUuid,
				profileUuid,
			},
		},
	});

export const FetchSelectedProfile = (playerUuid: string) =>
	GET('/profile/{uuid}/selected', {
		params: {
			path: {
				uuid: playerUuid,
			},
		},
	});

export const FetchContests = (playerUuid: string) =>
	GET('/contests/{playerUuid}', {
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
	GET('/leaderboard/rank/{leaderboardId}/{playerUuid}/{profileUuid}', {
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
	GET('/leaderboard/rank/{leaderboardId}/{playerUuid}/{profileUuid}', {
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
	GET('/leaderboard/{id}', {
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
	GET('/leaderboard/skill/{skillName}', {
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
	GET('/leaderboard/collection/{collection}', {
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
	GET('/bot/{guildId}', {
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
	GET('/bot/{guildId}/jacob', {
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
	PUT('/bot/{guildId}/jacob', {
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

export const GetGuildsToPing = () => GET('/bot/contestpings', {
	headers: {
		Authorization: `Bearer EliteDiscordBot ${process.env.BOT_TOKEN}`,
	},
});

export const DisableGuildContestPings = (id: string, reason: string) =>
	DELETE('/bot/contestpings/{guildId}', {
		params: {
			path: {
				guildId: id as unknown as number,
			},
			query: {
				reason,
			},
		},
		headers: {
			Authorization: `Bearer EliteDiscordBot ${process.env.BOT_TOKEN}`,
		},
	});

export const GetCurrentContests = () => GET('/contests/at/now', {});

export const SearchUsers = (query: string) =>
	GET('/account/search', {
		params: {
			query: {
				q: query,
			},
		},
	});

export const LinkAccount = (id: string, player: string) =>
	POST('/bot/account/{discordId}/{playerIgnOrUuid}', {
		params: {
			path: {
				discordId: id as unknown as number,
				playerIgnOrUuid: player,
			},
		},
		headers: {
			Authorization: `Bearer EliteDiscordBot ${process.env.BOT_TOKEN}`,
		},
	});

export const UnlinkAccount = (id: string, player: string) =>
	DELETE('/bot/account/{discordId}/{playerIgnOrUuid}', {
		params: {
			path: {
				discordId: id as unknown as number,
				playerIgnOrUuid: player,
			},
		},
		headers: {
			Authorization: `Bearer EliteDiscordBot ${process.env.BOT_TOKEN}`,
		},
	});

export const MakeAccountPrimary = (id: string, player: string) =>
	POST('/bot/account/{discordId}/{playerIgnOrUuid}/primary', {
		params: {
			path: {
				discordId: id as unknown as number,
				playerIgnOrUuid: player,
			},
		},
		headers: {
			Authorization: `Bearer EliteDiscordBot ${process.env.BOT_TOKEN}`,
		},
	});

export const FetchContestMonthlyBrackets = (year: number, month: number, months?: number) =>
	GET('/graph/medals/{sbYear}/{sbMonth}', {
		params: {
			path: {
				sbYear: year,
				sbMonth: month
			},
			query: {
				months
			}
		}
	});

export const FetchCurrentMonthlyBrackets = (months?: number) =>
	GET('/graph/medals/now', {
		params: {
			query: {
				months
			}
		}
	});

export const FetchContestYearlyMonthlyBrackets = (year: number, months?: number, years?: number) =>
	GET('/graph/medals/{sbYear}', {
		params: {
			path: {
				sbYear: year,
			},
			query: {
				months,
				years
			}
		}
	});

export const GrantUserBadge = (playerUuid: string, badgeId: number) =>
	POST('/bot/badges/{playerUuid}/{badgeId}', {
		params: {
			path: {
				playerUuid,
				badgeId
			}
		},
		headers: {
			Authorization: `Bearer EliteDiscordBot ${process.env.BOT_TOKEN}`,
		},
	});

export const FetchCollectionGraphs = (playerUuid: string, profileUuid: string, days?: number, perDay?: number) =>
	GET('/graph/{playerUuid}/{profileUuid}/crops', {
		params: {
			path: {
				playerUuid,
				profileUuid
			},
			query: {
				days,
				perDay
			}
		}
	});

export const FetchSkillGraphs = (playerUuid: string, profileUuid: string, days?: number, perDay?: number) =>
	GET('/graph/{playerUuid}/{profileUuid}/skills', {
		params: {
			path: {
				playerUuid,
				profileUuid
			},
			query: {
				days,
				perDay
			}
		}
	})

export const RequestGuildUpdate = (guildId: string) =>
	POST('/bot/guild/{guildId}', {
		params: {
			path: {
				guildId: guildId as unknown as number,
			},
		},
		headers: {
			Authorization: `Bearer EliteDiscordBot ${process.env.BOT_TOKEN}`,
		},
	});

export const UpdateGuildChannel = (guildId: string, channel: components['schemas']['IncomingGuildChannelDto']) =>
	POST('/bot/guild/{guildId}/channels', {
		params: {
			path: {
				guildId: guildId as unknown as number,
			},
		},
		body: channel,
		headers: {
			Authorization: `Bearer EliteDiscordBot ${process.env.BOT_TOKEN}`,
		},
	});

export const UpdateGuildRole = (guildId: string, role: components['schemas']['IncomingGuildRoleDto']) =>
	POST('/bot/guild/{guildId}/roles', {
		params: {
			path: {
				guildId: guildId as unknown as number,
			},
		},
		body: role,
		headers: {
			Authorization: `Bearer EliteDiscordBot ${process.env.BOT_TOKEN}`,
		},
	});

export const UpdateGuildMemberRoles = (guildId: string, userId: string, roles: string[]) =>
	PUT('/bot/guild/{guildId}/members/{userId}/roles', {
		params: {
			path: {
				guildId: guildId as unknown as number,
				userId: userId,
			},
		},
		body: roles,
		headers: {
			Authorization: `Bearer EliteDiscordBot ${process.env.BOT_TOKEN}`,
		},
	});