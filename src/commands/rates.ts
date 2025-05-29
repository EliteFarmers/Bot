import {
	ButtonBuilder,
	ButtonStyle,
	ChatInputCommandInteraction,
	MessageFlags,
	StringSelectMenuInteraction,
} from 'discord.js';
import {
	CROP_INFO,
	Crop,
	calculateAverageSpecialCrops,
	calculateDetailedAverageDrops,
	getCropDisplayName,
	getPossibleResultsFromCrops,
} from 'farming-weight';
import { FetchProducts, UserSettings } from '../api/elite.js';
import { CropSelectRow, EliteCropEmojis, GetCropEmoji } from '../classes/Util.js';
import { CommandAccess, CommandType, EliteCommand, SlashCommandOptionType } from '../classes/commands/index.js';
import { EliteContainer } from '../classes/components.js';
import { NotYoursReply } from '../classes/embeds.js';

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

	const allIds = Object.values(CROP_INFO)
		.map((info) => info.crafts.map((c) => c.item))
		.flat();
	const { data: bazaar } = await FetchProducts(allIds);

	let amountLength = 0;
	let profitLength = 0;
	let bzLength = 0;

	const formatted = Object.entries(expectedDrops)
		.map(([crop, details]) => {
			const cropName = getCropDisplayName(crop as Crop);
			const profit = details.npcCoins ?? 0;
			const otherCoins = details.npcCoins - details.coinSources['Collection'];

			const crafts = getPossibleResultsFromCrops(crop as Crop, details.collection);
			const bz = [];

			for (const [itemId, craft] of Object.entries(crafts)) {
				if (itemId === crop) continue;
				const bzData = bazaar?.items?.[itemId];
				if (!bzData?.bazaar) continue;

				const profit = craft.fractionalItems * bzData.bazaar.averageSellOrder - craft.fractionalCost;

				bz.push({
					name: bzData.name,
					items: craft.fractionalItems,
					cost: craft.fractionalCost,
					profit: Math.floor(profit),
					total: Math.floor(profit + otherCoins),
				});
			}

			bz.sort((a, b) => b.total - a.total);

			const highestBz = bz[0];

			if (profit.toLocaleString().length > amountLength) amountLength = profit.toLocaleString().length;
			if (profit.toLocaleString().length > profitLength) profitLength = profit.toLocaleString().length;
			if (highestBz && highestBz.total.toLocaleString().length > bzLength)
				bzLength = highestBz.total.toLocaleString().length;

			return {
				crop: crop as Crop,
				emoji: GetCropEmoji(cropName),
				bz: bz,
				details,
				profit,
			};
		})
		.sort((a, b) => b.profit - a.profit);

	const bpsText = `-# **${bps % 1 === 0 ? bps : bps.toFixed(2)}**/20 BPS (${((bps / 20) * 100).toFixed(1)}%)`;
	const description =
		`Expected rates for **${fortuneInput?.toLocaleString() ?? 'MAX'}** Farming Fortune in **${timeName}**! ` +
		`\nUsing **${reforge === 'bountiful' ? 'Bountiful' : 'Blessed'}**, ` +
		`**${pet === 'mooshroom' ? 'Mooshroom Cow' : 'Elephant'}**, and **4/4ths Fermento Armor**!\n` +
		bpsText;

	await interaction.deferReply();

	const row = CropSelectRow('crop-select-rates', 'Select a crop to view its rates!');

	const container = new EliteContainer(settings)
		.addTitle('## Farming Rates Calculator', false)
		.addDescription(description)
		.addSeperator();

	const compactContainer = new EliteContainer(settings)
		.addTitle('## Farming Rates Calculator', false)
		.addDescription(description)
		.addSeperator();

	const cropList = Object.keys(EliteCropEmojis) as Crop[];

	for (const { emoji, profit, bz, crop } of formatted) {
		const values = `:coin: \`${profit.toLocaleString().padStart(profitLength, ' ')}\` **BZ** \`${bz[0].total.toLocaleString().padStart(bzLength, ' ')}\``;
		const text = `-# ${emoji} **${getCropDisplayName(crop)}**\n${values}`;
		container.addSectionComponents((s) =>
			s
				.addTextDisplayComponents((t) => t.setContent(text))
				.setButtonAccessory(
					new ButtonBuilder()
						.setCustomId(`crop-select-rates-${cropList.indexOf(crop)}`)
						.setEmoji(emoji)
						.setLabel('>')
						.setStyle(ButtonStyle.Secondary),
				),
		);

		compactContainer.addText(`${emoji} ${values}`);
	}

	let details = settings
		? `You can view your rates with your farming gear on the [website here](<https://elitebot.dev/@${interaction.user.id}/rates>)!`
		: `You can view your rates with your farming gear on the "**Rates**" tab of your [online stats](<https://elitebot.dev/>)!`;

	if (fortuneInput !== undefined) {
		details +=
			'\n\n**Custom Fortune Warning**\n-# The amount of fortune available varies depending on the crop. For the best results, only look at the crop your entered fortune is for.';
	}

	container.addSeperator();
	container.addText("**What's my fortune?**\n-# " + details);
	container.addFooter();

	compactContainer.addSeperator();
	compactContainer.addText("**What's my fortune?**\n-# " + details);
	compactContainer.addFooter();

	const reply = await interaction.editReply({
		components: [container, row],
		flags: [MessageFlags.IsComponentsV2],
	});

	const collector = reply.createMessageComponentCollector({
		time: 120_000,
	});

	let cropContainer: EliteContainer | undefined;

	collector.on('collect', async (inter) => {
		if (inter.user.id !== interaction.user.id) {
			return NotYoursReply(inter);
		}

		collector.resetTimer();

		if (cropContainer?.handleCollapsibleInteraction(inter)) {
			return inter.update({ components: [cropContainer, row] });
		}

		if (inter.customId == 'back') {
			await inter.update({
				components: [container, row],
				flags: [MessageFlags.IsComponentsV2],
			});
			cropContainer = undefined;
			return;
		}

		if (inter.customId !== 'crop-select-rates' && !inter.customId.startsWith('crop-select-rates-')) return;

		const selected = inter instanceof StringSelectMenuInteraction ? +inter.values[0] : +inter.customId.split('-')[3];
		const selectedCrop = cropList[selected] as Crop;

		const { crop, ...cropInfo } = formatted.find((c) => c.crop === selectedCrop) || formatted[selected];
		const coinSources = Object.entries(cropInfo.details.coinSources).sort((a, b) => b[1] - a[1]);
		const collections = Object.entries(cropInfo.details.otherCollection).sort((a, b) => b[1] - a[1]);
		const cropName = getCropDisplayName(crop as Crop);

		const cropDetails =
			`\nUsing **${reforge === 'bountiful' ? 'Bountiful' : 'Blessed'}**, ` +
			`**${pet === 'mooshroom' ? 'Mooshroom Cow' : 'Elephant'}**, ` +
			`and **4/4ths Fermento Armor**!`;

		const threeFourths = calculateAverageSpecialCrops(blocksBroken, crop as Crop, 3);
		const fromSpecial = cropInfo.details.coinSources[threeFourths.type] ?? 0;
		const specialDifference = fromSpecial - threeFourths.npc;
		const threeFourthsTotal = cropInfo.details.npcCoins - specialDifference;

		cropContainer = new EliteContainer(settings)
			.addTitle('## ' + cropName + ' Rates', false)
			.addDescription(
				`Expected rates for **${fortuneInput?.toLocaleString() ?? `${cropInfo.details.fortune.toLocaleString()} (MAX)`}** Farming Fortune in **${timeName}**!${cropDetails}\n${bpsText}`,
			)
			.addSeperator()
			.addCollapsible({
				header: '**NPC Profit**',
				collapsed: {
					text: '### :coin: ' + cropInfo.details.npcCoins.toLocaleString() || '0',
				},
				expanded: {
					text:
						coinSources
							.map(([source, amount]) => {
								return `- **${source}:** ${amount?.toLocaleString()}`;
							})
							.join('\n') +
						`\n### 3/4ths Fermento Armor\n:coin: ${threeFourthsTotal?.toLocaleString() ?? '0'} ⠀ ${(specialDifference).toLocaleString()} less coins (~${threeFourths.amount.toLocaleString()} ${threeFourths.type})`,
				},
			})
			.addSeperator()
			.addCollapsible({
				header: '**Bazaar Profit**',
				collapsed: {
					text: '### <:bz:1376714811894796328> ' + cropInfo.bz[0].total.toLocaleString() || '0',
				},
				expanded: {
					text:
						cropInfo.bz
							.map(({ name, items, profit, total }, i) => {
								return `${i === 0 ? ':star: ' : ''}**${name}:** ${total.toLocaleString()} \n-# **${Math.floor(items).toLocaleString()}** items for **${profit.toLocaleString()}** coins plus other items`;
							})
							.join('\n') +
						`\n\n-# Other items: **${Math.floor(cropInfo.bz[0].total - cropInfo.bz[0].profit).toLocaleString()}** coins to NPC`,
				},
			})
			.addSeperator()
			.addCollapsible({
				header: '**Collection Gain**',
				collapsed: {
					text: '### ' + GetCropEmoji(cropName) + ' ' + cropInfo.details.collection.toLocaleString(),
				},
				expanded: {
					text: collections
						.map(([source, amount]) => {
							return `- **${source}:** ${amount?.toLocaleString()}`;
						})
						.join('\n'),
				},
			})
			.addFooter(true, 'Back');

		inter.update({ components: [cropContainer, row] });
	});

	collector.on('end', async () => {
		if (cropContainer) {
			cropContainer.disableEverything();
			await interaction.editReply({ components: [cropContainer] });
		} else {
			interaction.editReply({ components: [compactContainer] }).catch(() => undefined);
		}
	});
}
