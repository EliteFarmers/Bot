import { ChatInputCommandInteraction, ComponentType, SlashCommandBuilder } from 'discord.js';
import { Crop, calculateAverageSpecialCrops, calculateDetailedAverageDrops, getCropDisplayName } from 'farming-weight';
import { UserSettings } from '../api/elite.js';
import { CropSelectRow, GetCropEmoji } from '../classes/Util.js';
import { CommandAccess, CommandType, EliteCommand, SlashCommandOptionType } from '../classes/commands/index.js';
import { EliteEmbed, EmptyField, NotYoursReply } from '../classes/embeds.js';

const TIME_OPTIONS = {
	24_000: 'Jacob Contest',
	72_000: '1 Hour',
	288_000: '4 Hours',
	864_000: '12 Hours',
	1_728_000: '24 Hours',
};

const command = new EliteCommand({
	name: 'rates',
	description: 'Get NPC profit rates for a given amount of fortune!',
	access: CommandAccess.Everywhere,
	type: CommandType.Slash,
	options: {
		fortune: {
			name: 'fortune',
			description: 'The amount of fortune to calculate rates for!',
			type: SlashCommandOptionType.Integer,
			builder: (b) => b.setMinValue(0).setMaxValue(5000),
		},
		time: {
			name: 'time',
			description: 'The amount of time to calculate rates for!',
			type: SlashCommandOptionType.Integer,
			builder: (b) => b.addChoices(...Object.entries(TIME_OPTIONS).map(([value, name]) => ({ name, value: +value }))),
		},
		reforge: {
			name: 'reforge',
			description: 'The reforge to calculate rates for!',
			type: SlashCommandOptionType.String,
			builder: (b) => b.addChoices({ name: 'Bountiful', value: 'bountiful' }, { name: 'Blessed', value: 'blessed' }),
		},
		pet: {
			name: 'pet',
			description: 'The pet to calculate rates for!',
			type: SlashCommandOptionType.String,
			builder: (b) =>
				b.addChoices({ name: 'Mooshroom Cow', value: 'mooshroom' }, { name: 'Elephant', value: 'elephant' }),
		},
		bps: {
			name: 'bps',
			description: 'Your blocks broken per second! (10-20)',
			type: SlashCommandOptionType.Number,
			builder: (b) => b.setMinValue(10).setMaxValue(20),
		},
	},
	execute: execute,
});

export default command;

