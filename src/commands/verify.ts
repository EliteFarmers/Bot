import { ChatInputCommandInteraction } from 'discord.js';
import { FetchAccount, FetchUpdateAccount, LinkAccount } from '../api/elite.js';
import { autocomplete } from '../autocomplete/player.js';
import { escapeIgn } from '../classes/Util.js';
import { CommandAccess, CommandType, EliteCommand, SlashCommandOptionType } from '../classes/commands/index.js';
import { EliteEmbed, ErrorEmbed, WarningEmbed } from '../classes/embeds.js';

const command = new EliteCommand({
	name: 'verify',
	description: 'Link your Minecraft account.',
	access: CommandAccess.Everywhere,
	type: CommandType.Slash,
	options: {
		player: {
			name: 'player',
			description: 'Link your Minecraft account!',
			type: SlashCommandOptionType.String,
			required: true,
			autocomplete,
		},
	},
	execute: execute,
});

export default command;

async function execute(interaction: ChatInputCommandInteraction) {
	const playerName = interaction.options.getString('player', false);
	if (!playerName) return;

	await interaction.deferReply({ ephemeral: true });

	// Validate username or uuid regex
	const regex = new RegExp(/^[a-zA-Z0-9_-]{1,36}$/);
	if (!regex.test(playerName)) {
		const embed = WarningEmbed('Invalid Username!')
			.setDescription("Usernames can only contain letters, numbers, underscores, and hyphens (if it's a uuid).")
			.addFields({
				name: 'Proper Usage:',
				value: command.getUsage(),
			});
		return interaction.editReply({ embeds: [embed] });
	}

	// Will create a new account/load stats if one doesn't exist already
	await FetchAccount(playerName).catch(() => undefined);

	const account = await FetchUpdateAccount(interaction.user, interaction.locale)
		.then((res) => res.data)
		.catch(() => undefined);

	if (!account) {
		const embed = ErrorEmbed('Failed to Fetch Account!').setDescription(
			'Please try again. If this issue persists, contact kaeso.dev on discord.',
		);
		return interaction.editReply({ embeds: [embed] });
	}

	try {
		const { error, response } = await LinkAccount(interaction.user.id, playerName);

		if (!response.ok) {
			const embed = ErrorEmbed('Failed to Link Account!')
				.setDescription(
					(error || 'Please try again later.') +
						'\n⠀\nEnsure your Discord account is properly linked to your minecraft account on Hypixel. It should match your username exactly, case-sensitive.',
				)
				.addFields({
					name: 'Proper Usage:',
					value: '`/verify` `player:`(player name)',
				})
				.addFields({
					name: 'Want to unlink your account?',
					value: 'Please go to [elitebot.dev/profile](https://elitebot.dev/profile) and remove your account there.',
				});
			return interaction.editReply({ embeds: [embed] });
		}

		const embed = EliteEmbed()
			.setTitle('Account Linked!')
			.setDescription(
				`Your account has been linked to ${escapeIgn(playerName)}! You can now use the \`/weight\` command without entering your username!`,
			)
			.addFields({
				name: 'Want to unlink your account?',
				value:
					'Please go to [elitebot.dev/profile](https://elitebot.dev/profile) and remove your account there. This is also where you can change which account is primary.',
			});

		return interaction.editReply({ embeds: [embed] });
	} catch (_) {
		const embed = ErrorEmbed('Failed to Link Account!').setDescription(
			'Please try again later. If this issue persists, contact kaeso.dev on discord.',
		);
		return interaction.editReply({ embeds: [embed] });
	}
}
