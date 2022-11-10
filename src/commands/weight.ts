import { ApplicationCommandOptionType, ButtonInteraction, ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder, ComponentType } from 'discord.js';
import { Command } from '../classes/Command';
import Canvas, { registerFont, createCanvas } from 'canvas';
import { ImproperUsageError } from 'src/classes/Errors';
import { FetchAccount, FetchAccountFromDiscord, FetchPlayerRanking, FetchPlayerWeight, UserInfo, WeightInfo } from 'src/classes/Elite';
import { AccountData } from 'src/classes/skyblock';

const command: Command = {
	name: 'weight',
	description: 'Calculate a players farming weight',
	usage: '(username) (profile name)',
	access: 'ALL',
	type: 'SLASH',
	slash: {
		name: 'weight',
		description: 'Get a players farming weight!',
		options: [
			{
				name: 'player',
				type: ApplicationCommandOptionType.String,
				description: 'The player in question.',
				required: false,
				autocomplete: true
			},
			{
				name: 'profile',
				type: ApplicationCommandOptionType.String,
				description: 'Optionally specify a profile!',
				required: false
			}
		]
	},
	execute: execute
}

export default command;

async function execute(interaction: ChatInputCommandInteraction) {
	if (!interaction.isChatInputCommand()) return;

	let playerName = interaction.options.getString('player', false)?.trim();
	const _profileName = interaction.options.getString('profile', false)?.trim();

	let account: AccountData | undefined;

	if (!playerName) {
		const user = await FetchAccountFromDiscord(interaction.user.id);

		if (!user?.success || !user.account?.id) {
			const embed = new EmbedBuilder()
				.setColor('#CB152B')
				.setTitle('Error: Specify a Username!')
				.addFields({ name: 'Proper Usage:', value: '`/weight` `player:`(player name)' })
				.setDescription('Checking for yourself?\nYou must use `/verify` `player:`(account name) before using this shortcut!')
				.setFooter({ text: 'Created by Kaeso#5346' });
			interaction.reply({ embeds: [embed], ephemeral: true });
			return;
		}
		
		account = user.account;
		playerName = user.account.id;
	}

	if (!account) {
		const acc = await FetchAccount(playerName);
		if (!acc?.success || !acc.account) {
			const embed = ImproperUsageError('Error: Invalid Username!', `Player "${playerName}" does not exist.`, '`/weight` `player:`(player name)');
			interaction.reply({ embeds: [embed], ephemeral: true });
			return;
		}
		account = acc.account;
	}

	const uuid = account.id;
	playerName = account.name;

	try {
		await interaction.deferReply();
	} catch (e) {
		const embed = new EmbedBuilder().setColor('#CB152B')
			.setTitle('Error: Something went wrong!')
			.setDescription(`Discord didn't want to wait for me to reply.`)
			.setFooter({ text: 'Contact Kaeso#5346 if this continues to occur.' });
		return interaction.reply({ embeds: [embed], ephemeral: true });
	}

	const weight = await FetchPlayerWeight(uuid);

	if ((weight as { success: boolean }).success === false) {
		const embed = new EmbedBuilder().setColor('#CB152B')
			.setTitle('Error: Couldn\'t fetch data!')
			.setDescription(`Something went wrong when getting data for "${playerName}".`)
			.setFooter({ text: 'Contact Kaeso#5346 if this continues to occur.' });
		return interaction.editReply({ embeds: [embed] });
	}

	const userInfo = weight as UserInfo;

	let profile: WeightInfo;
	let profileId = '';

	if (_profileName && weight) {
		const foundProfile = Object.values(userInfo.profiles).find(p => p?.cute_name.toLowerCase() === _profileName.toLowerCase());
		if (!foundProfile) {
			const embed = ImproperUsageError('Error: Invalid Profile!', `Profile "${_profileName}" does not exist.`, '`/weight` `player:`(player name) `profile:`(profile name)');
			return interaction.editReply({ embeds: [embed] });
		}
		profile = foundProfile;
	} else if (weight) {
		const profiles = Object.entries(userInfo.profiles);

		if (!profiles || !profiles[0]) {
			const embed = new EmbedBuilder().setColor('#CB152B')
				.setTitle('Error: Couldn\'t fetch data!')
				.setDescription(`Something went wrong when getting data for "${playerName}".`)
				.setFooter({ text: 'Contact Kaeso#5346 if this continues to occur.' });
			return interaction.editReply({ embeds: [embed] });
		}

		profile = profiles[0][1] as WeightInfo;
		profileId = profiles[0][0];

		for (const [id, p] of profiles) {
			if (p && (p.farming?.total ?? 0) > (profile?.farming?.total ?? 0)) {
				profile = p;
				profileId = id;
			}
		}
	} else {
		const embed = new EmbedBuilder().setColor('#CB152B')
			.setTitle('Error: Couldn\'t fetch data!')
			.setDescription(`Something went wrong when getting data for "${playerName}".`)
			.setFooter({ text: 'Contact Kaeso#5346 if this continues to occur.' });
		return interaction.editReply({ embeds: [embed] });
	}

	const totalWeight = profile?.farming?.total ?? 0;

	if (totalWeight === 0) {
		const embed = new EmbedBuilder()
			.setColor('#CB152B')
			.setTitle(`Stats for ${playerName.replace(/_/g, '\\_')}`)
			.addFields({ name: 'Farming Weight', value: 'Zero! - Try some farming!\nOr turn on collections API access and help make Skyblock a more transparent place!' })
			.setFooter({ text: 'This could also mean that Hypixel\'s API is down.\nCreated by Kaeso#5346' })
			.setThumbnail(`https://mc-heads.net/head/${uuid}/left`);

		interaction.editReply({ embeds: [embed] });
		return;
	}

	const rank = await FetchPlayerRanking(uuid);
	const ranking = rank.success ? rank : undefined;

	await sendWeight();

	async function sendWeight() {
		if (!profile) {
			const embed = new EmbedBuilder()
				.setColor('#03fc7b')
				.setTitle(`Stats for ${(playerName ?? 'Player').replace(/_/g, '\\_')}`)
				.addFields({ name: 'Farming Weight', value: 'Zero! - Try some farming!\nOr turn on API access and help make Skyblock a better place.' })
				.setFooter({ text: 'Created by Kaeso#5346' })
				.setThumbnail(`https://mc-heads.net/head/${uuid}/left`);

			return interaction.editReply({embeds: [embed]});
		}
		
		const row = new ActionRowBuilder<ButtonBuilder>().setComponents(
			new ButtonBuilder()
				.setCustomId('info')
				.setLabel('More Info')
				.setStyle(ButtonStyle.Success),
			new ButtonBuilder()
				.setLabel('Elite')
				.setStyle(ButtonStyle.Link)
				.setURL(`https://elitebot.dev/stats/${playerName}/${profileId}`),
			new ButtonBuilder()
				.setCustomId(`jacob|${playerName}`)
				.setLabel('Jacob\'s Stats')
				.setStyle(ButtonStyle.Danger)
		)
		
		let result = "Hey what's up?";
		const rWeight = Math.round(totalWeight * 100) / 100;

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

		const sources = profile.farming.sources;

		//Get image relating to their top collection
		let imagePath;
		if (sources) {
			const topCollection = Object.entries(sources).sort(([,a], [,b]) => (b - a))[0][0];
			imagePath = `./assets/images/${topCollection.toLowerCase().replace(' ', '_')}.png`;
		} else {
			imagePath = `./assets/images/wheat.png`
		}

		registerFont('./assets/fonts/OpenSans-Regular.ttf', { family: 'Open Sans' });

		//Load crop image and avatar
		const background = await Canvas.loadImage(imagePath)
		const avatar = await Canvas.loadImage(`https://mc-heads.net/head/${uuid}/left`).catch(() => {
			console.log("Couldn't load image")
			return null;
		});

		//Create our canvas and draw the crop image
		const canvas = createCanvas(background.width, background.height);
		const ctx = canvas.getContext('2d');

		ctx.drawImage(background, 0, 0, canvas.width, canvas.height);
	
		//Add name and rank, then resize to fit
		let name = playerName ?? 'N/A';
		if (ranking && ranking.entry.rank > 0) {
			name = (`${playerName} - #${ranking.entry.rank}`);
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
	
		const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'weight.png' });

		let replyEmbed;
		if (userInfo.cheating) {
			const embed = new EmbedBuilder()
				.setColor('#FF8600')
				.setDescription(`**This player is a __cheater__.** ${!profile.api ? ` They also turned off their api access.` : ``}`)
				.setFooter({ text: 'Players are only marked as cheating when it\'s proven beyond a reasonable doubt.\nThey hold no position in any leaderboards.' });
			replyEmbed = [embed];
		} else if (!profile.api) {
			const embed = new EmbedBuilder()
				.setColor('#FF8600')
				.setDescription(`**This data is outdated!** ${(playerName ?? 'They').replace(/_/g, '\\_')} turned off their api access.`);
			replyEmbed = [embed];
		}

		interaction.editReply({
			files: [attachment],
			components: [row],
			allowedMentions: { repliedUser: false },
			embeds: replyEmbed,
		}).then(async (reply) => {
			if (!reply) return;

			let infoClicked = false;

			const collector = reply.createMessageComponentCollector({ componentType: ComponentType.Button, time: 30_000 });

			collector.on('collect', i => {
				if (i.user.id === interaction.user.id) {
					if (i.customId === 'info') {
						sendDetailedWeight(i, totalWeight, true);
						infoClicked = true;
						collector.stop();
					}
				} else {
					i.reply({ content: `These buttons aren't for you!`, ephemeral: true });
				}
			});

			collector.on('end', () => {
				if (infoClicked) return;
				try {
					const linkRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
						new ButtonBuilder()
							.setLabel('Elite')
							.setStyle(ButtonStyle.Link)
							.setURL(`https://elitebot.dev/stats/${playerName}/${profile.cute_name}`),
						new ButtonBuilder()
							.setLabel('SkyCrypt')
							.setStyle(ButtonStyle.Link)
							.setURL(`https://sky.shiiyu.moe/stats/${playerName}/${profile.cute_name}`)
					);
					reply.edit({ components: [linkRow], allowedMentions: { repliedUser: false } }).catch(() => undefined);
				} catch (error) { console.log(error) }
			});
		}).catch(error => { console.log(error) });
	}

	async function sendDetailedWeight(interaction: ButtonInteraction, totalWeight: number, edit = false) {
		let result = "Hey what's up?";
		totalWeight = Math.round((totalWeight) * 100) / 100;

		if (totalWeight > 1) {
			result = weight.toString().replace(/\B(?<!\.\d*)(?=(\d{3})+(?!\d))/g, ",");
		} else if (totalWeight === -1) {
			result = 'This player has collections API off!';
		} else {
			result = weight.toString();
		}

		if (!playerName) playerName = 'Player';

		const embed = new EmbedBuilder()
			.setColor('#03fc7b')
			.setTitle(`Stats for ${playerName.replace(/_/g, '\\_')} on ${profile?.cute_name}`)
			.addFields([
				{ name: 'Farming Weight', value: !result ? '0 - Try some farming!' : result + ' ' },
				{ name: 'Breakdown', value: getBreakdown(), inline: edit },
			])
			.setFooter({ text: 'Created by Kaeso#5346    Questions? Use /info' });
		
		if (!edit) {
			embed.setThumbnail(`https://mc-heads.net/head/${uuid}/left`)
		}

		if (ranking?.entry.rank !== undefined && ranking.entry.rank !== 0 && ranking.entry.profile === profileId && !edit) {
			embed.setDescription(`**${playerName.replace(/_/g, '\\_')}** is rank **#${ranking.entry.rank}!**`)
		}

		if (Object.values(profile.farming.bonuses).length > 0) {
			embed.addFields({ name: 'Bonus', value: getBonus(), inline: edit });
		}

		let notes = '';

		if (userInfo?.cheating) { 
			notes += `\n**This player is a __cheater__.** ${!profile?.api.collections ? ` They also turned off their api access.` : ``}`;
		} else if (!profile?.api.collections) {
			notes += `\n**This data is outdated! ${playerName.replace(/_/g, '\\_')} turned off their api access.**`;
		}

		if (notes !== '') {
			embed.addFields({ name: 'Notes', value: notes });
		}

		if (!edit) {
			interaction.editReply({ embeds: [embed], allowedMentions: { repliedUser: false } }).catch(error => {
				console.log(error);
			});
		} else {
			const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
				new ButtonBuilder()
					.setLabel('Elite')
					.setStyle(ButtonStyle.Link)
					.setURL(`https://elitebot.dev/stats/${playerName}/${profile ? profile.cute_name : ''}`),
				new ButtonBuilder()
					.setLabel('SkyCrypt')
					.setStyle(ButtonStyle.Link)
					.setURL(`https://sky.shiiyu.moe/stats/${playerName}/${profile ? profile.cute_name : ''}`),
			);
			interaction.update({ embeds: [embed], allowedMentions: { repliedUser: false }, components: [row] });
		}
	}

	function getBreakdown() {
		const entries = Object.entries(profile.farming.sources);
		if (entries.length < 1) return "This player has no notable collections";

		//Sort collections
		const sortedCollections = entries.sort(([, a], [, b]) => b - a);
		let breakdown = '';
		
		sortedCollections.forEach(function (key, val) {
			const percent = Math.floor(val / profile.farming.total * 100);
			breakdown += (percent > 1) ? `${val}: ${key}  [${percent}%]\n` : (percent > 1) ? `${val}: ${key}  [${percent}%]\n` : '';
		});

		return breakdown === '' ? "This player has no notable collections" : breakdown;
	}

	function getBonus() {
		if (!profile.farming.bonus) return "This player has no bonus points!";
		const entries = Object.entries(profile.farming.bonuses);

		//Sort bonus
		const sortedBounus = entries.sort(([, a], [, b]) => b - a);
		let bonusText = '';

		sortedBounus.forEach(function (key, val) {
			bonusText += `${val}: ${key}\n`;
		});

		return bonusText === '' ? 'No bonus points :(' : bonusText;
	}
}

