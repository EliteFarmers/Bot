import { SKRSContext2D } from '@napi-rs/canvas';
import {
	ActionRowBuilder,
	ChannelType,
	Client,
	Guild,
	GuildBasedChannel,
	GuildMember,
	PermissionFlagsBits,
	Snowflake,
	StringSelectMenuBuilder,
} from 'discord.js';
import { Crop, GearSlot } from 'farming-weight';
import { client } from '../bot.js';
import { CommandAccess } from './commands/index.js';

export function isValidAccess(access: CommandAccess | CommandAccess[], type: ChannelType): boolean {
	const a = access instanceof Array ? access : [access];

	if (a.includes(CommandAccess.Everywhere)) return true;

	switch (type) {
		case ChannelType.DM:
		case ChannelType.GroupDM:
			return a.includes(CommandAccess.BotDM) || a.includes(CommandAccess.PrivateMessages);
		default:
			return a.includes(CommandAccess.Guild);
	}
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
	channelId: Snowflake,
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
export async function FindGuild(guildId: Snowflake): Promise<Guild | undefined> {
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
export function HasRole(member?: GuildMember, roleId?: Snowflake, adminOverride = true) {
	if (!member || !roleId) return false;

	const perms = member.permissions;
	const roles = member.roles?.cache?.map((role) => role.id);

	// If user has the admin perm and overide is true then return true
	if (adminOverride && perms && perms.has(PermissionFlagsBits.Administrator)) return true;

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
	cactus: 'Cactus',
	carrot: 'Carrot',
	cocoa: 'Cocoa Beans',
	melon: 'Melon',
	mushroom: 'Mushroom',
	wart: 'Nether Wart',
	potato: 'Potato',
	pumpkin: 'Pumpkin',
	cane: 'Sugar Cane',
	wheat: 'Wheat',
};

export const CROP_ARRAY = [
	Crop.Cactus,
	Crop.Carrot,
	Crop.CocoaBeans,
	Crop.Melon,
	Crop.Mushroom,
	Crop.NetherWart,
	Crop.Potato,
	Crop.Pumpkin,
	Crop.SugarCane,
	Crop.Wheat,
];
export const GEAR_ARRAY = [
	GearSlot.Helmet,
	GearSlot.Chestplate,
	GearSlot.Leggings,
	GearSlot.Boots,
	GearSlot.Necklace,
	GearSlot.Cloak,
	GearSlot.Belt,
	GearSlot.Gloves,
];

export function CropFromSimple(name: string) {
	return simpleCropNames[name.toLowerCase() as keyof typeof simpleCropNames] ?? undefined;
}

export function GetCropEmoji(crop: string) {
	if (crop.toLowerCase() === 'seeds') return '🌱';

	const emoji = CropEmojis[crop as keyof typeof CropEmojis] ?? EliteCropEmojis[crop as keyof typeof EliteCropEmojis];

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
			return '<:bronze:1313281303973597214> ';
		case 'silver':
			return '<:silver:1313281335703507004> ';
		case 'gold':
			return '<:gold:1313281357329334335> ';
		case 'platinum':
			return '<:platinum:1313281394029625468> ';
		case 'diamond':
			return '<:diamond:1313281416053788753> ';
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
			.setPlaceholder(placeholder),
	);

	return row;
}

const CropEmojis = {
	Cactus: {
		id: '1263608405939978404',
		name: 'cactus',
	},
	Carrot: {
		id: '1263608446335582280',
		name: 'carrot',
	},
	'Cocoa Beans': {
		id: '1263608459618947186',
		name: 'cocoa',
	},
	Melon: {
		id: '1263608474743341098',
		name: 'melon',
	},
	Mushroom: {
		id: '1263608486609162301',
		name: 'mushroom',
	},
	'Nether Wart': {
		id: '1263608502564425788',
		name: 'netherwart',
	},
	Potato: {
		id: '1263608514639560725',
		name: 'potato',
	},
	Pumpkin: {
		id: '1263608527918989403',
		name: 'pumpkin',
	},
	'Sugar Cane': {
		id: '1263608539578892391',
		name: 'sugarcane',
	},
	Wheat: {
		id: '1263608553797849119',
		name: 'wheat',
	},
};

const EliteCropEmojis = {
	[Crop.Cactus]: CropEmojis.Cactus,
	[Crop.Carrot]: CropEmojis.Carrot,
	[Crop.CocoaBeans]: CropEmojis['Cocoa Beans'],
	[Crop.Melon]: CropEmojis.Melon,
	[Crop.Mushroom]: CropEmojis.Mushroom,
	[Crop.NetherWart]: CropEmojis['Nether Wart'],
	[Crop.Potato]: CropEmojis.Potato,
	[Crop.Pumpkin]: CropEmojis.Pumpkin,
	[Crop.SugarCane]: CropEmojis['Sugar Cane'],
	[Crop.Wheat]: CropEmojis.Wheat,
};

export async function GetPurchaseUpdateChannel(client: Client) {
	const channel =
		client.channels.cache.get(process.env.ENTITLEMENT_CHANNEL) ??
		(await client.channels.fetch(process.env.ENTITLEMENT_CHANNEL));
	if (!channel || !channel.isTextBased()) return undefined;
	return channel;
}

export function CreateRoundCornerPath(
	ctx: SKRSContext2D,
	x: number,
	y: number,
	width: number,
	height: number,
	cornerRadius: number,
) {
	ctx.beginPath();
	ctx.moveTo(x + cornerRadius, y);
	ctx.lineTo(x + width - cornerRadius, y);
	ctx.quadraticCurveTo(x + width, y, x + width, y + cornerRadius);
	ctx.lineTo(x + width, y + height - cornerRadius);
	ctx.quadraticCurveTo(x + width, y + height, x + width - cornerRadius, y + height);
	ctx.lineTo(x + cornerRadius, y + height);
	ctx.quadraticCurveTo(x, y + height, x, y + height - cornerRadius);
	ctx.lineTo(x, y + cornerRadius);
	ctx.quadraticCurveTo(x, y, x + cornerRadius, y);
	ctx.closePath();
}

export function CreateClipPath(ctx: SKRSContext2D, x1: number, y1: number, x2: number, y2: number) {
	ctx.beginPath();
	ctx.moveTo(x1, y1);
	ctx.lineTo(x2, y1);
	ctx.lineTo(x2, y2);
	ctx.lineTo(x1, y2);
	ctx.closePath();
}

export function commandMd(client: Client, name: string) {
	const command = client.application?.commands.cache.find((c) => c.name === name);
	if (!command) return '`/' + name + '`';
	return `</${name}:${command.id}>`;
}

export function removeColorCodes(str: string) {
	return str.replace(/§[0-9a-fklmnor]/g, '');
}

export const LEVELING_XP = [
	50, 125, 200, 300, 500, 750, 1000, 1500, 2000, 3500, 5000, 7500, 10000, 15000, 20000, 30000, 50000, 75000, 100000,
	200000, 300000, 400000, 500000, 600000, 700000, 800000, 900000, 1000000, 1100000, 1200000, 1300000, 1400000, 1500000,
	1600000, 1700000, 1800000, 1900000, 2000000, 2100000, 2200000, 2300000, 2400000, 2500000, 2600000, 2750000, 2900000,
	3100000, 3400000, 3700000, 4000000, 4300000, 4600000, 4900000, 5200000, 5500000, 5800000, 6100000, 6400000, 6700000,
	7000000,
];

export function escapeIgn(name?: string | null) {
	return name?.replace(/_/g, '\\_');
}
