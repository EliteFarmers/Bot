import { User } from 'discord.js';
import createClient from 'openapi-fetch';
import { components, paths } from './api.d.js';

import dotenv from 'dotenv';
dotenv.config();

const { GET, PUT, POST, DELETE, PATCH } = createClient<paths>({
	baseUrl: process.env.ELITE_API_URL,
	headers: {
		'User-Agent': 'EliteDiscordBot',
		Authorization: `Bearer EliteDiscordBot ${process.env.BOT_TOKEN}`,
	},
});

export type UserSettings = components['schemas']['UserSettingsDto'];
export const FetchUserSettings = (id: string) =>
	GET('/account/{discordId}/settings', {
		params: {
			path: {
				discordId: id as unknown as number,
			},
		},
	});

export const FetchAccount = (id: string) =>
	GET('/account/{player}', {
		params: {
			path: {
				player: id,
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

export const FetchWeight = (playerUuid: string, collections = false) =>
	GET('/weight/{playerUuid}', {
		params: {
			path: { playerUuid },
			query: { collections },
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
	GET('/profile/{playerUuid}/selected', {
		params: {
			path: {
				playerUuid: playerUuid,
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

export const FetchWeightLeaderboardRank = (playerUuid: string, profileUuid: string) =>
	GET('/leaderboard/rank/{leaderboard}/{playerUuid}/{profileUuid}', {
		params: {
			path: {
				leaderboard: 'farmingweight',
				playerUuid,
				profileUuid,
			},
		},
	});

export const FetchLeaderboardRankings = (playerUuid: string, profileUuid: string) =>
	GET('/leaderboard/ranks/{playerUuid}/{profileUuid}', {
		params: {
			path: {
				playerUuid,
				profileUuid,
			},
		},
	});

export const FetchLeaderboardRank = (leaderboardId: string, playerUuid: string, profileUuid: string) =>
	GET('/leaderboard/rank/{leaderboard}/{playerUuid}/{profileUuid}', {
		params: {
			path: {
				leaderboard: leaderboardId,
				playerUuid,
				profileUuid,
			},
		},
	});

export const FetchLeaderboardSlice = (leaderboardId: string, offset = 0, limit = 20) =>
	GET('/leaderboard/{leaderboard}', {
		params: {
			path: {
				leaderboard: leaderboardId,
			},
			query: {
				offset,
				limit,
				new: true,
			},
		},
	});

export const FetchGuild = (id: string) =>
	GET('/bot/{discordId}', {
		params: {
			path: {
				discordId: id as unknown as number,
			},
		},
		headers: {
			Authorization: `Bearer EliteDiscordBot ${process.env.BOT_TOKEN}`,
		},
	});

export const FetchGuildJacob = (id: string) =>
	GET('/bot/{discordId}/jacob', {
		params: {
			path: {
				discordId: id as unknown as number,
			},
		},
		headers: {
			Authorization: `Bearer EliteDiscordBot ${process.env.BOT_TOKEN}`,
		},
	});

export const UpdateGuildJacob = (id: string, data: components['schemas']['GuildJacobLeaderboardFeature']) =>
	PUT('/bot/{discordId}/jacob', {
		params: {
			path: {
				discordId: id as unknown as number,
			},
		},
		body: data,
		headers: {
			Authorization: `Bearer EliteDiscordBot ${process.env.BOT_TOKEN}`,
		},
	});

export const GetGuildsToPing = () =>
	GET('/bot/contestpings', {
		headers: {
			Authorization: `Bearer EliteDiscordBot ${process.env.BOT_TOKEN}`,
		},
	});

export const DisableGuildContestPings = (id: string, reason: string) =>
	DELETE('/bot/contestpings/{discordId}', {
		params: {
			path: {
				discordId: id as unknown as number,
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
	POST('/bot/account/{discordId}/{player}', {
		params: {
			path: {
				discordId: id as unknown as number,
				player: player,
			},
		},
		headers: {
			Authorization: `Bearer EliteDiscordBot ${process.env.BOT_TOKEN}`,
		},
	});

export const UnlinkAccount = (id: string, player: string) =>
	DELETE('/bot/account/{discordId}/{player}', {
		params: {
			path: {
				discordId: id as unknown as number,
				player: player,
			},
		},
		headers: {
			Authorization: `Bearer EliteDiscordBot ${process.env.BOT_TOKEN}`,
		},
	});

export const MakeAccountPrimary = (id: string, player: string) =>
	POST('/bot/account/{discordId}/{player}/primary', {
		params: {
			path: {
				discordId: id as unknown as number,
				player: player,
			},
		},
		headers: {
			Authorization: `Bearer EliteDiscordBot ${process.env.BOT_TOKEN}`,
		},
	});

export const FetchContestMonthlyBrackets = (year: number, month: number, months?: number) =>
	GET('/graph/medals/{year}/{month}', {
		params: {
			path: {
				year: year,
				month: month,
			},
			query: {
				months,
			},
		},
	});

export const FetchCurrentMonthlyBrackets = (months?: number) =>
	GET('/graph/medals/now', {
		params: {
			query: {
				months,
			},
		},
	});

export const FetchContestYearlyMonthlyBrackets = (year: number, months?: number, years?: number) =>
	GET('/graph/medals/{year}', {
		params: {
			path: {
				year: year,
			},
			query: {
				months,
				years,
			},
		},
	});

export const GrantUserBadge = (player: string, badgeId: number) =>
	POST('/bot/badges/{player}/{badgeId}', {
		params: {
			path: {
				player,
				badgeId,
			},
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
				profileUuid,
			},
			query: {
				days,
				perDay,
			},
		},
	});

export const FetchSkillGraphs = (playerUuid: string, profileUuid: string, days?: number, perDay?: number) =>
	GET('/graph/{playerUuid}/{profileUuid}/skills', {
		params: {
			path: {
				playerUuid,
				profileUuid,
			},
			query: {
				days,
				perDay,
			},
		},
	});

export const FetchContest = (timestamp: number) =>
	GET('/contests/{timestamp}', {
		params: {
			path: {
				timestamp,
			},
		},
	});

export const FetchWeightStyles = () => GET('/product/styles', {});

export const FetchProduct = (skuId: string) =>
	GET('/product/{discordId}', {
		params: {
			path: {
				discordId: skuId as unknown as number,
			},
		},
	});

export const FetchLeaderboardList = () => GET('/leaderboards', {});

export const RequestGuildUpdate = (guildId: string) =>
	POST('/bot/guild/{discordId}', {
		params: {
			path: {
				discordId: guildId as unknown as number,
			},
		},
		headers: {
			Authorization: `Bearer EliteDiscordBot ${process.env.BOT_TOKEN}`,
		},
	});

export const UpdateGuildChannel = (guildId: string, channel: components['schemas']['IncomingGuildChannelDto']) =>
	POST('/bot/guild/{discordId}/channels', {
		params: {
			path: {
				discordId: guildId as unknown as number,
			},
		},
		body: channel,
		headers: {
			Authorization: `Bearer EliteDiscordBot ${process.env.BOT_TOKEN}`,
		},
	});

export const UpdateGuildRole = (guildId: string, role: components['schemas']['IncomingGuildRoleDto']) =>
	POST('/bot/guild/{discordId}/roles', {
		params: {
			path: {
				discordId: guildId as unknown as number,
			},
		},
		body: role,
		headers: {
			Authorization: `Bearer EliteDiscordBot ${process.env.BOT_TOKEN}`,
		},
	});

export const UpdateGuildMemberRoles = (guildId: string, userId: string, roles: string[]) =>
	POST('/bot/guild/{discordId}/members/{userId}/roles', {
		params: {
			path: {
				discordId: guildId as unknown as number,
				userId: userId,
			},
		},
		body: roles,
		headers: {
			Authorization: `Bearer EliteDiscordBot ${process.env.BOT_TOKEN}`,
		},
	});

export const RefreshUserEntitlements = (discordId: string) =>
	POST('/bot/account/{discordId}/purchases', {
		params: {
			path: {
				discordId: discordId as unknown as number,
			},
		},
		headers: {
			Authorization: `Bearer EliteDiscordBot ${process.env.BOT_TOKEN}`,
		},
	});
