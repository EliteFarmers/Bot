const { MessageEmbed, MessageActionRow } = require('discord.js');
const { DataHandler } = require('../database.js');
const { Data } = require('../data.js')

module.exports = {
	name: 'config',
	aliases: [ 'c' ],
	description: 'Edit the server config.',
	usage: '/config <sub command>',
	guildOnly: true,
	async execute(interaction) {
		if (!interaction.guild) {
			interaction.reply({ content: '**Error!** How in the world did you do this? Please report this error to Kaeso.', ephemeral: true }); 
			return; 
		}

		const server = await DataHandler.getServer(interaction.member.guild.id) 
					?? await DataHandler.createServer(interaction.member.guild.id);

		if (!interaction.member.permissions.has('ADMINISTRATOR') && !interaction.member.roles.cache.some(role => role.id === server.dataValues.adminrole)) {
			interaction.reply({ content: '**Error!** This command is only for server Admins/authorized users!', ephemeral: true }); 
			return; 
		}

		if (!server) {
			interaction.reply({ content: '**Error!**\nSomething went wrong with grabbing/creating your server data. If this issue persists please contact Kaeso#5346', ephemeral: true }); 
			return; 
		}

		const command = interaction.options.getSubcommand();
		const group = interaction.options.getSubcommandGroup(false);
		const guildId = interaction.guild.id;
		const superUser = interaction.member.permissions.has('ADMINISTRATOR');
		
		switch (command) {
			case 'view': {
				viewSettings(server, interaction);
				break;
			}
			case 'whitelist': {
				if (group === 'clear') {
					await DataHandler.updateServer({ channels: null }, guildId);
					clearedSettings(interaction);
					break;
				}
				whitelist(server, interaction);
				break;
			}
			case 'leaderboard': {
				if (group === 'clear') {
					await DataHandler.updateServer({ 
						lbchannel: null,
						lbcutoff: null,
						lbrolereq: null,
						lbupdatechannel: null,
						lbroleping: null,
						scores: {},
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
				if (group === 'clear') {
					if (superUser) { 
						await DataHandler.updateServer({ adminrole: null }, guildId);
						clearedSettings(interaction);
					} else {
						await interaction.reply({ content: 'You need the \`ADMINISTRATOR\` permission to use this command!', ephemeral: true });
					}
					break;
				}
				setAdminRole(server, interaction);
				break;
			}
			case 'weight-role': {
				if (group === 'clear') {
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
			case 'cutoff-date': {
				setCutoffDate(server, interaction);
				break;
			}
			case 'all': {
				await DataHandler.updateServer({
					channels: null,
					adminrole: superUser ? null : server.adminrole,
					weightrole: null,
					weightchannel: null,
					weightreq: null, 
					lbchannel: null,
					lbcutoff: null,
					lbrolereq: null,
					lbupdatechannel: null,
					lbroleping: null,
					scores: {}
				}, guildId);
				clearedSettings(interaction, superUser);
				break;
			}
			case 'user-score': {
				
				break;
			}
			case 'scores': {
				await DataHandler.updateServer({ scores: {} }, guildId);
				interaction.reply({ content: 'Success! The scores have been cleared.', ephemeral: true });
				break;
			}
			default: {
				interaction.reply({ content: 'Command not found!', ephemeral: true});
				break;
			}
		}
	}
}

async function viewSettings(s, interaction) {
	const content = `
**Admin Role:** ${s.adminrole ? `<@&${s.adminrole}>` : 'Not set'}\n
**Weight Requirement:** ${s.weightreq ? (s.weightreq === 0 ? 'All Verified Users' : s.weightreq) : 'Not set'}
- Reward Role: ${s.weightrole ? `<@&${s.weightrole}>` : 'Not set'}
- Annoucement Channel: ${s.weightchannel ? `<#${s.weightchannel}>` : 'Not set'}\n	
**Leaderboard Channel:** ${s.lbchannel ? `<#${s.lbchannel}>` : 'Not set'}
- Role Requirement: ${s.lbrolereq ? `<@&${s.lbrolereq}>` : 'Not set'}
- Annoucement Channel: ${s.lbupdatechannel ? `<#${s.lbupdatechannel}>` : 'Not set'}
- Annoucement Ping: ${s.lbroleping ? `<@&${s.lbroleping}>` : 'Not set'}
- Custom Cutoff Date: ${s.lbcutoff ? Data.getReadableDate(s.lbcutoff) : 'Not set'}
	`;

	let channels = '';
	s.channels?.forEach(channel => {
		channels += `<#${channel}> `;
	});
	
	const embed = new MessageEmbed().setColor('#03fc7b')
		.setTitle('Your Server Settings')
		.setDescription('Use \`/config\` and its subcommands to change these!\n(Show/hide `\/config\` with `\/admin\`)')
		.addField('Current Settings', content)
		.addField('Whitelisted Channels', channels.length > 0 ? channels : 'No channels set')
		.setFooter('Created by Kaeso#5346');

	await interaction.reply({ embeds: [embed], ephemeral: true }).catch();
}

async function clearedSettings(interaction, superUser = true) {
	let content = 'Success! These settings have been cleared.';

	if (!superUser) {
		content += '\nThe admin role has not been cleared, doing so requires the \`ADMINISTRATOR\` permission.'
	}

	await interaction.reply({ content: content, ephemeral: true }).catch();
}

async function whitelist(server, interaction) {
	const channelId = interaction.options.getChannel('channel', false)?.id ?? interaction.channelId;
	const channels = [];

	const embed = new MessageEmbed().setColor('#03fc7b')
		.setTitle('Success!')
		.setFooter('Created by Kaeso#5346');

	if (server.channels?.includes(channelId)) {
		if (server.channels) {
			server.channels.forEach(channel => { 
				if (channel !== channelId) channels.push(channel); 
			});
		}
	} else {
		channels.push(channelId);
		if (server.channels) channels.push(...server.channels);
	}

	let content = '';
	channels.forEach(channel => {
		content += `<#${channel}> `;
	});
	if (content.length > 0) {
		embed.addField('Whitelisted Channels', content.trim());
	} else {
		embed.setDescription('No channels are whitelisted.');
	}

	await DataHandler.updateServer({ channels: channels.length === 0 ? null : channels }, server.guildid);

	interaction.reply({ embeds: [embed], ephemeral: true }).catch(() => { });
}

async function setAdminRole(server, interaction) {
	if (!interaction.member.permissions.has('ADMINISTRATOR')) {
		interaction.reply({ content: '**Error!** Only users with the \`ADMINISTRATOR\` permission can configure this.', ephemeral: true }).catch(() => { });
		return;
	}

	const roleId = interaction.options.getRole('role', false)?.id;

	if (!roleId) {
		interaction.reply({ content: '**Error!** No role specified!', ephemeral: true }).catch(() => { });
		return;
	}

	await DataHandler.updateServer({ adminrole: roleId }, server.guildid);

	const embed = new MessageEmbed().setColor('#03fc7b')
		.setTitle('Success!')
		.setDescription(`Admin Role: <@&${roleId}>`)
		.setFooter('Created by Kaeso#5346');

	interaction.reply({ embeds: [embed], ephemeral: true }).catch(() => { });
}

async function setWeightRole(server, interaction) {
	const weight = interaction.options.getInteger('weight', false) ?? undefined;
	const roleId = interaction.options.getRole('role', false)?.id;
	const channelId = interaction.options.getChannel('channel', false)?.id;

	if (weight === undefined || !roleId) {
		interaction.reply({ content: '**Error!** Option not specified!', ephemeral: true }).catch(() => { });
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
		.setFooter('Created by Kaeso#5346');

	interaction.reply({ embeds: [embed], ephemeral: true }).catch(() => { });
}

async function createLeaderboard(server, interaction) {
	const channel = interaction.options.getChannel('channel', false);
	if (!channel) return interaction.reply({ content: '**Error!** Option not specified!', ephemeral: true }).catch(() => { });

	const roleId = interaction.options.getRole('role', false)?.id;
	const clearScores = interaction.options.getBoolean('clear', false) ?? false;

	await DataHandler.updateServer({ 
		lbchannel: channel.id, 
		lbrolereq: roleId ?? server.lbrolereq, 
		lbactiveid: interaction.id,
		scores: clearScores ? {} : server.scores
	}, server.guildid);

	interaction.reply({ embeds: [
		new MessageEmbed().setColor('#03fc7b')
			.setTitle('Success!')
			.setDescription(`Leaderboard Channel: <#${channel.id}>\nRole Requirement: ${roleId ? `<@&${roleId}>` : 'Not set'}`)
			.setFooter('Created by Kaeso#5346')
		], ephemeral: true }).catch();

	const embed = new MessageEmbed().setColor('#03fc7b')
		.setTitle('Jacob\'s Contest Leaderboard')
		.setDescription('These are the highscores set by your fellow server members!')
		.setFooter(`Highscores only valid after ${Data.getReadableDate(server.lbcutoff ?? Data.CUTOFFDATE)}⠀⠀Created by Kaeso#5346`);
		
	if (!clearScores && Object.keys(server.scores)?.length > 0) {
		for (const crop of Object.keys(server.scores)) {
			const contest = server.scores[crop];

			const details = (contest.par) 
				? `\`#${(contest.pos + 1).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}\` of \`${contest.par.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}\` on \`${contest.profilename}\`!` 
				: `Contest Still Unclaimed!`;

			if (!contest.value) continue;

			embed.fields.push({
				name: `${Data.getReadableCropName(crop)} - ${contest.ign}`,
				value: `<@${contest.user}> - **${contest.value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}**⠀⠀${details}\n${Data.getReadableDate(contest.obtained)}⠀[\🔗](https://sky.shiiyu.moe/stats/${contest.ign}/${contest.profilename})`,
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
		interaction.followUp({ content: `**Error!** I don\'t have permission to send messages in ${channel.id}. Please fix this and rerun the command.`, ephemeral: true });
	});
}

async function createLeaderboardNotifs(server, interaction) {
	const channelId = interaction.options.getChannel('channel', false)?.id;
	if (!channelId) return interaction.reply({ content: '**Error!** Option not specified!', ephemeral: true }).catch(() => { });

	const roleId = interaction.options.getRole('role', false)?.id;

	await DataHandler.updateServer({ 
		lbupdatechannel: channelId, 
		lbroleping: roleId ?? server.lbrolereq, 
	}, server.guildid);

	const embed = new MessageEmbed().setColor('#03fc7b')
		.setTitle('Success!')
		.setDescription(`Annoucement Channel: <#${channelId}>\nRole That\'s Pinged: ${roleId ? `<@&${roleId}>` : 'Not set'}`)
		.setFooter('Created by Kaeso#5346');

	interaction.reply({ embeds: [embed], ephemeral: true }).catch(() => { });
}

async function setCutoffDate(server, interaction) {
	const day = interaction.options.getInteger('day', false) ?? undefined;
	const month = interaction.options.getInteger('month', false) ?? undefined;
	let year = interaction.options.getInteger('year', false) ?? undefined;

	if (!day || !month || !year) {
		return interaction.reply({ content: '**Error!** Option not specified!', ephemeral: true }).catch(() => { });
	}

	// Jacob's contests have their years starting at 0
	year--;

	if (day < 1 || day > 31) {
		return interaction.reply({ content: '**Error!** Day must be a number [1-31] (inclusive)', ephemeral: true }).catch(() => { });
	}

	const date = `${year}${month <= 9 ? `0${month}` : month}${day <= 9 ? `0${day}` : day}`;

	if (year < 159 || date < +Data.CUTOFFDATE) {
		return interaction.reply({ content: `**Error!** Overall date must be after **${Data.getReadableDate(Data.CUTOFFDATE)}**, dates before this are currently unsupported.`, ephemeral: true }).catch(() => { });
	}

	if (year > 9999) {
		return interaction.reply({ content: `**Error!** You really think Hypixel will exist still?`, ephemeral: true }).catch(() => { });
	}

	await DataHandler.updateServer({ lbcutoff: date }, server.guildid);
	interaction.reply({ embeds: [
		new MessageEmbed().setColor('#03fc7b')
			.setTitle('Success!')
			.setDescription(`New Cutoff Date: **${Data.getReadableDate(date)}**\nScores that are on or after this date will be counted!`)
			.setFooter('Created by Kaeso#5346')
	], ephemeral: true }).catch(() => { });
}