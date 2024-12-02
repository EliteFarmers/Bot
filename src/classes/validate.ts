import { EmbedBuilder } from 'discord.js';
import type { components } from '../api/api.js';
import { FetchAccount } from '../api/elite.js';
import { escapeIgn } from './Util.js';
import { EliteCommand } from './commands/index.js';
import { ErrorEmbed } from './embeds.js';

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
	userId?: string,
): Promise<GetAccountReturn> {
	const { data: account } =
		playerId || userId
			? await FetchAccount((playerId ?? userId) as string).catch(() => ({
					data: undefined,
				}))
			: { data: undefined };

	if (!account?.id || !account?.name) {
		// Check if account wasn't linked
		if (userId && !playerId) {
			const embed = ErrorEmbed('Account not linked!').addFields({
				name: 'Proper Usage',
				value: command.getUsage() ?? 'No usage information available.',
			});

			embed.setDescription(
				(profileId
					? `You entered "${escapeIgn(profileId)}" as the \`profile\` option. Did you mean to specify the \`player\` parameter instead?\n\n`
					: '') +
					`In order to use this command without specifying a player name, you need to link your account with </verify:1135100641560248334> first!`,
			);

			return { success: false, embed };
		}

		const embed = ErrorEmbed('Invalid Username!').addFields({
			name: 'Proper Usage',
			value: command.getUsage() ?? 'No usage information available.',
		});

		if (playerId) {
			embed.setDescription(
				`Player \`${escapeIgn(playerId)}\` does not exist!\n-# Or an error occured, try again later.`,
			);
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
			.setDescription(`Profile "${escapeIgn(profileId)}" does not exist.`)
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
