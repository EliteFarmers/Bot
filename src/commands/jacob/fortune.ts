import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	ChatInputCommandInteraction,
	ComponentType,
	EmbedBuilder,
} from 'discord.js';
import { getCropFromName, getFortuneRequiredForCollection } from 'farming-weight';
import type { components } from '../../api/api.js';
import { FetchCurrentMonthlyBrackets, UserSettings } from '../../api/elite.js';
import { GetCropEmoji } from '../../classes/Util.js';
import { CommandAccess, CommandType, EliteCommand, SlashCommandOptionType } from '../../classes/commands/index.js';
import { EliteEmbed, EmptyString, ErrorEmbed, NotYoursEmbed, PrefixFooter } from '../../classes/embeds.js';

const command = new EliteCommand({
	name: 'fortune',
	description: 'Get the farming fortune required for Jacob Contests!',
	type: CommandType.Slash,
	access: CommandAccess.Everywhere,
	subCommand: true,
	options: {
		bps: {
			name: 'bps',
			description: 'Your blocks broken per second! (10-20)',
			type: SlashCommandOptionType.Number,
			builder: (b) => b.setMinValue(10).setMaxValue(20),
		},
		dicer: {
			name: 'dicer',
			description: 'Include tier 3 dicer crops in the calculation?',
			type: SlashCommandOptionType.Boolean,
			required: false,
		},
		mooshroom: {
			name: 'mooshroom',
			description: 'Include mooshroom mushrooms in the calculation?',
			type: SlashCommandOptionType.Boolean,
		},
	},
	execute: execute,
});

export default command;

const fortuneEmoji = '<:fortune:1313282552060055635>';

async function execute(interaction: ChatInputCommandInteraction, settings?: UserSettings) {
	const useDicers = interaction.options.getBoolean('dicer', false) ?? true;
	const useMooshroom = interaction.options.getBoolean('mooshroom', false) ?? true;

	const bpsValue = interaction.options.getNumber('bps', false) ?? undefined;
	const bps = bpsValue ?? 20;
	const ratio = bps / 20;

	const blocksBroken = Math.round(24_000 * ratio);

	const monthsParam = [1, 4, 8, 12];
	let monthsIndex = 1;

	let { data: brackets } = await FetchCurrentMonthlyBrackets(monthsParam[monthsIndex]).catch(() => ({
		data: undefined,
	}));

	if (brackets === undefined) {
		const embed = ErrorEmbed('Failed to fetch brackets! Please try again later.');
		await interaction
			.reply({
				embeds: [embed],
				allowedMentions: { repliedUser: false },
				ephemeral: true,
			})
			.catch(() => undefined);
		return;
	}

	const embed = EliteEmbed(settings)
		.setTitle('Jacob Contest Fortune Requirements')
		.setDescription(
			`Requirements are averaged using contests from **<t:${+(brackets?.start ?? 0)}:R>** until now.\nUsing an efficiency of **${bps} BPS** (${(ratio * 100).toFixed(1)}%)`,
		);

	PrefixFooter(
		embed,
		`Dicer RNG drops ${useDicers ? 'included' : 'not included'} • Mooshroom Cow mushrooms ${useMooshroom ? 'included' : 'not included'}`,
	);

	const lessButton = new ButtonBuilder().setCustomId('less').setLabel('Decrease Range').setStyle(ButtonStyle.Secondary);

	const moreButton = new ButtonBuilder().setCustomId('more').setLabel('Increase Range').setStyle(ButtonStyle.Secondary);

	const helpButton = new ButtonBuilder().setCustomId('help').setLabel('Help').setStyle(ButtonStyle.Secondary);

	const silverRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder().setCustomId('lower').setLabel('Silver / Bronze').setStyle(ButtonStyle.Primary),
		lessButton,
		moreButton,
		helpButton,
	);

	const diamondRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder().setCustomId('higher').setLabel('Diamond / Platinum / Gold').setStyle(ButtonStyle.Primary),
		lessButton,
		moreButton,
		helpButton,
	);

	const reply = await interaction
		.reply({
			embeds: [higherEmbed(embed, brackets, blocksBroken, useDicers, useMooshroom)],
			components: [silverRow],
		})
		.catch(() => undefined);

	const collector = reply?.createMessageComponentCollector({
		componentType: ComponentType.Button,
		time: 60_000,
	});

	if (!collector) return;

	collector.on('collect', async (button) => {
		if (button.customId === 'help') {
			const helpEmbed = EliteEmbed(settings)
				.setTitle('Help Menu')
				.setDescription(
					'This command shows you the estimated farming fortune required to get each medal in Jacob contests!' +
						' Data is obtained from participations saved in [elitebot.dev/contests](https://elitebot.dev/contests)' +
						' which will not be 100% accurate, but should give you a good idea of what to aim for.\n' +
						EmptyString,
				)
				.setFields(
					{
						name: 'What do the buttons do?',
						value: [
							'**Decrease Range** and **Increase Range** will change the time range used to calculate the averages, which may be more or less accurate.',
							'**Silver / Bronze** and **Diamond / Platinum / Gold** will show you the requirements for each bracket.',
							'**Help** will show you this message again.\n' + EmptyString,
						].join('\n'),
					},
					{
						name: 'What do the command options do?',
						value: [
							'`bps` is the blocks broken per second you want to use for the calculations.' +
								' __A common mistake is to use 20 BPS when you are not actually breaking that many blocks.__',
							'`dicer` will include or exclude tier 3 dicer crops from the calculations.',
							'`mooshroom` will include or exclude mooshroom eater mushrooms from the calculations.\n' + EmptyString,
						].join('\n'),
					},
					{
						name: 'How do I read the results?',
						value: [
							"Here's an example result: ",
							`**Diamond Bracket**`,
							`${GetCropEmoji('Wheat')} \`  472,132\` ${fortuneEmoji} \` 1,868\``,
							'1. **Diamond Bracket** - The bracket the results under it are for.',
							`2. ${GetCropEmoji('Wheat')} - The crop you're reading the results for (Wheat in this case).`,
							'3. `472,132` - The calculated average collection required to get the medal.',
							'4. `1,868` - The estimated fortune required to get that collection.',
							'',
							'If the fortune required is zero, you can get the medal by farming for the whole contest without any fortune.' +
								' Keep in mind that these brackets are averages and the actual requirements may vary.',
						].join('\n'),
					},
				);

			await button.reply({ embeds: [helpEmbed], ephemeral: true }).catch(() => undefined);
			return;
		}

		if (button.user.id !== interaction.user.id) {
			await button.reply({ embeds: [NotYoursEmbed()], ephemeral: true }).catch(() => undefined);
			return;
		}

		if (button.customId === 'higher') {
			await button
				.update({
					embeds: [higherEmbed(embed, brackets, blocksBroken, useDicers, useMooshroom)],
					components: [silverRow],
				})
				.catch(() => undefined);
			return;
		}

		if (button.customId === 'lower') {
			await button
				.update({
					embeds: [lowerEmbed(embed, brackets, blocksBroken, useDicers, useMooshroom)],
					components: [diamondRow],
				})
				.catch(() => undefined);
			return;
		}

		if (button.customId === 'less') {
			if (monthsIndex === 0) return;
			monthsIndex--;
		}

		if (button.customId === 'more') {
			if (monthsIndex === monthsParam.length - 1) return;
			monthsIndex++;
		}

		lessButton.setDisabled(monthsIndex === 0);
		moreButton.setDisabled(monthsIndex === monthsParam.length - 1);

		const data = await FetchCurrentMonthlyBrackets(monthsParam[monthsIndex]).catch(() => ({ data: undefined }));

		if (data?.data === undefined) {
			const embed = ErrorEmbed('Failed to fetch brackets! Please try again later.');
			await button
				.reply({
					embeds: [embed],
					allowedMentions: { repliedUser: false },
					ephemeral: true,
				})
				.catch(() => undefined);
			return;
		}

		brackets = data.data;
		embed.setDescription(
			`Required collection is averaged using contests from **<t:${+(brackets?.start ?? 0)}:R>** until now.\nUsing an efficiency of **${bps} BPS** (${(ratio * 100).toFixed(1)}%)`,
		);

		await button
			.update({
				embeds: [higherEmbed(embed, brackets, blocksBroken, useDicers, useMooshroom)],
				components: [silverRow],
			})
			.catch(() => undefined);
	});

	collector.on('end', async (_, reason) => {
		if (reason === 'time') {
			await reply?.edit({ embeds: [embed], components: [] }).catch(() => undefined);
		}
	});
}

