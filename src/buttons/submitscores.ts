import {
	APIContainerComponent,
	APITextDisplayComponent,
	ButtonBuilder,
	ButtonInteraction,
	ButtonStyle,
	ChannelType,
	ContainerBuilder,
	MessageFlags,
	PermissionFlagsBits,
	SectionBuilder,
	TextDisplayBuilder,
} from 'discord.js';
import { components } from '../api/api.js';
import { FetchAccount, FetchContests, FetchGuildJacob, UpdateGuildJacob } from '../api/elite.js';
import { CommandAccess, CommandType, EliteCommand } from '../classes/commands/index.js';
import { EliteEmbed, ErrorEmbed, WarningEmbed } from '../classes/embeds.js';
import { GetReadableDate } from '../classes/SkyblockDate.js';
import {
	escapeIgn,
	GetCropEmoji,
	GetCropTuple,
	GetCropURL,
	GetEmbeddedTimestamp,
	UserHyperLink,
} from '../classes/Util.js';

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

	const { data: guild } = await FetchGuildJacob(interaction.guildId).catch(() => ({ data: null }));

	if (!guild) {
		const embed = ErrorEmbed('Jacob Leaderboards not available!').setDescription(
			'This server does not have Jacob Leaderboards enabled. (Or the Elite API is down)\n⠀\nIf you were expecting this to work, please contact "kaeso.dev" on Discord.\nThis feature is being remade currently, and will likely be a paid feature. Sorry for the inconvenience.',
		);
		interaction.editReply({ embeds: [embed] });
		return;
	}

	const [, lbId] = interaction.customId.split('|');

	const leaderboard = guild.leaderboards?.find((lb) => lb.id === lbId);

	const isAdmin = interaction.memberPermissions.has(PermissionFlagsBits.Administrator);

	if (!leaderboard?.crops) {
		if (isAdmin) {
			try {
				// Scuffed way to remove the submit button
				const components = interaction.message.components;
				const buttonContainer = components.at(-1) as APIContainerComponent;
				const textDisplay = buttonContainer.components[0] as APITextDisplayComponent;

				const newButtonContainer = new ContainerBuilder().addTextDisplayComponents((b) =>
					b.setContent(textDisplay.content ?? 'Error fetching text'),
				);

				await interaction.message.edit({
					components: [...components.slice(0, -1), newButtonContainer],
					allowedMentions: { parse: [] },
				});
			} catch (e) {
				console.error(e);
			}
		}

		const embed = ErrorEmbed('Leaderboard not found!').setDescription(
			'This leaderboard does not exist.\n⠀\nIf you were expecting this to work, please contact "kaeso.dev" on Discord.\nThis feature is being remade currently, and will likely be a paid feature. Sorry for the inconvenience.',
		);
		interaction.editReply({ embeds: [embed] });
		return;
	}

	if (!interaction.message.flags.has(MessageFlags.IsComponentsV2)) {
		await interaction.message.delete().catch(() => undefined);
		await interaction.channel
			?.send({
				components: getLeaderboardComponents(leaderboard, interaction.guildId),
				allowedMentions: { parse: [] },
				flags: [MessageFlags.IsComponentsV2, MessageFlags.SuppressNotifications],
			})
			.catch(() => undefined);
	}

	if (isAdmin) {
		await interaction.message
			.edit({
				components: getLeaderboardComponents(leaderboard, interaction.guildId),
				allowedMentions: { parse: [] },
			})
			.catch(() => undefined);
	}

	// Check if the user has a banned role
	const bannedRoles = guild.blockedRoles?.map((r) => r.id) ?? [];
	if (leaderboard.blockedRole) bannedRoles.push(leaderboard.blockedRole);

	const hasBannedRoles = interaction.member.roles.cache.some((r) => bannedRoles.includes(r.id));

	if (hasBannedRoles) {
		const embed = ErrorEmbed('You are not allowed to submit scores!').setDescription(
			'You have a role that is not allowed to submit scores.\nSorry for the inconvenience.',
		);
		interaction.editReply({ embeds: [embed] });
		return;
	}

	// Check that the user has all required roles
	const requiredRoles = guild.requiredRoles?.map((r) => r.id) ?? [];
	if (leaderboard.requiredRole) requiredRoles.push(leaderboard.requiredRole);

	const hasRoles =
		requiredRoles.length === 0 || requiredRoles.every((r) => interaction.member.roles.cache.some((c) => c.id === r));

	if (!hasRoles) {
		const embed = ErrorEmbed('You are not allowed to submit scores!')
			.setDescription('You do not have a role that is required to submit scores.\nSorry for the inconvenience.')
			.addFields({
				name: 'Required Roles',
				value: requiredRoles.map((r) => `<@&${r}>`).join(', '),
			});
		interaction.editReply({ embeds: [embed] });
		return;
	}

	// Fetch the user's account
	const account = await FetchAccount(interaction.user.id)
		.then((data) => data.data)
		.catch(() => undefined);

	if (!account?.id || !account.name) {
		const embed = ErrorEmbed('Account not found!').setDescription(
			'You must link your account before submitting scores.\nUse the `/verify` command to link your account.',
		);
		interaction.editReply({ embeds: [embed] });
		return;
	}

	const contestRespnse = await FetchContests(account.id)
		.then((data) => data.data)
		.catch(() => undefined);
	const contests = contestRespnse ?? [];

	if (!contestRespnse) {
		const embed = ErrorEmbed('Contests not found!').setDescription(
			"Your data wasn't able to be fetched!\nThis is likely an issue with the Elite API, please try again later.",
		);
		interaction.editReply({ embeds: [embed] });
		return;
	}

	if (!contests || contests.length === 0) {
		const embed = WarningEmbed('Jacob Contests not Found!').setDescription(
			'You must have participated in a Jacob Contest before submitting scores.\nIf you have participated in a contest, please wait a few minutes and try again.\nIf this issue persists, please contact "kaeso.dev" on Discord.',
		);
		interaction.editReply({ embeds: [embed] });
		return;
	}

	const validContests = contests.filter((c) => {
		const time = c.timestamp;
		if (!time) return false;

		if (time < (leaderboard.startCutoff ?? 0)) return false;
		if (leaderboard.endCutoff && leaderboard.endCutoff !== -1 && time > leaderboard.endCutoff) return false;

		if (
			guild.excludedTimespans?.some((t) => {
				if (!t.start || !t.end) return false;

				return t.start <= time && t.end >= time;
			})
		)
			return false;

		if (guild.excludedParticipations?.includes(`${c.timestamp}-${c.crop}-${account.id}`)) return false;

		return true;
	});

	if (validContests.length === 0) {
		const embed = WarningEmbed('No Valid Contests Found!').setDescription(
			`No contests found fit the criteria for this leaderboard.\nIf you have participated in a valid contest, please wait up to 10 minutes (until your profile can be fetched again)`,
		);
		interaction.editReply({ embeds: [embed] });
		return;
	}

	const cropKeys = [
		'cactus',
		'carrot',
		'cocoaBeans',
		'potato',
		'pumpkin',
		'sugarCane',
		'wheat',
		'melon',
		'netherWart',
		'mushroom',
	];
	for (const key of Object.keys(leaderboard.crops)) {
		if (!cropKeys.includes(key)) {
			delete leaderboard.crops[key as keyof typeof leaderboard.crops];
		}
	}

	leaderboard.crops.cactus ??= [];
	leaderboard.crops.carrot ??= [];
	leaderboard.crops.cocoaBeans ??= [];
	leaderboard.crops.potato ??= [];
	leaderboard.crops.pumpkin ??= [];
	leaderboard.crops.sugarCane ??= [];
	leaderboard.crops.wheat ??= [];
	leaderboard.crops.melon ??= [];
	leaderboard.crops.netherWart ??= [];
	leaderboard.crops.mushroom ??= [];

	const currentScores = {
		Cactus: leaderboard.crops.cactus,
		Carrot: leaderboard.crops.carrot,
		'Cocoa Beans': leaderboard.crops.cocoaBeans,
		Potato: leaderboard.crops.potato,
		Pumpkin: leaderboard.crops.pumpkin,
		'Sugar Cane': leaderboard.crops.sugarCane,
		Wheat: leaderboard.crops.wheat,
		Melon: leaderboard.crops.melon,
		'Nether Wart': leaderboard.crops.netherWart,
		Mushroom: leaderboard.crops.mushroom,
	};

	const cropEmbeds = new Map<
		string,
		{
			container: ContainerBuilder;
			section: SectionBuilder;
		}
	>();

	validContests.sort((a, b) => (b.collected ?? 0) - (a.collected ?? 0));
	let sendPing = false;

	for (const contest of validContests) {
		const { crop, collected } = contest;
		if (!crop || !collected) continue;

		const scores = currentScores[crop as keyof typeof currentScores];
		if (scores === undefined) continue;

		if (scores.length === 3 && !scores.some((s) => (s.record?.collected ?? 0) < collected)) {
			// Contest is not a new record
			continue;
		}

		// Same user already has a better score for this crop
		if (scores.some((s) => s.discordId === interaction.user.id && (s.record?.collected ?? 0) >= collected)) continue;

		if (
			scores.some(
				(s) =>
					s.record?.collected === collected &&
					s.discordId === interaction.user.id &&
					s.record?.timestamp === contest.timestamp &&
					s.record.crop === crop,
			)
		) {
			// Contest is a duplicate
			continue;
		}

		const oldIndex = scores.findIndex((s) => (s.record?.collected ?? 0) < collected);
		const old = oldIndex !== -1 ? scores[oldIndex] : undefined;

		let updateContainer = cropEmbeds.get(crop);

		if (!updateContainer) {
			updateContainer = {
				container: new ContainerBuilder().setAccentColor(GetCropTuple(crop)),
				section: new SectionBuilder()
					.addTextDisplayComponents((b) =>
						b.setContent(oldIndex === 0 ? `## New High Score for ${crop}!` : `## New Score for ${crop}!`),
					)
					.setThumbnailAccessory((b) => b.setURL(GetCropURL(crop) ?? 'https://elitebot.dev/favicon.webp')),
			};

			updateContainer.container.addSectionComponents(updateContainer.section);
		}

		if (old?.record?.collected) {
			let message =
				oldIndex === 0
					? '**New High Score!**'
					: oldIndex === 1
						? `**New 2nd Place Score!**`
						: `**New 3rd Place Score!**`;

			if (old.uuid !== account.id) {
				message += `\n<@${interaction.user.id}> **(${escapeIgn(
					account.name,
				)})** has beaten <@${old.discordId}> (${escapeIgn(old.ign)}) by **${(
					collected - old.record.collected
				).toLocaleString()}** collection for a total of **${collected.toLocaleString()}**! [⧉](https://elitebot.dev/contest/${
					contest.timestamp ?? 0
				})`;

				// Check if this knocked someone out of the top 3
				if (scores.length > 2 && !scores.some((s) => s.discordId === interaction.user.id)) {
					const knockedOut = scores[2];
					if (knockedOut.discordId !== interaction.user.id) {
						message += `\n-# <@${knockedOut.discordId}> (${escapeIgn(knockedOut.ign)}) has been knocked out of the top 3!`;
					}
				}
			} else {
				const improvement = collected - old.record.collected;
				sendPing =
					sendPing || (oldIndex === 0 && (improvement >= 500 || (leaderboard.pingForSmallImprovements ?? false)));

				message += `\n<@${interaction.user.id}> **(${escapeIgn(
					account.name,
				)})** improved their score by **${improvement.toLocaleString()}** collection for a total of **${collected.toLocaleString()}**! [⧉](https://elitebot.dev/contest/${
					contest.timestamp ?? 0
				})`;
			}

			updateContainer.section.addTextDisplayComponents((b) => b.setContent(`${message}`));
		} else {
			sendPing = true;
			const prefix =
				scores.length === 0 ? '' : scores.length === 1 ? '**New 2nd Place Score!**\n' : '**New 3rd Place Score!**\n';
			updateContainer.section.addTextDisplayComponents((b) =>
				b.setContent(
					`\n${prefix}<@${interaction.user.id}> **(${escapeIgn(
						account.name,
					)})** has set a new score of **${collected.toLocaleString()}** collection! [⧉](https://elitebot.dev/contest/${
						contest.timestamp ?? 0
					})`,
				),
			);
		}

		sendPing = sendPing || oldIndex === 0;

		// Remove previous score of the user
		for (let i = 0; i < scores.length; i++) {
			if (scores[i].discordId === interaction.user.id) {
				scores.splice(i, 1);
			}
		}

		// Add new score
		scores.push({
			uuid: account.id,
			ign: account.name,
			discordId: interaction.user.id,
			record: contest,
		});

		// Sort scores
		scores.sort((a, b) => (b.record?.collected ?? 0) - (a.record?.collected ?? 0));

		// Remove any scores that are not in the top 3
		while (scores.length > 3) scores.pop();

		cropEmbeds.set(crop, updateContainer);
		currentScores[crop as keyof typeof currentScores] = scores;
	}

	try {
		await UpdateGuildJacob(interaction.guildId, guild).catch(() => undefined);
	} catch (e) {
		console.error(e);
		const embed = ErrorEmbed('Failed to Update Leaderboard!').setDescription(
			'Please try again later. If this issue persists, contact `kaeso.dev` on Discord.',
		);
		interaction.editReply({ embeds: [embed] });
		return;
	}

	const componentsToSend = Array.from(cropEmbeds.values()).map((c) => c.container);
	const newRecords = componentsToSend.length > 0;

	if (leaderboard.updateChannelId && newRecords) {
		const channel = await interaction.guild.channels.fetch(leaderboard.updateChannelId);

		const pingDisplay =
			sendPing && leaderboard.updateRoleId
				? new TextDisplayBuilder({ content: `<@&${leaderboard.updateRoleId}> ` })
				: undefined;

		if (channel?.type === ChannelType.GuildText || channel?.type === ChannelType.GuildAnnouncement) {
			channel
				.send({
					flags: MessageFlags.IsComponentsV2,
					components: pingDisplay ? [pingDisplay, ...componentsToSend.slice(0, 5)] : componentsToSend.slice(0, 5),
				})
				.catch((e) => {
					console.error(e);
				});

			if (componentsToSend.length > 5) {
				channel
					.send({
						flags: MessageFlags.IsComponentsV2,
						components: componentsToSend.slice(5),
					})
					.catch((e) => {
						console.error(e);
					});
			}
		}
	}

	if (!newRecords) {
		const embed = WarningEmbed('No New Records Set!').setDescription(
			'You did not set any new records.\nIf you think this is a mistake, please wait 10 minutes and try again, otherwise contact `kaeso.dev` on Discord.',
		);
		interaction.editReply({ embeds: [embed] });
		// return; Update the leaderboard even if no new records were set (to update changes from the site)
	} else {
		const embed = EliteEmbed()
			.setTitle('Scores Submitted!')
			.setDescription('Your scores were submitted! Congratulations!');
		interaction.editReply({ embeds: [embed] });
	}

	const components = getLeaderboardComponents(leaderboard, interaction.guildId);

	interaction.message
		.edit({
			components,
			allowedMentions: { parse: [] },
		})
		.catch(() => undefined);
}

