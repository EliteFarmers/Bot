import { EliteEmbed, EmptyField, NotYoursReply } from '../classes/embeds.js';
import { Command, CommandAccess, CommandType } from '../classes/Command.js';
import { CropSelectRow, GetCropEmoji } from '../classes/Util.js';
import { ChatInputCommandInteraction, ComponentType, SlashCommandBuilder } from 'discord.js';
import { CalculateDetailedAverageDrops, Crop, CropDisplayName } from 'farming-weight';

const TIME_OPTIONS = {
	24_000: 'Jacob Contest',
	72_000: '1 Hour',
	288_000: '4 Hours',
	864_000: '12 Hours',
	1_728_000: '24 Hours',
}

const command: Command = {
	name: 'rates',
	description: 'Get NPC profit rates for a given amount of fortune!',
	access: CommandAccess.Everywhere,
	type: CommandType.Slash,
	slash: new SlashCommandBuilder()
		.setName('rates')
		.setDescription('Get NPC profit rates for a given amount of fortune!')
		.addIntegerOption(option => option.setName('fortune')
			.setDescription('The amount of fortune to calculate rates for!')
			.setMinValue(100)
			.setMaxValue(5000)
			.setRequired(false))
		.addIntegerOption(option => option.setName('time')
			.setDescription('The amount of time to calculate rates for!')
			.addChoices(...Object.entries(TIME_OPTIONS).map(([value, name]) => ({ name, value: +value })))
			.setRequired(false))
		.addStringOption(option => option.setName('reforge')
			.setDescription('The reforge to calculate rates for!')
			.addChoices({ name: 'Bountiful', value: 'bountiful' }, { name: 'Blessed', value: 'blessed' })
			.setRequired(false)),
	execute: execute
}

export default command;

async function execute(interaction: ChatInputCommandInteraction) {
	const fortune = interaction.options.getInteger('fortune', false) ?? undefined;
	const blocks = interaction.options.getInteger('time', false) ?? 72_000;
	const reforge = interaction.options.getString('reforge', false) ?? 'bountiful';
	const timeName = TIME_OPTIONS[blocks as keyof typeof TIME_OPTIONS];

	const expectedDrops = CalculateDetailedAverageDrops({
		farmingFortune: fortune,
		blocksBroken: blocks,
		bountiful: reforge === 'bountiful',
		mooshroom: true,
	}) as Partial<ReturnType<typeof CalculateDetailedAverageDrops>>;

	delete expectedDrops[Crop.Seeds];

	let amountLength = 0;
	let profitLength = 0;

	const formatted = Object.entries(expectedDrops).map(([crop, details]) => {
		const cropName = CropDisplayName(crop as Crop);
		const profit = details.npcCoins ?? 0;

		if (profit.toLocaleString().length > amountLength) amountLength = profit.toLocaleString().length;
		if (profit.toLocaleString().length > profitLength) profitLength = profit.toLocaleString().length;

		return {
			emoji: GetCropEmoji(cropName),
			details,
			profit
		}
	}).sort((a, b) => b.profit - a.profit);

	const text = formatted.map(({ emoji, details, profit }) => {
		const amountStr = details.collection.toLocaleString().padStart(amountLength, ' ');
		const profitStr = profit.toLocaleString().padStart(profitLength, ' ');

		return `${emoji} \`${amountStr}\` :coin: \`${profitStr}\``;
	}).join('\n');

	const details = `\nUsing **${reforge === 'bountiful' ? 'Bountiful' : 'Blessed'}**, **Mooshroom Cow**, and **4/4ths Fermento Armor**!`;

	const embed = EliteEmbed()
		.setTitle('NPC Profit Calculator')
		.setDescription(`Expected rates for **${fortune?.toLocaleString() ?? 'MAX'}** Farming Fortune in **${timeName}**${details}`)
		.addFields({
			name: 'Crops',
			value: text || 'Error!',
		});

	const row = CropSelectRow('crop-select-rates', 'Select a crop to view its rates!');

	const reply = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

	const collector = reply.createMessageComponentCollector({ componentType: ComponentType.StringSelect, time: 120_000 });

	collector.on('collect', async inter => {
		if (inter.customId !== 'crop-select-rates') return;

		if (inter.user.id !== interaction.user.id) {
			return NotYoursReply(inter);
		}

		const selected = +inter.values[0];

		const [ crop, cropInfo ] = Object.entries(expectedDrops)[selected];
		const coinSources = Object.entries(cropInfo.coinSources).sort((a, b) => b[1] - a[1]);
		const collections = Object.entries(cropInfo.otherCollection).sort((a, b) => b[1] - a[1]);
		const cropName = CropDisplayName(crop as Crop);

		const cropEmbed = EliteEmbed()
			.setTitle(`${cropName} Rates`)
			.setDescription(`Expected rates for **${fortune?.toLocaleString() ?? `${cropInfo.fortune.toLocaleString()} (MAX)`}** Farming Fortune in **${timeName}**${details}`)
			.addFields([{
				name: 'Collection Gain',
				value: GetCropEmoji(cropName) + ' ' + cropInfo.collection.toLocaleString(),
				inline: true,
			}, {
				name: 'Total NPC Profit',
				value: ':coin: ' + cropInfo.npcCoins?.toLocaleString() ?? '0',
				inline: true,
			}, EmptyField(), {
				name: 'Profit Breakdown',
				value: coinSources.map(([source, amount]) => {
					return `**${source}:** ${amount?.toLocaleString()}`;
				}).join('\n'),
				inline: true,
			}, {
				name: 'Other Collection',
				value: collections.map(([source, amount]) => {
					return `**${source}:** ${amount?.toLocaleString()}`;
				}).join('\n'),
				inline: true,
			}, EmptyField() ]);

		inter.update({ embeds: [cropEmbed] });
	})

	collector.on('end', async () => {
		reply.edit({ components: [] }).catch(() => undefined);
	});
}