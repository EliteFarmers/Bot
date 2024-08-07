import { FetchProfile } from 'api/elite.js';
import { Signal, SignalRecieverOptions } from '../classes/Signal.js';
import { EliteEmbed, PrefixFooter } from '../classes/embeds.js';
import { Crop, getCropDisplayName, getCropFromItemId, getCropFromName } from 'farming-weight';
import { GetCropEmoji } from 'classes/Util.js';

const settings: SignalRecieverOptions = {
	name: 'wipe',
	execute: execute
}

export default settings;

type Data = {
	channelId: string,
	ign: string,
	uuid: string,
	profileId: string,
	discord: string,
}

async function execute(signal: Signal) {
	if (!signal.isExpected<Data>()) return;

	const { 
		data: { ign = "", uuid = "", discord = "", profileId = "", channelId },
		guild 
	} = signal;

	if (!guild || !channelId) return;

	const channel = guild.channels.cache.get(channelId) ?? await guild.channels.fetch(channelId);
	if (!channel?.isTextBased()) return;

	const ping = discord ? `<@${discord}>` : '';

	const { data: member } = await FetchProfile(uuid, profileId).catch(() => ({ data: undefined }));

	const fields = [];

	if (!member?.farmingWeight.totalWeight || member.farmingWeight.totalWeight <= 50) {
		// Send short and simple message if the weight is low
		const message = `**${ign}** (${member?.profileName ?? 'Unknown'})${ping ? ` (${ping})` : ''} has been wiped! [API](https://elitebot.dev/profile/${uuid}/${profileId})`;
		channel?.send({ content: message, }).catch(() => undefined);
		return;
	}

	if (member?.collections) {
		const crops = Object.entries(member.collections ?? {})
			.filter(([key]) => getCropFromItemId(key) !== undefined)
			.map(([key, value]) => {
				const crop = getCropFromItemId(key) ?? Crop.Wheat;
				return { key: GetCropEmoji(getCropDisplayName(crop)), value };
			})
			.sort((a, b) => b.value - a.value)
			.map(({ key, value }) => `${key} \`${value.toLocaleString()}\``)
			.join('\n');

		fields.push({ name: 'Collections', value: crops, inline: true });
	}

	if (member?.garden?.crops) {
		const crops = Object.entries(member.garden.crops ?? {})
			.filter(([key, value]) => getCropFromName(key) !== undefined && value && isFinite(+value))
			.map(([key, value]) => {
				const crop = getCropFromName(key) ?? Crop.Wheat;
				return { key: GetCropEmoji(getCropDisplayName(crop)), value: +(value ?? 0) };
			})
			.sort((a, b) => b.value - a.value)
			.map(({ key, value }) => `${key} \`${value.toLocaleString()}\``)
			.join('\n');

		fields.push({ name: 'Garden Milestones', value: crops, inline: true });
	}

	fields.push({ 
		name: 'Stats', 
		inline: true,
		value: `**Weight**: \`${member?.farmingWeight.totalWeight.toLocaleString()}\`\n`
			+ `**SB Level**: \`${(member?.skyblockXp ?? 0) / 100}\``
	});

	const embed = EliteEmbed()
		.setDescription(`## **${ign}** (${member?.profileName ?? 'Unknown'})${ping ? ` (${ping})` : ''} has been wiped!\n`
			+ `-# UUID: \`${uuid}\`\n`
			+ `-# Profile ID: \`${profileId}\`\n`
			+ `-# [Link to API Data](https://elitebot.dev/profile/${uuid}/${profileId})`
		)
		.setTimestamp()

	if (fields.length) embed.addFields(fields);

	PrefixFooter(embed, 'This could also mean the profile was deleted or the player was kicked from a coop.');

	channel?.send({ 
		content: ping || undefined,
		allowedMentions: { roles: ping ? [ ping ] : [] },
		embeds: [embed], 
	}).catch(() => undefined);
}