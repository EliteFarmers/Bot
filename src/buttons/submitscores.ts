import { Command, CommandAccess, CommandType } from "../classes/Command.js";
import { ButtonInteraction, ChannelType, EmbedBuilder } from 'discord.js';
import { EliteEmbed, ErrorEmbed, WarningEmbed } from "../classes/embeds.js";
import { FetchAccount, FetchContests, FetchGuildJacob, UpdateGuildJacob } from "../api/elite.js";
import { GetCropColor, GetCropEmoji, GetCropURL, GetEmbeddedTimestamp } from "../classes/Util.js";
import { components } from "../api/api.js";
import { GetReadableDate } from "../classes/SkyblockDate.js";

const command: Command = {
	name: 'LBSUBMIT',
	description: 'Submit your scores!',
	access: CommandAccess.Guild,
	type: CommandType.Button,
	execute: execute
}

export default command;

async function execute(interaction: ButtonInteraction) {
	if (!interaction.inCachedGuild()) {
		const embed = ErrorEmbed('This command can only be used in a server!')
			.setDescription('If you are in a server, please wait a few minutes and try again.\nOtherwise I have no idea how you got this error.');
		interaction.reply({ embeds: [embed], ephemeral: true });
		return;
	}

	await interaction.deferReply({ ephemeral: true });

	const guild = await FetchGuildJacob(interaction.guildId).then((data) => data.data).catch(() => undefined);

	if (!guild) {
		const embed = ErrorEmbed('Jacob Leaderboards not available!')
			.setDescription('This server does not have Jacob Leaderboards enabled.\nIf you were expecting this to work, please contact "kaeso.dev" on Discord.\nThis feature is being remade currently, and will likely be a paid feature. Sorry for the inconvenience.');
		interaction.editReply({ embeds: [embed] });
		return;
	}

	const [, lbId ] = interaction.customId.split('|');

	const leaderboard = guild.leaderboards?.find((lb) => lb.id === lbId);

	if (!leaderboard?.crops) {
		const embed = ErrorEmbed('Leaderboard not found!')
			.setDescription('This leaderboard does not exist.\n⠀\nIf you were expecting this to work, please contact "kaeso.dev" on Discord.\nThis feature is being remade currently, and will likely be a paid feature. Sorry for the inconvenience.');
		interaction.editReply({ embeds: [embed] });
		return;
	}

	// Check if the user has a banned role
	const bannedRoles = guild.blockedRoles?.map(r => r.id) ?? [];
	if (leaderboard.blockedRole) bannedRoles.push(leaderboard.blockedRole);

	const hasBannedRoles = interaction.member.roles.cache.some((r) => bannedRoles.includes(r.id));

	if (hasBannedRoles) {
		const embed = ErrorEmbed('You are not allowed to submit scores!')
			.setDescription('You have a role that is not allowed to submit scores.\nSorry for the inconvenience.');
		interaction.editReply({ embeds: [embed] });
		return;
	}

	// Check that the user has all required roles
	const requiredRoles = guild.requiredRoles?.map(r => r.id) ?? [];
	if (leaderboard.requiredRole) requiredRoles.push(leaderboard.requiredRole);

	const hasRoles = requiredRoles.length === 0 
		|| requiredRoles.every((r) => interaction.member.roles.cache.some((c => c.id === r)));

	if (!hasRoles) {
		const embed = ErrorEmbed('You are not allowed to submit scores!')
			.setDescription('You do not have a role that is required to submit scores.\nSorry for the inconvenience.')
			.addFields({ name: 'Required Roles', value: requiredRoles.map((r) => `<@&${r}>`).join(', ') });
		interaction.editReply({ embeds: [embed] });
		return;
	}

	// Fetch the user's account
	const account = await FetchAccount(interaction.user.id).then((data) => data.data).catch(() => undefined);

	if (!account?.id || !account.name) {
		const embed = ErrorEmbed('Account not found!')
			.setDescription('You must link your account before submitting scores.\nUse the `/verify` command to link your account.');
		interaction.editReply({ embeds: [embed] });
		return;
	}

	// Fetch the user's profile
	const selectedProfile = account.profiles?.find((p) => p.selected);

	if (!selectedProfile?.profileId) {
		const embed = ErrorEmbed('Profile not found!')
			.setDescription('You must have a profile selected in SkyBlock before submitting scores.\nThis is a scary error to get, hopefully something went wrong and you can try again, otherwise your selected profile might be deleted.');
		interaction.editReply({ embeds: [embed] });
		return;
	}

	const contestRespnse = await FetchContests(account.id).then((data) => data.data).catch(() => undefined);
	const contests = contestRespnse ?? [];

	if (!contestRespnse) {
		const embed = ErrorEmbed('Profile not found!')
			.setDescription('You must have a profile selected in SkyBlock before submitting scores.\nThis is a scary error to get, hopefully something went wrong and you can try again, otherwise your selected profile might be deleted.');
		interaction.editReply({ embeds: [embed] });
		return;
	}

	if (!contests || contests.length === 0) {
		const embed = WarningEmbed('Jacob Contests not Found!')
			.setDescription('You must have participated in a Jacob Contest before submitting scores.\nIf you have participated in a contest, please wait a few minutes and try again.\nIf this issue persists, please contact "kaeso.dev" on Discord.')
			.addFields({ name: 'Selected Profile', value: selectedProfile.profileName ?? 'Unknown' });
		interaction.editReply({ embeds: [embed] });
		return;
	}

	const validContests = contests.filter((c) => {
		const time = c.timestamp;
		if (!time) return false;

		if (time < (leaderboard.startCutoff ?? 0)) return false;
		if (leaderboard.endCutoff && leaderboard.endCutoff !== -1 && time > leaderboard.endCutoff) return false;

		if (guild.excludedTimespans?.some((t) => {
			if (!t.start || !t.end) return false;

			return t.start <= time && t.end >= time
		})) return false;

		if (guild.excludedParticipations?.includes(`${c.timestamp}-${c.crop}-${account.id}`)) return false;

		return true;
	});

	if (validContests.length === 0) {
		const embed = WarningEmbed('No Valid Contests Found!')
			.setDescription(`No contests found fit the criteria for this leaderboard.\nIf you have participated in a valid contest, please wait up to 10 minutes (until your profile can be fetched again)`)
			.addFields({ name: 'Selected Profile', value: selectedProfile.profileName ?? 'Unknown' });
		interaction.editReply({ embeds: [embed] });
		return;
	}

	const currentScores = {
		'Cactus': leaderboard.crops.cactus ??= [],
		'Carrot': leaderboard.crops.carrot ??= [],
		'Cocoa Beans': leaderboard.crops.cocoaBeans ??= [],
		'Potato': leaderboard.crops.potato ??= [],
		'Pumpkin': leaderboard.crops.pumpkin ??= [],
		'Sugar Cane': leaderboard.crops.sugarCane ??= [],
		'Wheat': leaderboard.crops.wheat ??= [],
		'Melon': leaderboard.crops.melon ??= [],
		'Nether Wart': leaderboard.crops.netherWart ??= [],
		'Mushroom': leaderboard.crops.mushroom ??= [],
	}

	const cropEmbeds = new Map<string, EmbedBuilder>();

	validContests.sort((a, b) => (b.collected ?? 0) - (a.collected ?? 0));
	let sendPing = false;

	for (const contest of validContests) {
		const { crop, collected } = contest;
		if (!crop || !collected) continue;

		let scores = currentScores[crop as keyof typeof currentScores];
		if (scores === undefined) continue;

		if (scores.length === 3 && !scores.some((s) => (s.record?.collected ?? 0) < collected)) {
			// Contest is not a new record
			continue;
		}

		// Same user already has a better score for this crop
		if (scores.some((s) => 
			s.discordId === interaction.user.id 
			&& (s.record?.collected ?? 0) >= collected
		)) continue;

		if (scores.some((s) => 
			s.record?.collected === collected 
			&& s.discordId === interaction.user.id 
			&& s.record?.timestamp === contest.timestamp
			&& s.record.crop === crop)) {
			// Contest is a duplicate
			continue;
		}

		const oldIndex = scores.findIndex((s) => (s.record?.collected ?? 0) < collected);
		const old = oldIndex !== -1 ? scores[oldIndex] : undefined;

		const embed = cropEmbeds.get(crop) ?? EliteEmbed()
			.setColor(GetCropColor(crop))
			.setThumbnail(GetCropURL(crop) ?? 'https://elitebot.dev/favicon.webp')
			.setTitle(`New Score for ${crop}!`)

		if (oldIndex === 0) {
			embed.setTitle(`New High Score for ${crop}!`);
		}

		if (old?.record?.collected) {
			let message = oldIndex === 0 ? '**New High Score!**' : oldIndex === 1 ? `**New 2nd Place Score!**` : `**New 3rd Place Score!**`;
			
			if (old.uuid !== account.id) {
				message += `\n<@${interaction.user.id}> **(${account.name})** has beaten <@${old.discordId}> (${old.ign}) by **${(collected - old.record.collected).toLocaleString()}** collection for a total of **${collected.toLocaleString()}**! [⧉](https://elitebot.dev/contest/${contest.timestamp ?? 0})`
			} else {
				const improvement = collected - old.record.collected;
				sendPing = sendPing || (oldIndex === 0 && (improvement >= 500 || (leaderboard.pingForSmallImprovements ?? false)));

				message += `\n<@${interaction.user.id}> **(${account.name})** improved their score by **${improvement.toLocaleString()}** collection for a total of **${collected.toLocaleString()}**! [⧉](https://elitebot.dev/contest/${contest.timestamp ?? 0})`
			}

			embed.setDescription((embed.data.description ?? '') + `\n${message}`);
		} else {
			sendPing = true;
			const prefix = scores.length === 0 ? '' : scores.length === 1 ? '**New 2nd Place Score!**\n' : '**New 3rd Place Score!**\n';
			embed.setDescription((embed.data.description ?? '') 
				+ `\n${prefix}<@${interaction.user.id}> **(${account.name})** has set a new score of **${collected.toLocaleString()}** collection! [⧉](https://elitebot.dev/contest/${contest.timestamp ?? 0})`
			);
		}

		sendPing = sendPing || oldIndex === 0;

		// Remove previous score of the user
		scores = scores.filter((s) => s.discordId !== interaction.user.id);

		// Add new score
		scores.push({
			uuid: account.id,
			ign: account.name,
			discordId: interaction.user.id,
			record: contest
		});

		// Sort scores
		scores.sort((a, b) => (b.record?.collected ?? 0) - (a.record?.collected ?? 0));

		// Remove any scores that are not in the top 3
		scores = scores.slice(0, 3);

		cropEmbeds.set(crop, embed);
		currentScores[crop as keyof typeof currentScores] = scores;
	}

	try {
		await UpdateGuildJacob(interaction.guildId, guild).catch(() => undefined);
	} catch (e) {
		console.error(e);
		const embed = ErrorEmbed('Failed to Update Leaderboard!')
			.setDescription('Please try again later. If this issue persists, contact `kaeso.dev` on Discord.');
		interaction.editReply({ embeds: [embed] });
		return;
	}

	const embedsToSend = Array.from(cropEmbeds.values());
	const newRecords = embedsToSend.length > 0;

	if (leaderboard.updateChannelId && newRecords) {
		const channel = await interaction.guild.channels.fetch(leaderboard.updateChannelId);

		if (channel?.type === ChannelType.GuildText || channel?.type === ChannelType.GuildAnnouncement) {
			channel.send({ 
				content: (sendPing && leaderboard.updateRoleId) ? `<@&${leaderboard.updateRoleId}>` : undefined, 
				embeds: embedsToSend,
				allowedMentions: { roles: [leaderboard.updateRoleId ?? ''] }
			}).catch((e) => {
				console.error(e);
			});
		}
	}

	if (!newRecords) {
		const embed = WarningEmbed('No New Records Set!')
			.setDescription('You did not set any new records.\nIf you think this is a mistake, please wait 10 minutes and try again, otherwise contact `kaeso.dev` on Discord.');
		interaction.editReply({ embeds: [embed] });
		// return; Update the leaderboard even if no new records were set (to update changes from the site)
	} else {
		const embed = EliteEmbed()
			.setTitle('Scores Submitted!')
			.setDescription('Your scores were submitted! Congratulations!');
		interaction.editReply({ embeds: [embed] });
	}

	interaction.message.edit({ embeds: [getLeaderboardEmbed(leaderboard)] }).catch(() => undefined);
}

