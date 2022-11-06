import { Command } from "classes/Command";

import { MessageEmbed, MessageActionRow, MessageButton, Message, CommandInteraction } from 'discord.js';

const command: Command = {
	name: 'info',
	description: 'Information about the bot!',
	access: 'ALL',
	type: 'SLASH',
	slash: {
		name: 'info',
		description: 'Get bot information!'
	},
	execute: execute
}

export default command;

async function execute(interaction: CommandInteraction) {
	const embed = new MessageEmbed()
		.setColor('#03fc7b')
		.setTitle('Farming Weight Information')
		.setFooter({ text: 'Created by Kaeso#5346' })
		.setDescription('Farming weight is based off of multiple different factors to provide a number for comparsion between all farmers.')
		.addField('Crop Collections', 'All crops are factored off of relative drop rates in order to equalize time spent for each farming weight.')
		.addField('Collection Bug', 'Co op members used to not gain the proper amounts of collections in a significant (and random) way. This has been patched as of **November 2nd, 2021**, but nothing can be done about lost collection.')
		.addField('Links', '[Website](https://elitebot.dev/)⠀⠀  [Bot Invite Link](https://discord.com/oauth2/authorize?client_id=845065148997566486&scope=applications.commands%20bot&permissions=2214718528)⠀⠀  [Source code](https://github.com/ptlthg/EliteDiscordBot)⠀ ⠀ [Feedback](https://forms.gle/9XFNcj4ownZj23nM8)');

	const row = new MessageActionRow().addComponents(
		new MessageButton()
			.setCustomId('maininfo')
			.setLabel('Main Info')
			.setStyle('PRIMARY')
			.setDisabled(true),
		new MessageButton()
			.setCustomId('crops')
			.setLabel('Crop Info')
			.setStyle('SUCCESS'),
		new MessageButton()
			.setCustomId('bonus')
			.setLabel('Bonus Info')
			.setStyle('PRIMARY'),
		new MessageButton()
			.setCustomId('xpinfo')
			.setLabel('Farming XP?')
			.setStyle('SECONDARY')
	);
	
	await interaction.reply({
		embeds: [embed],
		components: [row],
		allowedMentions: { repliedUser: false },
		fetchReply: true
	}).then(async (reply: unknown) => {
		if (!(reply instanceof Message)) return;

		const collector = reply.createMessageComponentCollector({ componentType: 'BUTTON', time: 30000 });

		collector.on('collect', i => {
			if (i.user.id === interaction.user.id) {
				collector.resetTimer({time: 15000});

				let newEmbed = new MessageEmbed()
					.setColor('#03fc7b')
					.setFooter({ text: 'Created by Kaeso#5346' });

				if (i.customId === 'crops') {
					newEmbed
						.setTitle('Crop Weight Breakdown')
						.setDescription('Amount of each crop per 1 farming weight')
						.addField('Mathematical Hoes', `Wheat: 100,000\nCarrot: 300,000\nPotato: 300,000\nSugar Cane: 200,000\nNether Wart: 250,000`, true)
						.addField(`Specific Tools`, `Pumpkin: 71,000\nMelon: 355,000\nMushroom: 55,000\nCocoa Beans: 220,000\nCactus: 158,000`, true)
						.addField('Infomation', `
The crops with specific tools have a different calculation in order to equalize their tools with mathematical hoes provided by Bankhier (Only rounded number shown)

Seeds are not included as they are simply a byproduct of wheat.
If you have suggestions for tweaking these numbers contact me with your reason.
					`);
				} else if (i.customId === 'bonus') {
					newEmbed
						.setTitle('Bonus Points Information')
						.addField('Farming XP', 'You will recieve 100 farming weight at farming 50, and 150 more at farming 60 for a total of 250. Read more with the buttons.')
						.addField('Jacob\'s Contests', 'For each milestone of 50 gold medals, you will receive 25 weight. 1,000 gold medals (500 weight) maximum.')
						.addField('Farming Minions', 'For each unlocked tier 12 farming minion, you will recieve 5 weight.')
						.addField('Anita Buff', 'For every percent bonus you have, you will recieve 1 more farming weight.');
				} else if (i.customId === 'xpinfo') {
					newEmbed
						.setTitle('What is up with farming xp?')
						.addField('Explanation', `
Well, it's complicated.

Farming xp is rewarded to players along with item drops. Counting xp in a similar fashion would only buff everything excluding netherwart, while not really adding anything informative to the calcuation.

**Simply put, if all the xp was counted in the weight there would be no way to balance the weight from different crops.**

For now, reaching 55m xp (lvl 50) rewards you with 100 weight, with 150 more after you unlock farming 60.\n
								`)
				} else if (i.customId === 'maininfo') {
					newEmbed = embed;
				}

				const newRow = new MessageActionRow().addComponents(
					new MessageButton()
						.setCustomId('maininfo')
						.setLabel('Main Info')
						.setStyle('PRIMARY')
						.setDisabled(i.customId === 'maininfo'),
					new MessageButton()
						.setCustomId('crops')
						.setLabel('Crop Info')
						.setStyle('SUCCESS')
						.setDisabled(i.customId === 'crops'),
					new MessageButton()
						.setCustomId('bonus')
						.setLabel('Bonus Info')
						.setStyle('PRIMARY')
						.setDisabled(i.customId === 'bonus'),
					new MessageButton()
						.setCustomId('xpinfo')
						.setLabel('Farming XP?')
						.setStyle('SECONDARY')
						.setDisabled(i.customId === 'xpinfo')
				);

				i.update({ embeds: [newEmbed], components: [newRow] })
			} else {
				i.reply({ content: `These buttons aren't for you!`, ephemeral: true });
			}
		});

		collector.on('end', () => {
			reply.edit({ components: [], allowedMentions: { repliedUser: false } }).catch(() => undefined);
		});
	}).catch(error => { console.log(error) });
}
