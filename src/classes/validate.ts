import { components } from 'api/api.js';
import { EmbedBuilder } from 'discord.js';
import { FetchAccount } from '../api/elite.js';
import { EliteCommand } from './commands/index.js';
import { ErrorEmbed, WarningEmbed } from './embeds.js';

type AccountWithNameAndId = Required<Pick<components['schemas']['MinecraftAccountDto'], 'id' | 'name'>> &
	components['schemas']['MinecraftAccountDto'];

export type GetAccountReturn =
	| {
			success: false;
			embed: EmbedBuilder;
	  }
	| {
			success: true;
			account: AccountWithNameAndId;
			profile: components['schemas']['ProfileDetailsDto'];
			name: string;
	  };

export async function getAccount(
	playerId: string | undefined,
	profileId: string | undefined,
	command: EliteCommand,
): Promise<GetAccountReturn> {
	const { data: account } = playerId
		? await FetchAccount(playerId).catch(() => ({
				data: undefined,
			}))
		: { data: undefined };

	if (!account?.id || !account?.name) {
		const embed = WarningEmbed('Invalid Username!').addFields({
			name: 'Proper Usage:',
			value: command.getUsage() ?? 'No usage information available.',
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
		const embed = ErrorEmbed('Invalid Profile!')
			.setDescription(`Profile "${profileId}" does not exist.`)
			.addFields({
				name: 'Proper Usage:',
				value: command.getUsage() ?? 'No usage information available.',
			});

		if (!profileId) {
			embed.setDescription('This player has no profiles!');
		}

		return { success: false, embed };
	}

	return { success: true, account: account as AccountWithNameAndId, profile, name: account.name };
}
