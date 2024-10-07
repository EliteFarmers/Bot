import { ChatInputCommandInteraction } from 'discord.js';
import { UserSettings } from '../api/elite.js';
import { Command, CommandAccess, CommandType } from '../classes/commands/index.js';
import { EliteEmbed } from '../classes/embeds.js';

const command: Command = {
	name: 'shop',
	description: 'View the shop!',
	access: CommandAccess.Everywhere,
	type: CommandType.Slash,
	execute: execute,
};

export default command;

async function execute(interaction: ChatInputCommandInteraction, settings?: UserSettings) {
	const embed = EliteEmbed(settings)
		.setTitle('Elite Farmers Shop')
		.setDescription(
			'[Open Discord Store](https://discord.com/application-directory/1106961758905708596/store)\n' +
				'View products on the Discord store to help support the bot and get cool perks!',
		)
		.addFields({
			name: 'Bought Something?',
			value:
				'-# Thank you!\nManage your new settings/options on [elitebot.dev/profile/settings](https://elitebot.dev/profile/settings)!',
		});

	await interaction
		.reply({
			embeds: [embed],
			allowedMentions: { repliedUser: false },
			ephemeral: true,
		})
		.catch(() => undefined);
}
