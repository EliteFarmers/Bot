import { EliteEmbed, ErrorEmbed, PrefixFooter } from '../../classes/embeds.js';
import { CommandAccess, CommandType, SubCommand } from '../../classes/Command.js';
import { ChatInputCommandInteraction, SlashCommandSubcommandBuilder } from 'discord.js';
import { FetchCurrentMonthlyBrackets } from '../../api/elite.js';
import { GetCropEmoji } from '../../classes/Util.js';
import { CropFromName, GetFortuneRequiredForCollection } from 'farming-weight';
import type { components } from '../../api/api.js';

const command: SubCommand = {
	name: 'fortune',
	description: 'Get the farming fortune required for Jacob Contests!',
	access: CommandAccess.Everywhere,
	type: CommandType.Slash,
	slash: new SlashCommandSubcommandBuilder()
		.setName('fortune')
		.setDescription('Get the farming fortune required for Jacob Contests!')
		.addNumberOption(option => 
			option.setName('bps')
				.setDescription('Your blocks broken per second! (10-20)')
				.setMinValue(10)
				.setMaxValue(20)
				.setRequired(false))
		.addBooleanOption(option =>
			option.setName('dicer')
				.setDescription('Include tier 3 dicer crops in the calculation?')
				.setRequired(false))
		.addBooleanOption(option =>
			option.setName('mooshroom')
				.setDescription('Include mooshroom mushrooms in the calculation?')
				.setRequired(false)),
	execute: execute
}

export default command;

async function execute(interaction: ChatInputCommandInteraction) {
	const useDicers = interaction.options.getBoolean('dicer', false) ?? true;
	const useMooshroom = interaction.options.getBoolean('mooshroom', false) ?? true;

	const bpsValue = interaction.options.getNumber('bps', false) ?? undefined;
	const bps = bpsValue ?? 20;
	const ratio = bps / 20;

	const blocksBroken = Math.round(24_000 * ratio);

	const { data: brackets } = await FetchCurrentMonthlyBrackets(3).catch(() => ({ data: undefined }));

	if (!brackets) {
		const embed = ErrorEmbed('Failed to fetch brackets! Please try again later.');
		await interaction.reply({
			embeds: [embed],
			allowedMentions: { repliedUser: false },
			ephemeral: true
		}).catch(() => undefined);
		return;
	}

	const embed = EliteEmbed()
		.setTitle('Jacob Contest Fortune Requirements')
		.setDescription(`Required collection is averaged using contests from <t:${+(brackets?.start ?? 0)}:R> until now.\nUsing an efficiency of **${bps} BPS** (${(ratio * 100).toFixed(1)}%)`)
		.addFields([
			makeField(brackets, 'Diamond', blocksBroken, useDicers, useMooshroom),
			makeField(brackets, 'Platinum', blocksBroken, useDicers, useMooshroom),
			makeField(brackets, 'Gold', blocksBroken, useDicers, useMooshroom),
		]);

	let footer = '';

	if (useDicers) footer += 'Dicer RNG drops included';
	if (useDicers && useMooshroom) footer += ' • ';
	if (useMooshroom) footer += 'Mooshroom Cow mushrooms included';

	if (footer) PrefixFooter(embed, footer);

	await interaction.reply({
		embeds: [embed],
		allowedMentions: { repliedUser: false }
	}).catch(() => console.log);
}

const fortuneEmoji = '<:fortune:1180353749076693092>';

function makeField(data: components['schemas']['ContestBracketsDetailsDto'], bracket: string, blocksBroken: number, useDicers = true, useMooshroom = true) {

	const reqs = Object.entries(data.brackets ?? {}).map(([ cropName, medals ]) => {
		return { 
			cropName, 
			collection: medals[bracket.toLowerCase() as keyof typeof medals] ?? 0,
		};	
	}).sort((a, b) => a.cropName.localeCompare(b.cropName));

	const cropNames = reqs.map(({ cropName, collection }) => {
		const crop = CropFromName(cropName);
		if (!crop) return '';

		const fortune = GetFortuneRequiredForCollection({
			crop, 
			collection, 
			blocksBroken, 
			useDicers,
			useMooshroom,
		});

		let collect = collection.toLocaleString();
		if (collect.length < 9) collect = collect.padStart(9, ' ');
		let fort = fortune.toLocaleString();
		if (fort.length < 9) fort = fort.padStart(9, ' ');

		return `${GetCropEmoji(cropName)} \`${collection.toLocaleString().padStart(9, ' ')}\` ${fortuneEmoji} \`${fortune.toLocaleString().padStart(5, ' ')}\``;
	});

	return {
		name: bracket + ' Bracket',
		value: cropNames.join('\n'),
		inline: true,
	}
}