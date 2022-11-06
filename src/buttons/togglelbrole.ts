import { Command } from "../classes/Command";
import { ButtonInteraction } from 'discord.js';
import ServerUtil from "../classes/ServerUtil";

const command: Command = {
	name: 'LBROLETOGGLE',
	description: 'Toggle if you have the LB notification role!',
	access: 'GUILD',
	type: 'BUTTON',
	execute: execute
}

export default command;

async function execute(interaction: ButtonInteraction) {
	await ServerUtil.toggleRole(interaction);
}