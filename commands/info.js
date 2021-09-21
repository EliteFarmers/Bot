const Discord = require('discord.js');

module.exports = {
	name: 'info',
	aliases: ['i'],
	description: 'Information about the bot',
	usage: '',
	guildOnly: false,
	async execute(interaction) {
		const embed = new Discord.MessageEmbed()
			.setColor('#03fc7b')
			.setTitle('Farming Weight Information')
			.setFooter('Created by Kaeso#5346')
			.setDescription('Farming weight is based off of multiple different factors to provide a number for comparsion between all farmers.')
			.addField('Crop Collections', 'All crops are factored off of relative drop rates in order to equalize time spent for each farming weight.')
			.addField('Collection Bug', 'Co op members do not gain the proper amounts of collections in a significant way and the calculations suffer from it. You can fix this for the future by kicking all co op members, but nothing can be done about lost collection.')
			.addField('Links', 'Source code - https://github.com/ptlthg/EliteDiscordBot\nFeedback - https://forms.gle/9XFNcj4ownZj23nM8');

		const row = new Discord.MessageActionRow().addComponents(
			new Discord.MessageButton()
				.setCustomId('crops')
				.setLabel('Crop Info')
				.setStyle('SUCCESS'),
			new Discord.MessageButton()
				.setCustomId('bonus')
				.setLabel('Bonus Info')
				.setStyle('PRIMARY'),
			new Discord.MessageButton()
				.setCustomId('xpinfo')
				.setLabel('Farming XP?')
				.setStyle('SECONDARY')
		);
		
		let sentReply = await interaction.reply({
			embeds: [embed],
			components: [row],
			allowedMentions: { repliedUser: false }
		}).then(async () => {
			let reply = await interaction.fetchReply();
			const collector = reply.createMessageComponentCollector({ componentType: 'BUTTON', time: 30000 });

			collector.on('collect', i => {
				if (i.user.id === interaction.user.id) {
					collector.resetTimer({time: 15000});

					let newEmbed = new Discord.MessageEmbed()
						.setColor('#03fc7b')
						.setFooter('Created by Kaeso#5346');

					if (i.customId === 'crops') {
						newEmbed
							.setTitle('Crop Weight Breakdown')
							.addField('Amount of each crop per 1 farming weight', `
Wheat: 100,000
Carrot: 300,000
Potato: 300,000
Sugar Cane: 200,000
Nether Wart: 250,000
Pumpkin: 71,000
Melon: 355,000
Mushroom: 55,000
Cocoa Beans: 220,000
Cactus: 158,000

The last 5 crops have a different calculation in order to equalize their tools with mathematical hoes provided by Bankhier (Only rounded number shown)

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

Farming xp is rewarded to players along with item drops. Counting xp in a similar fashion would only buff everything excluding netherwart, while not really adding anything informative to the cacluation. While there are people with incredible amounts of farming xp which shows great dedication and effort in the ways of farming, the issuses are too hard to ignore. Consider this my official apology to people with obscene amounts of farming xp and the dreaded co op bug.

For now, reaching 55m xp (lvl 50) rewards you with 100 weight, with 150 more after you unlock farming 60.\n
									`)
					} else if (i.customId === 'maininfo') {
						newEmbed = embed;
					}

					const newRow = new Discord.MessageActionRow().addComponents(
						new Discord.MessageButton()
							.setCustomId('maininfo')
							.setLabel('Main Info')
							.setStyle('PRIMARY')
							.setDisabled(i.customId === 'maininfo'),
						new Discord.MessageButton()
							.setCustomId('crops')
							.setLabel('Crop Info')
							.setStyle('SUCCESS')
							.setDisabled(i.customId === 'crops'),
						new Discord.MessageButton()
							.setCustomId('bonus')
							.setLabel('Bonus Info')
							.setStyle('PRIMARY')
							.setDisabled(i.customId === 'bonus'),
						new Discord.MessageButton()
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

			collector.on('end', collected => {
				try {
					reply.edit({ components: [], allowedMentions: { repliedUser: false } })
				} catch (error) { console.log(error) }
			});
		}).catch(error => { console.log(error) });
	},
};
