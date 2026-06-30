import { Crop, getCropDisplayName, getCropFromItemId, getCropFromName } from 'farming-weight';
import { FetchProfile } from '../api/elite';
import { EliteEmbed, PrefixFooter } from '../classes/embeds';
import { Signal, SignalReceiverOptions } from '../classes/Signal';
import { GetCropEmoji } from '../classes/Util';

const settings: SignalReceiverOptions = {
	name: 'wipe',
	execute: execute,
};

export default settings;

type Data = {
	channelId: string;
	ign: string;
	uuid: string;
	profileId: string;
	discord: string;
};

async function execute(signal: Signal) {
	if (!signal.isExpected<Data>()) return;

	const {
		data: { ign = '', uuid = '', discord = '', profileId = '', channelId },
		guild,
	} = signal;

	if (!guild || !channelId) return;

	const channel = guild.channels.cache.get(channelId) ?? (await guild.channels.fetch(channelId));
	if (!channel?.isTextBased()) return;

	const ping = discord ? `<@${discord}>` : '';
	const username = (ign || 'Unknown').replaceAll('_', '\\_');

	const member = await fetchRemovedProfile(uuid, profileId);
	if (!member?.wasRemoved) return;

	if (!member.farmingWeight.totalWeight || member.farmingWeight.totalWeight <= 50) {
		// Send short and simple message if the weight is low
		const message = `**${username}** (${member?.profileName ?? 'Unknown'})${ping ? ` (${ping})` : ''} has been wiped! [API](https://api.eliteskyblock.com/profile/${uuid}/${profileId})`;
		await channel.send({ content: message }).catch((error) => {
			console.error('Failed to send short wipe message', { error, uuid, profileId, channelId });
		});
		return;
	}

	const fields = [];

	if (member.collections) {
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

	if (member.garden?.crops) {
		const crops = Object.entries(member.garden.crops ?? {})
			.filter(([key, value]) => getCropFromName(key) !== undefined && value && isFinite(+value))
			.map(([key, value]) => {
				const crop = getCropFromName(key) ?? Crop.Wheat;
				return {
					key: GetCropEmoji(getCropDisplayName(crop)),
					value: +(value ?? 0),
				};
			})
			.sort((a, b) => b.value - a.value)
			.map(({ key, value }) => `${key} \`${value.toLocaleString()}\``)
			.join('\n');

		fields.push({ name: 'Garden Milestones', value: crops, inline: true });
	}

	fields.push({
		name: 'Stats',
		inline: true,
		value:
			`**Weight**: \`${member?.farmingWeight.totalWeight.toLocaleString()}\`\n` +
			`**SB Level**: \`${(member?.skyblockXp ?? 0) / 100}\``,
	});

	const embed = EliteEmbed()
		.setDescription(
			`## **${username}** (${member?.profileName ?? 'Unknown'})${ping ? ` (${ping})` : ''} has been wiped!\n` +
				`-# UUID: \`${uuid}\`\n` +
				`-# Profile ID: \`${profileId}\`\n` +
				`-# [Link to API Data](https://api.eliteskyblock.com/profile/${uuid}/${profileId})`,
		)
		.setTimestamp();

	if (fields.length) embed.addFields(fields);

	PrefixFooter(embed, 'This could also mean the profile was deleted or the player was kicked from a coop.');

	await channel
		?.send({
			content: ping || undefined,
			embeds: [embed],
		})
		.catch((error) => {
			console.error('Failed to send wipe message', { error, uuid, profileId, channelId });
		});
}

async function fetchRemovedProfile(uuid: string, profileId: string) {
	let member = await fetchProfileForWipe(uuid, profileId, 1);
	if (member?.wasRemoved) return member;

	await new Promise((resolve) => setTimeout(resolve, 2_000));

	member = await fetchProfileForWipe(uuid, profileId, 2);
	if (!member?.wasRemoved) {
		console.warn('Dropping wipe signal because profile is not marked removed after retry', {
			uuid,
			profileId,
			wasRemoved: member?.wasRemoved,
		});
	}

	return member;
}

async function fetchProfileForWipe(uuid: string, profileId: string, attempt: number) {
	try {
		const result = await FetchProfile(uuid, profileId);
		if (!result.ok) {
			console.error('Failed to fetch profile for wipe signal', {
				attempt,
				uuid,
				profileId,
				status: result.response.status,
				error: result.error,
			});
			return undefined;
		}

		return result.data;
	} catch (error) {
		console.error('Error fetching profile for wipe signal', { attempt, uuid, profileId, error });
		return undefined;
	}
}
