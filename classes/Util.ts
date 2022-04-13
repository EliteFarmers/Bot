import { Guild, GuildBasedChannel, Snowflake, ThreadChannelTypes } from "discord.js";
import { client } from "../index";
import { CommandAccess } from "./Command";

export function isValidAccess(access: CommandAccess, type: 'DM' | 'GUILD_NEWS' | 'GUILD_TEXT' | ThreadChannelTypes): boolean {
	if (access === 'ALL') return true;
	// If access is direct, return true if type is also a DM, else false
	if (access === 'DIRECT') return (type === 'DM');
	// Access has to be GUILD at this point, so return true as long as the channel isn't a DM
	return (type !== 'DM');
}

/**
 * Given a GuildID or Guild object, finds the given channel
 * 
 * @param  {Snowflake|Guild} guild
 * @param  {Snowflake} channelId
 * @returns {Promise<GuildBasedChannel | undefined>}
 */
export async function FindChannel(guild: Snowflake | Guild, channelId: Snowflake): Promise<GuildBasedChannel | undefined> {
	let guildObj = guild;

	if (typeof guildObj === 'string') {
		const fetchGuild = await FindGuild(guildObj);
		if (fetchGuild) {
			guildObj = fetchGuild;
		} return undefined;
	}
	
	if (guildObj.channels.cache.has(channelId)) {
		return guildObj.channels.cache.get(channelId);
	}
	
	const channel = await guildObj.channels.fetch(channelId);
	return channel ?? undefined;
}
/**
 * Finds a guild given an ID or undefined
 * 
 * @param  {Snowflake} guildId
 * @returns {Promise<Guild | undefined>}
 */
export async function FindGuild(guildId: Snowflake): Promise<Guild | undefined> {
	if (client.guilds.cache.has(guildId)) {
		return client.guilds.cache.get(guildId);
	}
	
	const guild = await client.guilds.fetch(guildId);
	return guild ?? undefined;
}

export type Nullable<T> = T | null;