export function getLeaderboardComponents(lb: components['schemas']['GuildJacobLeaderboard'], guildId?: string) {
	const { cactus, carrot, cocoaBeans, melon, mushroom, netherWart, potato, pumpkin, sugarCane, wheat } = lb.crops ?? {};

	const headerContainer = new ContainerBuilder();

	const headerText = new TextDisplayBuilder().setContent(
		[
			`## ${lb.title ?? "Jacob's Contest Leaderboard"}`,
			'-# These are the highscores set by your fellow server members!',
		].join('\n'),
	);

	headerContainer.addTextDisplayComponents(headerText);

	const container = new ContainerBuilder();

	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(getField('Cactus', cactus)),
		new TextDisplayBuilder().setContent(getField('Carrot', carrot)),
		new TextDisplayBuilder().setContent(getField('Cocoa Beans', cocoaBeans)),
		new TextDisplayBuilder().setContent(getField('Melon', melon)),
		new TextDisplayBuilder().setContent(getField('Mushroom', mushroom)),
		new TextDisplayBuilder().setContent(getField('Nether Wart', netherWart)),
		new TextDisplayBuilder().setContent(getField('Potato', potato)),
		new TextDisplayBuilder().setContent(getField('Pumpkin', pumpkin)),
		new TextDisplayBuilder().setContent(getField('Sugar Cane', sugarCane)),
		new TextDisplayBuilder().setContent(getField('Wheat', wheat)),
	);

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

	footerContainer.addActionRowComponents((row) =>
		row.addComponents(
			new ButtonBuilder().setCustomId(`LBSUBMIT|${lb.id}`).setLabel('Submit Scores').setStyle(ButtonStyle.Primary),
			new ButtonBuilder()
				.setLabel('View Online')
				.setURL(`https://elitebot.dev/server/${guildId}`)
				.setStyle(ButtonStyle.Link),
		),
	);

	return [headerContainer, container, footerContainer];
}

function getField(crop: string, scores?: components['schemas']['GuildJacobLeaderboardEntry'][]) {
	if (!scores || scores.length === 0) {
		return `### ${GetCropEmoji(crop)} ${crop} \nNo Scores Set Yet!`;
	}

	const first = scores[0];
	const otherScores = scores
		.slice(1)
		.map((s, i) => {
			return `${i + 2}. ${scoreFormat(s.record?.collected)}  ${UserHyperLink(s.discordId)}  ${GetEmbeddedTimestamp(
				s.record?.timestamp ?? 0,
			)} [⧉](https://elitebot.dev/contest/${s.record?.timestamp ?? 0})`;
		})
		.join('\n');

	const value =
		`1. **${scoreFormat(first.record?.collected)}**  ${UserHyperLink(first.discordId)}  ${GetEmbeddedTimestamp(
			first.record?.timestamp ?? 0,
		)} [⧉](https://elitebot.dev/contest/${first.record?.timestamp ?? 0})\n` + otherScores.trim();

	return `### ${GetCropEmoji(crop)} ${crop} - ${first.ign}\n${value.trim()}`;
}

const scoreFormat = (collected = 0) => {
	return `\`${collected.toLocaleString().padStart(9, ' ')}\``;
};
