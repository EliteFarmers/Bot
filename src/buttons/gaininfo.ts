import { ButtonInteraction } from 'discord.js';
import { UserSettings } from '../api/elite.js';
import { CommandAccess, CommandType, EliteCommand } from '../classes/commands/index.js';
import { EliteEmbed } from '../classes/embeds.js';

const command = new EliteCommand({
	name: 'GAININFO',
	description: 'Get information about the gain command!',
	access: CommandAccess.Everywhere,
	type: CommandType.Button,
	fetchSettings: true,
	execute: execute,
});

export default command;

async function execute(interaction: ButtonInteraction, settings: UserSettings) {
	const embed = EliteEmbed(settings)
		.setTitle('Gain Command Information')
		.setDescription('The gain command is used to get the collection gain of a player over the last 9 days.');

	embed.addFields(
		{
			name: 'Where is this data from?',
			value:
				"Collection increases are stored in the Elite Farmers API's database every time new data is fetched from Hypixel, this is not an automatic process.",
		},
		{
			name: 'Why is a day really high?',
			value:
				'If a particular day is really high, it is likely that the player has not been updated for a while before that day. For example, if a player has not been updated for 3 days, the collection increase for the 3rd day will be the sum of the 1st, 2nd, and 3rd day. This may also be due to collecting minions.',
		},
		{
			name: 'What are the timestamps?',
			value:
				"These timestamps represent the start of the day in UTC. A player's first and last data point of that day is what is used to calculate the collection increase.",
		},
		{
			name: 'Where can I see older data?',
			value:
				'If it exists, older data may be viewed on the Elite Farmers [website](https://elitebot.dev). View someone\'s profile and click on the "Charts" tab.',
		},
	);

	return interaction.reply({ embeds: [embed.data], ephemeral: true });
}
