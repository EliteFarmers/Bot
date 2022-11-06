import { Command } from "../classes/Command";
import { ButtonInteraction } from 'discord.js';
import ServerUtil from "../classes/ServerUtil";

const command: Command = {
	name: 'LBSUBMIT',
	description: 'Submit your scores!',
	access: 'GUILD',
	type: 'BUTTON',
	execute: execute
}

export default command;

async function execute(interaction: ButtonInteraction) {
	await ServerUtil.submitScores(interaction);
}