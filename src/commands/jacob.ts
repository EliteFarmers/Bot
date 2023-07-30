import { Command, CommandAccess, CommandType } from "../classes/Command.js";
import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ChatInputCommandInteraction, CommandInteraction, ComponentType, EmbedBuilder, SlashCommandBuilder, StringSelectMenuBuilder } from 'discord.js';
import { EliteEmbed, ErrorEmbed, WarningEmbed } from "../classes/embeds.js";
import { FetchAccount, FetchProfile } from "../api/elite.js";
import { GetReadableDate } from "../classes/SkyblockDate.js";
import { GetCropEmoji } from "../classes/Util.js";

const command: Command = {
	name: 'jacob',
	description: 'Get jacob\'s high scores or leaderboard!',
	access: CommandAccess.Everywhere,
	type: CommandType.Slash,
	slash: new SlashCommandBuilder()
		.setName('jacob')
		.setDescription('Get the jacob\'s stats of a player!')
		.addStringOption(option => option.setName('player')
			.setDescription('The player in question.')
			.setRequired(false))
		.addStringOption(option => option.setName('profile')
			.setDescription('Optionally specify a profile!')
			.setRequired(false)),
	execute: execute
}

export default command;

async function execute(interaction: ButtonInteraction | ChatInputCommandInteraction) {
	if (interaction instanceof CommandInteraction) {

		const args: JacobCMDArgs = {
			playerName: interaction.options.getString('player', false) ?? undefined,
			profileName: interaction.options.getString('profile', false) ?? undefined
		}

		return await commandExecute(interaction, args);
		
	} else return await commandExecute(interaction, { playerName: interaction.customId.split('|')[1] });
}

