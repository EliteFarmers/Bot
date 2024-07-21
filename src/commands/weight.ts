import { ChatInputCommandInteraction, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, EmbedBuilder, ColorResolvable } from 'discord.js';
import { Command, CommandAccess, CommandType } from '../classes/Command.js';
import { FetchAccount, FetchLeaderboardRankings, FetchProfile, UserSettings } from '../api/elite.js';
import { EliteEmbed, EmptyField, EmptyString, ErrorEmbed, WarningEmbed } from '../classes/embeds.js';
import { GetCropEmoji, LEVELING_XP } from '../classes/Util.js';
import playerAutocomplete from '../autocomplete/player.js';
import { getCustomFormatter } from '../weight/custom.js';
import { getCropFromName, getLevel } from 'farming-weight';

const command: Command = {
	name: 'weight',
	description: 'Calculate a players farming weight',
	usage: '(username) (profile name)',
	access: CommandAccess.Everywhere,
	type: CommandType.Slash,
	slash: new SlashCommandBuilder()
		.setName('weight')
		.setDescription('Get a players farming weight!')
		.addStringOption(option => option.setName('player')
			.setDescription('The player in question.')
			.setAutocomplete(true)
			.setRequired(false))
		.addStringOption(option => option.setName('profile')
			.setDescription('Optionally specify a profile!')
			.setRequired(false)),
	execute: execute,
	autocomplete: playerAutocomplete
}

export default command;

