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
			.addField('Warning', 'Role settings require the \`Manage Roles\` permission.\nSetting channels requires the \`Read Messages\` permission.\n__This is only to view channels, the bot still **CANNOT** read messages.__\n⠀\nYou can change permissions manually, or **[click here](https://discord.com/api/oauth2/authorize?client_id=845065148997566486&permissions=277361249280&scope=bot%20applications.commands)** to reinvite the bot.')
			.addField('How?', 'Please click the buttons below in order to register the slash commands that you\'ll need in order to configure these settings. Use `/help` to find further info on all the commands. To prevent command clutter, you can remove these commands when you\'re finished and enable them when you need them.')
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
					await inter.reply({ content: 'Success! The \`/config\` command should now be available to you!', ephemeral: true });
					await DataHandler.updateServer({ configshowedat: dateNow }, inter.guild.id);
				} catch (e) {
					await inter.reply({ content: 'Something went wrong! This is likely due to the bot lacking permissions to create slash commands. Please reinvite the bot with the link or fix this manually. If the issue still occurs contact Kaeso#5346', ephemeral: true });
				}
			} else if (inter.customId === 'clear') {
				try {
					await inter.guild.commands.set([]);
					await inter.reply({ content: 'Success! The \`/config\` command should now be gone!', ephemeral: true });
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
		name: 'set',
		description: 'Change settings directly!',
		type: 2,
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
			name: 'leaderboard-channel',
			description: 'Set this channel as the place to keep the leaderboard, or a specified one!',
			type: 1,
			options: [{
				name: 'channel',
				description: 'Choose a channel to set as the leaderboard channel!',
				type: 7,
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
			name: 'cut-off-date',
			description: 'Please read about this command in /help before using this.',
			type: 1,
			options: [{
				name: 'date',
				description: 'Specify the date in which scores are valid after.',
				type: 4,
				required: true
			}],
		}]
	}, {
		name: 'create',
		description: 'Create various features!',
		type: 2,
		options: [{
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
				required: true
			}]
		}, {
			name: 'leaderboard-notifs',
			description: 'Setup notifications for leaderboard movements!',
			type: 1,
			options: [{
				name: 'notif-role',
				description: 'What role should be pinged when there\'s a new placement on the leaderboard?',
				type: 8,
				required: true
			}, {
				name: 'notif-channel',
				description: 'Where should those pings be sent?',
				type: 7,
				required: true
			}]
		}]
	}, {
		name: 'clear',
		description: 'Clear various settings.',
		type: 2,
		options: [{
			name: 'all',
			description: 'Clear all server-specific settings',
			type: 1,
		}, {
			name: 'leaderboard',
			description: 'Clear your leaderboard settings',
			type: 1,
		}, {
			name: 'user-score',
			description: 'Remove a user from the leaderboard',
			type: 1,
			options: [{
				name: 'ign',
				description: 'The IGN of the user to remove',
				type: 3,
				required: true
			}]
		}, {
			name: 'admin-role',
			description: 'Remove the set role from having these permissions!',
			type: 1,
		}, {
			name: 'weight-role',
			description: 'Stop rewarding a role for a specific weight.',
			type: 1
		}, {
			name: 'whitelist',
			description: 'Allow the bot to be used in all channels (it can access) again.',
			type: 1
		}]
	}, {
		name: 'view',
		description: 'View the config!',
		type: 1
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
