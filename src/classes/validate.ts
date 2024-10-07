import { FetchAccount } from '../api/elite.js';
import { Command } from './commands/index.js';
import { ErrorEmbed, WarningEmbed } from './embeds.js';

export async function getAccount(playerId: string, profileId: string, command: Command) {
	const { data: account } = await FetchAccount(playerId).catch(() => ({
		data: undefined,
	}));

	if (!account?.id || !account?.name) {
		const embed = WarningEmbed('Invalid Username!').addFields({
			name: 'Proper Usage:',
			value: '`/weight` `player:`(player name)\nOr link your account with </verify:1135100641560248334> first!',
		});

		if (playerId) {
			embed.setDescription(`Player \`${playerId}\` does not exist (or an error occured)`);
		} else {
			embed.setDescription('You need to link your account or enter a playername!');
		}

		return { success: false, embed };
	}

	playerId = account.name;

	const profile = profileId
		? account.profiles?.find((p) => p?.profileName?.toLowerCase() === profileId.toLowerCase())
		: (account.profiles?.find((p) => p.selected) ?? account.profiles?.[0]);

	if (!profile?.profileId || !profile.profileName) {
		const embed = ErrorEmbed('Invalid Profile!').setDescription(`Profile "${profileId}" does not exist.`).addFields({
			name: 'Proper Usage:',
			value: '`/weight` `player:`(player name) `profile:`(profile name)',
		});

		if (!profileId) {
			embed.setDescription('This player has no profiles!');
		}

		return { success: false, embed };
	}

	return { success: true, account, profile, name: playerId };
}
