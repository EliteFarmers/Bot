const Discord = require('discord.js');
const { Auth } = require('../auth.js');
const { PlayerHandler } = require('../calc.js');
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
        if (!superusers.includes(interaction.user.id)) {
            interaction.reply({ content: 'Invalid 2 Factor Authentication code, and/or you aren\'t authorized\nServer specific settings coming eventually', ephemeral: true });
            return;
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
										await DataHandler.update({ cheating: toggle, rank: 0 }, { uuid: user.dataValues.uuid });
										console.log(`Set ${user.dataValues?.ign}'s cheating status to ${toggle}`);
										await DataHandler.getPlayer(user.dataValues.uuid).then(user => {
											collected.first().reply({ content: `${user.dataValues.ign} has been labled as ${toggle ? 'cheating.' : 'legit.'}` });
										});
										if (PlayerHandler.cachedPlayers.has(user.dataValues?.ign.toLowerCase())) {
											PlayerHandler.cachedPlayers.delete(user.dataValues?.ign.toLowerCase());
										}
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