async function execute(interaction: ChatInputCommandInteraction, settings?: UserSettings) {
	const fortuneInput = interaction.options.getInteger('fortune', false) ?? undefined;
	const blocks = interaction.options.getInteger('time', false) ?? 72_000;
	const reforge = interaction.options.getString('reforge', false) ?? 'bountiful';
	const pet = interaction.options.getString('pet', false) ?? 'mooshroom';
	const bps = interaction.options.getNumber('bps', false) ?? 20;
	const timeName = TIME_OPTIONS[blocks as keyof typeof TIME_OPTIONS];
	const blocksBroken = Math.round(blocks * (bps / 20));

	const expectedDrops = calculateDetailedAverageDrops({
		farmingFortune: fortuneInput,
		blocksBroken: blocksBroken,
		bountiful: reforge === 'bountiful',
		mooshroom: pet === 'mooshroom',
	}) as Partial<ReturnType<typeof calculateDetailedAverageDrops>>;

	delete expectedDrops[Crop.Seeds];

	let amountLength = 0;
	let profitLength = 0;

	const formatted = Object.entries(expectedDrops)
		.map(([crop, details]) => {
			const cropName = getCropDisplayName(crop as Crop);
			const profit = details.npcCoins ?? 0;

			if (profit.toLocaleString().length > amountLength) amountLength = profit.toLocaleString().length;
			if (profit.toLocaleString().length > profitLength) profitLength = profit.toLocaleString().length;

			return {
				emoji: GetCropEmoji(cropName),
				details,
				profit,
			};
		})
		.sort((a, b) => b.profit - a.profit);

	const text = formatted
		.map(({ emoji, details, profit }) => {
			const amountStr = details.collection.toLocaleString().padStart(amountLength, ' ');
			const profitStr = profit.toLocaleString().padStart(profitLength, ' ');

			return `${emoji} \`${amountStr}\` :coin: \`${profitStr}\``;
		})
		.join('\n');

	const bpsText = `**${bps % 1 === 0 ? bps : bps.toFixed(2)}**/20 BPS (${((bps / 20) * 100).toFixed(1)}%)`;
	const description =
		`Expected rates for **${fortuneInput?.toLocaleString() ?? 'MAX'}** Farming Fortune in **${timeName}**! ` +
		`\nUsing **${reforge === 'bountiful' ? 'Bountiful' : 'Blessed'}**, ` +
		`**${pet === 'mooshroom' ? 'Mooshroom Cow' : 'Elephant'}**, and **4/4ths Fermento Armor**!\n` +
		bpsText;

	const embed = EliteEmbed(settings)
		.setTitle('NPC Profit Calculator')
		.setDescription(description)
		.addFields({
			name: 'Crops',
			value: text || 'Error!',
			inline: true,
		});

	let details = settings
		? `You can view your rates with your farming gear on the [website here](<https://elitebot.dev/@${interaction.user.id}/rates>)!`
		: `You can view your rates with your farming gear on the "**Rates**" tab of your [online stats](<https://elitebot.dev/>)!`;

	if (fortuneInput !== undefined) {
		details +=
			'\n\n**Custom Fortune Warning**\nThe amount of fortune available varies depending on the crop. For the best results, only look at the crop your entered fortune is for.';
	}

	embed.addFields({
		name: "What's My Fortune?",
		value: details,
		inline: true,
	});

	const row = CropSelectRow('crop-select-rates', 'Select a crop to view its rates!');

	const reply = await interaction.reply({
		embeds: [embed],
		components: [row],
		fetchReply: true,
	});

	const collector = reply.createMessageComponentCollector({
		componentType: ComponentType.StringSelect,
		time: 120_000,
	});

	collector.on('collect', async (inter) => {
		if (inter.customId !== 'crop-select-rates') return;

		if (inter.user.id !== interaction.user.id) {
			return NotYoursReply(inter);
		}

		const selected = +inter.values[0];

		const [crop, cropInfo] = Object.entries(expectedDrops)[selected];
		const coinSources = Object.entries(cropInfo.coinSources).sort((a, b) => b[1] - a[1]);
		const collections = Object.entries(cropInfo.otherCollection).sort((a, b) => b[1] - a[1]);
		const cropName = getCropDisplayName(crop as Crop);

		const cropDetails =
			`\nUsing **${reforge === 'bountiful' ? 'Bountiful' : 'Blessed'}**, ` +
			`**${pet === 'mooshroom' ? 'Mooshroom Cow' : 'Elephant'}**, ` +
			`and **4/4ths Fermento Armor**!`;

		const threeFourths = calculateAverageSpecialCrops(blocksBroken, crop as Crop, 3);
		const fromSpecial = cropInfo.coinSources[threeFourths.type] ?? 0;
		const specialDifference = fromSpecial - threeFourths.npc;
		const threeFourthsTotal = cropInfo.npcCoins - specialDifference;

		const cropEmbed = EliteEmbed(settings)
			.setTitle(`${cropName} Rates`)
			.setDescription(
				`Expected rates for **${fortuneInput?.toLocaleString() ?? `${cropInfo.fortune.toLocaleString()} (MAX)`}** Farming Fortune in **${timeName}**!${cropDetails}\n${bpsText}`,
			)
			.addFields([
				{
					name: 'Total NPC Profit',
					value: ':coin: ' + cropInfo.npcCoins.toLocaleString() || '0',
					inline: true,
				},
				{
					name: 'Collection Gain',
					value: GetCropEmoji(cropName) + ' ' + cropInfo.collection.toLocaleString(),
					inline: true,
				},
				EmptyField(),
				{
					name: 'Profit Breakdown',
					value: coinSources
						.map(([source, amount]) => {
							return `**${source}:** ${amount?.toLocaleString()}`;
						})
						.join('\n'),
					inline: true,
				},
				{
					name: 'Collection Breakdown',
					value: collections
						.map(([source, amount]) => {
							return `**${source}:** ${amount?.toLocaleString()}`;
						})
						.join('\n'),
					inline: true,
				},
			]);

		cropEmbed.addFields([
			EmptyField(),
			{
				name: '3/4ths Fermento Armor',
				value: `:coin: ${threeFourthsTotal?.toLocaleString() ?? '0'} ⠀ ${(specialDifference).toLocaleString()} less coins (~${threeFourths.amount.toLocaleString()} ${threeFourths.type})`,
			},
		]);

		inter.update({ embeds: [cropEmbed] });
	});

	collector.on('end', async () => {
		reply.edit({ components: [] }).catch(() => undefined);
	});
}
