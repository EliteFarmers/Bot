import { DisableGuildContestPings, FetchCurrentMonthlyBrackets, GetCurrentContests, GetGuildsToPing } from '../api/elite.js';
import { CropFromSimple, GetCropEmoji, GetMedalEmoji } from '../classes/Util.js';
import { EliteEmbed, PrefixFooter } from '../classes/embeds.js';
import { Client, EmbedBuilder, MessageCreateOptions, PermissionFlagsBits } from 'discord.js';
import { Crop, getCropFromName, getFortuneRequiredForCollection, SkyBlockTime } from 'farming-weight';
import { GetSkyblockDate } from '../classes/SkyblockDate.js';
import { CronTask } from '../classes/Command.js';
import { components } from '../api/api.js';

const settings = {
	cron: '0 10 * * * *',
	execute: execute
} satisfies CronTask;

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
	console.log('Running contest ping task. Shard: ' + client.shard?.ids[0]);

	const { data: guilds } = await GetGuildsToPing().catch(() => ({ data: undefined, response: undefined }));
	if (!guilds || guilds.length === 0) {
		console.log('No guilds to ping! Shard: ' + client.shard?.ids[0]);
		return;
	}

	const { data: contests } = await GetCurrentContests().catch(() => ({ data: undefined }));

	if (!contests?.complete) {
		// Check if it's a new skyblock year
		const sbDate = SkyBlockTime.now;
		if (sbDate.month !== 1 || sbDate.day > 2) {
			console.log('Contests not available yet! Shard: ' + client.shard?.ids[0]);
			return;
		}

		const current = SkyBlockTime.from(sbDate.year, 1, 2);
		const nextContest = SkyBlockTime.from(sbDate.year, 1, 2 + 3);

		// New year, send please wait message
		const embed = EliteEmbed()
			.setTitle(current.toString())
			.setDescription(`Upcoming contest haven't been uploaded yet!`)
			.addFields([{
				name: 'Enjoy the Spring Season!',
				value: `**+25** <:fortune:1180353749076693092> from [Atmospheric Filter](https://wiki.hypixel.net/Atmospheric_Filter)`
					+ `\nGood luck finding Zorro in [Hoppity's Hunt](https://wiki.hypixel.net/Hoppity%27s_Hunt)!`
			}, {
				name: 'Next Contest',
				value: `Starts <t:${nextContest.unixSeconds}:R> [View All](<https://elitebot.dev/contests/upcoming#${nextContest.unixSeconds}>)`
			}]);

		sendMessages(client, embed, guilds);

		return;
	}
	
	const now = Date.now() / 1000;

	const [ timestamp, crops ] = Object.entries(contests.contests ?? {}).find(([ k ]) => +k > now) ?? []
	if (!timestamp || !crops) {
		console.log('No upcoming contests found! Shard: ' + client.shard?.ids[0]);
		return;
	}

	const nextContest = Object.entries(contests.contests ?? {}).find(([ k ]) => +k > +timestamp);

	const { data: brackets } = await FetchCurrentMonthlyBrackets(3).catch(() => ({ data: undefined }));

	const reqs = Object.entries(brackets?.brackets ?? {})
		.reduce<Record<string, { gold: number, diamond: number }>>((acc, curr) => {
			const [ simpleCrop, { gold = 0, diamond = 0 } = {} ] = curr;
			const crop = CropFromSimple(simpleCrop);

			if (!crop || !crops.includes(crop)) return acc;

			acc[crop] = { gold, diamond };

			return acc;
		}, {}) ?? [];

	const getCropEmojis = (crops?: string[]) => crops?.map(crop => GetCropEmoji(crop)).join('') ?? '';

	const embed = EliteEmbed()
		.setTitle(GetSkyblockDate(+timestamp).Readable)
		.setDescription(`${getCropEmojis(crops)} **starts <t:${timestamp}:R>!** [⧉](<https://elitebot.dev/contest/${timestamp}>)`)
		.setFields(getFields(reqs))
		.addFields([{
			name: 'Next Contest',
			value: nextContest 
				? `${getCropEmojis(nextContest[1])} starts <t:${nextContest[0]}:R> [View All](<https://elitebot.dev/contests/upcoming#${nextContest[0]}>)` 
				: 'Not available yet!',
		}])

	PrefixFooter(embed, 'Estimated bracket requirements shown for 19.8 BPS');

	await sendMessages(client, embed, guilds, crops);
}

