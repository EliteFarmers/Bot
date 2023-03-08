import { ButtonInteraction, CommandInteraction, InteractionReplyOptions, Message, MessageActionRow, MessageAttachment, MessageButton, MessageEmbed } from 'discord.js';
import Data, { ProfileMember, TotalProfileData } from '../classes/Data';
import DataHandler from '../classes/Database';
import ServerUtil from '../classes/ServerUtil';
import { Command } from '../classes/Command';
import { CanUpdate } from '../classes/Util';
import Canvas, { registerFont, createCanvas } from 'canvas';

export const CROPS_PER_ONE_WEIGHT = {
	wheat: 100_000,
	carrot: 300_000,
	potato: 300_000,
	sugarcane: 200_000,
	netherwart: 250_000,
	pumpkin: 87_095.11,
	melon: 435_466.47,
	mushroom: 168_925.53,
	cocoa: 257_214.64,
	cactus: 169_389.33,
};

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
				type: 'STRING',
				description: 'The player in question.',
				required: false,
				autocomplete: true
			},
			{
				name: 'profile',
				type: 'STRING',
				description: 'Optionally specify a profile!',
				required: false
			}
		]
	},
	execute: execute
}

export default command;

async function execute(interaction: CommandInteraction) {

	let playerName = interaction.options.getString('player', false)?.trim();
	const _profileName = interaction.options.getString('profile', false)?.trim();

	if (!playerName) {
		const user = await DataHandler.getPlayer(undefined, { discordid: interaction.user.id });
		if (!user || !user?.ign) {
			const embed = new MessageEmbed()
				.setColor('#CB152B')
				.setTitle('Error: Specify a Username!')
				.addField('Proper Usage:', '`/weight` `player:`(player name)')
				.setDescription('Checking for yourself?\nYou must use `/verify` `player:`(account name) before using this shortcut!')
				.setFooter({ text: 'Created by Kaeso#5346' });
			interaction.reply({ embeds: [embed], ephemeral: true });
			return;
		}
		
		playerName = user.ign;
	}

	const uuid = await Data.getUUID(playerName).then(result => {
		playerName = result.name;
		return result.id;
	}).catch(() => {
		return undefined;
	});
	if (!uuid) {
		const embed = new MessageEmbed()
			.setColor('#CB152B')
			.setTitle('Error: Invalid Username!')
			.setDescription(`Player "${playerName}" does not exist.`)
			.addField('Proper Usage:', '`/weight` `player:`(player name)')
			.setFooter({ text: 'Created by Kaeso#5346' });
		interaction.reply({ embeds: [embed], ephemeral: true });
		return;
	}

	try {
		await interaction.deferReply();
	} catch (e) {
		const embed = new MessageEmbed().setColor('#CB152B')
			.setTitle('Error: Something went wrong!')
			.setDescription(`Discord didn't want to wait for me to reply.`)
			.setFooter({ text: 'Contact Kaeso#5346 if this continues to occur.' });
		return interaction.reply({ embeds: [embed], ephemeral: true });
	}

	const user = await DataHandler.getPlayer(uuid) ?? undefined;
	const grabnewdata = CanUpdate(user);

	const fullData = (grabnewdata || !user?.profiledata) 
		? await Data.getBestData(user?.profiledata ?? undefined, uuid) 
		: user?.profiledata;

	if (!fullData) {
		const embed = new MessageEmbed().setColor('#CB152B')
			.setTitle('Error: Couldn\'t fetch data!')
			.setDescription(`Something went wrong when getting data for "${playerName}".`)
			.setFooter({ text: 'Contact Kaeso#5346 if this continues to occur.' });
		return interaction.editReply({ embeds: [embed] });
	}

	let mainProfileuuid: string | undefined;
	let mainCollections: Map<string, number> | undefined;
	let mainBonus: Map<string, number> | undefined;
	let mainWeight = 0;
	let mainBWeight = 0;
	const profile = await getUserdata(fullData, _profileName);

	if (!profile) {
		const embed = new MessageEmbed()
			.setColor('#CB152B')
			.setTitle(`Stats for ${playerName.replace(/_/g, '\\_')}`)
			.addField('Farming Weight', 'Zero! - Try some farming!\nOr turn on collections API access and help make Skyblock a more transparent place!')
			.setFooter({ text: 'This could also mean that Hypixel\'s API is down.\nCreated by Kaeso#5346' })
			.setThumbnail(`https://mc-heads.net/head/${uuid}/left`);

		interaction.editReply({ embeds: [embed] });
		return;
	}

	if (grabnewdata || user?.ign !== playerName) await DataHandler.updatePlayer(uuid, playerName, mainProfileuuid, mainWeight + mainBWeight);
	
	await sendWeight();
	await saveData();

	// Check if they're eligible for server weight-role
	const server = interaction.guildId ? await DataHandler.getServer(interaction.guildId) : undefined;
	if (server && user && server?.weightrole && (server?.weightreq ?? -1) >= 0 && user?.discordid === interaction.user.id) {
		if (Array.isArray(interaction.member?.roles)) return;
		const hasRole = interaction.member?.roles?.cache?.has(server.weightrole);

		if (server.weightreq === 0) {
			if (hasRole) return;
			return ServerUtil.handleWeightRole(interaction, server);
		}
	
		const eligible = (mainWeight + mainBWeight >= (server?.weightreq ?? 0) && !hasRole);
		if (!eligible) return;

		ServerUtil.handleWeightRole(interaction, server);
	}

	async function saveData() {
		const jacob = await Data.getBestContests(fullData ?? undefined);
		return await DataHandler.update({ profiledata: fullData, contestdata: jacob }, { uuid: uuid });
	}

	async function getUserdata(data: TotalProfileData, profileName?: string) {
		if (!data || !data?.profiles || !uuid) {
			return undefined;
		}

		const profiles = data.profiles;
		let bestProfile = null;
		let bestWeight = 0;

		for (let i = 0; i < profiles.length; i++) {
			const profile = profiles[i];

			const tempCollections = await calcCollections(profile.members[uuid] as ProfileMember);
			const weight = await computeWeight(tempCollections);
			const tempBonus = await calcBonus(profile.members[uuid] as ProfileMember);
			const bonus = await computeBonusWeight(tempBonus) ?? 0;

			if (profileName !== null && profile.cute_name.toLowerCase() === profileName?.toLowerCase()) {
				bestProfile = profile;
				mainCollections = tempCollections;
				mainBonus = tempBonus;
				mainWeight = weight ?? 0;
				mainBWeight = bonus ?? 0;

				break;
			}

			if (weight) {
				const total = weight + bonus;
				if (!bestProfile || total > bestWeight) {		
					bestProfile = profile;
					mainCollections = tempCollections;
					mainBonus = tempBonus;
					mainProfileuuid = profile.profile_id;
					mainWeight = weight;
					mainBWeight = bonus;

					bestWeight = total;
				}
			}
		}

		return bestProfile ?? undefined;
	}

	async function calcCollections(userData: ProfileMember) {
		if (!userData.collection) return undefined;
		
		let { 
			WHEAT, POTATO_ITEM: POTATO, CARROT_ITEM: CARROT, 
			MUSHROOM_COLLECTION: MUSHROOM, PUMPKIN, MELON, 
			SUGAR_CANE: CANE, CACTUS, NETHER_STALK: WART 
		} = userData.collection;

		let COCOA = userData.collection["INK_SACK:3"]; //Dumb cocoa

		//Set potentially empty values to 0, and fix overflow
		if (!WHEAT) { WHEAT = 0; } else if (WHEAT < 0) { WHEAT += 4294967294; }
		if (!PUMPKIN) { PUMPKIN = 0; } else if (PUMPKIN < 0) { PUMPKIN += 4294967294; }
		if (!MUSHROOM) { MUSHROOM = 0; } else if (MUSHROOM < 0) { MUSHROOM += 4294967294; }
		if (!CARROT) { CARROT = 0; } else if (CARROT < 0) { CARROT += 4294967294; }
		if (!POTATO) { POTATO = 0; } else if (POTATO < 0) { POTATO += 4294967294; }
		if (!MELON) { MELON = 0; } else if (MELON < 0) { MELON += 4294967294; }
		if (!COCOA) { COCOA = 0; } else if (COCOA < 0) { COCOA += 4294967294; }
		if (!CACTUS) { CACTUS = 0; } else if (CACTUS < 0) { CACTUS += 4294967294; }
		if (!WART) { WART = 0; } else if (WART < 0) { WART += 4294967294; }
		if (!CANE) { CANE = 0; } else if (CANE < 0) { CANE += 4294967294; }

		const collections = new Map<string, number>();

		const wheat = WHEAT / CROPS_PER_ONE_WEIGHT.wheat;
		const potato = POTATO / CROPS_PER_ONE_WEIGHT.potato;
		const carrot = CARROT / CROPS_PER_ONE_WEIGHT.carrot;
		const mushroom = MUSHROOM / CROPS_PER_ONE_WEIGHT.mushroom;
		const pumpkin = PUMPKIN / CROPS_PER_ONE_WEIGHT.pumpkin;
		const melon = MELON / CROPS_PER_ONE_WEIGHT.melon;
		const cane = CANE / CROPS_PER_ONE_WEIGHT.sugarcane;
		const cactus = CACTUS / CROPS_PER_ONE_WEIGHT.cactus;
		const wart = WART / CROPS_PER_ONE_WEIGHT.netherwart;
		const cocoa = COCOA / CROPS_PER_ONE_WEIGHT.cocoa;
	
		//Normalize collections
		collections.set('Wheat', RoundToFixed(wheat));
		collections.set('Carrot', RoundToFixed(carrot));
		collections.set('Potato', RoundToFixed(potato));
		collections.set('Pumpkin', RoundToFixed(pumpkin));
		collections.set('Melon', RoundToFixed(melon));
		collections.set('Cocoa Beans', RoundToFixed(cocoa));
		collections.set('Cactus', RoundToFixed(cactus));
		collections.set('Sugar Cane', RoundToFixed(cane));
		collections.set('Nether Wart', RoundToFixed(wart));
	
		// Mushroom is a special case, it needs to be calculated dynamically based on the
		// ratio between the farmed crops that give two mushrooms per break with cow pet
		// and the farmed crops that give one mushroom per break with cow pet
		const total = wheat + carrot + potato + pumpkin + melon + cocoa + cactus + cane + wart + mushroom;
	
		const doubleBreakRatio = (cactus + cane) / total;
		const normalRatio = (total - cactus - cane) / total;
	
		const mushWght = CROPS_PER_ONE_WEIGHT.mushroom;
		const mushroomWeight = doubleBreakRatio * (MUSHROOM / (2 * mushWght)) + normalRatio * (MUSHROOM / mushWght);
	
		collections.set('Mushroom', RoundToFixed(mushroomWeight));

		return collections;
	}

	async function computeWeight(collections: Map<string, number> | undefined) {
		if (!collections) return undefined;

		let weight = 0;
		collections.forEach(function (value) {
			weight += value;
		});
		weight = Math.floor(weight * 100) / 100;

		return weight;
	}

	async function calcBonus(userData: ProfileMember) {
		//Bonus sources
		const bonus = new Map();

		if (userData.jacob) {
			//Farming level bonuses
			const farmingCap = userData.jacob.perks.farming_level_cap ?? 0;
			if (userData.experience_skill_farming > 111672425 && farmingCap === 10) {
				bonus.set('Farming Level 60', 250);
			} else if (userData.experience_skill_farming > 55172425) {
				bonus.set('Farming Level 50', 100);
			}

			//Anita buff bonus
			const anitaBuff = userData.jacob.perks.double_drops ?? 0;
			if (anitaBuff > 0) {
				bonus.set(`${anitaBuff * 2}% Anita Buff`, anitaBuff * 2);
			}

			const earnedGolds = userData.jacob.totalmedals.gold;
			if (earnedGolds >= 1000) {
				bonus.set('1,000 Gold Medals', 500);
			} else {
				const roundDown = Math.floor(earnedGolds / 50) * 50;
				if (roundDown > 0) {
					bonus.set(`${roundDown} Gold Medals`, roundDown / 2);
				}
			}
		}

		//Tier 12 farming minions
		const tier12s = [
			'WHEAT_12', 'CARROT_12', 'POTATO_12', 
			'PUMPKIN_12', 'MELON_12', 'MUSHROOM_12', 
			'COCOA_12', 'CACTUS_12', 'SUGAR_CANE_12', 
			'NETHER_WARTS_12'
		];
		let obtained12s = 0;
		if (userData.crafted_generators) {
			const obtainedMinions = userData.crafted_generators;
			tier12s.forEach(minion => {
				obtained12s += (obtainedMinions.includes(minion)) ? 1 : 0;
			});
		}
		if (obtained12s > 0) {
			bonus.set(`${obtained12s}/10 Minions`, obtained12s * 5);
		}

		return bonus;
	}

	async function computeBonusWeight(bonus: Map<string, number>) {
		if (!bonus) return undefined;

		let bonusWeight = 0;
		bonus?.forEach(function (value) {
			bonusWeight += value;
		});

		return bonusWeight;
	}

	async function sendWeight() {
		if (!profile) {
			const embed = new MessageEmbed()
				.setColor('#03fc7b')
				.setTitle(`Stats for ${(playerName ?? 'Player').replace(/_/g, '\\_')}`)
				.addField('Farming Weight', 'Zero! - Try some farming!\nOr turn on API access and help make Skyblock a better place.')
				.setFooter({ text: 'Created by Kaeso#5346' })
				.setThumbnail(`https://mc-heads.net/head/${uuid}/left`);

			return interaction.editReply({embeds: [embed]});
		}
		
		const row = new MessageActionRow().addComponents(
			new MessageButton()
				.setCustomId('info')
				.setLabel('More Info')
				.setStyle('SUCCESS'),
			new MessageButton()
				.setLabel('Elite')
				.setStyle('LINK')
				.setURL(`https://elitebot.dev/stats/${playerName}/${profile.profile_id}`),
			new MessageButton()
				.setCustomId(`jacob|${playerName}`)
				.setLabel('Jacob\'s Stats')
				.setStyle('DANGER')
		);
		
		let result = "Hey what's up?";
		const rWeight = Math.round((mainWeight + mainBWeight) * 100) / 100;

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


		//Get image relating to their top collection
		let imagePath;
		if (mainCollections) {
			const topCollection = new Map([...mainCollections.entries()].sort((a, b) => b[1] - a[1])).entries().next().value[0];
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
		if (user && user?.rank !== 0 && mainProfileuuid === profile.profile_id) {
			name = (`${playerName} - #${user?.rank}`);
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
	
		const attachment = new MessageAttachment(canvas.toBuffer(), 'weight.png');

		const replyMessage: InteractionReplyOptions = {
			files: [attachment],
			components: [row],
			allowedMentions: { repliedUser: false },
			fetchReply: true,
			embeds: undefined 
		};

		if (user?.cheating) {
			const embed = new MessageEmbed()
				.setColor('#FF8600')
				.setDescription(`**This player is a __cheater__.** ${!profile.api ? ` They also turned off their api access.` : ``}`)
				.setFooter({ text: 'Players are only marked as cheating when it\'s proven beyond a reasonable doubt.\nThey hold no position in any leaderboards.' });
			replyMessage.embeds = [embed];
		} else if (!profile.api) {
			const embed = new MessageEmbed()
				.setColor('#FF8600')
				.setDescription(`**This data is outdated!** ${(playerName ?? 'They').replace(/_/g, '\\_')} turned off their api access.`);
			replyMessage.embeds = [embed];
		}

		interaction.editReply(replyMessage).then(async (reply) => {
			if (!(reply instanceof Message)) return;

			let infoClicked = false;

			const collector = reply.createMessageComponentCollector({ componentType: 'BUTTON', time: 30000 });

			collector.on('collect', i => {
				if (i.user.id === interaction.user.id) {
					if (i.customId === 'info') {
						sendDetailedWeight(i, mainWeight, true);
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
					const linkRow = new MessageActionRow().addComponents(
						new MessageButton()
							.setLabel('Elite')
							.setStyle('LINK')
							.setURL(`https://elitebot.dev/stats/${playerName}/${profile.profile_id}`),
						new MessageButton()
							.setLabel('SkyCrypt')
							.setStyle('LINK')
							.setURL(`https://sky.shiiyu.moe/stats/${playerName}/${encodeURIComponent(profile.cute_name)}`)
					);
					reply.edit({ components: [linkRow], allowedMentions: { repliedUser: false } }).catch(() => undefined);
				} catch (error) { console.log(error) }
			});
		}).catch(error => { console.log(error) });
	}

	async function sendDetailedWeight(interaction: ButtonInteraction, weight: number, edit = false) {
		let result = "Hey what's up?";
		weight = Math.round((weight + mainBWeight) * 100) / 100;

		if (weight > 1) {
			result = weight.toString().replace(/\B(?<!\.\d*)(?=(\d{3})+(?!\d))/g, ",");
		} else if (weight === -1) {
			result = 'This player has collections API off!';
		} else {
			result = weight.toString();
		}

		if (!playerName) playerName = 'Player';

		const embed = new MessageEmbed()
			.setColor('#03fc7b')
			.setTitle(`Stats for ${playerName.replace(/_/g, '\\_')} on ${profile?.cute_name}`)
			.addField('Farming Weight', !result ? '0 - Try some farming!' : result + ' ')
			.addField('Breakdown', getBreakdown(), edit)
			.setFooter({ text: 'Created by Kaeso#5346    Questions? Use /info' });
		
		if (!edit) {
			embed.setThumbnail(`https://mc-heads.net/head/${uuid}/left`)
		}

		if (user?.rank !== undefined && user?.rank !== 0 && mainProfileuuid === profile?.profile_id && !edit) {
			embed.setDescription(`**${playerName.replace(/_/g, '\\_')}** is rank **#${user?.rank}!**`)
		}

		if (mainBonus?.size) {
			embed.addField('Bonus', getBonus(), edit);
		}

		let notes = '';
		if (Object.keys(profile?.members ?? {}).length > 1) {
			notes += 'This player has been or is a co op member';
		}

		if (user?.cheating) { 
			notes += `\n**This player is a __cheater__.** ${!profile?.api ? ` They also turned off their api access.` : ``}`;
		} else if (!profile?.api) {
			notes += `\n**This data is outdated! ${playerName.replace(/_/g, '\\_')} turned off their api access.**`;
		}

		if (notes !== '') {
			embed.addField('Notes', notes);
		}

		if (!edit) {
			interaction.editReply({ embeds: [embed], allowedMentions: { repliedUser: false } }).catch(error => {
				console.log(error);
			});
		} else {
			const row = new MessageActionRow().addComponents(
				new MessageButton()
					.setLabel('Elite')
					.setStyle('LINK')
					.setURL(`https://elitebot.dev/stats/${playerName}/${profile ? profile.profile_id : ''}`),
				new MessageButton()
					.setLabel('SkyCrypt')
					.setStyle('LINK')
					.setURL(`https://sky.shiiyu.moe/stats/${playerName}/${profile ? encodeURIComponent(profile.cute_name) : ''}`),
			);
			interaction.update({ embeds: [embed], allowedMentions: { repliedUser: false }, components: [row] });
		}
	}

	function getBreakdown() {
		if (!mainCollections) return "This player has no notable collections";

		//Sort collections
		const sortedCollections = new Map([...mainCollections.entries()].sort((a, b) => b[1] - a[1]));
		let breakdown = '';
		
		sortedCollections.forEach(function (value, key) {
			const percent = Math.floor(value / mainWeight * 100);
			breakdown += (percent > 1) ? `${key}: ${value}  [${percent}%]\n` : (percent > 1) ? `${key}: ${value}  [${percent}%]\n` : '';
		});

		return breakdown === '' ? "This player has no notable collections" : breakdown;
	}

	function getBonus() {
		if (!mainBonus) return "This player has no bonus points!";
		//Sort bonus
		const sortedBounus = new Map([...mainBonus.entries()].sort((a, b) => b[1] - a[1]));
		let bonusText = '';

		sortedBounus.forEach(function (value, key) {
			bonusText += `${key}: ${value}\n`;
		});

		return bonusText === '' ? 'No bonus points :(' : bonusText;
	}
}

function RoundToFixed(num: number | null, fixed = 2) {
	if (num === null || !isFinite(num)) return 0;

	const divider = Math.pow(10, fixed);
	const rounded = Math.round((num + Number.EPSILON) * divider) / divider;

	return isNaN(rounded) ? 0 : rounded;
}