async function commandExecute(interaction: ChatInputCommandInteraction | ButtonInteraction, cmdArgs: JacobCMDArgs) {
	let { playerName, profileName } = cmdArgs;

	await interaction.deferReply();

	const { data: account } = await FetchAccount(playerName ?? interaction.user.id).catch(() => ({ data: undefined }));

	if (!account?.id || !account?.name) {
		const embed = WarningEmbed('Specify a Username!')
			.addFields({ name: 'Proper Usage:', value: '`/jacob` `player:`(player name)' })
			.setDescription('Checking for yourself?\nYou must use `/verify` `player:`(account name) before using this shortcut!')
		await interaction.deleteReply().catch(() => undefined);
		interaction.followUp({ embeds: [embed], ephemeral: true });
		return;
	}

	playerName = account.name;

	const profile = profileName 
		? account.profiles?.find(p => p?.profileName?.toLowerCase() === profileName?.toLowerCase())
		: account.profiles?.find(p => p.selected) ?? account.profiles?.[0];

	if (!profile?.profileId || !profile.profileName) {
		const embed = ErrorEmbed('Invalid Profile!')
			.setDescription(`Profile "${profileName}" does not exist.`)
			.addFields({ name: 'Proper Usage:', value: '`/jacob` `player:`(player name) `profile:`(profile name)' });
		await interaction.deleteReply().catch(() => undefined);
		interaction.followUp({ embeds: [embed], ephemeral: true });
		return;
	}

	profileName = profile.profileName;

	const member = await FetchProfile(account.id, profile.profileId).then(res => { return res.data; }).catch(() => undefined);

	if (!member || !member.jacob) {
		const embed = ErrorEmbed('Failed to Get Profile!')
			.setDescription('Please try again later. If this issue persists, contact kaeso.dev on discord.')
			.addFields({ name: 'Proper Usage:', value: '`/jacob` `player:`(player name) `profile:`(profile name)' })
			.addFields({ name: 'Want to view online?', value: `Please go to [elitebot.dev/@${playerName}/${profileName}](https://elitebot.dev/@${playerName}/${encodeURIComponent(profileName)})` });
		await interaction.deleteReply().catch(() => undefined);
		interaction.followUp({ embeds: [embed], ephemeral: true });
		return;
	}

	const jacob = member.jacob;
	const contests = jacob.contests ?? [];
	contests.sort((a, b) => (b?.timestamp ?? 0) - (a?.timestamp ?? 0));

	const { earnedMedals: earned, medals } = jacob;

	const partic = (jacob.participations && jacob.participations > 0 && jacob.contests && jacob.contests.length > 0)
		? `Out of **${jacob.participations?.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}** contests, **${account.name?.replace(/_/g, '\\_')}** has been 1st **${jacob.contests?.filter(c => c.position === 0).length.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}** times!`
		: `**${account.name?.replace(/_/g, '\\_')}** has participated in **${jacob.participations?.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}** contests!`;

	const embed = EliteEmbed()
		.setTitle(`Jacob's Stats for ${playerName.replace(/_/g, '\\_')}${profileName ? ` on ${profileName}` : ``}`)
		.setDescription(`🥇 ${medals?.gold} / **${earned?.gold}** 🥈 ${medals?.silver} / **${earned?.silver}** 🥉 ${medals?.bronze} / **${earned?.bronze}**\n${partic}\n⠀`)
		.addFields(contests.slice(0, 3).map((contest) => ({
			name: `${GetReadableDate(contest.timestamp ?? 0)}`,
			value: `${GetCropEmoji(contest.crop ?? '')} ${(contest?.crop ?? 'ERROR')} - **${contest.collected?.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}** [⧉](https://elitebot.dev/contest/${contest.timestamp})`,
		})));

	let page = 0;

	const args = {
		components: getComponents(page, playerName, profileName),
		embeds: [embed],
		allowedMentions: { repliedUser: false },
		fetchReply: true
	}

	let selectedCrop: string | undefined = undefined;

	const reply = await interaction.editReply(args);
	
	const collector = reply.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60_000 });

	collector.on('collect', async i => {
		if (i.user.id !== interaction.user.id) {
			i.reply({ content: `These buttons aren't for you!`, ephemeral: true });
			return;
		}

		collector.resetTimer({ time: 30_000 });

		if (i.customId === 'overall') {
			page = 0;

			i.update({ embeds: [embed], components: getComponents(page, playerName, profileName) })
				.catch(() => { collector.stop(); });
		} else if (i.customId === 'recents') {
			const recentsEmbed = await getRecents(undefined)
			if (!recentsEmbed) return;

			page = 1;

			const updated = await i.update({ embeds: [recentsEmbed], components: getComponents(page, playerName, profileName), fetchReply: true });
			
			const cropCollector = updated.createMessageComponentCollector({ 
				componentType: ComponentType.StringSelect, 
				time: 30_000 
			});

			cropCollector.on('collect', async inter => {
				if (inter.user.id !== interaction.user.id) {
					inter.reply({ content: `These buttons aren't for you!`, ephemeral: true });
					return;
				}

				collector.resetTimer({ time: 30_000 });
				cropCollector.resetTimer({ time: 30_000 });

				selectedCrop = inter.values[0];

				const crop = crops[parseInt(selectedCrop)];

				const cropsEmbed = await getRecents(crop.name);
				
				inter.update({ embeds: [cropsEmbed], components: getComponents(page, playerName, profileName) }).catch(() => undefined);
			});

			cropCollector.on('end', () => {
				collector.stop();
			});
		}
	});

	collector.on('end', () => {
		interaction.editReply({ components: [] }).catch(() => undefined);
	});

	async function getRecents(selectedCrop?: string) {		
		const entries = (selectedCrop) ? contests.filter(c => c.crop === selectedCrop) : contests;

		const newEmbed = new EmbedBuilder().setColor('#03fc7b')
			.setTitle(`Recent ${selectedCrop ? selectedCrop : 'Jacob\'s'} Contests for ${playerName?.replace(/_/g, '\\_')}${profileName ? ` on ${profileName}` : ``}`)
			.setDescription((entries.length !== 1 
				? `Showing the most recent **${Math.min(10, entries.length)}** / **${entries.length.toLocaleString()}** contests${selectedCrop ? ` for ${selectedCrop}` : ``}!`
				: `Showing the most recent contest${selectedCrop ? ` for ${selectedCrop}` : ``}!`
			));

		const contestAmount = entries.length;

		if (contestAmount === 0) {
			newEmbed.setDescription(`**${account?.name?.replace(/_/g, '\\_')}** hasn't participated in any contests!`);
			return newEmbed;
		}

		let added = 0;
		for (let i = 0; i < Math.min(10, contestAmount); i++) {
			const contest = entries[i];
			if (!contest) continue;

			const details = ((contest?.participants ?? 0) > 0 && contest.position !== undefined) 
				? `\`#${(contest.position + 1).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}\` of \`${contest.participants?.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}\` ${profileName ? ` on \`${profileName}\`` : ` players!`}` 
				: `${profileName ? `Unclaimed on \`${profileName}\`!` : `Contest Still Unclaimed!`}`;

			if (!contest.collected) continue;
			added++;

			newEmbed.addFields({
				name: `${GetReadableDate(contest.timestamp ?? 0)}`,
				value: `${GetCropEmoji(contest.crop ?? '')} ${(selectedCrop) ? 'Collected ' : `${contest?.crop ?? 'ERROR'} - `}**${contest.collected.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}** [⧉](https://elitebot.dev/contest/${contest.timestamp})\n` + details,
				inline: true
			});

			if (added % 2 == 1) {
				newEmbed.addFields({
					name: "⠀",
					value: "⠀",
					inline: true
				});
			}
		}

		return newEmbed;
	}
}

