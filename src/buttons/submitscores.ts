import {
	AttachmentBuilder,
	ButtonBuilder,
	ButtonInteraction,
	ButtonStyle,
	ContainerBuilder,
	MediaGalleryBuilder,
	MessageFlags,
	PermissionFlagsBits,
	TextDisplayBuilder,
} from 'discord.js';
import { Crop, getCropDisplayName, getCropFromName } from 'farming-weight';
import { components } from '../api/api.js'; // Assuming this has the new schemas
import { FetchAccount, FetchGuildJacob, SubmitJacobScore } from '../api/elite.js'; // Added SubmitJacobScore
import { commandReferences } from '../bot.js';
import { CommandAccess, CommandType, EliteCommand } from '../classes/commands/index.js';
import { EliteEmbed, ErrorEmbed, WarningEmbed } from '../classes/embeds.js';
import { GenerateLeaderboardImage } from '../classes/LeaderboardImage.js';
import { GetReadableDate } from '../classes/SkyblockDate.js';
import { CropSelectRow, escapeIgn, GetCropEmoji, GetCropTuple } from '../classes/Util.js';

const command = new EliteCommand({
	name: 'LBSUBMIT',
	description: 'Submit your scores!',
	access: CommandAccess.Guild,
	type: CommandType.Button,
	execute: execute,
});

export default command;

