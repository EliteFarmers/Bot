import { Command } from "classes/Command";
import { CommandInteraction, MessageEmbed, MessageActionRow, Permissions } from "discord.js";
import DataHandler from '../classes/Database';
import Data, { CropString } from '../classes/Data';
import { ServerData } from "database/models/servers";

const command: Command = {
	name: 'config',
	description: 'Edit the server config.',
	usage: '<sub command>',
	access: 'GUILD',
	type: 'SLASH',
	permissions: ['ADMINISTRATOR'],
	adminRoleOverride: true,
	execute: execute,
}

export default command;

async function execute(interaction: CommandInteraction) {
	if (!interaction.member || !interaction.guildId) return;

	const server = await DataHandler.getServer(interaction.guildId) 
		?? await DataHandler.createServer(interaction.guildId);

	if (!server) {
		interaction.reply({ content: '**Error!**\nSomething went wrong with grabbing/creating your server data. If this issue persists please contact Kaeso#5346', ephemeral: true }); 
		return; 
	}

	// Handling for old registered commands
	const group = interaction.options.getSubcommandGroup(false);
	if (group) {
		return interaction.reply({ content: '**Error!** Command not found! Re-register `/config` with `/admin`\nIf this issue persists, contact Kaeso!', ephemeral: true});
	}

	const subCommand = interaction.options.getSubcommand();
	const command = (subCommand === 'clear') 
		? interaction.options.getString('setting', false) 
		: subCommand;

	const guildId = interaction.guildId;
	const superUser = (interaction.member.permissions as Readonly<Permissions>).has('ADMINISTRATOR');
	
	switch (command) {
	case 'view': {
		viewSettings(server, interaction);
		break;
	}
	case 'whitelist': {
		if (subCommand === 'clear') {
			await DataHandler.updateServer({ channels: null }, guildId);
			clearedSettings(interaction);
			break;
		}
		whitelist(server, interaction);
		break;
	}
	case 'leaderboard': {
		if (subCommand === 'clear') {
			await DataHandler.updateServer({ 
				lbchannel: null,
				lbcutoff: null,
				lbrolereq: null,
				lbupdatechannel: null,
				lbroleping: null,
				scores: null,
			}, guildId);
			clearedSettings(interaction);
			break;
		}
		createLeaderboard(server, interaction);
		break;
	}
	case 'leaderboard-notifs': {
		createLeaderboardNotifs(server, interaction);
		break;
	}
	case 'admin-role': {
		if (subCommand === 'clear') {
			if (superUser) { 
				await DataHandler.updateServer({ adminrole: null }, guildId);
				clearedSettings(interaction);
			} else {
				await interaction.reply({ content: 'You need the `ADMINISTRATOR` permission to use this command!', ephemeral: true });
			}
			break;
		}
		setAdminRole(server, interaction);
		break;
	}
	case 'weight-role': {
		if (subCommand === 'clear') {
			await DataHandler.updateServer({ 
				weightrole: null,
				weightchannel: null,
				weightreq: null 
			}, guildId);
			clearedSettings(interaction);
			break;
		}
		setWeightRole(server, interaction);
		break;
	}
	case 'weight-review': {
		if (subCommand === 'clear') {
			await DataHandler.updateServer({ 
				reviewchannel: null,
				reviewerrole: null,
				inreview: []
			}, guildId);
			clearedSettings(interaction);
			break;
		}
		setWeightReview(server, interaction);
		break;
	}
	case 'cutoff-date': {
		setCutoffDate(server, interaction);
		break;
	}
	case 'all': {
		await DataHandler.updateServer({
			adminrole: superUser ? null : server.adminrole,
			weightrole: null, weightchannel: null, weightreq: null,
			reviewchannel: null, reviewerrole: null, lbchannel: null,
			lbcutoff: null, lbrolereq: null, lbupdatechannel: null,
			lbroleping: null, scores: null, inreview: [], channels: null,
		}, guildId);
		clearedSettings(interaction, superUser);
		break;
	}
	case 'remove-user': {
		if (!server.scores) {
			return interaction.reply({ content: 'Nothing Changed! There are no saved scores currently.', ephemeral: true })
		}

		const ign = interaction.options.getString('player', false)?.toLowerCase() ?? undefined;
		if (!ign) return interaction.reply({ content: '**Error!** Option not specified!', ephemeral: true }).catch(() => undefined);

		for (const crop of Object.keys(server.scores)) {
			const record = server.scores[crop as CropString];
			if (!record || !record.ign) continue;
			if (record.ign.toLowerCase() === ign) delete server.scores[crop as CropString];
		}

		await DataHandler.updateServer({ scores: server.scores }, guildId);

		interaction.reply({ content: '**Success!** Please click "Submit Scores" to update the leaderboard message!\n**Note:** This doesn\'t prevent the user from submitting their scores again.', ephemeral: true }).catch(() => undefined);
		break;
	}
	case 'scores': {
		await DataHandler.updateServer({ scores: null }, guildId);
		interaction.reply({ content: '**Success!** The scores have been cleared.', ephemeral: true });
		break;
	}
	case 'weight-role-blacklist': {
		await DataHandler.updateServer({ inreview: [] }, guildId);
		interaction.reply({ content: '**Success!** The blacklist has been cleared.', ephemeral: true });
		break;
	}
	default: {
		interaction.reply({ content: '**Error!** Command not found! Re-register `/config` with `/admin`\nIf this issue persists, contact Kaeso!', ephemeral: true});
		break;
	}
	}
}

