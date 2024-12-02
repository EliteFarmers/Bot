import {
	ActionRowBuilder,
	BaseInteraction,
	ButtonBuilder,
	ButtonStyle,
	ChatInputCommandInteraction,
	ComponentType,
	Interaction,
} from 'discord.js';
import { FetchAccount, GrantUserBadge, UserSettings } from '../api/elite.js';
import { escapeIgn } from '../classes/Util.js';
import { CommandAccess, CommandType, EliteCommand } from '../classes/commands/index.js';
import { EliteEmbed, ErrorEmbed } from '../classes/embeds.js';

const command = new EliteCommand({
	name: 'badges',
	description: 'View available badges!',
	access: CommandAccess.Everywhere,
	type: CommandType.Slash,
	execute: execute,
});

export default command;

async function execute(interaction: ChatInputCommandInteraction, settings?: UserSettings) {
	const embed = EliteEmbed(settings)
		.setTitle('Elite Badges')
		.addFields([
			{
				name: 'What are badges?',
				value:
					'Badges are cosmetic profile decorations players can display on the website. You ~~must~~ should try to collect them all!',
			},
			{
				name: 'Elite Farmer Badge',
				value:
					'Awarded to players who have obtained the Elite Farmer role in the [Elite Farmers](https://elitebot.dev/discord) Discord server.',
				inline: true,
			},
			{
				name: 'Donator Badge',
				value: 'Awarded to players who have donated to the project. [Donate Here!](https://elitebot.dev/donate)',
				inline: true,
			},
			{
				name: 'Patron of the Arts Badge',
				value: "Awarded to players who have bought anything from [Lumini's Esty Shop!](https://elitebot.dev/stickers)",
				inline: true,
			},
			{
				name: 'Claiming Badges',
				value:
					'Join the [Development Server](https://elitebot.dev/support) and open a ticket to claim your badges! The Elite Farmer badge can be claimed with this same command in the [Elite Farmers](https://elitebot.dev/discord) server.',
			},
			{
				name: 'More information',
				value: '[View all badges online](https://elitebot.dev/info#Badges)',
			},
		]);

	const eliteRole = process.env.ELITE_FARMER_ROLE as string;

	const eligible =
		interaction.inCachedGuild() &&
		interaction.guildId === process.env.ELITE_DISCORD_ID &&
		interaction.member.roles.cache.has(eliteRole);

	if (!eligible) {
		await interaction.reply({ embeds: [embed], ephemeral: true }).catch(() => undefined);
		return;
	}

	const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder().setCustomId('claimelite').setLabel('Claim Elite Farmer Badge').setStyle(ButtonStyle.Secondary),
	);

	const reply = await interaction
		.reply({
			embeds: [embed],
			components: [row],
			ephemeral: true,
		})
		.catch(() => undefined);

	if (!reply) return;

	const filter = (i: BaseInteraction) => i.user.id === interaction.user.id;
	const collector = reply.createMessageComponentCollector({
		filter,
		time: 60_000,
		componentType: ComponentType.Button,
	});
	let primaryAccountUuid: string;

	collector.on('collect', async (i: Interaction) => {
		if (!i.isButton()) return;

		if (i.customId === 'claimelite') {
			await i.deferUpdate();

			const { data: account } = await FetchAccount(interaction.user.id).catch(() => ({ data: undefined }));

			if (!account?.id) {
				const errorEmbed = ErrorEmbed('Failed to fetch account!').setDescription(
					'Please make sure your account is linked with `/verify` and try again.',
				);

				await i.editReply({ embeds: [errorEmbed], components: [] });
				return;
			}

			primaryAccountUuid = account.id;

			const newEmbed = EliteEmbed()
				.setTitle('Claim Elite Farmer Badge')
				.setDescription(
					`Your primary Minecraft account is ${escapeIgn(account.name)} (\`${account.id}\`)\nIf this is incorrect please change it in your [profile settings](https://elitebot.dev/profile) and try again.`,
				);

			const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
				new ButtonBuilder().setCustomId('confirmclaim').setLabel('Confirm').setStyle(ButtonStyle.Success),
			);

			await i.editReply({ embeds: [newEmbed], components: [row] });
		}

		if (i.customId === 'confirmclaim') {
			const newEmbed = EliteEmbed()
				.setTitle('Claimed Elite Farmer Badge')
				.setDescription(
					"Your badge claim has been submitted! Please try again if it doesn't appear on your website profile within a few minutes, and contact `kaeso.dev` if it doesn't appear within an hour.",
				);

			await GrantUserBadge(primaryAccountUuid, 1).catch(() => undefined);

			await i.update({ embeds: [newEmbed], components: [] });
		}
	});
}
