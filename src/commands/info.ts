import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { UserSettings } from '../api/elite.js';
import { Command, CommandAccess, CommandType } from '../classes/commands/index.js';
import { EliteEmbed } from '../classes/embeds.js';

const command: Command = {
	name: 'info',
	description: 'Information about the bot!',
	access: CommandAccess.Everywhere,
	type: CommandType.Slash,
	slash: new SlashCommandBuilder().setName('info').setDescription('Get bot information!'),
	execute: execute,
};

export default command;

async function execute(interaction: ChatInputCommandInteraction, settings?: UserSettings) {
	const embed = EliteEmbed(settings)
		.setTitle('Farming Weight Information')
		.setDescription(
			'Farming weight is based off of multiple different factors to provide a number for comparsion between all farmers.\n\n**Info has been moved to [elitebot.dev/info](https://elitebot.dev/info)**',
		)
		.addFields([
			{
				name: 'Crop Collections',
				value:
					'All crops are factored off of relative drop rates in order to equalize time spent for each farming weight.',
			},
			{
				name: 'Collection Bug',
				value:
					'Co op members used to not gain the proper amounts of collections in a significant (and random) way. This has been patched as of **November 2nd, 2021**, but nothing can be done about lost collection.',
			},
			{
				name: 'Links',
				value:
					'[Website](https://elitebot.dev/)⠀⠀  [Bot Invite Link](https://elitebot.dev/invite)⠀⠀  [Source code](https://github.com/EliteFarmers/Bot)⠀ ⠀ [Feedback](https://forms.gle/9XFNcj4ownZj23nM8)',
			},
		]);

	await interaction
		.reply({
			embeds: [embed],
			allowedMentions: { repliedUser: false },
			ephemeral: true,
		})
		.catch(() => undefined);
}