async function viewSettings(s: ServerData, interaction: CommandInteraction) {
	const content = `
**Admin Role:** ${s.adminrole ? `<@&${s.adminrole}>` : 'Not set'}\n
**Weight Requirement:** ${s.weightreq ? (s.weightreq === 0 ? 'All Verified Users' : s.weightreq) : 'Not set'}
- Reward Role: ${s.weightrole ? `<@&${s.weightrole}>` : 'Not set'}
- Annoucement Channel: ${s.weightchannel ? `<#${s.weightchannel}>` : 'Not set'}
- Review Channel: ${s.reviewchannel ? `<#${s.reviewchannel}>` : 'Not set'}
- Reviewer Role: ${s.reviewerrole ? `<@&${s.reviewerrole}>` : 'Not set'}\n	
**Leaderboard Channel:** ${s.lbchannel ? `<#${s.lbchannel}>` : 'Not set'}
- Role Requirement: ${s.lbrolereq ? `<@&${s.lbrolereq}>` : 'Not set'}
- Annoucement Channel: ${s.lbupdatechannel ? `<#${s.lbupdatechannel}>` : 'Not set'}
- Annoucement Ping: ${s.lbroleping ? `<@&${s.lbroleping}>` : 'Not set'}
- Custom Cutoff Date: ${s.lbcutoff ? Data.getReadableDate(s.lbcutoff) : 'Not set'}
	`;

	let channels = '';
	s.channels?.forEach((channel: string) => {
		channels += channel[0] === 'C' ? `<#${channel.substring(1)}> ` : `<#${channel}> `;
	});
	
	const embed = new MessageEmbed().setColor('#03fc7b')
		.setTitle('Your Server Settings')
		.setDescription('Use `/config` and its subcommands to change these!\n(Show/hide `/config` with `/admin`)')
		.addField('Current Settings', content)
		.addField('Whitelisted Channels', channels.length > 0 ? channels : 'No channels set')
		.setFooter({ text: 'Created by Kaeso#5346' });

	await interaction.reply({ embeds: [embed], ephemeral: true }).catch(() => undefined);
}

async function clearedSettings(interaction: CommandInteraction, superUser = true) {
	let content = '**Success!** These settings have been cleared.';

	if (!superUser) {
		content += '\nThe admin role has not been cleared, doing so requires the `ADMINISTRATOR` permission.'
	}

	await interaction.reply({ content: content, ephemeral: true }).catch(() => undefined);
}

async function whitelist(server: ServerData, interaction: CommandInteraction) {
	const channel = interaction.options.getChannel('channel', false) ?? interaction.channel;
	
	if (!channel || !channel.id) return interaction.reply({ content: '**Error!** Select a text channel!', ephemeral: true }).catch(() => undefined);
	const channelId = (channel.type === 'GUILD_TEXT') ? channel.id : 'C' + channel.id;

	const channels = [];

	const embed = new MessageEmbed().setColor('#03fc7b')
		.setTitle('Success!')
		.setFooter({ text: 'Created by Kaeso#5346' });

	if (server.channels?.includes(channelId)) {
		if (server.channels) {
			server.channels.forEach((c: string) => { 
				if (c !== channelId) channels.push(c); 
			});
		}
	} else {
		channels.push(channelId);
		if (server.channels) channels.push(...server.channels);
	}

	let content = '';
	channels.forEach(channel => {
		content += channel[0] === 'C' ? `<#${channel.substring(1)}> ` : `<#${channel}> `;
	});
	if (content.length > 0) {
		embed.addField('Whitelisted Channels', content.trim());
	} else {
		embed.setDescription('No channels are whitelisted.');
	}

	await DataHandler.updateServer({ channels: channels.length === 0 ? null : channels }, server.guildid);

	interaction.reply({ embeds: [embed], ephemeral: true }).catch(() => undefined);
}

