import { EliteEmbed } from '../classes/embeds.js';
import { GetCropColor } from '../classes/Util.js';
import { CustomFormatterOptions } from './custom.js';

export async function createWeightEmbed({
	account,
	profile,
	profileId,
	weightRank = -1,
	badgeUrl = '',
}: CustomFormatterOptions) {
	const ign = account.name ?? 'Unknown';
	const uuid = account.id ?? 'Unknown';
	const profileName = account.profiles?.find((p) => p.profileId === profileId)?.profileName ?? 'Unknown';

	let result = '';
	const rWeight = Math.round((profile.totalWeight ?? 0) * 100) / 100;

	if (rWeight > 1) {
		result = rWeight.toString().replace(/\B(?<!\.\d*)(?=(\d{3})+(?!\d))/g, ',');
	} else if (rWeight === -1) {
		result = 'Zero!';
	} else {
		result = rWeight.toString();
	}

	let description = `**${result}**`;
	if (weightRank !== -1) {
		description += ` [#${weightRank}](https://elitesb.gg/leaderboard/farmingweight/${uuid}-${profileId})`;
	}
	description += '\n-# Farming Weight';

	const topCrop = Object.entries(profile.cropWeight ?? {}).sort(([, a], [, b]) => (b ?? 0) - (a ?? 0))[0][0];

	const embed = EliteEmbed(undefined, false)
		.setAuthor({
			name: `${ign} (${profileName})`,
			url: `https://elitesb.gg/@${uuid}/${profileId}`,
			iconURL: `https://mc-heads.net/head/${uuid}/right`,
		})
		.setDescription(description)
		.setColor(GetCropColor(topCrop));

	if (badgeUrl) {
		embed.setThumbnail(badgeUrl);
	}

	return embed;
}
