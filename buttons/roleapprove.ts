import { Command } from "../classes/Command";
import { ButtonInteraction, GuildMember } from 'discord.js';
import ServerUtil from "../classes/ServerUtil";
import DataHandler from "../classes/Database";
import { HasRole } from "../classes/Util";

const command: Command = {
	name: 'WEIGHTROLEAPPROVE',
	description: 'Approve the weight-role for someone!',
	access: 'GUILD',
	type: 'BUTTON',
	execute: execute
}

export default command;

async function execute(interaction: ButtonInteraction) {

	const serverPromise = interaction.guildId ? DataHandler.getServer(interaction.guildId) : undefined;
	const userPromise = DataHandler.getPlayer(undefined, { discordid: interaction.customId.split('|')[1] });

	Promise.all([serverPromise, userPromise]).then(async (values) => {
		const server = values[0], user = values[1];

		if (!server || !user || !interaction.member || !(interaction.member instanceof GuildMember) || !interaction.guild) return;

		if (!HasRole(interaction.member, server.reviewerrole ?? undefined)) {
			return interaction.reply({ content: '**Error!** You don\'t have permission to do this!', ephemeral: true }).catch();
		}

		await ServerUtil.grantWeightRole(interaction, interaction.guild, interaction.member, server, user);
	}).catch((e) => { throw e });
}