async function setAdminRole(server: ServerData, interaction: CommandInteraction) {
	if (interaction.member && !(interaction.member.permissions as Readonly<Permissions>).has('ADMINISTRATOR')) {
		interaction.reply({ content: '**Error!** Only users with the `ADMINISTRATOR` permission can configure this.', ephemeral: true }).catch(() => undefined);
		return;
	}

	const roleId = interaction.options.getRole('role', false)?.id;

	if (!roleId) {
		interaction.reply({ content: '**Error!** No role specified!', ephemeral: true }).catch(() => undefined);
		return;
	}

	await DataHandler.updateServer({ adminrole: roleId }, server.guildid);

	const embed = new MessageEmbed().setColor('#03fc7b')
		.setTitle('Success!')
		.setDescription(`Admin Role: <@&${roleId}>`)
		.setFooter({ text: 'Created by Kaeso#5346' });

	interaction.reply({ embeds: [embed], ephemeral: true }).catch(() => undefined);
}

async function setWeightRole(server: ServerData, interaction: CommandInteraction) {
	const weight = interaction.options.getInteger('weight', false) ?? undefined;
	const roleId = interaction.options.getRole('role', false)?.id;

	const channel = interaction.options.getChannel('channel', false);
	if (channel && channel?.type !== 'GUILD_TEXT') return interaction.reply({ content: '**Error!** Select a text channel!', ephemeral: true }).catch(() => undefined);
	const channelId = channel?.id;

	if (weight === undefined || !roleId) {
		interaction.reply({ content: '**Error!** Option not specified!', ephemeral: true }).catch(() => undefined);
		return;
	}

	await DataHandler.updateServer({ 
		weightreq: weight, 
		weightrole: roleId, 
		weightchannel: channelId ?? server.weightchannel
	}, server.guildid);

	const embed = new MessageEmbed().setColor('#03fc7b')
		.setTitle('Success!')
		.setDescription(`Required Weight: **${weight === 0 ? 'N/A (All verified users qualify)' : weight}**\nReward Role: <@&${roleId}>${channelId ? `\nAnnouncement Channel: <#${channelId}>` : ''}`)
		.setFooter({ text: 'Created by Kaeso#5346' });

	interaction.reply({ embeds: [embed], ephemeral: true }).catch(() => undefined);
}

async function createLeaderboard(server: ServerData, interaction: CommandInteraction) {
	const channel = interaction.options.getChannel('channel', false);
	if (channel?.type !== 'GUILD_TEXT') return interaction.reply({ content: '**Error!** Select a text channel!', ephemeral: true }).catch(() => undefined);
	if (!channel) return interaction.reply({ content: '**Error!** Option not specified!', ephemeral: true }).catch(() => undefined);

	const roleId = interaction.options.getRole('role', false)?.id;
	const clearScores = interaction.options.getBoolean('clear', false) ?? false;

	await DataHandler.updateServer({ 
		lbchannel: channel.id, 
		lbrolereq: roleId ?? server.lbrolereq, 
		lbactiveid: interaction.id,
		scores: clearScores ? null : server.scores
	}, server.guildid);

	interaction.reply({ embeds: [
		new MessageEmbed().setColor('#03fc7b')
			.setTitle('Success!')
			.setDescription(`Leaderboard Channel: <#${channel.id}>\nRole Requirement: ${roleId ? `<@&${roleId}>` : 'Not set'}`)
			.setFooter({ text: 'Created by Kaeso#5346' })
	], ephemeral: true }).catch(() => undefined);

	const embed = new MessageEmbed().setColor('#03fc7b')
		.setTitle('Jacob\'s Contest Leaderboard')
		.setDescription('These are the highscores set by your fellow server members!')
		.setFooter({ text: `Highscores only valid after ${Data.getReadableDate(server.lbcutoff ?? Data.CUTOFFDATE)}⠀⠀Created by Kaeso#5346` });
		
	if (!clearScores && server.scores) {
		for (const crop in server.scores) {
			const contest = server.scores[crop as CropString];

			const details = (contest.par && contest.pos !== undefined) 
				? `\`#${(contest.pos + 1).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}\` of \`${contest.par.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}\` on \`${contest.profilename}\`!` 
				: `Contest Still Unclaimed!`;

			if (!contest.value) continue;

			embed.fields.push({
				name: `${Data.getReadableCropName(crop)} - ${contest.ign}`, inline: false,
				value: `<@${contest.user}> - **${contest.value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}**⠀⠀${details}\n${Data.getReadableDate(contest.obtained)}⠀[🔗](https://sky.shiiyu.moe/stats/${contest.ign}/${contest.profilename})`,
			});
		}
	} else {
		embed.addField('Nothing Yet', 'Be the first to submit your scores!');
	}

	const row = new MessageActionRow().addComponents(
		{ label: 'Submit Scores', customId: `LBSUBMIT|${interaction.id}`, style: 'SECONDARY', type: 'BUTTON' },
		{ label: 'Toggle Notifications', customId: `LBROLETOGGLE|${interaction.id}`, style: 'SECONDARY', type: 'BUTTON' }
	);

	channel.send({ embeds: [embed], components: [row] }).catch(() => {
		interaction.followUp({ content: `**Error!** I don't have permission to send messages in ${channel.id}. Please fix this and rerun the command.`, ephemeral: true });
	});
}

async function createLeaderboardNotifs(server: ServerData, interaction: CommandInteraction) {
	const channel = interaction.options.getChannel('channel', false);
	if (channel?.type !== 'GUILD_TEXT') return interaction.reply({ content: '**Error!** Select a text channel!', ephemeral: true }).catch(() => undefined);
	const channelId = channel?.id;
	if (!channelId) return interaction.reply({ content: '**Error!** Option not specified!', ephemeral: true }).catch(() => undefined);

	const roleId = interaction.options.getRole('role', false)?.id;

	await DataHandler.updateServer({ 
		lbupdatechannel: channelId, 
		lbroleping: roleId ?? server.lbrolereq, 
	}, server.guildid);

	const embed = new MessageEmbed().setColor('#03fc7b')
		.setTitle('Success!')
		.setDescription(`Annoucement Channel: <#${channelId}>\nRole That's Pinged: ${roleId ? `<@&${roleId}>` : 'Not set'}`)
		.setFooter({ text: 'Created by Kaeso#5346' });

	interaction.reply({ embeds: [embed], ephemeral: true }).catch(() => undefined);
}

async function setCutoffDate(server: ServerData, interaction: CommandInteraction) {
	const day = interaction.options.getInteger('day', false) ?? undefined;
	const month = interaction.options.getInteger('month', false) ?? undefined;
	let year = interaction.options.getInteger('year', false) ?? undefined;

	if (!day || !month || !year) {
		return interaction.reply({ content: '**Error!** Option not specified!', ephemeral: true }).catch(() => undefined);
	}

	// Jacob's contests have their years starting at 0
	year--;

	if (day < 1 || day > 31) {
		return interaction.reply({ content: '**Error!** Day must be a number [1-31] (inclusive)', ephemeral: true }).catch(() => undefined);
	}

	const date = `${year}${month <= 9 ? `0${month}` : month}${day <= 9 ? `0${day}` : day}`;

	if (year < 159 || +date < +Data.CUTOFFDATE) {
		return interaction.reply({ content: `**Error!** Overall date must be after **${Data.getReadableDate(Data.CUTOFFDATE)}**, dates before this are currently unsupported.`, ephemeral: true }).catch(() => undefined);
	}

	if (year > 9999) {
		return interaction.reply({ content: `**Error!** You really think Hypixel will exist still?`, ephemeral: true }).catch(() => undefined);
	}

	await DataHandler.updateServer({ lbcutoff: date }, server.guildid);
	interaction.reply({ embeds: [
		new MessageEmbed().setColor('#03fc7b')
			.setTitle('Success!')
			.setDescription(`New Cutoff Date: **${Data.getReadableDate(date)}**\nOnly scores that are on or after this date will be counted!`)
			.setFooter({ text: 'Created by Kaeso#5346' })
	], ephemeral: true }).catch(() => undefined);
}

async function setWeightReview(server: ServerData, interaction: CommandInteraction) {
	const roleId = interaction.options.getRole('role', false)?.id;
	const channel = interaction.options.getChannel('channel', false) ?? undefined;

	if (channel && channel?.type !== 'GUILD_TEXT') return interaction.reply({ content: '**Error!** Select a text channel!', ephemeral: true }).catch(() => undefined);
	const channelId = channel?.id;

	if (!channelId || !roleId) {
		interaction.reply({ content: '**Error!** Option not specified!', ephemeral: true }).catch(() => undefined);
		return;
	}

	await DataHandler.updateServer({ 
		reviewerrole: roleId, 
		reviewchannel: channelId
	}, server.guildid);

	const embed = new MessageEmbed().setColor('#03fc7b')
		.setTitle('Success!')
		.setDescription(`Review Channel: <#${channelId}>\nReviewer Role: <@&${roleId}>`)
		.setFooter({ text: 'Created by Kaeso#5346' });

	interaction.reply({ embeds: [embed], ephemeral: true }).catch(() => undefined);
}