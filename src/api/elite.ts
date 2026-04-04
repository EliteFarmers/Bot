import { User } from 'discord.js';
import {
	disableContestPingsPings,
	getAccount,
	getAccountSettings,
	getBotGuild,
	getContestPings,
	getContestsAtTimestamp,
	getCropGraphs,
	getCurrentContests,
	getCurrentMedalBrackets,
	getGuide,
	getJacobFeature,
	getLeaderboard,
	getLeaderboards,
	getMedalBrackets,
	getMedalBracketsGraph,
	getPlayerData,
	getPlayerLeaderboardRanks,
	getPlayerParticipations,
	getPlayerRank2,
	getProduct,
	getProfile,
	getSelectedProfile,
	getSkillGraphs,
	getSpecifiedSkyblockItems,
	getStyles,
	getWeightForProfiles,
	grantBadge,
	linkAccountBot,
	makePrimaryAccount,
	refreshGuild,
	refreshUserPurchases,
	searchAccounts,
	submitScore,
	unlinkAccountBot,
	updateDiscordAccount,
	updateGuildChannel,
	updateGuildMemberRoles,
	updateGuildRole,
	updateJacobFeature,
} from './client/EliteAPI';
import {
	GuildJacobLeaderboardFeature,
	IncomingGuildChannelDto,
	IncomingGuildRoleDto,
	UserSettingsDto,
} from './schemas';

export type UserSettings = UserSettingsDto;

export const FetchUserSettings = (id: string) => getAccountSettings(id as unknown as number);

export const FetchAccount = (id: string) => getAccount(id);

export const FetchUpdateAccount = (user: User, locale?: string) =>
	updateDiscordAccount({
		id: user.id as unknown as number,
		username: user.username,
		discriminator: user.discriminator,
		avatar: user.avatar,
		locale,
	});

export const FetchWeight = (playerUuid: string, collections = false) =>
	getWeightForProfiles(playerUuid, { collections });

export const FetchProfile = (playerUuid: string, profileUuid: string) => getProfile(playerUuid, profileUuid);

export const FetchSelectedProfile = (playerUuid: string) => getSelectedProfile(playerUuid);

export const FetchContests = (playerUuid: string) => getPlayerParticipations(playerUuid);

export const FetchWeightLeaderboardRank = (playerUuid: string, profileUuid: string) =>
	getPlayerRank2('farmingweight', playerUuid, profileUuid);

export const FetchLeaderboardRankings = (playerUuid: string, profileUuid: string, max = 10_000) =>
	getPlayerLeaderboardRanks(playerUuid, profileUuid, { max });

export const FetchLeaderboardRank = (leaderboardId: string, playerUuid: string, profileUuid: string) =>
	getPlayerRank2(leaderboardId, playerUuid, profileUuid);

export const FetchLeaderboardSlice = (leaderboardId: string, offset = 0, limit = 20) =>
	getLeaderboard(leaderboardId, { offset, limit });

export const FetchGuild = (id: string) => getBotGuild(id as unknown as number);

export const FetchGuildJacob = (id: string) => getJacobFeature(id as unknown as number);

export const SubmitJacobScore = ({
	guildId,
	lbId,
	discordUserId,
	roles,
}: {
	guildId: string;
	lbId: string;
	discordUserId: string;
	roles: string[];
}) =>
	submitScore(guildId as unknown as number, lbId, roles, {
		discordUserId: discordUserId as unknown as number,
	});

export const UpdateGuildJacob = (id: string, data: GuildJacobLeaderboardFeature) =>
	updateJacobFeature(id as unknown as number, data);

export const GetGuildsToPing = () => getContestPings();

export const DisableGuildContestPings = (id: string, reason: string) =>
	disableContestPingsPings(id as unknown as number, { reason });

export const GetCurrentContests = () => getCurrentContests();

export const SearchUsers = (query: string) => searchAccounts({ q: query });

export const LinkAccount = (id: string, player: string) => linkAccountBot(id as unknown as number, player);

export const UnlinkAccount = (id: string, player: string) => unlinkAccountBot(id as unknown as number, player);

export const MakeAccountPrimary = (id: string, player: string) => makePrimaryAccount(id as unknown as number, player);

export const FetchContestMonthlyBrackets = (year: number, month: number, months?: number) =>
	getMedalBrackets(year, month, { months });

export const FetchCurrentMonthlyBrackets = (months?: number) => getCurrentMedalBrackets({ months });

export const FetchContestYearlyMonthlyBrackets = (year: number, months?: number, years?: number) =>
	getMedalBracketsGraph(year, { months, years });

export const GrantUserBadge = (player: string, badgeId: number) => grantBadge(player, badgeId);

export const FetchCollectionGraphs = (playerUuid: string, profileUuid: string, days?: number, perDay?: number) =>
	getCropGraphs(playerUuid, profileUuid, { days, perDay });

export const FetchSkillGraphs = (playerUuid: string, profileUuid: string, days?: number, perDay?: number) =>
	getSkillGraphs(playerUuid, profileUuid, { days, perDay });

export const FetchPlayerData = (player: string) => getPlayerData(player);

export const FetchContest = (timestamp: number) => getContestsAtTimestamp(timestamp, { limit: -1 });

export const FetchGuide = (guideId: string) => getGuide(guideId, { draft: false });

export const FetchWeightStyles = () => getStyles();

export const FetchProduct = (skuId: string) => getProduct(skuId as unknown as number);

export const FetchLeaderboardList = () => getLeaderboards();

export const RequestGuildUpdate = (guildId: string) => refreshGuild(guildId as unknown as number);

export const UpdateGuildChannel = (guildId: string, channel: IncomingGuildChannelDto) =>
	updateGuildChannel(guildId as unknown as number, channel);

export const UpdateGuildRole = (guildId: string, role: IncomingGuildRoleDto) =>
	updateGuildRole(guildId as unknown as number, role);

export const UpdateGuildMemberRoles = (guildId: string, userId: string, roles: string[]) =>
	updateGuildMemberRoles(guildId as unknown as number, userId, roles);

export const RefreshUserEntitlements = (discordId: string) => refreshUserPurchases(discordId as unknown as number);

export const FetchProducts = (list: string[]) => getSpecifiedSkyblockItems({ items: list });
