const Discord = require('discord.js');
const { Data } = require('../data.js');
const { DataHandler } = require('../database.js');

module.exports = {
	name: 'verify',
	aliases: [ 'v' ],
	description: 'Link your Minecraft account.',
	usage: '[username]',
	guildOnly: false,
	dmOnly: false,
	async execute(interaction) {
		const options = interaction?.options?._hoistedOptions;

		let playerName = options[0]?.value.trim();
		if (!playerName) { return; }

        await interaction.deferReply().then(async () => {

			const uuid = await Data.getUUID(playerName).then(response => {
				playerName = response.name;
				return response.id;
			}).catch(error => {
				console.log(error);
				return undefined;
			});
			
			const discordTag = (uuid) ? await Data.getDiscord(uuid) : null;

			if (discordTag === undefined) {
				const embed = new Discord.MessageEmbed()
					.setColor('#CB152B')
					.setTitle('Error: No Discord Linked!')
					.setDescription('Link this discord account to your Minecraft account on Hypixel first!')
					.setFooter('Created by Kaeso#5346');
				interaction.editReply({embeds: [embed]});
				return;
			} else if (!discordTag) {
				const embed = new Discord.MessageEmbed()
					.setColor('#CB152B')
					.setTitle('Error: Invalid Username!')
					.setDescription(`"${playerName}" doesn't play skyblock! Double check your spelling.`)
					.setFooter('Created by Kaeso#5346');
				interaction.editReply({embeds: [embed]});
				return;
			}

			let userTag = interaction.user.username + '#' + interaction.user.discriminator;
			if (userTag !== discordTag) {
				const embed = new Discord.MessageEmbed()
					.setColor('#CB152B')
					.setTitle('Error: Account Mismatch!')
					.setDescription(`Your discord account does not match the one linked with \"${playerName}\"`)
					.setFooter('Created by Kaeso#5346');
				interaction.editReply({embeds: [embed]});
				return;
			}

			let user = await DataHandler.getPlayer(uuid);
			if (user) {
				let oldUser = await DataHandler.getPlayer(null, { discordid: interaction.user.id });
				if (oldUser) {
					await DataHandler.update({ discordid: null, ign: playerName }, { discordid: interaction.user.id });

					if (oldUser.dataValues.uuid === uuid) {
						const embed = new Discord.MessageEmbed()
						.setColor('#03fc7b')
							.setTitle('Unlinked!')
							.setDescription(`Your discord account was already linked with \"${playerName}\"\nIt has now been unlinked.`)
							.setFooter('Created by Kaeso#5346');
						interaction.editReply({embeds: [embed]});
						return;
					}
				}

				await DataHandler.update({ discordid: interaction.user.id, ign: playerName }, { uuid: uuid });
			} else {
				await DataHandler.updatePlayer(uuid, playerName, null, null);
				await DataHandler.update({ discordid: interaction.user.id, ign: playerName }, { uuid: uuid });
			}

			const embed = new Discord.MessageEmbed()
				.setColor('#03fc7b')
				.setTitle('Success!')
				.setDescription(`Your minecraft account \`${playerName}\` has been linked! Try \`/weight\` with no arguments!`)
				.setFooter('Created by Kaeso#5346');
			interaction.editReply({embeds: [embed]});
		});		
	}
};