async function sendMessages(client: Client, embed: EmbedBuilder, guilds: components['schemas']['ContestPingsFeatureDto'][], crops?: string[]) {
	for (const pings of guilds) {
		if (!pings.guildId || !pings?.enabled || !pings.channelId) {
			console.log('Invalid pings config', pings);
			continue;
		}

		const guild = client.guilds.cache.get(pings.guildId);
		if (!guild) {
			console.log(`Guild ${pings.guildId} not found on Shard ${client.shard?.ids[0]}`);
			continue;
		}

		try {
			const channel = client.channels.cache.get(pings.channelId)
				?? await client.channels.fetch(pings.channelId).catch(() => undefined);
			if (!channel) continue; // Channel on another shard (or invalid)

			if (!channel || !channel.isTextBased() || channel.isDMBased()) {
				console.log(`Invalid channel (${pings.channelId}) for guild ${pings.guildId}`);
				DisableGuildContestPings(pings.guildId, 'Channel not found');
				continue;
			}

			const me = channel.guild.members.me ?? await channel.guild.members.fetchMe();

			if (!channel.permissionsFor(me)?.has(PermissionFlagsBits.SendMessages)) {
				console.log(`Missing send message permissions in ${channel.id} (${pings.guildId})`);
				DisableGuildContestPings(pings.guildId, 'Missing send message permissions');
				continue;
			}

			let roles: string[] = [];
			if (crops) {
				roles = crops
					.map(crop => pings.cropPingRoles?.[cropKeys[crop] as keyof typeof pings.cropPingRoles] ?? undefined)
					.filter(role => role) as string[];
			}
	
			// Make sure alwaysPingRole at least seems valid
			const alwaysPing = !!pings.alwaysPingRole && pings.alwaysPingRole.length > 10;

			const msg = {
				content: (alwaysPing ? `<@&${pings.alwaysPingRole}> ` : '') + roles.map(role => `<@&${role}>`).join(' '),
				embeds: [ embed ],
				allowedMentions: {
					roles: roles
				}
			} as MessageCreateOptions;

			channel.send(msg).catch(() => {
				console.log(`Failed to send message to ${channel.id} (${channel.guild.id})`)
				// DisableGuildContestPings(pings.guildId ?? '', 'Failed to send message');
			});
		} catch (e) {
			console.log(e);
		}

		console.log(`Sent contest ping to ${pings.guildId} (${pings.channelId})`);
	}
}

function getFields(reqs: Record<string, { gold: number; diamond: number; }>): { name: string, value: string, inline: boolean }[] {
	const entries = Object.entries(reqs).sort(([ a ], [ b ]) => a.localeCompare(b));

	const goldEmoji = GetMedalEmoji('gold');
	const diamondEmoji = GetMedalEmoji('diamond');
	const fortuneEmoji = '<:fortune:1180353749076693092>';

	return entries.map(([ crop, { gold, diamond } ]) => {
		const goldFortune = Math.max(getFortuneRequiredForCollection({
			crop: getCropFromName(crop) as Crop, 
			collection: gold, 
			blocksBroken: Math.floor(24_000 * (19.8 / 20)), 
			useDicers: true,
			useMooshroom: true,
		}), 0);

		const diamondFortune = Math.max(getFortuneRequiredForCollection({
			crop: getCropFromName(crop) as Crop, 
			collection: diamond, 
			blocksBroken: Math.floor(24_000 * (19.8 / 20)), 
			useDicers: true,
			useMooshroom: true,
		}), 0);


		const goldStr = `${goldEmoji} \`${gold.toLocaleString()}\`\n${fortuneEmoji} \`${goldFortune.toLocaleString()}\``;
		const diamondStr = `${diamondEmoji} \`${diamond.toLocaleString()}\`\n${fortuneEmoji} \`${diamondFortune.toLocaleString()}\``;

		return {
			name: crop,
			value: `${goldStr}\n${diamondStr}`,
			inline: true,
		}
	});
}