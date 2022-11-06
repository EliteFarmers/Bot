import { Command } from "../classes/Command";
import { ButtonInteraction } from 'discord.js';

const command: Command = {
	name: 'WEIGHTROLEDENY',
	description: 'Deny the weight-role to someone!',
	access: 'GUILD',
	type: 'BUTTON',
	execute: execute
}

export default command;

async function execute(interaction: ButtonInteraction) {
	interaction.update({ content: `**Denied by** <@${interaction.user.id}>!`, components: [] }).catch(() => undefined);
}