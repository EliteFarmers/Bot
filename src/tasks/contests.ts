import { DisableGuildContestPings, FetchCurrentMonthlyBrackets, GetCurrentContests, GetGuildsToPing } from '../api/elite';
import { CropFromSimple, GetCropEmoji, GetCropURL, GetMedalEmoji } from '../classes/Util';
import { EliteEmbed, PrefixFooter } from '../classes/embeds';
import { AttachmentBuilder, Client, MessageCreateOptions, PermissionFlagsBits } from 'discord.js';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { Crop, CropFromName, GetFortuneRequiredForCollection } from 'farming-weight';
import { GetSkyblockDate } from 'classes/SkyblockDate';

const settings = {
	cron: '0 10 * * * *',
	execute: execute
}

export default settings;

const cropKeys: Record<string, string> = {
	'Cactus': 'cactus',
	'Carrot': 'carrot',
	'Cocoa Beans': 'cocoaBeans',
	'Melon': 'melon',
	'Mushroom': 'mushroom',
	'Nether Wart': 'netherWart',
	'Potato': 'potato',
	'Pumpkin': 'pumpkin',
	'Sugar Cane': 'sugarCane',
	'Wheat': 'wheat',
}

async function execute(client: Client) {
	console.log('Running contest ping task');
	const { data: contests } = await GetCurrentContests().catch(() => ({ data: undefined }));
	if (!contests?.complete) return;
	
	const now = Date.now() / 1000;
	const upcomingContest = Object.entries(contests.contests ?? {}).find(([ k ]) => +k > now);
	if (!upcomingContest) return;

	const [ timestamp, crops ] = upcomingContest;

	const { data: guilds } = await GetGuildsToPing().catch(() => ({ data: undefined, response: undefined }));
	
	if (!guilds || guilds.length === 0) return;

	const { data: brackets } = await FetchCurrentMonthlyBrackets(3).catch(() => ({ data: undefined }));

	const reqs = Object.entries(brackets?.brackets ?? {})
		.reduce<Record<string, { gold: number, diamond: number }>>((acc, curr) => {
			const [ simpleCrop, { gold = 0, diamond = 0 } ] = curr;
			const crop = CropFromSimple(simpleCrop);
			console.log(crop, gold, diamond);
			if (!crop || !crops.includes(crop)) return acc;

			acc[crop] = { gold, diamond };

			return acc;
		}, {}) ?? [];

	const attachment = await combineCropImages(crops);
	if (!attachment) return;

	const cropEmojis = crops.sort().map(crop => GetCropEmoji(crop)).join('');

	const embed = EliteEmbed()
		.setThumbnail('attachment://crops.webp')
		.setTitle(GetSkyblockDate(+timestamp).Readable)
		.setDescription(`${cropEmojis} **starts <t:${timestamp}:R>!** [⧉](<https://elitebot.dev/contest/${timestamp}>)`)
		.setFields(getFields(reqs))

	PrefixFooter(embed, 'Estimated bracket requirements shown for 19.8 BPS');

	let setUrl = false;

	for (const pings of guilds) {
		if (!pings.guildId || !pings?.enabled || !pings.channelId) continue;

		const channel = client.channels.cache.get(pings.channelId)
			?? await client.channels.fetch(pings.channelId) 
			?? undefined;

		if (!channel || !channel.isTextBased() || channel.isDMBased()) {
			DisableGuildContestPings(pings.guildId, 'Channel not found');
			return;
		}

		const me = channel.guild.members.me ?? await channel.guild.members.fetchMe();

		if (!channel.permissionsFor(me)?.has(PermissionFlagsBits.SendMessages)) {
			DisableGuildContestPings(pings.guildId, 'Missing send message permissions');
			return;
		}

		const roles = crops
			.map(crop => pings.cropPingRoles?.[cropKeys[crop] as keyof typeof pings.cropPingRoles] ?? undefined)
			.filter(role => role);

		const msg = {
			content: (pings.alwaysPingRole ? `<@&${pings.alwaysPingRole}>` : '') + roles.map(role => `<@&${role}>`).join(' '),
			embeds: [ embed ],
			allowedMentions: {
				roles: roles
			}
		} as MessageCreateOptions;

		if (!setUrl) {
			msg.files = [ attachment ];
			try {
				const sent = await channel.send(msg);

				// Get attachment URL from embed
				const url = sent.embeds[0]?.thumbnail?.url?.split('?')?.[0];

				if (url) {
					embed.setThumbnail(url);
					msg.files = undefined;
					setUrl = true;
				}
			} catch (err) {
				DisableGuildContestPings(pings.guildId ?? '', 'Failed to send message');
			}
			return;
		}

		channel.send(msg).catch(() => DisableGuildContestPings(pings.guildId ?? '', 'Failed to send message'));
	}
}

async function combineCropImages(crops: string[]) {
	const urls = crops
		.sort()
		.map(crop => GetCropURL(crop))
		.filter(url => url) as string[];

	const images = await Promise.all(urls.map(url => loadImage(url)));
	if (images.length === 0) return undefined;

	const canvas = createCanvas(256 * 2, 256);
	const ctx = canvas.getContext('2d');
	ctx.imageSmoothingEnabled = false;

	ctx.drawImage(images[0], 0, 0, images[0].width * 2, images[0].height * 2);
	ctx.drawImage(images[2], 2 * images[0].width, 0, images[0].width * 2, images[0].height * 2);
	ctx.drawImage(images[1], images[0].width, 0, images[0].width * 2, images[0].height * 2);

	return new AttachmentBuilder(canvas.toBuffer("image/webp"), { name: 'crops.webp' });
}

function getFields(reqs: Record<string, { gold: number; diamond: number; }>): { name: string, value: string, inline: boolean }[] {
	const entries = Object.entries(reqs).sort(([ a ], [ b ]) => a.localeCompare(b));

	const goldEmoji = GetMedalEmoji('gold');
	const diamondEmoji = GetMedalEmoji('diamond');
	const fortuneEmoji = '<:fortune:1180353749076693092>';

	return entries.map(([ crop, { gold, diamond } ]) => {
		const goldFortune = Math.max(GetFortuneRequiredForCollection({
			crop: CropFromName(crop) as Crop, 
			collection: gold, 
			blocksBroken: Math.floor(24_000 * (19.8 / 20)), 
			useDicers: true,
			useMooshroom: true,
		}), 0);

		const diamondFortune = Math.max(GetFortuneRequiredForCollection({
			crop: CropFromName(crop) as Crop, 
			collection: diamond, 
			blocksBroken: Math.floor(24_000 * (19.8 / 20)), 
			useDicers: true,
			useMooshroom: true,
		}), 0);


		const goldStr = `${goldEmoji} \`${gold.toLocaleString()}\`\n${fortuneEmoji} \`${goldFortune.toLocaleString()}\``;
		const diamondStr = `${diamondEmoji} \`${diamond.toLocaleString()}\`\n${fortuneEmoji} \`${diamondFortune.toLocaleString()}\``;

		return {
			name: crop,
			value: `${goldStr}\n** **\n${diamondStr}`,
			inline: true,
		}
	});
}