export function getLeaderboardEmbed(lb: components['schemas']['GuildJacobLeaderboard']) {
	const { cactus, carrot, cocoaBeans, melon, mushroom, netherWart, potato, pumpkin, sugarCane, wheat } = lb.crops ?? {};

	const embed = EliteEmbed()
		.setTitle(lb.title ?? 'Jacob\'s Contest Leaderboard')
		.setDescription('These are the highscores set by your fellow server members!')
	
	let footerText = 'Scores are valid from ';
	if (!lb.startCutoff || lb.startCutoff === -1) {
		footerText += 'the beginning of Skyblock';
	}
	if (lb.startCutoff && lb.startCutoff !== -1) {
		footerText += GetReadableDate(lb.startCutoff);
	}

	if (lb.endCutoff && lb.endCutoff !== -1) {
		footerText += ` to ${GetReadableDate(lb.endCutoff)}`;
	}

	embed.setFooter({ text: footerText });

	embed.addFields([
		getField('Cactus', cactus),
		getField('Carrot', carrot),
		getField('Cocoa Beans', cocoaBeans),
		getField('Melon', melon),
		getField('Mushroom', mushroom),
		getField('Nether Wart', netherWart),
		getField('Potato', potato),
		getField('Pumpkin', pumpkin),
		getField('Sugar Cane', sugarCane),
		getField('Wheat', wheat),
	]);

	return embed;
}

function getField(crop: string, scores?: components['schemas']['GuildJacobLeaderboardEntry'][]) {
	if (!scores || scores.length === 0) return {
		name: crop,
		value: 'No Scores Set Yet!'
	};

	const first = scores[0];
	const otherScores = scores.slice(1).map((s, i) => {
		return `**${i + 2}.**⠀<@${s.discordId}>⠀${s.record?.collected?.toLocaleString()}⠀${GetEmbeddedTimestamp(first.record?.timestamp ?? 0)} [⧉](https://elitebot.dev/contest/${s.record?.timestamp ?? 0})`
	}).join('\n');

	const value = `
		${GetCropEmoji(crop)} <@${first.discordId}>⠀**${first.record?.collected?.toLocaleString()}**⠀${GetEmbeddedTimestamp(first.record?.timestamp ?? 0)} [⧉](https://elitebot.dev/contest/${first.record?.timestamp ?? 0})
		${otherScores}
	`;

	return {
		name: `${crop} - ${first.ign}`, value
	};
}