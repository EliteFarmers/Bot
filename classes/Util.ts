import { UserData } from "database/models/users";
import { Guild, GuildBasedChannel, GuildMember, Snowflake, ThreadChannelTypes, Permissions, PermissionString } from "discord.js";
import { client } from "../index";
import { CommandAccess } from "./Command";
import DataHandler from "./Database";

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
/**
 * Returns `true` if the number of `minutes` have passed since the last time the user's data was fetched or `false` otherwise.
 * `minutes` defaults to 10.
 * 
 * @param  {UserData} user
 * @param  {number} minutes 10
 * @returns boolean
 */
export function CanUpdate(user?: UserData, minutes = 10): boolean {
	if (!user || !user.updatedat) return true;

	// All of these are in milliseconds
	const lastUpdated = parseInt(user.updatedat);
	const updateInterval = minutes * 60 * 1000;
	const currentTime = Date.now();

	return lastUpdated + updateInterval < currentTime;
}
/**
 *  Returns `true` and updates the last updated time if the number of `minutes` have passed since the last time the user's data was fetched or `false` otherwise.
 * `minutes` defaults to 10.
 * 
 * @param  {UserData} user
 * @param  {number} minutes 10
 * @returns boolean
 */
export async function CanUpdateAndFlag(user: UserData, minutes = 10) {
	const canUpdate = CanUpdate(user, minutes);
	if (!canUpdate) return false;
	
	await DataHandler.update({ updatedat: Date.now().toString() }, { uuid: user.uuid });
	return canUpdate;
}
/**
 * Returns `true` if member has a role, or `false` otherwise. By default, a user having the ADMINISTRATOR permission will return `true` unless adminOverride is false.
 * 
 * @param  {GuildMember} member
 * @param  {Snowflake} roleId
 * @param  {} adminOverride=true
 * @returns boolean
 */
export function HasRole(member?: GuildMember, roleId?: Snowflake, adminOverride = true) {
	if (!member || !roleId) return false;

	const perms = ((member.permissions) as Readonly<Permissions>).toArray();
	const roles = member.roles?.cache?.map((role) => role.id);

	// If user has the admin perm and overide is true then return true 
	if (adminOverride && perms && perms.includes('ADMINISTRATOR' as PermissionString)) return true;

	// Otherwise return whether or not the user has the role
	return roles.includes(roleId) ?? false;
}