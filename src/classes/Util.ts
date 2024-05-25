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
import { client } from '../bot.js';
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
	if (crop === 'Cactus')
		return 'https://media.discordapp.net/attachments/1115349089782087731/1191978759197294602/cactus.png';
	if (crop === 'Carrot')
		return 'https://media.discordapp.net/attachments/1115349089782087731/1191978766868697168/carrot.png';
	if (crop === 'Cocoa Beans')
		return 'https://media.discordapp.net/attachments/1115349089782087731/1191978774053535804/cocoa_beans.png';
	if (crop === 'Melon')
		return 'https://media.discordapp.net/attachments/1115349089782087731/1191978782832214100/melon.png';
	if (crop === 'Mushroom')
		return 'https://media.discordapp.net/attachments/1115349089782087731/1191978789526306846/mushroom.png';
	if (crop === 'Nether Wart')
		return 'https://media.discordapp.net/attachments/1115349089782087731/1191978796912492564/nether_wart.png';
	if (crop === 'Potato')
		return 'https://media.discordapp.net/attachments/1115349089782087731/1191978803854061638/potato.png';
	if (crop === 'Pumpkin')
		return 'https://media.discordapp.net/attachments/1115349089782087731/1191978810653024256/pumpkin.png';
	if (crop === 'Sugar Cane')
		return 'https://media.discordapp.net/attachments/1115349089782087731/1191978817150009355/sugar_cane.png';
	if (crop === 'Wheat')
		return 'https://media.discordapp.net/attachments/1115349089782087731/1191978823630209024/wheat.png';
	
	return undefined;
}

export function GetCropPath(crop: string) {
	return `./src/assets/crops/${crop.toLowerCase().replace(' ', '_')}.png`;
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

const simpleCropNames = {
	'cactus': 'Cactus',
	'carrot': 'Carrot',
	'cocoa': 'Cocoa Beans',
	'melon': 'Melon',
	'mushroom': 'Mushroom',
	'wart': 'Nether Wart',
	'potato': 'Potato',
	'pumpkin': 'Pumpkin',
	'cane': 'Sugar Cane',
	'wheat': 'Wheat',
};

export function CropFromSimple(name: string) {
	return simpleCropNames[name.toLowerCase() as keyof typeof simpleCropNames] ?? undefined;
}

export function GetCropEmoji(crop: string) {
	const emoji = CropEmojis[crop as keyof typeof CropEmojis];

	if (emoji) return `<:${emoji.name}:${emoji.id}>`;
	
	const simpleCrop = simpleCropNames[crop.toLowerCase() as keyof typeof simpleCropNames];
	if (simpleCrop) {
		const emoji = CropEmojis[simpleCrop as keyof typeof CropEmojis];
		if (!emoji) return '';
		return `<:${emoji.name}:${emoji.id}>`;
	}

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

export function UserHyperLink(userId?: Snowflake) {
	return `<@${userId}> [⟳](discord://-/users/${userId})`;
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
