import { ChatInputCommandInteraction, AttachmentBuilder, SlashCommandBuilder } from 'discord.js';
import { Command, CommandAccess, CommandType } from '../classes/Command';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { FetchAccount, FetchWeight, FetchWeightLeaderboardRank } from '../api/elite';
import { ErrorEmbed, WarningEmbed } from 'classes/embeds';
import { components } from 'api/api';

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
			.setRequired(false))
		.addStringOption(option => option.setName('profile')
			.setDescription('Optionally specify a profile!')
			.setRequired(false)),
	execute: execute
}

export default command;

async function execute(interaction: ChatInputCommandInteraction) {
	let playerName = interaction.options.getString('player', false)?.trim();
	const _profileName = interaction.options.getString('profile', false)?.trim();

	await interaction.deferReply();

	const { data: account } = await FetchAccount(playerName ?? interaction.user.id).catch(() => ({ data: undefined }));

	if (!account?.id || !account?.name) {
		const embed = WarningEmbed('Specify a Username!')
			.addFields({ name: 'Proper Usage:', value: '`/weight` `player:`(player name)' })
			.setDescription('Checking for yourself?\nYou must use `/verify` `player:`(account name) before using this shortcut!')
		interaction.deleteReply().catch(() => undefined);
		interaction.followUp({ embeds: [embed], ephemeral: true });
		return;
	}

	playerName ??= account.name;

	const profile = _profileName 
		? account.profiles?.find(p => p?.profileName?.toLowerCase() === _profileName.toLowerCase())
		: account.profiles?.find(p => p.selected) ?? account.profiles?.[0];

	if (!profile?.profileId || !profile.profileName) {
		const embed = ErrorEmbed('Invalid Profile!')
			.setDescription(`Profile "${_profileName}" does not exist.`)
			.addFields({ name: 'Proper Usage:', value: '`/weight` `player:`(player name) `profile:`(profile name)' });
		interaction.deleteReply().catch(() => undefined);
		interaction.followUp({ embeds: [embed], ephemeral: true });
		return;
	}

	const { data: weight } = await FetchWeight(account.id).catch(() => ({ data: undefined }));
	const profileWeight = weight?.profiles?.find(p => p?.profileId === profile.profileId);

	if (!weight || !profileWeight) {
		const embed = ErrorEmbed('Couldn\'t fetch data!')
			.setDescription(`Something went wrong when getting data for "${playerName}".`)
			.setFooter({ text: 'Contact kaeso.dev if this continues to happen' });
		interaction.deleteReply().catch(() => undefined);
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

	const img = await createWeightImage(playerName, account.id, profile.profileName, profileWeight, rank);

	await interaction.editReply({ files: [img], allowedMentions: { repliedUser: false } }).catch(() => {
		const embed = ErrorEmbed('Something went wrong!')
			.setDescription(`Weight image couldn't be sent in this channel. There is likely something wrong with the channel permissions.`);
		interaction.followUp({ embeds: [embed], ephemeral: true });
		return;
	});
}

async function createWeightImage(ign: string, uuid: string, profile: string, weight: components['schemas']['FarmingWeightDto'], rank = -1) {
	let result = "Hey what's up?";
	const rWeight = Math.round((weight.totalWeight ?? 0) * 100) / 100;

	if (rWeight > 1) {
		result = rWeight.toString().replace(/\B(?<!\.\d*)(?=(\d{3})+(?!\d))/g, ",");
	} else if (rWeight === -1) {
		result = 'This player has collections API off!';
	} else {
		result = rWeight.toString();
	}

	/*
	The below code is not fun at all and just generally awful, but basically the only way to do all this so yeah.

	Different sections are commented but you sort of need to know what you're looking at already.
	*/

	const sources = weight.cropWeight;

	//Get image relating to their top collection
	let imagePath;
	if (sources) {
		const topCollection = Object.entries(sources).sort(([,a], [,b]) => ((b ?? 0) - (a ?? 0)))[0][0];
		imagePath = `./assets/images/${topCollection.toLowerCase().replace(' ', '_')}.png`;
	} else {
		imagePath = `./assets/images/wheat.png`
	}

	// Load crop image and avatar
	const background = await loadImage(imagePath)
	const avatar = await loadImage(`https://mc-heads.net/head/${uuid}/left`).catch(() => {
		return null;
	});

	// Create our canvas and draw the crop image
	const canvas = createCanvas(background.width, background.height);
	const ctx = canvas.getContext('2d');

	ctx.drawImage(background, 0, 0, canvas.width, canvas.height);

	//Add name and rank, then resize to fit
	let name = ign ?? 'N/A';
	if (rank > 0) {
		name = (`${ign} - #${rank}`);
	}

	ctx.font = '100px "Open Sans"';
	let fontSize = 100;
	do {
		fontSize--;
		ctx.font = fontSize + 'px ' + "Open Sans";
	} while (ctx.measureText(name).width > canvas.width * 0.66);

	const metrics = ctx.measureText(name) as unknown as { emHeightAscent: number, emHeightDescent: number };
	const fontHeight = metrics.emHeightAscent + metrics.emHeightDescent;

	ctx.fillStyle = '#dddddd';
	ctx.fillText(name, 55, 90 - (90 - fontHeight) / 2);
	ctx.save();

	//Add weight and label, then resize to fit
	ctx.font = '256px "Open Sans"';
	fontSize = 256;

	do {
		fontSize--;
		ctx.font = fontSize + 'px ' + "Open Sans";
	} while (ctx.measureText(result).width > canvas.width * 0.66);
	const weightWidth = ctx.measureText(result).width;

	ctx.fillStyle = '#dddddd';
	ctx.fillText(result, 50, canvas.height * 0.9);

	ctx.font = '64px "Open Sans"';
	fontSize = 64;

	do {
		fontSize--;
		ctx.font = fontSize + 'px ' + "Open Sans";
	} while (ctx.measureText('Weight').width + weightWidth > canvas.width - 515);

	ctx.fillStyle = '#dddddd';
	ctx.fillText('Weight', weightWidth + 75, canvas.height * 0.9);
	const mes = ctx.measureText('Weight') as unknown as { emHeightAscent: number, emHeightDescent: number };
	ctx.fillText('Farming', weightWidth + 75, canvas.height * 0.9 - (mes.emHeightAscent + mes.emHeightDescent));

	//Draw avatar
	if (avatar) {
		ctx.drawImage(avatar, canvas.width - (canvas.height * 0.8) - 50, (canvas.height - canvas.height * 0.8) / 2, canvas.height * 0.8, canvas.height * 0.8);
		ctx.restore();
	}

	return new AttachmentBuilder(canvas.toBuffer("image/webp"), { name: 'weight.webp' });
}