type JacobCMDArgs = {
	playerName?: string,
	profileName?: string
	ign?: string,
}

function getComponents(page: number, playerName?: string, profileName?: string) {
	const components = [new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder()
			.setCustomId('overall')
			.setLabel('Overall Stats')
			.setStyle(ButtonStyle.Success)
			.setDisabled(page === 0),
		new ButtonBuilder()
			.setCustomId('recents')
			.setLabel('Recent Contests')
			.setStyle(ButtonStyle.Primary)
			.setDisabled(page === 1),
		new ButtonBuilder()
			.setURL(`https://elitebot.dev/@${playerName}/${encodeURIComponent(profileName ?? '')}`)
			.setLabel(`@${playerName}/${profileName ?? ''}`)
			.setStyle(ButtonStyle.Link)
	)] as unknown[];

	if (page === 1) components.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents( 
		new StringSelectMenuBuilder()
			.setCustomId('select')
			.setPlaceholder('Filter by Crop!')
			.addOptions(crops.map((crop, i) => ({
				label: crop.name,
				value: i.toString(),
				emoji: crop.emoji,
			}))),
	));

	return components as ActionRowBuilder<ButtonBuilder>[];
}

const crops = [
	{
		name: 'Cactus',
		emoji: {
			id: '1096113963512639528',
			name: 'cactus',
		}
	},
	{
		name: 'Carrot',
		emoji: {
			id: '1096114031359701023',
			name: 'carrot',
		}
	},
	{
		name: 'Cocoa Beans',
		emoji: {
			id: '1096206396707581973',
			name: 'cocoa_beans',
		}
	},
	{
		name: 'Melon',
		emoji: {
			id: '1096108893735768094',
			name: 'melon',
		}
	},
	{
		name: 'Mushroom',
		emoji: {
			id: '1109927720546226276',
			name: 'mushrooms',
		}
	},
	{
		name: 'Nether Wart',
		emoji: {
			id: '1109927626899980429',
			name: 'wart',
		}
	},
	{
		name: 'Potato',
		emoji: {
			id: '1109928158003736626',
			name: 'potato',
		}
	},
	{
		name: 'Pumpkin',
		emoji: {
			id: '1096108959225610310',
			name: 'pumpkin',
		}
	},
	{
		name: 'Sugar Cane',
		emoji: {
			id: '1096107156023033897',
			name: 'sugarcane',
		}
	},
	{
		name: 'Wheat',
		emoji: {
			id: '1096108834663178350',
			name: 'wheat',
		}
	},
];