import { Command } from '../classes/Command';
import { Message, ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';

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

async function execute(interaction: ChatInputCommandInteraction) {
	const embed = new EmbedBuilder()
		.setColor('#03fc7b')
		.setTitle('Farming Weight Information')
		.setFooter({ text: 'Created by Kaeso#5346' })
		.setDescription('Farming weight is based off of multiple different factors to provide a number for comparsion between all farmers.')
		.addFields([
			{ 
				name: 'Crop Collections', 
				value: 'All crops are factored off of relative drop rates in order to equalize time spent for each farming weight.' 
			}, { 
				name: 'Collection Bug', 
				value: 'Co op members used to not gain the proper amounts of collections in a significant (and random) way. This has been patched as of **November 2nd, 2021**, but nothing can be done about lost collection.' 
			}, { 
				name: 'Links', 
				value: '[Website](https://elitebot.dev/)⠀⠀  [Bot Invite Link](https://discord.com/oauth2/authorize?client_id=845065148997566486&scope=applications.commands%20bot&permissions=2214718528)⠀⠀  [Source code](https://github.com/ptlthg/EliteDiscordBot)⠀ ⠀ [Feedback](https://forms.gle/9XFNcj4ownZj23nM8)' 
			},
		]);
	const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder()
			.setCustomId('maininfo')
			.setLabel('Main Info')
			.setStyle(ButtonStyle.Primary)
			.setDisabled(true),
		new ButtonBuilder()
			.setCustomId('crops')
			.setLabel('Crop Info')
			.setStyle(ButtonStyle.Success),
		new ButtonBuilder()
			.setCustomId('bonus')
			.setLabel('Bonus Info')
			.setStyle(ButtonStyle.Primary),
		new ButtonBuilder()
			.setCustomId('xpinfo')
			.setLabel('Farming XP?')
			.setStyle(ButtonStyle.Secondary)
	);
	
	await interaction.reply({
		embeds: [embed],
		components: [row],
		allowedMentions: { repliedUser: false },
		fetchReply: true
	}).then(async (reply: unknown) => {
		if (!(reply instanceof Message)) return;

		const collector = reply.createMessageComponentCollector({ componentType: ComponentType.Button, time: 30_000 });

		collector.on('collect', i => {
			if (i.user.id === interaction.user.id) {
				collector.resetTimer({time: 15000});

				let newEmbed = new EmbedBuilder()
					.setColor('#03fc7b')
					.setFooter({ text: 'Created by Kaeso#5346' });

				if (i.customId === 'crops') {
					newEmbed
						.setTitle('Crop Weight Breakdown')
						.setDescription('Amount of each crop per 1 farming weight')
						.addFields([
							{ name: 'Mathematical Hoes', value: `Wheat: 100,000\nCarrot: 300,000\nPotato: 300,000\nSugar Cane: 200,000\nNether Wart: 250,000`, inline: true },
							{ name: `Specific Tools`, value: `Pumpkin: 71,000\nMelon: 355,000\nMushroom: 55,000\nCocoa Beans: 220,000\nCactus: 158,000`, inline: true },
							{ name: 'Infomation', value: `
The crops with specific tools have a different calculation in order to equalize their tools with mathematical hoes provided by Bankhier (Only rounded number shown)

Seeds are not included as they are simply a byproduct of wheat.
If you have suggestions for tweaking these numbers contact me with your reason.
							` }
						]);
				} else if (i.customId === 'bonus') {
					newEmbed
						.setTitle('Bonus Points Information')
						.addFields([
							{ name: 'Farming XP', value: 'You will recieve 100 farming weight at farming 50, and 150 more at farming 60 for a total of 250. Read more with the buttons.' },
							{ name: 'Jacob\'s Contests', value: 'For each milestone of 50 gold medals, you will receive 25 weight. 1,000 gold medals (500 weight) maximum.' },
							{ name: 'Farming Minions', value: 'For each unlocked tier 12 farming minion, you will recieve 5 weight.' },
							{ name: 'Anita Buff', value: 'For every percent bonus you have, you will recieve 1 more farming weight.' }
						]);
				} else if (i.customId === 'xpinfo') {
					newEmbed
						.setTitle('What is up with farming xp?')
						.addFields({
							name: 'Explanation', 
							value: `
Well, it's complicated.

Farming xp is rewarded to players along with item drops. Counting xp in a similar fashion would only buff everything excluding netherwart, while not really adding anything informative to the calcuation.

**Simply put, if all the xp was counted in the weight there would be no way to balance the weight from different crops.**

For now, reaching 55m xp (lvl 50) rewards you with 100 weight, with 150 more after you unlock farming 60.\n
						` });
				} else if (i.customId === 'maininfo') {
					newEmbed = embed;
				}

				const newRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
					new ButtonBuilder()
						.setCustomId('maininfo')
						.setLabel('Main Info')
						.setStyle(ButtonStyle.Primary)
						.setDisabled(i.customId === 'maininfo'),
					new ButtonBuilder()
						.setCustomId('crops')
						.setLabel('Crop Info')
						.setStyle(ButtonStyle.Success)
						.setDisabled(i.customId === 'crops'),
					new ButtonBuilder()
						.setCustomId('bonus')
						.setLabel('Bonus Info')
						.setStyle(ButtonStyle.Primary)
						.setDisabled(i.customId === 'bonus'),
					new ButtonBuilder()
						.setCustomId('xpinfo')
						.setLabel('Farming XP?')
						.setStyle(ButtonStyle.Secondary)
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
