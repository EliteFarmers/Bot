const Discord = require('discord.js');
const { Auth } = require('../auth.js');
const { superusers } = require('../config.json');
const { DataHandler } = require('../database.js');

module.exports = {
	name: 'admin',
	aliases: [ 'a' ],
	description: 'Access the admin panel.',
	usage: '(token)',
	guildOnly: false,
	dmOnly: false,
	async execute(interaction) {
		if (!interaction.member) {
			if (superusers.includes(interaction.user.id)) {
				superUser(interaction);
				return;
			}
			interaction.reply({ content: '**Error!**\nUse this command in a server only.', ephemeral: true }); 
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

		const dateNow = Date.now();
		const onCooldown = (dateNow < +(server.configshowedat ?? 0) + (10 * 60 * 1000));
		const commandsRegistered = await interaction.guild.commands.fetch().then(commands => commands.size > 0);

		const embed = new Discord.MessageEmbed().setColor('#03fc7b')
			.setTitle('Server Admin Panel')
			.setDescription('Configure your server specific settings!')
			.addField('WARNING', `**Role settings** require the \`Manage Roles\` permission.\n__And for the @Elite role to be above others in the hierarchy!__\n**Setting channels** requires the \`Read Messages\` permission.\n__This is only to view channels, the bot still **CANNOT** read messages!__\n⠀\n**You must change permissions manually, or [click here](https://discord.com/api/oauth2/authorize?client_id=845065148997566486&permissions=277361249280&scope=bot%20applications.commands) to reinvite the bot.**`)
			.addField('How?', 'Please click the buttons below in order to register the slash commands that you\'ll need in order to configure these settings. To prevent command clutter, you can remove these commands when you\'re finished and enable them when you need them.\n⠀\n\`/config view\` is useful! Browse all \`/config\` commands by looking through the slash commands GUI without typing anything after they\'re registered.')
			.setFooter('Instead of "Read Messages" you can give the bot view access to specific channels\nCreated by Kaeso#5346')

		if (onCooldown) {
			embed.addField('ATTENTION', `You have registered these commands recently, to prevent spam you can only remove these commands until the cooldown is over <t:${Math.floor((+(server.configshowedat ?? 0) + (10 * 60 * 1000)) / 1000)}:R>.`)
		}

		const row = new Discord.MessageActionRow().addComponents(
			{ type: 'BUTTON', style: 'SUCCESS', customId: 'register', label: 'Register /config', disabled: onCooldown || commandsRegistered },
			{ type: 'BUTTON', style: 'PRIMARY', customId: 'clear', label: 'Remove /config', disabled: !commandsRegistered },
			{ type: 'BUTTON', style: 'DANGER', customId: 'cancel', label: 'Cancel' },
		);

		const message = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

		const collector = message.createMessageComponentCollector({ componentType: 'BUTTON', time: 30000 });
    
		collector.on('collect', async inter => {
			if (inter.user.id !== interaction.user.id) {
				inter.reply({ content: 'These aren\'t your buttons! Begone!', ephemeral: true });
				return;
			}

			if (inter.customId === 'register') {
				try {
					await inter.guild.commands.set([slashCommandData]);
					await inter.reply({ content: '**Success!** The \`/config\` command should now be available to you!', ephemeral: true });
					await DataHandler.updateServer({ configshowedat: dateNow }, inter.guild.id);
				} catch (e) {
					await inter.reply({ content: 'Something went wrong! This is likely due to the bot lacking permissions to create slash commands. Please reinvite the bot with the link or fix this manually. If the issue still occurs contact Kaeso#5346', ephemeral: true });
				}
			} else if (inter.customId === 'clear') {
				try {
					await inter.guild.commands.set([]);
					await inter.reply({ content: '**Success!** The \`/config\` command should now be gone!', ephemeral: true });
				} catch (e) {
					await inter.reply({ content: 'Something went wrong! This is likely due to the bot lacking permissions to create slash commands. Please reinvite the bot with the link or fix this manually. If the issue still occurs contact Kaeso#5346', ephemeral: true });
				}
			} else {
				await inter.reply({ content: 'Canceled!', ephemeral: true });
			}

			collector.stop();
		});

		collector.on('end', async collected => {
			message.delete().catch(() => {
				message.edit({ components: [] }).catch(() => { });
			})
		});
	}
}

const slashCommandData = {
	name: 'config',
	description: 'Configure your server settings!',
	options: [{
		name: 'whitelist',
		description: 'Whitelist this current channel, or a specified one!',
		type: 1,
		options: [{
			name: 'channel',
			description: 'Choose a channel to whitelist!',
			type: 7,
			required: false
		}]
	}, {
		name: 'leaderboard',
		description: 'Set up your server\'s auto-updating Jacob leaderboard!',
		type: 1,
		options: [{
			name: 'channel',
			description: 'Where should the leaderboard be sent in?',
			type: 7,
			required: true
		}, {
			name: 'role',
			description: 'What role should be required to be placed the leaderboard?',
			type: 8,
			required: false
		}, {
			name: 'clear',
			description: 'Should the leaderboard be reset?',
			type: 5,
			required: false
		}]
	}, {
		name: 'leaderboard-notifs',
		description: 'Setup notifications for leaderboard movements!',
		type: 1,
		options: [{
			name: 'channel',
			description: 'Where should those pings be sent?',
			type: 7,
			required: true
		}, {
			name: 'role',
			description: 'What role should be pinged when there\'s a new placement on the leaderboard?',
			type: 8,
			required: false
		}]
	}, {
		name: 'admin-role',
		description: 'Allow one specified role access to these settings!',
		type: 1,
		options: [{
			name: 'role',
			description: 'Choose a trusted role to grant it access!',
			type: 8,
			required: true
		}]
	}, {
		name: 'weight-role',
		description: 'Automatically give users in this server a role for a weight amount!',
		type: 1,
		options: [{
			name: 'weight',
			description: 'How much farming weight is required?',
			type: 4,
			required: true,
			choices: [
				{ name: 'Allow Any Linked User', value: 0 }, 
				{ name: '10 Weight', value: 10 }, 
				{ name: '50 Weight', value: 50 }, 
				{ name: '100 Weight', value: 100 }, 
				{ name: '250 Weight', value: 250 }, 
				{ name: '500 Weight', value: 500 }, 
				{ name: '750 Weight', value: 750 }, 
				{ name: '1000 Weight', value: 1000 }, 
				{ name: '1250 Weight', value: 1250 }, 
				{ name: '1500 Weight', value: 1500 }, 
				{ name: '1750 Weight', value: 1750 }, 
				{ name: '2000 Weight', value: 2000 }, 
				{ name: '2250 Weight', value: 2250 }, 
				{ name: '2500 Weight', value: 2500 }, 
				{ name: '2750 Weight', value: 2750 },
				{ name: '3000 Weight', value: 3000 },
				{ name: '3500 Weight', value: 3500 },
				{ name: '4000 Weight', value: 4000 },
				{ name: '4500 Weight', value: 4500 },
				{ name: '5000 Weight', value: 5000 }
			]
		}, {
			name: 'role',
			description: 'What role should be given as a reward?',
			type: 8,
			required: true
		}, {
			name: 'channel',
			description: 'If you\'d like, specify a channel to announce this user obtaining the role.',
			type: 7,
			required: false
		}]
	}, {
		name: 'weight-review',
		description: 'Specify these options to manually approve each weight-role auto-grant.',
		type: 1,
		options: [{
			name: 'channel',
			description: 'What channel should applications wait for review in?',
			type: 7,
			required: true
		}, {
			name: 'role',
			description: 'What role should be pinged and be able to approve applications?',
			type: 8,
			required: true
		}]
	}, {
		name: 'cutoff-date',
		description: 'Please read about this command in "/config view" before using this.',
		type: 1,
		options: [{
			name: 'day',
			description: 'Set the day of the cutoff date! [1-31] (inclusive)',
			type: 4,
			required: true,
		}, {
			name: 'month',
			description: 'Set the month of the cutoff date!',
			type: 4,
			required: true,
			choices: [
				{ name: 'Early Spring', value: 1 }, 
				{ name: 'Spring', value: 2 }, 
				{ name: 'Late Spring', value: 3 }, 
				{ name: 'Early Summer', value: 4 }, 
				{ name: 'Summer', value: 5 }, 
				{ name: 'Late Summer', value: 6 }, 
				{ name: 'Early Autumn', value: 7 }, 
				{ name: 'Autumn', value: 8 }, 
				{ name: 'Late Autumn', value: 9 }, 
				{ name: 'Early Winter', value: 10 }, 
				{ name: 'Winter', value: 11 }, 
				{ name: 'Late Winter', value: 12 }
			]
		}, {
			name: 'year',
			description: 'Set the year of the cutoff date! Must be greater than 159.',
			type: 4,
			required: true
		}]
	}, {
		name: 'clear',
		description: 'Clear various settings.',
		type: 1,
		options: [{
			name: 'setting',
			description: 'Close the setting to clear!',
			type: 3,
			required: true,
			choices: [{
				value: 'all',
				name: 'All - Clear all server-specific settings',
			}, {
				value: 'leaderboard',
				name: 'Leaderboard - Clear your leaderboard settings',
			}, {
				value: 'scores',
				name: 'Scores - Clear your leaderboard scores, but keep the settings!',
			}, {
				value: 'admin-role',
				name: 'Admin Role - Remove the set role from having these permissions!',
			}, {
				value: 'weight-role',
				name: 'Weight-Role - Stop rewarding a role for a specific weight.',
			}, {
				value: 'weight-review',
				name: 'Weight-review - Remove the application process of the auto weight-role grant.',
			}, {
				value: 'weight-role-blacklist',
				name: 'Weight-Role Blacklist - Clear the blacklist of denied users!',
			}, {
				value: 'whitelist',
				name: 'Whitelist - Allow the bot to be used in all channels (it can access) again.',
			}]
		}]
	}, {
		name: 'view',
		description: 'View the config!',
		type: 1
	}, {
		name: 'remove-user',
		description: 'Remove a user from the leaderboard',
		type: 1,
		options: [{
			name: 'player',
			description: 'The Minecraft username of the player to remove!', 
			type: 3,
			required: true,
		}]
	}]
}

async function superUser(interaction) {
	const embed = new Discord.MessageEmbed().setColor('#03fc7b')
		.setTitle('🚨 AWAITING IDENTITY CONFIRMATION 🚨')
		.setDescription('Respond with your Two Factor Authenitcation code');

	let authorized = false;
	
	const message = await interaction.reply({ embeds: [embed], fetchReply: true });

	if (!message) { return; }

	const fakeFilter = () => { return true; };
	message.channel.awaitMessages({ fakeFilter, max: 1, time: 60000, errors: ['time'] })
	.then(async collected => {
		const code = +(collected.first().content.trim());
		if (Auth.verifyTOTP(code)) {
			authorized = true;

			const authEmbed = new Discord.MessageEmbed().setColor('#03fc7b')
			.setTitle(`🔓 - Welcome ${interaction.user.username}`); 

			if (interaction.channel.type === 'DM') {
				await interaction.editReply({ embeds: [authEmbed], components: [] });
			} else {
				await message.edit({ embeds: [authEmbed], components: [] });
			}
			sendAdminPanel(interaction);
		} else {
			throw new Error();
		}
	})
	.catch(collected => {
		if (authorized) return;
		if (interaction.channel.type === 'DM') {
			interaction.deleteReply();
		} else {
			message.delete();
		}
	});

	if (!authorized) return;
}
        

async function sendAdminPanel(interaction) {

	const embed = new Discord.MessageEmbed().setColor('#03fc7b')
	.setTitle('Superuser Admin Panel')
	.setDescription('More stuff coming eventually');

	const row = new Discord.MessageActionRow().addComponents(
		new Discord.MessageButton()
			.setCustomId('flagcheater')
			.setLabel('Flag Cheater')
			.setStyle('DANGER'),
		new Discord.MessageButton()
			.setCustomId('globalslash')
			.setLabel('Deploy Global')
			.setStyle('SECONDARY'),
	);

	interaction.user.send({ embeds: [embed], components: [row], fetchReply: true }).then(reply => {
		const collector = reply.createMessageComponentCollector({ componentType: 'BUTTON', time: 120000 });

		collector.on('collect', async inter => {
			if (inter.user.id === interaction.user.id) {
				collector.resetTimer({ time: 120000 });

				if (inter.customId === 'flagcheater') {
					const filt = () => { return true; };
					await inter.reply({ content: 'Specify a minecraft uuid or ign.', fetchReply: true }).then(message => {
						message.channel.awaitMessages({ filt, max: 1, time: 60000, errors: ['time'] })
						.then(async collected => {
							const response = collected.first().content.trim();
							const user = (response.length === 32) ? await DataHandler.getPlayer(response) : await DataHandler.getPlayerByName(response);
							if (user) {
								const toggle = !user.dataValues.cheating;
								await DataHandler.update({ cheating: toggle, rank: 0, updatedat: Date.now() - (600000) }, { uuid: user.dataValues.uuid });
								console.log(`Set ${user.dataValues?.ign}'s cheating status to ${toggle}`);
								await DataHandler.getPlayer(user.dataValues.uuid).then(user => {
									collected.first().reply({ content: `${user.dataValues.ign} has been labled as ${toggle ? 'cheating.' : 'legit.'}` });
								});
								throw new Error();
							} else {
								collected.first().reply({ content: 'Specify a valid uuid next time.' })
								throw new Error();
							}
						})
						.catch(collected => {
							setTimeout(function() {
								message.delete().catch(error => { });
							}, 5000);
						});
					})
				} else if (inter.customId === 'globalslash') {
					await inter.reply({ content: 'I\'ll do this later' });
				}
			} else {
				inter.reply({ content: `These buttons aren't for you!`, ephemeral: true });
			}
		});

		collector.on('end', async collected => {
			reply.edit({ components: [] });
		});
	});
}
