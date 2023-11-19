import {
	Guild,
	GuildBasedChannel,
	GuildMember,
	Snowflake,
	PermissionFlagsBits,
	ChannelType,
	ActionRowBuilder,
	StringSelectMenuBuilder,
} from 'discord.js';
import { client } from '../index.js';
import { CommandAccess } from './Command.js';

export function isValidAccess(
	access: CommandAccess,
	type: ChannelType
): boolean {
	if (access === CommandAccess.Everywhere) return true;
	// If access is direct, return true if type is also a DM, else false
	if (access === CommandAccess.DirectMessage) return type === ChannelType.DM;
	// Access has to be GUILD at this point, so return true as long as the channel isn't a DM
	return type !== ChannelType.DM;
}

/**
 * Given a GuildID or Guild object, finds the given channel
 *
 * @param  {Snowflake|Guild} guild
 * @param  {Snowflake} channelId
 * @returns {Promise<GuildBasedChannel | undefined>}
 */
export async function FindChannel(
	guild: Snowflake | Guild,
	channelId: Snowflake
): Promise<GuildBasedChannel | undefined> {
	let guildObj = guild;

	if (typeof guildObj === 'string') {
		const fetchGuild = await FindGuild(guildObj);
		if (fetchGuild) {
			guildObj = fetchGuild;
		}
		return undefined;
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
export async function FindGuild(
	guildId: Snowflake
): Promise<Guild | undefined> {
	if (client.guilds.cache.has(guildId)) {
		return client.guilds.cache.get(guildId);
	}

	const guild = await client.guilds.fetch(guildId);
	return guild ?? undefined;
}
/**
 * Returns `true` if member has a role, or `false` otherwise. By default, a user having the ADMINISTRATOR permission will return `true` unless adminOverride is false.
 *
 * @param  {GuildMember} member
 * @param  {Snowflake} roleId
 * @param  {} adminOverride=true
 * @returns boolean
 */
export function HasRole(
	member?: GuildMember,
	roleId?: Snowflake,
	adminOverride = true
) {
	if (!member || !roleId) return false;

	const perms = member.permissions;
	const roles = member.roles?.cache?.map((role) => role.id);

	// If user has the admin perm and overide is true then return true
	if (adminOverride && perms && perms.has(PermissionFlagsBits.Administrator))
		return true;

	// Otherwise return whether or not the user has the role
	return roles.includes(roleId) ?? false;
}

export function GetEmbeddedTimestamp(unixSeconds: number, format = 'R') {
	return `<t:${Math.floor(unixSeconds)}:${format}>`;
}

export function GetCropURL(crop: string) {
	// Melon and cactus courtesy of https://github.com/thepotatoking55/2D-block-texture-pack/
	if (crop === 'Wheat')
		return 'https://media.discordapp.net/attachments/850812400747544657/958131911308488735/unknown.png';
	if (crop === 'Melon')
		return 'https://media.discordapp.net/attachments/850812400747544657/958131910310248518/unknown.png';
	if (crop === 'Cactus')
		return 'https://media.discordapp.net/attachments/850812400747544657/958131911543386192/unknown.png';
	if (crop === 'Pumpkin')
		return 'https://media.discordapp.net/attachments/850812400747544657/958131910721302588/unknown.png';
	if (crop === 'Carrot')
		return 'https://media.discordapp.net/attachments/850812400747544657/958131911916654622/unknown.png';
	if (crop === 'Potato')
		return 'https://media.discordapp.net/attachments/850812400747544657/958154868739153940/potato2.png';
	if (crop === 'Sugar Cane')
		return 'https://media.discordapp.net/attachments/850812400747544657/958131911757267035/unknown.png';
	if (crop === 'Nether Wart')
		return 'https://media.discordapp.net/attachments/850812400747544657/958131911111376937/unknown.png';
	if (crop === 'Mushroom')
		return 'https://media.discordapp.net/attachments/850812400747544657/958154868521058344/mushrooms.png';
	if (crop === 'Cocoa Beans')
		return 'https://media.discordapp.net/attachments/850812400747544657/958131912143167558/unknown.png';

	return undefined;
}

export function GetCropColor(crop: string) {
	if (crop === 'Wheat') return '#d5da45';
	if (crop === 'Melon') return '#bb170b';
	if (crop === 'Cactus') return '#3b5b1d';
	if (crop === 'Pumpkin') return '#a0560b';
	if (crop === 'Carrot') return '#ff8e09';
	if (crop === 'Potato') return '#e9ba62';
	if (crop === 'Sugar Cane') return '#82a859';
	if (crop === 'Nether Wart') return '#5c151a';
	if (crop === 'Mushroom') return '#725643';
	if (crop === 'Cocoa Beans') return '#61381d';

	// Default green
	return '#03fc7b';
}

export function GetCropEmoji(crop: string) {
	const emoji = CropEmojis[crop as keyof typeof CropEmojis];
	if (emoji) return `<:${emoji.name}:${emoji.id}>`;
	return '';
}

export function GetMedalEmoji(medal?: string) {
	switch (medal) {
	case 'bronze':
		return '<:bronze:1175629425623187507> '; 
	case 'silver':
		return '<:silver:1175629454043779243> '; 
	case 'gold':
		return '<:gold:1175629485333299342> '; 
	case 'platinum':
		return '<:platinum:1175629500738961500> '; 
	case 'diamond':
		return '<:diamond:1175629512663384104> ';
	}
	return '';
}

export function CropSelectRow(customId = 'crop-select', placeholder = 'Select a crop!') {
	const options = Object.entries(CropEmojis).map(([name, emoji], i) => ({
		label: name,
		value: i.toString(),
		emoji: emoji.id,
	}));

	const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
		new StringSelectMenuBuilder()
			.addOptions(...options)
			.setCustomId(customId)
			.setPlaceholder(placeholder)
	)

	return row;
}

const CropEmojis = {
	Cactus: {
		id: '1158914561454387370',
		name: 'cactus',
	},
	Carrot: {
		id: '1158914559843766372',
		name: 'carrot',
	},
	'Cocoa Beans': {
		id: '1158914476704284694',
		name: 'cocoa',
	},
	Melon: {
		id: '1158914475794112522',
		name: 'melon',
	},
	Mushroom: {
		id: '1158914474577768490',
		name: 'mushrooms',
	},
	'Nether Wart': {
		id: '1158914473252360282',
		name: 'netherwart',
	},
	Potato: {
		id: '1158914472329613433',
		name: 'potato',
	},
	Pumpkin: {
		id: '1158914471394279454',
		name: 'pumpkin',
	},
	'Sugar Cane': {
		id: '1158914469532016642',
		name: 'sugarcane',
	},
	Wheat: {
		id: '1158914469087432754',
		name: 'wheat',
	},
};
