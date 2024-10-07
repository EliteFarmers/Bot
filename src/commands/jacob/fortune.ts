import { EliteCommand } from 'classes/commands/command.js';
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	ChatInputCommandInteraction,
	ComponentType,
	EmbedBuilder,
	SlashCommandSubcommandBuilder,
} from 'discord.js';
import { getCropFromName, getFortuneRequiredForCollection } from 'farming-weight';
import type { components } from '../../api/api.js';
import { FetchCurrentMonthlyBrackets, UserSettings } from '../../api/elite.js';
import { GetCropEmoji } from '../../classes/Util.js';
import { EliteEmbed, ErrorEmbed, NotYoursEmbed, PrefixFooter } from '../../classes/embeds.js';

const command = new EliteCommand({
	name: 'fortune',
	description: 'Get the farming fortune required for Jacob Contests!',
	slash: new SlashCommandSubcommandBuilder()
		.setName('fortune')
		.setDescription('Get the farming fortune required for Jacob Contests!')
		.addNumberOption((option) =>
			option
				.setName('bps')
				.setDescription('Your blocks broken per second! (10-20)')
				.setMinValue(10)
				.setMaxValue(20)
				.setRequired(false),
		)
		.addBooleanOption((option) =>
			option.setName('dicer').setDescription('Include tier 3 dicer crops in the calculation?').setRequired(false),
		)
		.addBooleanOption((option) =>
			option.setName('mooshroom').setDescription('Include mooshroom mushrooms in the calculation?').setRequired(false),
		),
	execute: execute,
});

export default command;

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
			`Requirements are averaged using contests from <t:${+(brackets?.start ?? 0)}:R> until now.\nUsing an efficiency of **${bps} BPS** (${(ratio * 100).toFixed(1)}%)`,
		);

	PrefixFooter(
		embed,
		`Dicer RNG drops ${useDicers ? 'included' : 'not included'} • Mooshroom Cow mushrooms ${useMooshroom ? 'included' : 'not included'}`,
	);

	const lessButton = new ButtonBuilder().setCustomId('less').setLabel('Include Less').setStyle(ButtonStyle.Secondary);

	const moreButton = new ButtonBuilder().setCustomId('more').setLabel('Include More').setStyle(ButtonStyle.Secondary);

	const silverRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder().setCustomId('lower').setLabel('Silver / Bronze').setStyle(ButtonStyle.Primary),
		lessButton,
		moreButton,
	);

	const diamondRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder().setCustomId('higher').setLabel('Diamond / Platinum / Gold').setStyle(ButtonStyle.Primary),
		lessButton,
		moreButton,
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
			`Required collection is averaged using contests from <t:${+(brackets?.start ?? 0)}:R> until now.\nUsing an efficiency of **${bps} BPS** (${(ratio * 100).toFixed(1)}%)`,
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

const fortuneEmoji = '<:fortune:1180353749076693092>';

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