async function execute(interaction: ChatInputCommandInteraction, settings?: UserSettings) {
	let playerName = interaction.options.getString('player', false)?.trim();
	const _profileName = interaction.options.getString('profile', false)?.trim();

	await interaction.deferReply();

	const { data: account } = await FetchAccount(playerName ?? interaction.user.id).catch(() => ({ data: undefined }));

	if (!account?.id || !account?.name) {
		const embed = WarningEmbed('Invalid Username!')
			.addFields({ name: 'Proper Usage:', value: '`/weight` `player:`(player name)\nOr link your account with </verify:1135100641560248334> first!' });

		if (playerName) {
			embed.setDescription(`Player \`${playerName}\` does not exist (or an error occured)`);
		} else {
			embed.setDescription('You need to link your account or enter a playername!');
		}

		await interaction.deleteReply().catch(() => undefined);
		interaction.followUp({ embeds: [embed], ephemeral: true });
		return;
	}

	playerName = account.name;

	const profile = _profileName 
		? account.profiles?.find(p => p?.profileName?.toLowerCase() === _profileName.toLowerCase())
		: account.profiles?.find(p => p.selected) ?? account.profiles?.[0];

	if (!profile?.profileId || !profile.profileName) {
		const embed = ErrorEmbed('Invalid Profile!')
			.setDescription(`Profile "${_profileName}" does not exist.`)
			.addFields({ name: 'Proper Usage:', value: '`/weight` `player:`(player name) `profile:`(profile name)' });
		await interaction.deleteReply().catch(() => undefined);
		interaction.followUp({ embeds: [embed], ephemeral: true });
		return;
	}

	const { data: member } = await FetchProfile(account.id, profile.profileId).catch(() => ({ data: undefined }));
	const profileWeight = member?.farmingWeight;

	if (!member || !profileWeight) {
		const embed = ErrorEmbed('Couldn\'t fetch data!')
			.setDescription(`Something went wrong when getting data for "${playerName}".`)
			.setFooter({ text: 'Contact kaeso.dev if this continues to happen' });
		await interaction.deleteReply().catch(() => undefined);
		interaction.followUp({ embeds: [embed], ephemeral: true });
		return;
	}

	const totalWeight = profileWeight?.totalWeight ?? 0;

	if (totalWeight === 0) {
		const embed = WarningEmbed(`Stats for ${playerName.replace(/_/g, '\\_')}`)
			.addFields({ 
				name: 'Farming Weight', 
				value: 'No farming weight!\nIf this is wrong, turn on collections API access and help make Skyblock a more transparent place!' 
			})
			.setThumbnail(`https://mc-heads.net/head/${account.id}/left`);

		interaction.editReply({ embeds: [embed] });
		return;
	}

	const { data: rankings } = await FetchLeaderboardRankings(account.id, profile.profileId).catch(() => ({ data: undefined }));
	const weightRank = rankings?.misc?.farmingweight ?? -1;

	const badge = account.badges?.filter(b => b?.visible).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))[0];
	const badgeId = badge?.imageId ? `https://cdn.elitebot.dev/u/${badge.imageId}.png` : '';

	// Apply override if set
	const style = settings?.features?.weightStyleOverride
		? settings.features?.weightStyle ?? undefined
		: undefined;

	const custom = await getCustomFormatter({ 
		settings,
		account, 
		profile: profileWeight,
		profileId: profile.profileId,
		weightRank: weightRank,
		badgeUrl: badgeId
	}, style);

	if (!custom) {
		const embed = ErrorEmbed('Something went wrong!')
			.setDescription('Failed to generated weight image/response.');
		interaction.followUp({ embeds: [embed], ephemeral: true });
		return;
	}

	const isEmbed = custom instanceof EmbedBuilder;

	let moreInfo = undefined;
	if (settings?.features?.moreInfoDefault) {
		moreInfo = moreInfoEmbed();
	}

	const row = new ActionRowBuilder<ButtonBuilder>();
	
	if (!moreInfo) {
		row.addComponents(
			new ButtonBuilder()
				.setCustomId('moreInfo')
				.setLabel('More Info')
				.setStyle(ButtonStyle.Success)
		);
	}

	row.addComponents(
		new ButtonBuilder()
			.setLabel(`@${account.name}/${profile.profileName}`)
			.setURL(`https://elitebot.dev/@${account.name}/${encodeURIComponent(profile.profileName)}`)
			.setStyle(ButtonStyle.Link)
	);

	const payload = isEmbed 
		? (moreInfo ? { embeds: [custom, moreInfo] } : { embeds: [custom] }) 
		: (moreInfo ? { files: [custom], embeds: [moreInfo] } : { files: [custom] });

	const reply = await interaction.editReply({ 
		components: [row], 
		allowedMentions: { repliedUser: false }, 
		...payload 
	}).catch(() => {
		const embed = ErrorEmbed('Something went wrong!')
			.setDescription(`Weight image couldn't be sent in this channel. There is likely something wrong with the channel permissions.`);
		interaction.followUp({ embeds: [embed], ephemeral: true });
		return;
	});

	if (!reply || moreInfo) return;

	const filter = (i: { customId: string }) => i.customId === 'moreInfo';
	const collector = reply.createMessageComponentCollector({ filter, time: 60000, componentType: ComponentType.Button });

	collector.on('collect', async i => {
		if (i.user.id !== interaction.user.id) {
			await i.reply({ content: 'This button is not for you!', ephemeral: true });
			return;
		}

		const embed = await moreInfoEmbed();

		await i.update({ 
			embeds: isEmbed ? [custom, embed] : [embed], 
			components: [] 
		}).catch(() => undefined);
		collector.stop('done');
	});

	collector.on('end', async (_, reason) => {
		if (reason === 'done') return;
		
		const linkRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder()
				.setLabel(`@${account.name}/${profile.profileName}`)
				.setURL(`https://elitebot.dev/@${account.name}/${encodeURIComponent(profile.profileName ?? '')}`)
				.setStyle(ButtonStyle.Link)
		);
		await reply.edit({ components: [linkRow] }).catch(() => undefined);
	});

	function moreInfoEmbed() {
		const crops = Object.entries(profileWeight?.cropWeight ?? {})
			.filter(([,a]) => a && a >= 0.001)
			.sort(([,a], [,b]) => ((b ?? 0) - (a ?? 0)));

		const embed = EliteEmbed(settings)

		if (!settings?.features?.weightStyleOverride && account?.settings?.features?.embedColor) {
			embed.setColor(('#' + account?.settings?.features?.embedColor) as ColorResolvable);
		}

		if (!isEmbed) {
			embed.setTitle(`Stats for ${playerName?.replace(/_/g, '\\_')} on ${profile?.profileName}`);
		} else if (custom.data.color) {
			embed.setColor(custom.data.color);
		}

		const weightRankText = weightRank > -1
			? `[#${weightRank}](https://elitebot.dev/leaderboard/farmingweight/${account?.id}-${profile?.profileId}) • `
			: '';

		const farmingRank = rankings?.skills?.farming ?? -1;
		const farmingLevel = getLevel(member?.skills?.farming ?? 0, LEVELING_XP, 50 + (member?.jacob.perks?.levelCap ?? 0));		
		const farmingRankText = farmingRank > -1 
			? `[#${farmingRank}](https://elitebot.dev/leaderboard/farming/${account?.id}-${profile?.profileId}) • ` 
			: ''; 

		embed.addFields({ 
			name: 'Farming Weight', 
			value: `-# ${weightRankText}${totalWeight.toLocaleString()} Total Weight`,
			inline: true
		}, EmptyField(), {
			name: `Farming Level • ${farmingLevel.level}`,
			value: `-# ${farmingRankText}${farmingLevel.total.toLocaleString()} Total XP`,
			inline: true
		});

		const cropRanks = Object.entries(rankings?.collections ?? {})
			.map(([key, value]) => ({
				crop: getCropFromName(key),
				key, 
				rank: value ?? -1 
			}))

		const formattedCrops = crops.map(([key, value]) => {
			const crop = getCropFromName(key);
			if (!crop) return '';

			const collection = member?.collections?.[crop];
			const percent = Math.round((value ?? 0) / totalWeight * 1000) / 10;

			const { rank = -1, key: lb } = cropRanks.find(c => c.crop === crop) ?? {};
			const rankString = rank > -1 
				? `[#${rank}](https://elitebot.dev/leaderboard/${lb}/${account?.id}-${profile?.profileId}) • ` : '';

			return `${GetCropEmoji(key)} **${(+(value?.toFixed(2) ?? 0))?.toLocaleString() ?? 0}** ⠀${percent > 2 ? `${percent}%` : ''}`
					+ `${collection ? `\n-# ${rankString}${collection.toLocaleString()} ${key}` : ''}`;
		});
		
		const cropWeight = +crops.reduce((acc, [, value]) => acc + (value ?? 0), 0).toFixed(2);

		embed.addFields({
			inline: true,
			name: `Crop Weight • ${cropWeight.toLocaleString()}`, 
			value: formattedCrops.slice(0, 5).join('\n') || 'No crop weight!'
		}, EmptyField());
		
		if (formattedCrops.length > 5) {
			embed.addFields({
				inline: true,
				name: EmptyString,
				value: formattedCrops.slice(5).join('\n')
			});
		}

		const bonusWeight = Object.values(profileWeight?.bonusWeight ?? {})
			.reduce((acc, value) => (acc ?? 0) + (value ?? 0), 0) ?? 0;

		embed.addFields({
			name: 'Bonus Weight • ' + bonusWeight.toLocaleString(),
			value: Object.entries(profileWeight?.bonusWeight ?? {}).map(([key, value]) => {
				return `${key} • **${value?.toLocaleString() ?? 0}**`;
			}).join('\n') || 'No bonus weight!',
		}, {
			name: '⠀',
			value: `[Questions?](https://elitebot.dev/info)⠀ ⠀[@${account?.name}/${profile?.profileName}](https://elitebot.dev/@${account?.name}/${encodeURIComponent(profile?.profileName ?? '')})⠀ ⠀[SkyCrypt](https://sky.shiiyu.moe/stats/${account?.name}/${encodeURIComponent(profile?.profileName ?? '')})`
		});

		return embed;
	}
}
