const Discord = require('discord.js');

module.exports = {
	name: 'info',
	aliases: ['i'],
	description: 'Information',
	usage: '[command name]',
	guildOnly: false,
	execute(message, args) {
		const arg = (args[0] !== undefined) ? args[0].toLowerCase() : 'nope';

		const embed = new Discord.MessageEmbed()
			.setColor('#03fc7b')
			.setTitle('Farming Weight Information')
			.setFooter('Created by Kaeso#5346');
			
		
		if (arg === 'crops') {
			embed.addField('Amount of each crop per 1 farming weight', `
Wheat: 100,000
Carrot: 300,000
Potato: 300,000
Sugar Cane: 200,000
Nether Wart: 250,000
Pumpkin: 71,000
Melon: 355,000
Mushroom: 83,000
Cocoa Beans: 220,000
Cactus: 79,000

The last 5 crops have a different calculation in order to equalize their tools with mathematical hoes provided by Bankhier (Only rounded number shown)

Seeds are not included as they are simply a byproduct of wheat.
If you have suggestions for tweaking these numbers contact me with your reason.
		`)
		} else if (arg === 'xp') {
			embed.addField('What is up with farming xp?', `
Well, it's complicated.

Farming xp is rewarded to players along with item drops. Counting xp in a similar fashion would only buff everything excluding netherwart, while not really adding anything informative to the cacluation. While there are people with incredible amounts of farming xp which shows great dedication and effort in the ways of farming, the issuses are too hard to ignore. Consider this my official apology to people with obscene amounts of farming xp and the dreaded co op bug.

For now, reaching 55m xp (lvl 50) rewards you with 100 weight, with 150 more after you unlock farming 60.\n
			`).addField('**F.A.Q:**', `
**Q:** Why not just give one weight per [insert number] xp?
**A:** Again, farming xp is just a byproduct and it differs between crops. Because the crops are balanced Pumpkin would give players the most weight unfairly.

**Q:** Why not weigh it per crop so it's balanced?
**A:** Then weight numbers would just be inflated across the board with no other changes.

**Q:** Why include it at all?
**A:** I feel bad for people with co op bug, farming 60 is a notable accomplisment that warrants some reward.

**Q:** Doesn't this just give a set boost to top farmers?
**A:** Kind of, but anyone can achieve it.

**Q:** How does this benefit people with co op bug?
**A:** Adding a source of farming weight that's unaffected slightly dilutes the pain of hundreds of millions of missing collection numbers.
			`)
		} else {
			embed.setDescription('Farming weight is based off of multiple different factors to provide a number for comparsion between all farmers.')
				.addField('Crop Collections', 'All crops are factored off of relative drop rates in order to equalize time spent for each farming weight.\nRead more with **info crops**')
				.addField('Farming XP', 'Farming xp is not a key contributer in weight because it is mostly a byproduct of farming. I have capped it at farming 60 as a result.\nRead more with **info xp**')
				.addField('Jacob\'s Contests', 'For each milestone of 50 gold medals, you will receive 25 weight. 1,000 gold medals (500 weight) maximum.')
				.addField('Collection Bug', 'Co op members do not gain the proper amounts of collections in a significant way and the calculations suffer from it. You can fix this for the future by kicking all co op members, but nothing can be done about lost collection.')
				.addField('Links', 'Source code - https://github.com/ptlthg/EliteDiscordBot\nFeedback - https://forms.gle/9XFNcj4ownZj23nM8');
		}

		message.channel.send({ embeds: [embed] });
	},
};
