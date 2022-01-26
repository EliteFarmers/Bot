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
		const server = await DataHandler.getServer(interaction.member.guild.id) ?? await DataHandler.createServer(interaction.member.guild.id);

		if (!server) {
			interaction.reply({ content: '**Error!**\nSomething went wrong with grabbing/creating your server data.', ephemeral: true }); 
			return; 
		}

		if (interaction.channel.type !== 'DM' && (interaction.member.permissions.has('ADMINISTRATOR') || interaction.member.roles.cache.some(role => role.id === server.dataValues.adminrole))) {
			const embed = new Discord.MessageEmbed()
				.setColor('#03fc7b')
				.setTitle('Server Admin Panel')
				.setDescription('Configure your server specific settings.')
				.setFooter('Created by Kaeso#5346');

			if (server.dataValues.channels) {
				let content = '';
				server.dataValues.channels.forEach(channel => {
					content += `<#${channel}> `;
				});
				
				embed.addField('Whitelisted Channels', content.trim());
			}

			if (server.dataValues.jacobchannel) {
				embed.addField('Jacob LB Channel', `<#${server.dataValues.jacobchannel}>`);
			}

				
			const components = [
				new Discord.MessageActionRow().addComponents(
					new Discord.MessageButton()
						.setCustomId('whitelist')
						.setLabel('Whitelist This Channel')
						.setStyle('SECONDARY'),
					new Discord.MessageButton()
						.setCustomId('jbchannel')
						.setLabel('Set As Jacob LB Channel')
						.setStyle('SECONDARY')
				),
				new Discord.MessageActionRow().addComponents(
					new Discord.MessageButton()
						.setCustomId('advanced')
						.setLabel('Advanced Settings')
						.setStyle('SUCCESS')
				)
			];

			interaction.reply({ embeds: [embed], components: components, fetchReply: true }).then(reply => {
				const collector = reply.createMessageComponentCollector({ componentType: 'BUTTON', time: 30000 });
    
				collector.on('collect', async inter => {
					if (inter.user.id !== interaction.user.id) {
						inter.reply({ content: 'These aren\'t your buttons! Begone!', ephemeral: true });
						return;
					}

					collector.resetTimer({ time: 30000 });

					if (inter.customId === 'whitelist') {
						const channels = [];

						const newEmbed = new Discord.MessageEmbed()
							.setColor('#03fc7b')
							.setTitle('Server Admin Panel')
							.setDescription('Configure your server specific settings.')
							.setFooter('Created by Kaeso#5346');

						if (server.dataValues.channels.includes(interaction.channelId)) {
							if (server.dataValues.channels) {
								server.dataValues.channels.forEach(channel => { 
									if (channel !== interaction.channelId) channels.push(channel); 
								});
							}

							let content = '';
							server.dataValues.channels.forEach(channel => {
								if (channel !== interaction.channelId) content += `<#${channel}> `;
							});
							newEmbed.addField('Whitelisted Channels', content.trim());
						} else {
							channels.push(interaction.channelId);

							if (server.dataValues.channels) {
								server.dataValues.channels.forEach(channel => { channels.push(channel); });
							}

							let content = `<#${interaction.channelId}> `;
							server.dataValues.channels.forEach(channel => {
								content += `<#${channel}> `;
							});
							newEmbed.addField('Whitelisted Channels', content.trim());
						}

						if (server.dataValues.jacobchannel) {
							newEmbed.addField('Jacob LB Channel', `<#${server.dataValues.jacobchannel}>`);
						}

						server.dataValues.channels = channels;
						await DataHandler.updateServer({ channels: channels }, server.dataValues.guildid);

						inter.update({ embeds: [newEmbed] }).catch(() => { });

					} else if (inter.customId === 'jbchannel') {
						const newEmbed = new Discord.MessageEmbed()
							.setColor('#03fc7b')
							.setTitle('Server Admin Panel')
							.setDescription('Configure your server specific settings.')
							.setFooter('Created by Kaeso#5346');

						if (server.dataValues.channels) {
							let content = '';
							server.dataValues.channels.forEach(channel => {
								content += `<#${channel}> `;
							});
							
							newEmbed.addField('Whitelisted Channels', content.trim());
						}

						newEmbed.addField('Jacob LB Channel', `<#${interaction.channelId}>`);
						server.dataValues.jacobchannel = interaction.channelId;

						await DataHandler.updateServer({ jacobchannel: interaction.channelId }, server.dataValues.guildid);
						inter.update({ embeds: [newEmbed] }).catch(() => { });
					} else if (inter.customId === 'advanced') {
						advancedSettings(inter);
						collector.stop();
					}
				});
		
				collector.on('end', async collected => {
					reply.delete().catch(() => {
						reply.edit({ components: [] }).catch(() => { });
					})
				});
			});

			return;
		}

        if (!superusers.includes(interaction.user.id)) {
            interaction.reply({ content: 'You aren\'t authorized!\nOnly server admins can use this.', ephemeral: true });
            return;
        }

		async function advancedSettings(inter) {
			const embed = new Discord.MessageEmbed().setColor('#03fc7b')
				.setTitle('Advanced Server Admin Panel')
				.setDescription('Configure your specific server settings.')
				.addField('Warning', 'Role settings require the \`Manage Roles\` permission.\nJacob\'s LB settings require the \`Read Messages\` permission.\n__This is only to view channels, the bot still **CANNOT** read messages.__\n⠀\nYou can change permissions manually, or **[click here](https://discord.com/api/oauth2/authorize?client_id=845065148997566486&permissions=277361249280&scope=bot%20applications.commands)** to reinvite the bot.')
				.setFooter('Instead of "Read Messages" you could also force\nallow the bot view access to specific channels\nCreated by Kaeso#5346');

			const components = [
				new Discord.MessageActionRow().addComponents(
					new Discord.MessageButton()
						.setCustomId('verifyreq')
						.setLabel('Reward a role for weight')
						.setStyle('SECONDARY'),
					new Discord.MessageButton()
						.setCustomId('adminrole')
						.setLabel('Allow a role access')
						.setStyle('SECONDARY')
				),
				new Discord.MessageActionRow().addComponents(
					new Discord.MessageButton()
						.setCustomId('jb')
						.setLabel('Advanced Settings')
						.setStyle('SUCCESS')
						.setDisabled(true)
				)
			];

			const message = await interaction.user.send({ embeds: [embed], components: components, fetchReply: true }).then(async message => {
				const embed = new Discord.MessageEmbed().setColor('#03fc7b')
					.setTitle('Success!')
					.setDescription(`Check your DMs or [click here!](${message.url})\nSorry, this has to be a DM for text inputs.`)
					.setFooter('I don\'t even have permissions to read messages here!');
	
				await inter.reply({ embeds: [embed], ephemeral: true });
				return message;
			}).catch(async error => {
				await interaction.reply({ content: 'Sorry, I wasn\'t able to message you.\nPlease enable DMs on this server, you can turn this off after.', ephemeral: true });
				return undefined;
			});


			const collector = message.createMessageComponentCollector({ componentType: 'BUTTON', time: 120000 });
    
			collector.on('collect', async inter => {
				//Hopefully not possible to ever happen but sure I guess?
				if (inter.user.id !== interaction.user.id) {
					inter.reply({ content: 'These aren\'t your buttons! Begone!', ephemeral: true });
					return;
				}

				collector.resetTimer({ time: 120000 });

				if (inter.customId === 'verifyreq') {
					
				} else if (inter.customId === 'adminrole') {
					
				} else if (inter.customId === 'advanced') {

					collector.stop();
				}
			});
	
			collector.on('end', async collected => {
				message.edit({ components: [] }).catch(() => { });
			});
		}

		const embed = new Discord.MessageEmbed().setColor('#03fc7b')
			.setTitle('🚨 AWAITING IDENTITY CONFIRMATION 🚨')
			.setDescription('Respond with your Two Factor Authenitcation code');

		let authorized = false;
		
		const message = (interaction.channel.type === 'DM')
		? await interaction.reply({ embeds: [embed], fetchReply: true })
		: await interaction.user.send({ embeds: [embed], fetchReply: true }).then(async message => {
			const embed = new Discord.MessageEmbed().setColor('#03fc7b')
				.setTitle('Success!')
				.setDescription(`Check your DMs or [click here!](${message.url})`);

		 	await interaction.reply({ embeds: [embed], ephemeral: true })
			return message;
		}).catch(async error => {
			await interaction.reply({ content: 'Sorry, I wasn\'t able to message you.\nTry using \`/admin\` directly in DMs.', ephemeral: true });
			return undefined;
		});

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

		async function sendAdminPanel(i) {

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

			i.user.send({ embeds: [embed], components: [row], fetchReply: true }).then(reply => {
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
	}
};

