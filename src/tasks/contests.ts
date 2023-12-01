import { components } from 'api/api';
import { GetCurrentContests, GetGuildsToPing } from '../api/elite';
import { GetCropColor, GetCropURL } from '../classes/Util';
import { EliteEmbed } from '../classes/embeds';
import { Client } from 'discord.js';

const settings = {
	cron: '*/10 * * * * *',
	execute: execute
}

export default settings;

async function execute(client: Client) {
	console.log('Running contest ping task');
	
	// const { data: contests } = await GetCurrentContests().catch(() => ({ data: undefined }));
	const contests = await fetch('https://api.elitebot.dev/contests/at/now').then(res => res.json()).catch(() => undefined) as components['schemas']['YearlyContestsDto'];
	
	// console.log(contests);
	if (!contests?.complete) return;
	
	const now = Date.now() / 1000;
	const upcomingContest = Object.entries(contests.contests ?? {}).find(([ k ]) => +k > now);
	if (!upcomingContest) return;

	const [ timestamp, crops ] = upcomingContest;

	
	console.log(upcomingContest);

	const { data: guilds } = await GetGuildsToPing().catch(() => ({ data: undefined }));

	console.log(guilds);

	if (!guilds || guilds.length === 0) return;


	const embeds = crops.map(crop => EliteEmbed()
		.setColor(GetCropColor(crop))
		.setThumbnail(GetCropURL(crop) ?? 'https://elitebot.dev/favicon.webp')
		.setTitle(`Upcoming ${crop} Contest!`)
		.setDescription(`The ${crop} contest will start <t:${timestamp}:R>!`)
	);

	for (const pings of Object.values(guilds)) {
		if (!pings?.enabled || !pings.channelId) continue;

		let channel = client.channels.cache.get(pings.channelId);
		if (!channel) {
			channel = await client.channels.fetch(pings.channelId) ?? undefined;

			if (!channel) continue;
		}

		if (!channel.isTextBased()) continue;

		const roles = crops.map(crop => pings.cropPingRoles?.[crop] ?? undefined).filter(role => role);

		channel.send({
			content: (pings.alwaysPingRole ? `<@&${pings.alwaysPingRole}>` : '') + roles.map(role => `<@&${role}>`).join(' '),
			embeds: embeds
		});
	}
}