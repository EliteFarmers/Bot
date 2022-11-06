import { Command } from "classes/Command";
import { CommandInteraction, Message, MessageActionRow, MessageButton } from 'discord.js';
import DataHandler from '../classes/Database';

const command: Command = {
	name: 'leaderboard',
	description: 'Get the farming weight leaderboard',
	usage: '(username)',
	access: 'ALL',
	type: 'SLASH',
	execute: execute,
	slash: {
		name: 'leaderboard',
		description: 'Get the farming weight leaderboard!',
		options: [{
			name: 'player',
			type: 'STRING',
			description: 'Jump to a specific player!',
			required: false,
			autocomplete: true
		}]
	}
}

export default command;
    
async function execute(interaction: CommandInteraction) {
	let playerName = interaction.options.getString('player', false) ?? undefined;

	let givenIndex = 0;

	if (playerName !== undefined) {
		const player = await DataHandler.getPlayerByName(playerName);

		if (player) {
			givenIndex = player.rank ?? 0;
			if (player?.ign) playerName = player.ign;
		} else playerName = undefined;
	}

	const leaderboardLength = await DataHandler.getLeaderboard().then(lb => { return lb.length; });
	let index = Math.floor(givenIndex / 10) * 10;
	const maxIndex = Math.floor((leaderboardLength - 1) / 10) * 10;

	let embed = await DataHandler.getLeaderboardEmbed(givenIndex, playerName, true);

	if (leaderboardLength <= 10) {
		interaction.reply({ embeds: [embed] });
		return;
	}

	const row = new MessageActionRow()
		.addComponents(
			new MessageButton()
				.setCustomId('first')
				.setLabel('First')
				.setStyle('PRIMARY')
				.setDisabled(index < 10),
			new MessageButton()
				.setCustomId('back')
				.setLabel('Back')
				.setStyle('PRIMARY')
				.setDisabled(index < 10),
			new MessageButton()
				.setCustomId('forward')
				.setLabel('Next')
				.setStyle('PRIMARY')
				.setDisabled(index + 10 > maxIndex),
			new MessageButton()
				.setCustomId('last')
				.setLabel('Last')
				.setStyle('PRIMARY')
				.setDisabled(index + 10 > maxIndex),
		);

	const reply = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

	if (!(reply instanceof Message)) throw new Error('Reply of wrong type');

	const collector = reply.createMessageComponentCollector({ componentType: 'BUTTON', time: 30000 });

	collector.on('collect', async i => {
		if (i.user.id === interaction.user.id) {
			collector.resetTimer({time: 15000});

			if (i.customId === 'first') {
				index = 0;
			} else if (i.customId === 'back') {
				if (index >= 10) {
					index -= 10;
				}
			} else if (i.customId === 'forward') {
				if (index < maxIndex) {
					index += 10;
				}
			} else if (i.customId === 'last') {
				if (index !== 990) {
					index = maxIndex; 
				}
			}

			embed = await DataHandler.getLeaderboardEmbed(index, playerName);

			const newRow = new MessageActionRow().addComponents(
				new MessageButton()
					.setCustomId('first')
					.setLabel('First')
					.setStyle('PRIMARY')
					.setDisabled(index < 10),
				new MessageButton()
					.setCustomId('back')
					.setLabel('Back')
					.setStyle('PRIMARY')
					.setDisabled(index < 10),
				new MessageButton()
					.setCustomId('forward')
					.setLabel('Next')
					.setStyle('PRIMARY')
					.setDisabled(index >= maxIndex),
				new MessageButton()
					.setCustomId('last')
					.setLabel('Last')
					.setStyle('PRIMARY')
					.setDisabled(index >= maxIndex),
			);

			i.update({ embeds: [embed], components: [newRow] }).catch(error => { console.log(error) });
		} else {
			i.reply({ content: `These buttons aren't for you!`, ephemeral: true });
		}
	});

	collector.on('end', async () => {
		await DataHandler.getLeaderboardEmbed(index, playerName).then(embed => { 
			interaction.editReply({ embeds: [embed], components: [] })
		}).catch(error => {
			console.log(error);
		})
	});
}