async function execute(interaction: ButtonInteraction) {
	if (!interaction.inCachedGuild()) {
		const embed = ErrorEmbed('This command can only be used in a server!').setDescription(
			'If you are in a server, please wait a few minutes and try again.\nOtherwise I have no idea how you got this error.',
		);
		interaction.reply({ embeds: [embed], ephemeral: true });
		return;
	}

	await interaction.deferReply({ ephemeral: true });

	const { data: account } = await FetchAccount(interaction.user.id).catch(() => ({ data: null }));

	if (!account) {
		const embed = ErrorEmbed('Account Not Found!').setDescription(
			`You must link your account before submitting scores.\nUse the ${commandReferences.get(
				'link',
			)} command to link your account.`,
		);
		interaction.editReply({ embeds: [embed] });
		return;
	}

	const [, lbId] = interaction.customId.split('|');

	const roleIds = interaction.member.roles.cache.map((r) => r.id);

	const { data: guild } = await FetchGuildJacob(interaction.guildId).catch(() => ({ data: null }));

	if (!guild) {
		const embed = ErrorEmbed('Guild Not Found!').setDescription(
			'This server is not registered!\nPlease invite the bot and set up a Jacob Leaderboard to use this command.',
		);
		interaction.editReply({ embeds: [embed] });
		return;
	}

	const leaderboard = guild?.leaderboards?.find((lb) => lb.id === lbId);

	if (!leaderboard) {
		const embed = ErrorEmbed('Leaderboard not found!').setDescription(
			'This leaderboard does not exist or Jacob Leaderboards are not enabled for this server.',
		);
		interaction.editReply({ embeds: [embed] });
		return;
	}

	const response = await SubmitJacobScore({
		guildId: interaction.guildId,
		lbId,
		discordUserId: interaction.user.id,
		roles: roleIds,
	}).catch((err) => ({ error: err, data: null }));

	if (response.error || !response.data) {
		// Update leaderboard image anyways if admin user (so admins can clear out removed scores)
		if (interaction.memberPermissions.has(PermissionFlagsBits.Administrator | PermissionFlagsBits.ManageGuild)) {
			const payload = await getLeaderboardPayload(leaderboard, interaction.guildId, interaction.guild.name);
			await interaction.message
				.edit({
					...payload,
					allowedMentions: { parse: [] },
				})
				.catch(() => undefined);
		}

		const status = response.error?.response?.status || response.error.statusCode;
		const msg =
			response.error?.response?.data?.message || response.error.errors.generalErrors.join('\n') || 'Unknown error';

		if (status === 404) {
			const embed = ErrorEmbed('Leaderboard not found!').setDescription(
				'This leaderboard does not exist or Jacob Leaderboards are not enabled for this server.\nIf this persists, contact support.',
			);
			interaction.editReply({ embeds: [embed] });
			return;
		}

		if (status === 403) {
			const embed = ErrorEmbed('Submission Rejected!').setDescription(
				msg ?? 'You are not allowed to submit scores to this leaderboard.',
			);
			interaction.editReply({ embeds: [embed] });
			return;
		}

		if (status === 400) {
			const embed = ErrorEmbed('Account Issue!').setDescription(
				msg ??
					`You must link your account before submitting scores.\nUse the ${commandReferences.get('link')} command to link your account.`,
			);
			interaction.editReply({ embeds: [embed] });
			return;
		}

		const embed = ErrorEmbed('API Error').setDescription(
			"Your request wasn't able to be processed!\nThis is likely an issue with the Elite API, please try again later.",
		);
		interaction.editReply({ embeds: [embed] });
		console.error(response.error);
		return;
	}

	const { changes, shouldPing } = response.data;

	// No changes made
	if (!changes || changes.length === 0) {
		const embed = WarningEmbed('No New Records Set!').setDescription(
			'You did not set any new records.\nIf you think this is a mistake, please wait 10 minutes and try again.',
		);

		interaction.editReply({ embeds: [embed] });

		// Update leaderboard image anyways if admin user (so admins can clear out removed scores)
		if (interaction.memberPermissions.has(PermissionFlagsBits.Administrator | PermissionFlagsBits.ManageGuild)) {
			const payload = await getLeaderboardPayload(leaderboard, interaction.guildId, interaction.guild.name);
			await interaction.message
				.edit({
					...payload,
					allowedMentions: { parse: [] },
				})
				.catch(() => undefined);
		}
		return;
	}
	const cropEmbeds = new Map<Crop, ContainerBuilder>();

	for (const change of changes) {
		const crop = getCropFromName(change.crop);
		if (!crop) continue;

		const collected = change.record.collected;
		const newPos = change.newPosition;
		const oldPos = change.oldPosition;
		const improvement = change.improvement;

		let updateContainer = cropEmbeds.get(crop);

		if (!updateContainer) {
			updateContainer = new ContainerBuilder()
				.setAccentColor(GetCropTuple(getCropDisplayName(crop)))
				.addTextDisplayComponents((b) =>
					b.setContent(
						newPos === 0
							? `## ${GetCropEmoji(crop)} New High Score for ${getCropDisplayName(crop)}!`
							: `## ${GetCropEmoji(crop)} New Score for ${getCropDisplayName(crop)}!`,
					),
				);
		}

		let message = '';
		if (newPos === 0) message += '**New High Score!**';
		else if (newPos === 1) message += '**New 2nd Place Score!**';
		else if (newPos === 2) message += '**New 3rd Place Score!**';

		if (oldPos !== -1 && improvement) {
			// User improved their own score
			message += `\n<@${interaction.user.id}> **(${escapeIgn(change.submitter.ign)})** improved their score by **${improvement.toLocaleString()}** collection for a total of **${collected.toLocaleString()}**! [⧉](https://elitesb.gg/contest/${change.record.timestamp})`;
		} else {
			// New entry
			if (change.displacedEntry) {
				message += `\n<@${interaction.user.id}> **(${escapeIgn(change.submitter.ign)})** has beaten <@${change.displacedEntry.discordId}> **(${escapeIgn(change.displacedEntry.ign)})** by **${(collected - change.displacedEntry.collected).toLocaleString()}** collection for a total of **${collected.toLocaleString()}**! [⧉](https://elitesb.gg/contest/${change.record.timestamp})`;
			} else {
				message += `\n<@${interaction.user.id}> **(${escapeIgn(change.submitter.ign)})** has set a new score of **${collected.toLocaleString()}** collection! [⧉](https://elitesb.gg/contest/${change.record.timestamp})`;
			}
		}

		// Check for displaced/knocked out entries
		if (change.knockedOutEntry) {
			message += `\n-# <@${change.knockedOutEntry.discordId}> (${escapeIgn(change.knockedOutEntry.ign)}) has been knocked out of the top 3!`;
		} else if (change.displacedEntry) {
			message += `\n-# <@${change.displacedEntry.discordId}> (${escapeIgn(change.displacedEntry.ign)}) has been moved down to #${change.newPosition + 2}!`;
		}

		updateContainer.addTextDisplayComponents((b) => b.setContent(message));
		cropEmbeds.set(crop, updateContainer);
	}

	const componentsToSend = Array.from(cropEmbeds.values());

	// Send notifications to update channel
	if (leaderboard?.updateChannelId && componentsToSend.length > 0) {
		const channel = await interaction.guild.channels.fetch(leaderboard.updateChannelId).catch(() => null);

		const pingDisplay =
			shouldPing && leaderboard.updateRoleId
				? new TextDisplayBuilder({
						content: `<@&${leaderboard.updateRoleId}> `,
					})
				: undefined;

		if (channel?.isTextBased()) {
			const firstBatch = pingDisplay ? [pingDisplay, ...componentsToSend.slice(0, 5)] : componentsToSend.slice(0, 5);
			channel.send({ flags: MessageFlags.IsComponentsV2, components: firstBatch }).catch(console.error);

			if (componentsToSend.length > 5) {
				channel
					.send({
						flags: MessageFlags.IsComponentsV2,
						components: componentsToSend.slice(5),
					})
					.catch(console.error);
			}
		}
	}

	const embed = EliteEmbed()
		.setTitle('Scores Submitted!')
		.setDescription('Your scores were submitted! Congratulations!');
	interaction.editReply({ embeds: [embed] });

	const { data: newGuild } = await FetchGuildJacob(interaction.guildId).catch(() => ({ data: null }));

	if (!newGuild) {
		const embed = ErrorEmbed('Guild Not Found!').setDescription(
			'This server is not registered!\nPlease invite the bot and set up a Jacob Leaderboard to use this command.',
		);
		interaction.editReply({ embeds: [embed] });
		return;
	}

	const newLeaderboard = newGuild?.leaderboards?.find((lb) => lb.id === lbId);

	if (!newLeaderboard) {
		const embed = ErrorEmbed('Leaderboard not found!').setDescription(
			'This leaderboard does not exist or Jacob Leaderboards are not enabled for this server.',
		);
		interaction.editReply({ embeds: [embed] });
		return;
	}

	const payload = await getLeaderboardPayload(newLeaderboard, interaction.guildId, interaction.guild.name);
	await interaction.message
		.edit({
			...payload,
			allowedMentions: { parse: [] },
		})
		.catch(() => undefined);
}

