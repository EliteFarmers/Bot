import { ChatInputCommandInteraction, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, EmbedBuilder } from 'discord.js';
import { Command, CommandAccess, CommandType } from '../classes/Command.js';
import { FetchAccount, FetchWeight, FetchWeightLeaderboardRank } from '../api/elite.js';
import { EliteEmbed, ErrorEmbed, WarningEmbed } from '../classes/embeds.js';
import { GetCropEmoji } from '../classes/Util.js';
import playerAutocomplete from '../autocomplete/player.js';
import { getCustomFormatter } from '../weight/custom.js';

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

async function execute(interaction: ChatInputCommandInteraction) {
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

	const { data: weight } = await FetchWeight(account.id).catch(() => ({ data: undefined }));
	const profileWeight = weight?.profiles?.find(p => p?.profileId === profile.profileId);

	if (!weight || !profileWeight) {
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

	const { data: ranking } = await FetchWeightLeaderboardRank(account.id, profile.profileId).catch(() => ({ data: undefined }));
	const rank = ranking?.rank ?? -1;

	const badge = account.badges?.filter(b => b?.visible).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))[0];
	const badgeId = badge?.imageId ? `https://cdn.elitebot.dev/u/${badge.imageId}.png` : '';

	const custom = await getCustomFormatter({ 
		account, 
		profile: profileWeight,
		profileId: profile.profileId,
		weightRank: rank,
		badgeUrl: badgeId
	});

	if (!custom) {
		const embed = ErrorEmbed('Something went wrong!')
			.setDescription('Failed to generated weight image/response.');
		interaction.followUp({ embeds: [embed], ephemeral: true });
		return;
	}

	const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder()
			.setCustomId('moreInfo')
			.setLabel('More Info')
			.setStyle(ButtonStyle.Success),
		new ButtonBuilder()
			.setLabel(`@${account.name}/${profile.profileName}`)
			.setURL(`https://elitebot.dev/@${account.name}/${encodeURIComponent(profile.profileName)}`)
			.setStyle(ButtonStyle.Link)
	);

	const isEmbed = custom instanceof EmbedBuilder;
	const payload = isEmbed ? { embeds: [custom] } : { files: [custom] };

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

	if (!reply) return;

	const filter = (i: { customId: string }) => i.customId === 'moreInfo';
	const collector = reply.createMessageComponentCollector({ filter, time: 60000, componentType: ComponentType.Button });

	collector.on('collect', async i => {
		if (i.user.id !== interaction.user.id) {
			await i.reply({ content: 'This button is not for you!', ephemeral: true });
			return;
		}

		const crops = Object.entries(profileWeight.cropWeight ?? {})
			.filter(([,a]) => a && a >= 0.001)
			.sort(([,a], [,b]) => ((b ?? 0) - (a ?? 0)));

		const embed = EliteEmbed()

		if (!isEmbed) {
			embed.setTitle(`Stats for ${playerName?.replace(/_/g, '\\_')} on ${profile.profileName}`);
			embed.addFields({ 
				name: 'Farming Weight', 
				value: totalWeight.toLocaleString()
			});
		} else if (custom.data.color) {
			embed.setColor(custom.data.color);
		}
		
		embed.addFields({
			inline: true,
			name: 'Breakdown', 
			value: crops.map(([key, value]) => {
				const percent = Math.round((value ?? 0) / totalWeight * 1000) / 10;
				return `${GetCropEmoji(key)} ${value?.toLocaleString() ?? 0} ⠀${percent > 2 ? `[${percent}%]` : ''}`;
			}).join('\n') || 'No notable collections!',
		}, {
			inline: true,
			name: '⠀',
			value: '⠀'
		}, {
			inline: true,
			name: 'Bonus',
			value: Object.entries(profileWeight.bonusWeight ?? {}).map(([key, value]) => {
				return `${key} - ${value?.toLocaleString() ?? 0}`;
			}).join('\n') || 'No bonus weight!',
		}, {
			name: '⠀',
			value: `[Questions?](https://elitebot.dev/info)⠀ ⠀[@${account.name}/${profile.profileName}](https://elitebot.dev/@${account.name}/${encodeURIComponent(profile.profileName ?? '')})⠀ ⠀[SkyCrypt](https://sky.shiiyu.moe/stats/${account.name}/${encodeURIComponent(profile.profileName ?? '')})`
		});

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
}
