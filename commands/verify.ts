import { Command } from "../classes/Command";
import { CanUpdate } from "../classes/Util";
import { CommandInteraction, MessageEmbed } from 'discord.js';
import Data from '../classes/Data';
import DataHandler from '../classes/Database';

const command: Command = {
	name: 'verify',
	description: 'Link your Minecraft account.',
	usage: '[username]',
	access: 'ALL',
	type: 'SLASH',
	slash: {
		name: 'verify',
		description: 'Link your Minecraft account!',
		options: [{
			name: 'player',
			type: 'STRING',
			description: 'Your minecraft account name.',
			required: true,
			autocomplete: true
		}]
	},
	execute: execute
}

export default command;

async function execute(interaction: CommandInteraction) {
	let playerName = interaction.options.getString('player', false);
	if (!playerName) return;


	const player = await DataHandler.getPlayer(undefined, { discordid: interaction.user.id });

	if (interaction.user.id === player?.discordid && player?.ign?.toLowerCase() === playerName.toLowerCase()) {
		await DataHandler.update({ discordid: null }, { discordid: interaction.user.id });

		const embed = new MessageEmbed()
			.setColor('#03fc7b')
			.setTitle('Unlinked!')
			.setDescription(`Your discord account was already linked with "${player?.ign}"\nIt has now been unlinked. Use \`/verify\` again to revert this.`)
			.setFooter({ text: 'Created by Kaeso#5346' });
		return interaction.reply({ embeds: [embed], ephemeral: true });
	}

	const canUpdate = CanUpdate(player ?? undefined, 2);

	if (!canUpdate) {
		const embed = new MessageEmbed()
			.setColor('#CB152B')
			.setTitle('User on Cooldown!')
			.setDescription(`Try again <t:${Math.floor((parseInt(player?.updatedat ?? Date.now().toString())) / 1000) + 120}:R>`);
		return interaction.reply({ embeds: [embed], ephemeral: true });
	}

	await interaction.deferReply();

	const uuid = await Data.getUUID(playerName).then(response => {
		playerName = response.name;
		return response.id;
	}).catch(() => undefined);
	
	const discordTag = (uuid) ? await Data.getDiscord(uuid) : null;

	if (discordTag === undefined) {
		const embed = new MessageEmbed()
			.setColor('#CB152B')
			.setTitle('Error: No Discord Linked!')
			.setDescription('Link this discord account to your Minecraft account on Hypixel first!')
			.setFooter({ text: 'Created by Kaeso#5346' });
		return interaction.editReply({ embeds: [embed] });
	} else if (!discordTag) {
		const embed = new MessageEmbed()
			.setColor('#CB152B')
			.setTitle('Error: Invalid Username!')
			.setDescription(`"${playerName}" doesn't play skyblock! Double check your spelling.`)
			.setFooter({ text: 'Created by Kaeso#5346' });
		return interaction.editReply({ embeds: [embed] });
	}

	if (!uuid) return; // Handled above. This is just to make TS happy

	const userTag = `${interaction.user.username}#${interaction.user.discriminator}`;
	if (userTag !== discordTag) {
		const embed = new MessageEmbed()
			.setColor('#CB152B')
			.setTitle('Error: Account Mismatch!')
			.setDescription(`Your discord account does not match the one linked with \`${playerName}\`!\n\`${playerName}\` has the account \`${discordTag}\` linked in Hypixel!`)
			.setFooter({ text: 'Created by Kaeso#5346' });
		return interaction.editReply({ embeds: [embed] });
	}

	if (player) {
		await DataHandler.update({ discordid: interaction.user.id, ign: playerName, updatedat: Date.now().toString() }, { uuid: uuid });
	} else {
		await DataHandler.updatePlayer(uuid, playerName, undefined, undefined);
		await DataHandler.update({ discordid: interaction.user.id, ign: playerName, updatedat: Date.now().toString() }, { uuid: uuid });
	}

	// const isEliteFarmer = (interaction.guild.id === eliteserverid && interaction.member.roles.cache.some(role => role.id === verifiedroleid));
	// if (isEliteFarmer) {
	// 	let styledata = { elitefarmer: true }

	// 	if (user && user.dataValues?.styledata) {
	// 		const old = user.dataValues?.styledata;
	// 		old.elitefarmer = true;
	// 		styledata = old;
	// 	}

	// 	await DataHandler.update({ discordid: interaction.user.id, styledata: styledata }, { uuid: uuid });
	// } else {
	// 	await DataHandler.update({ discordid: interaction.user.id }, { uuid: uuid });
	// }

	const embed = new MessageEmbed()
		.setColor('#03fc7b')
		.setTitle('Success!')
		.setDescription(`Your minecraft account \`${playerName}\` has been linked! Try \`/weight\` with no arguments!`)
		.setFooter({ text: 'Created by Kaeso#5346' });
	
	// if (isEliteFarmer) {
	// 	const embed2 = new Discord.MessageEmbed()
	// 		.setColor('#03fc7b')
	// 		.setDescription(`You're also an Elite Farmer! \`/jacob\` will update the leaderboard!`);
	// 	interaction.editReply({ embeds: [embed, embed2] });
	// } else {
	interaction.editReply({ embeds: [embed] });
	// }	
}