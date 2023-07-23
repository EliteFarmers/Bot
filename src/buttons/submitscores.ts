import { Command, CommandAccess, CommandType } from "../classes/Command.js";
import { ButtonInteraction, ChannelType } from 'discord.js';
import { EliteEmbed, ErrorEmbed, WarningEmbed } from "../classes/embeds.js";
import { FetchAccount, FetchGuildJacob, FetchProfile, UpdateGuildJacob } from "../api/elite.js";
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

	const leaderboard = guild.leaderboards?.find((lb) => lb.messageId === lbId);

	if (!leaderboard) {
		const embed = ErrorEmbed('Leaderboard not found!')
			.setDescription('This leaderboard does not exist.\nIf you were expecting this to work, please contact "kaeso.dev" on Discord.\nThis feature is being remade currently, and will likely be a paid feature. Sorry for the inconvenience.');
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

	const profile = await FetchProfile(account.id, selectedProfile.profileId).then((data) => data.data).catch(() => undefined);
	const contests = profile?.jacob?.contests;

	if (!profile) {
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
		if (leaderboard.endCutoff && time > leaderboard.endCutoff) return false;

		if (guild.excludedTimespans?.some((t) => {
			if (!t.start || !t.end) return false;

			return t.start <= time && t.end >= time
		})) return false;

		if (guild.excludedParticipations?.includes(`${c.timestamp}-${c.crop}-${account.id}`)) return false;

		return true;
	});

	if (validContests.length === 0) {
		const embed = WarningEmbed('No Valid Contests Found!')
			.setDescription(`No contests found fit the criteria for this leaderboard.\nIf you have participated in a valid contest, please wait until your profile can be fetched again <t:${profile.lastUpdated ?? ((Date.now() / 1000) + 600)}:r>` )
			.addFields({ name: 'Selected Profile', value: selectedProfile.profileName ?? 'Unknown' });
		interaction.editReply({ embeds: [embed] });
		return;
	}

	const currentScores = {
		'Cactus': leaderboard.cactus ??= [],
		'Carrot': leaderboard.carrot ??= [],
		'Cocoa Beans': leaderboard.cocoaBeans ??= [],
		'Potato': leaderboard.potato ??= [],
		'Pumpkin': leaderboard.pumpkin ??= [],
		'Sugarcane': leaderboard.sugarCane ??= [],
		'Wheat': leaderboard.wheat ??= [],
		'Melon': leaderboard.melon ??= [],
		'Nether Wart': leaderboard.netherWart ??= [],
		'Mushroom': leaderboard.mushroom ??= [],
	}

	const embeds = [];

	for (const contest of validContests) {
		const { crop, collected } = contest;
		if (!crop || !collected) continue;

		const scores = currentScores[crop as keyof typeof currentScores];
		if (!scores) continue;

		if (scores.every((s) => (s.record?.collected ?? 0) > collected)) {
			// Contest is not a new record
			continue;
		}

		const old = scores.find((s) => (s.record?.collected ?? 0) < collected);
		if (!old) continue;
			
		const embed = EliteEmbed()
			.setColor(GetCropColor(crop))
			.setThumbnail(GetCropURL(crop) ?? 'https://elitebot.dev/favicon.webp')
			.setTitle(`New High Score for ${crop}!`)

		if (old?.record?.collected) {
			if (old.discordId !== interaction.user.id) {
				embed.setDescription(`<@${interaction.user.id}> **(${account.name})** has beaten <@${old.discordId}> (${old.ign}) by **${(old.record.collected - collected).toLocaleString()}** collection for a total of ${collected.toLocaleString()}!`);
			} else {
				embed.setDescription(`<@${interaction.user.id}> **(${account.name})** improved their score by **${(old.record.collected - collected).toLocaleString()}** collection for a total of ${collected.toLocaleString()}!`);
			}
			
			embed.setFooter({ text: `The previous score was: ${old.record.collected.toLocaleString()}` });
		} else {
			embed.setDescription(`<@${interaction.user.id}> **(${account.name})** has set a new high score of **${collected.toLocaleString()}** collection!`);
		}

		embeds.push(embed);

		scores.push({
			uuid: account.id,
			ign: account.name,
			discordId: interaction.user.id,
			record: contest
		});

		scores.sort((a, b) => (b.record?.collected ?? 0) - (a.record?.collected ?? 0));

		if (scores.length > 3) {
			const removed = scores.pop();

			embed.addFields({ name: 'Pay Respects To', value: `<@${removed?.discordId}> (${removed?.ign}) - ${removed?.record?.collected?.toLocaleString() ?? 'Unknown'}` });
		}

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

	if (embeds.length === 0) {
		const embed = WarningEmbed('No New Records Set!')
			.setDescription('You did not set any new records.\nIf you think this is a mistake, please wait 10 minutes and try again, otherwise contact `kaeso.dev` on Discord.');
		interaction.editReply({ embeds: [embed] });
		return;
	}

	if (leaderboard.updateChannelId) {
		const channel = await interaction.guild.channels.fetch(leaderboard.updateChannelId);

		if (channel?.type === ChannelType.GuildText) {
			channel.send({ 
				content: leaderboard.updateRoleId ? `<@${leaderboard.updateRoleId}>` : undefined, 
				embeds: embeds 
			}).catch(() => undefined);
		}
	}

	const embed = EliteEmbed()
		.setTitle('Scores Submitted!')
		.setDescription('Your scores were submitted! Congratulations!');
	interaction.editReply({ embeds: [embed] });

	interaction.message.edit({ embeds: [getLeaderboardEmbed(leaderboard)] }).catch(() => undefined);
}

function getLeaderboardEmbed(lb: components['schemas']['GuildJacobLeaderboard']) {
	const { cactus, carrot, cocoaBeans, melon, mushroom, netherWart, potato, pumpkin, sugarCane, wheat } = lb;

	const embed = EliteEmbed()
		.setTitle('Jacob\'s Contest Leaderboard')
		.setDescription('These are the highscores set by your fellow server members!')
	
	if (lb.startCutoff && !lb.endCutoff) {
		embed.setFooter({ text: `Scores are only valid after ${GetReadableDate(lb.startCutoff)}` });
	} else if (lb.startCutoff && lb.endCutoff) {
		embed.setFooter({ text: `Scores are only valid between ${GetReadableDate(lb.startCutoff)} and ${GetReadableDate(lb.endCutoff)}` });
	}

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
	const value = `
		${GetCropEmoji(crop)} <@${first.discordId}> - **${first.record?.collected?.toLocaleString()}** - [${GetEmbeddedTimestamp(first.record?.timestamp ?? 0)}] [View](https://elitebot.dev/contest/${first.record?.timestamp ?? 0})
		${scores.slice(1).map((s) => `<@${s.discordId}> - ${s.record?.collected?.toLocaleString()} - [${GetEmbeddedTimestamp(s.record?.timestamp ?? 0)}] [View](https://elitebot.dev/contest/${s.record?.timestamp ?? 0})`).join('\n')}
	`;

	return {
		name: `${crop} - ${first.ign}`, value
	};
}