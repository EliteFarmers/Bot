import { Command, CommandAccess, CommandType } from "../classes/Command";
import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { EliteEmbed, ErrorEmbed, WarningEmbed } from "classes/embeds";
import { LinkAccount } from "api/elite";

const command: Command = {
	name: 'verify',
	description: 'Link your Minecraft account.',
	usage: '[username]',
	access: CommandAccess.Everywhere,
	type: CommandType.Slash,
	slash: new SlashCommandBuilder()
		.setName('verify')
		.setDescription('Link your Minecraft account!')
		.addStringOption(option => option.setName('player')
			.setDescription('Your minecraft account name.')
			.setRequired(true)),
	execute: execute
}

export default command;

async function execute(interaction: ChatInputCommandInteraction) {
	const playerName = interaction.options.getString('player', false);
	if (!playerName) return;

	await interaction.deferReply({ ephemeral: true });

	// Validate username or uuid regex
	const regex = new RegExp(/^[a-zA-Z0-9_-]{1,36}$/);
	if (!regex.test(playerName)) {
		const embed = WarningEmbed('Invalid Username!')
			.setDescription('Usernames can only contain letters, numbers, underscores, and hyphens (if it\'s a uuid).')
			.addFields({ name: 'Proper Usage:', value: '`/verify` `player:`(player name)' });
		return interaction.editReply({ embeds: [embed] });
	}

	try {
		const { response } = await LinkAccount(interaction.user.id, playerName);

		if (!response.ok) {
			const error = await response.text().catch(() => undefined);

			const embed = ErrorEmbed('Failed to Link Account!')
				.setDescription((error || 'Please try again later.') + '\nEnsure your discord account is properly linked to your minecraft account on Hypixel. It should match your username exactly, case-sensitive.')
				.addFields({ name: 'Proper Usage:', value: '`/verify` `player:`(player name)' })
				.addFields({ name: 'Want to unlink your account?', value: 'Please go to [elitebot.dev/profile](https://elitebot.dev/profile) and remove your account there.' });
			return interaction.editReply({ embeds: [embed] });
		}

		const embed = EliteEmbed()
			.setTitle('Account Linked!')
			.setDescription(`Your account has been linked to ${playerName}! You can now use the \`/weight\` command without entering your username!`)
			.addFields({ 
				name: 'Want to unlink your account?', 
				value: 'Please go to [elitebot.dev/profile](https://elitebot.dev/profile) and remove your account there. This is also where you can change which account is primary.' 
			});

		return interaction.editReply({ embeds: [embed] });
	} catch (error) {
		const embed = ErrorEmbed('Failed to Link Account!')
			.setDescription('Please try again later. If this issue persists, contact kaeso.dev on discord.');
		return interaction.editReply({ embeds: [embed] });
	}
}