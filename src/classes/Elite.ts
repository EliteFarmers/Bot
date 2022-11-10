import type { AccountInfo, APISettings, PlayerInfo, Profiles } from "./skyblock";

const ApiOrigin = 'https://elitebot.dev/api';

type Failure = {
	success: false;
	error?: string;
};

export async function FetchAccount(ign: string): Promise<AccountInfo|Failure> {
	return await genericFetch(`/account/${ign}`) as AccountInfo|Failure;
}

export async function FetchAccountFromDiscord(discordId: string): Promise<AccountInfo|Failure> {
	return await genericFetch(`/account/discord/${discordId}`) as AccountInfo|Failure;
}

export async function FetchPlayer(uuid: string): Promise<PlayerInfo|Failure> {
	return await genericFetch(`/player/${uuid}`) as PlayerInfo|Failure;
}

export async function FetchProfiles(uuid: string): Promise<Profiles|Failure> {
	return await genericFetch(`/profiles/${uuid}`) as Profiles|Failure;
}

export async function FetchLeaderboard(options?: { start?: number, limit?: number }) {
	const path = '/leaderboard/weight' + (options ? `?start=${options.start ?? 0}&limit=${options.limit ?? 10}` : '');
	return await genericFetch(path) as LeaderboardEntry[]|Failure;
}

export async function FetchPlayerRanking(uuid: string) {
	return await genericFetch(`/leaderboard/weight/${uuid}`) as Promise<{ success: true, entry: LeaderboardEntry }|Failure>;
}

export async function FetchPlayerWeight(uuid: string, profileId?: string) {
	if (profileId) {
		return await genericFetch(`/weight/${uuid}/${profileId}`) as Promise<WeightInfo|Failure>;
	}
	return await genericFetch(`/weight/${uuid}`) as Promise<UserInfo|Failure>;
}

async function genericFetch(path: string): Promise<unknown|Failure> {
	const req = await fetch(ApiOrigin + path);

	if (req.status !== 200) {
		return {
			success: false,
			error: 'Could not fetch data.'
		}
	}

	try {
		return await req.json();
	} catch (e) {
		return {
			success: false,
			error: 'Failed to parse response',
		};
	}
}

export interface LeaderboardEntry {
	uuid: string;
	ign: string;
	rank: number;
	weight: number;
	profile: string;
}

export interface UserInfo {
	linked: boolean;
	id: string | null;
	cheating: boolean;
	times_fetched: number;
	highest: HighestWeights;
	profiles: ProfileWeightInfo;
}

export interface DiscordUser {
	id: string;
	username: string;
	discriminator: string;
	avatar: string;
	avatar_decoration?: string | null;
	email: string;
	verified: boolean;
	mfa_enabled: boolean;
	locale: string;
	premium_type?: string;
	public_flags: number;
	flags: number;
	premium_since?: string;
	banner?: string | null;
	banner_color?: string | null;
	accent_color?: string | null;
}

export interface WeightBreakdown {
	total: number;
	bonus: number;
	sources: Record<string, number>;
	bonuses: Record<string, number>;
}

export interface WeightInfo {
	farming: WeightBreakdown;
	api: APISettings;
	cute_name: string;
}

export interface HighestWeights {
	farming: {
		weight: number;
		profile: string;
	};
}

export type ProfileWeightInfo = Partial<Record<string, WeightInfo>>;