export async function getLeaderboardPayload(
	lb: components['schemas']['GuildJacobLeaderboard'],
	guildId?: string,
	guildName = "Jacob's Contest",
) {
	const buffer = await GenerateLeaderboardImage(guildName, lb);
	const attachment = new AttachmentBuilder(buffer, { name: 'leaderboard.png' });

	const headerContainer = new ContainerBuilder();

	const headerText = new TextDisplayBuilder().setContent(
		[
			`## ${lb.title ?? "Jacob's Contest Leaderboard"}`,
			'-# These are the highscores set by your fellow server members!',
		].join('\n'),
	);

	headerContainer.addTextDisplayComponents(headerText);

	let footerText = '-# Scores are valid starting ';
	if (!lb.startCutoff || lb.startCutoff === -1) {
		footerText += 'from the beginning of Skyblock!';
	}
	if (lb.startCutoff && lb.startCutoff !== -1) {
		footerText += `${GetReadableDate(lb.startCutoff)} (<t:${lb.startCutoff}:D>)`;
	}

	if (lb.endCutoff && lb.endCutoff !== -1) {
		footerText += ` to ${GetReadableDate(lb.endCutoff)}`;
	}

	const footerContainer = new ContainerBuilder();

	const footerTextComponent = new TextDisplayBuilder().setContent(footerText);

	footerContainer.addTextDisplayComponents(footerTextComponent);

	footerContainer.addActionRowComponents(CropSelectRow(`LB_DETAILS|${lb.id}`, 'Select a crop to view detailed stats!'));

	footerContainer.addActionRowComponents((row) =>
		row.addComponents(
			new ButtonBuilder().setCustomId(`LBSUBMIT|${lb.id}`).setLabel('Submit Scores').setStyle(ButtonStyle.Primary),
			new ButtonBuilder()
				.setLabel('View Online')
				.setURL(`https://elitesb.gg/server/${guildId}`)
				.setStyle(ButtonStyle.Link),
		),
	);

	const mediaGallery = new MediaGalleryBuilder().addItems((b) => b.setURL('attachment://leaderboard.png'));

	return {
		components: [headerContainer, mediaGallery, footerContainer],
		files: [attachment],
	};
}