function higherEmbed(
	embed: EmbedBuilder,
	brackets: components['schemas']['ContestBracketsDetailsDto'] | undefined,
	blocksBroken: number,
	useDicers = true,
	useMooshroom = true,
) {
	embed.setFields([
		makeField(brackets, 'Diamond', blocksBroken, useDicers, useMooshroom),
		makeField(brackets, 'Platinum', blocksBroken, useDicers, useMooshroom),
		makeField(brackets, 'Gold', blocksBroken, useDicers, useMooshroom),
	]);

	return embed;
}

function lowerEmbed(
	embed: EmbedBuilder,
	brackets: components['schemas']['ContestBracketsDetailsDto'] | undefined,
	blocksBroken: number,
	useDicers = true,
	useMooshroom = true,
) {
	embed.setFields([
		makeField(brackets, 'Silver', blocksBroken, useDicers, useMooshroom),
		makeField(brackets, 'Bronze', blocksBroken, useDicers, useMooshroom),
		{
			name: 'Confused by Zeroes?',
			value: 'Even with no fortune, you can still get these medals by farming for the whole contest!',
			inline: true,
		},
	]);

	return embed;
}

function makeField(
	data: components['schemas']['ContestBracketsDetailsDto'] | undefined,
	bracket: string,
	blocksBroken: number,
	useDicers = true,
	useMooshroom = true,
) {
	const reqs = Object.entries(data?.brackets ?? {})
		.map(([cropName, medals = {}]) => {
			return {
				cropName,
				collection: medals[bracket.toLowerCase() as keyof typeof medals] ?? 0,
			};
		})
		.sort((a, b) => a.cropName.localeCompare(b.cropName));

	const cropNames = reqs
		.map(({ cropName, collection }) => {
			const crop = getCropFromName(cropName);
			if (!crop) return '';

			const fortune = Math.max(
				getFortuneRequiredForCollection({
					crop,
					collection,
					blocksBroken,
					useDicers,
					useMooshroom,
				}),
				0,
			);

			let collect = collection.toLocaleString();
			if (collect.length < 9) collect = collect.padStart(9, ' ');
			let fort = fortune.toLocaleString();
			if (fort.length < 9) fort = fort.padStart(9, ' ');

			const emote = GetCropEmoji(cropName);
			if (emote === '') return '';

			return `${GetCropEmoji(cropName)} \`${collection.toLocaleString().padStart(9, ' ')}\` ${fortuneEmoji} \`${fortune.toLocaleString().padStart(5, ' ')}\``;
		})
		.filter((a) => a !== '');

	return {
		name: bracket + ' Bracket',
		value: cropNames.join('\n'),
		inline: true,
	};
}
