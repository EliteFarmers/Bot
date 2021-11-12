const Discord = require('discord.js');
const Canvas = require('canvas');
const { Data } = require('../data.js');
const { DataHandler } = require('../database.js');

module.exports = {
	name: 'weight',
	aliases: ['w'],
	description: 'Calculate a players farming weight',
	usage: '[username] (profile name)',
	guildOnly: false,
	dmOnly: false,
	async execute(interaction) {
		const options = interaction?.options?._hoistedOptions;

		let playerName = undefined;
		let _profileName = undefined;

		for (let i = 0; i < Object.keys(options).length; i++) {
			let option = options[Object.keys(options)[i]];
			if (option.name === 'player') {
				playerName = option.value.trim();
			} else if (option.name === 'profile') {
				_profileName = option.value.trim();
			}
		}

		if (!playerName) {
			let user = await DataHandler.getPlayer(null, { discordid: interaction.user.id });
			if (!user || !user.dataValues?.ign) {
				const embed = new Discord.MessageEmbed()
					.setColor('#03fc7b')
					.setTitle('Error: Specify a Username!')
					.addField('Proper Usage:', '`/weight` `player:`(player name)')
					.setDescription('Checking for yourself?\nYou must use \`/verify\` \`player:\`(account name) before using this shortcut!')
					.setFooter('Created by Kaeso#5346');
				interaction.reply({ embeds: [embed], ephemeral: true });
				return;
			}
			
			playerName = user.dataValues.ign;
		}

		const uuid = await Data.getUUID(playerName).then(result => {
			playerName = result.name;
			return result.id;
		}).catch(() => {
			return undefined;
		});
		if (!uuid) {
			const embed = new Discord.MessageEmbed()
				.setColor('#03fc7b')
				.setTitle('Error: Invalid Username!')
				.addField('Proper Usage:', '`/weight` `player:`(player name)')
				.setFooter('Created by Kaeso#5346');
			interaction.reply({ embeds: [embed], ephemeral: true });
			return;
		}

		let grabnewdata = true;
		const user = await DataHandler.getPlayer(uuid);
		if (user && user.dataValues?.updatedat) {
			grabnewdata = !(+user.dataValues?.updatedat < Date.now() - (10 * 60 * 1000));
		}

		await interaction.deferReply();

		console.log(grabnewdata);
		const fullData = (grabnewdata) 
			? await Data.getBestData(user?.dataValues?.profiledata, uuid) 
			: user?.dataValues?.profiledata;

		let mainProfileuuid;
		let mainCollections;
		let mainBonus;
		let mainWeight = 0;
		let mainBWeight = 0;
		const profile = await getUserdata(fullData, _profileName);

		if (!profile) {
			const embed = new Discord.MessageEmbed()
				.setColor('#03fc7b')
				.setTitle(`Stats for ${playerName.replace(/\_/g, '\\_')}`)
				.addField('Farming Weight', 'Zero! - Try some farming!\nOr turn on collections API access and help make Skyblock a more transparent place!')
				.setFooter('This could also mean that Hypixel\'s API is down.\nCreated by Kaeso#5346')
				.setThumbnail(`https://mc-heads.net/head/${uuid}/left`);

			interaction.editReply({embeds: [embed]});
			return;
		}

		if (typeof (mainWeight + mainBWeight) === NaN) {
			mainWeight = 0;
			mainBWeight = 0;
		}

		if (grabnewdata) await DataHandler.updatePlayer(uuid, playerName, mainProfileuuid, mainWeight + mainBWeight);
		
		const sent = await sendWeight();



		async function getUserdata(data, profileName = null) {
			if (!data || !data?.profiles) {
				return undefined;
			}

			let profiles = data.profiles;
			let bestProfile = null;
			let bestWeight = 0;
			let best = true;

			for (let i = 0; i < Object.keys(profiles).length; i++) {
				const key = Object.keys(profiles)[i];
				const profile = profiles[key];

				let tempCollections = await calcCollections(profile.members[uuid]);
				let weight = await computeWeight(tempCollections);
				let tempBonus = await calcBonus(profile.members[uuid]);
				let bonus = await computeBonusWeight(tempBonus);

				if (profileName !== null && profile.cute_name.toLowerCase() === profileName.toLowerCase()) {
					bestProfile = profile;
					mainCollections = tempCollections;
					mainBonus = tempBonus;
					mainWeight = weight;
					mainBWeight = bonus;

					break;
				}

				if (weight) {
					let total = weight + bonus;
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

		async function calcCollections(userData) {
			if (!userData.collection) return undefined;
			
			let { 
				WHEAT, POTATO_ITEM: POTATO, CARROT_ITEM: CARROT, 
				MUSHROOM_COLLECTION: MUSHROOM, PUMPKIN, MELON, 
				SUGAR_CANE: CANE, CACTUS, NETHER_STALK: WART 
			} = userData.collection;

			let COCOA = userData.collection["INK_SACK:3"]; //Dumb cocoa

			//Set potentially empty values to 0, and fix overflow
			if (!WHEAT) { WHEAT = 0; } else if (WHEAT < 0) { WHEAT += 4294967294; };
			if (!PUMPKIN) { PUMPKIN = 0; } else if (PUMPKIN < 0) { PUMPKIN += 4294967294; };
			if (!MUSHROOM) { MUSHROOM = 0; } else if (MUSHROOM < 0) { MUSHROOM += 4294967294; };
			if (!CARROT) { CARROT = 0; } else if (CARROT < 0) { CARROT += 4294967294; };
			if (!POTATO) { POTATO = 0; } else if (POTATO < 0) { POTATO += 4294967294; };
			if (!MELON) { MELON = 0; } else if (MELON < 0) { MELON += 4294967294; };
			if (!COCOA) { COCOA = 0; } else if (COCOA < 0) { COCOA += 4294967294; };
			if (!CACTUS) { CACTUS = 0; } else if (CACTUS < 0) { CACTUS += 4294967294; };
			if (!WART) { WART = 0; } else if (WART < 0) { WART += 4294967294; };
			if (!CANE) { CANE = 0; } else if (CANE < 0) { CANE += 4294967294; };

			let collections = new Map();

			//Normalize collections
			collections.set('Wheat', Math.round(WHEAT / 1000) / 100);
			collections.set('Carrot', Math.round(CARROT / 3000) / 100);
			collections.set('Potato', Math.round(POTATO / 3000) / 100);
			collections.set('Pumpkin', Math.round(PUMPKIN * 1.41089 / 1000) / 100);
			collections.set('Melon', Math.round(MELON * 1.41089 / 5000) / 100);
			collections.set('Mushroom', Math.round(MUSHROOM * 1.20763 / 664) / 100);
			collections.set('Cocoa', Math.round(COCOA * 1.36581 / 3000) / 100);
			collections.set('Cactus', Math.round(CACTUS * 1.25551 / 2000) / 100);
			collections.set('Sugar Cane', Math.round(CANE / 2000) / 100);
			collections.set('Nether Wart', Math.round(WART / 2500) / 100);

			return collections;
		}

		async function computeWeight(collections) {
			if (!collections) return undefined;

			let weight = 0;
			collections.forEach(function (value, key) {
				weight += value;
			});
			weight = Math.floor(weight * 100) / 100;

			return weight;
		}

		async function calcBonus(userData) {
			//Bonus sources
			let bonus = new Map();

			if (userData.jacob) {
				//Farming level bonuses
				let farmingCap = userData.jacob.perks.farming_level_cap ?? 0;
				if (userData.experience_skill_farming > 111672425 && farmingCap === 10) {
					bonus.set('Farming Level 60', 250);
				} else if (userData.experience_skill_farming > 55172425) {
					bonus.set('Farming Level 50', 100);
				}

				//Anita buff bonus
				let anitaBuff = userData.jacob.perks.double_drops ?? 0;
				if (anitaBuff > 0) {
					bonus.set(`${anitaBuff * 2}% Anita Buff`, anitaBuff * 2);
				}

				const earnedGolds = userData.jacob.totalmedals.gold;
				if (earnedGolds >= 1000) {
					bonus.set('1,000 Gold Medals', 500);
				} else {
					let roundDown = Math.floor(earnedGolds / 50) * 50;
					if (roundDown > 0) {
						bonus.set(`${roundDown} Gold Medals`, roundDown / 2);
					}
				}
			} else if (userData.jacob2) {
				console.log("this should never happen");
				try {
					//Farming level bonuses
					let farmingCap = userData.jacob2.perks.farming_level_cap ?? 0;
					if (userData.experience_skill_farming > 111672425 && farmingCap === 10) {
						bonus.set('Farming Level 60', 250);
					} else if (userData.experience_skill_farming > 55172425) {
						bonus.set('Farming Level 50', 100);
					}

					//Anita buff bonus
					let anitaBuff = userData.jacob2.perks.double_drops ?? 0;
					if (anitaBuff > 0) {
						bonus.set(`${anitaBuff * 2}% Anita Buff`, anitaBuff * 2);
					}

					//Calculate Amount of Gold medals won
					let earnedGolds = 0;
					let contests = userData.jacob2.contests;
					if (contests) {
						for (let i = 0; i < Object.keys(contests).length; i++) {
							let contest = contests[Object.keys(contests)[i]];

							let position = ('claimed_position' in contest) ? contest['claimed_position'] : -1;
							let participants = ('claimed_participants' in contest) ? contest['claimed_participants'] : -1;

							if (position !== -1 && participants !== -1) {
								earnedGolds += ((participants * 0.05) - 1 >= position) ? 1 : 0;
							} else {
								continue;
							}

							if (earnedGolds > 1000) {
								break;
							}
						}
					}
					if (earnedGolds >= 1000) {
						bonus.set('1,000 Gold Medals', 500);
					} else {
						let roundDown = Math.floor(earnedGolds / 50) * 50;
						if (roundDown > 0) {
							bonus.set(`${roundDown} Gold Medals`, roundDown / 2);
						}
					}
				} catch (e) { }
			}

			//Tier 12 farming minions
			let tier12s = [
				'WHEAT_12', 'CARROT_12', 'POTATO_12', 
				'PUMPKIN_12', 'MELON_12', 'MUSHROOM_12', 
				'COCOA_12', 'CACTUS_12', 'SUGAR_CANE_12', 
				'NETHER_WARTS_12'
			];
			let obtained12s = 0;
			if (userData.crafted_generators) {
				let obtainedMinions = userData.crafted_generators;
				tier12s.forEach(minion => {
					obtained12s += (obtainedMinions.includes(minion)) ? 1 : 0;
				});
			}
			if (obtained12s > 0) {
				bonus.set(`${obtained12s}/10 Minions`, obtained12s * 5);
			}

			return bonus;
		}

		async function computeBonusWeight(bonus) {
			if (!bonus) return undefined;

			let bonusWeight = 0;
			bonus?.forEach(function (value, key) {
				bonusWeight += value;
			});

			return bonusWeight;
		}

		async function sendWeight() {
			if (!profile) {
				const embed = new Discord.MessageEmbed()
					.setColor('#03fc7b')
					.setTitle(`Stats for ${this.playerName.replace(/\_/g, '\\_')}`)
					.addField('Farming Weight', 'Zero! - Try some farming!\nOr turn on API access and help make Skyblock a better place.')
					.setFooter('Created by Kaeso#5346')
					.setThumbnail(`https://mc-heads.net/head/${this.uuid}/left`);
	
				interaction.editReply({embeds: [embed]});
				return;
			}
			
			const row = new Discord.MessageActionRow().addComponents(
				new Discord.MessageButton()
					.setCustomId('info')
					.setLabel('More Info')
					.setStyle('SUCCESS'),
				new Discord.MessageButton()
					.setLabel('SkyCrypt')
					.setStyle('LINK')
					.setURL(`https://sky.shiiyu.moe/stats/${playerName}/${profile.cute_name}`),
				new Discord.MessageButton()
					.setLabel('Plancke')
					.setStyle('LINK')
					.setURL(`https://plancke.io/hypixel/player/stats/${playerName}`)
			);
			
			let result = "Hey what's up?";
			let rWeight = Math.round((mainWeight + mainBWeight) * 100) / 100;
	
			if (rWeight > 1) {
				result = rWeight.toString().replace(/\B(?<!\.\d*)(?=(\d{3})+(?!\d))/g, ",");
			} else if (rWeight === -1) {
				result = 'This player has collections API off!';
			} else {
				result = rWeight;
			}
	
	
			/*
			The below code is not fun at all and just generally awful, but basically the only way to do all this so yeah.
	
			Different sections are commented but you sort of need to know what you're looking at already.
			*/
	
	
			//Get image relating to their top collection
			let imagePath;
			if (mainCollections) {
				const topCollection = new Map([...mainCollections.entries()].sort((a, b) => b[1] - a[1])).entries().next().value[0];
				imagePath = `./images/${topCollection.toLowerCase().replace(' ', '_')}.png`;
			} else {
				imagePath = `./images/wheat.png`
			}
	
			const { registerFont, createCanvas } = require('canvas');
			registerFont('./fonts/OpenSans-Regular.ttf', { family: 'Open Sans' });
			let attachment;
	
			//Load crop image and avatar
			const background = await Canvas.loadImage(imagePath)
			const avatar = await Canvas.loadImage(`https://mc-heads.net/head/${uuid}/left`).catch(collected => {
				console.log("Couldn't load image")
				return null;
			});
	
			//Create our canvas and draw the crop image
			const canvas = createCanvas(background.width, background.height);
			const ctx = canvas.getContext('2d');
	
			ctx.drawImage(background, 0, 0, canvas.width, canvas.height);
		
			//Add name and rank, then resize to fit
			let name = playerName;
			if (user?.dataValues && user?.dataValues?.rank !== 0 && mainProfileuuid === profile.profile_id) {
				name = (`${playerName} - #${user.dataValues?.rank}`);
			}
	
			ctx.font = '100px "Open Sans"';
			let fontSize = 100;
			do {
				fontSize--;
				ctx.font = fontSize + 'px ' + "Open Sans";
			} while (ctx.measureText(name).width > canvas.width * 0.66);
	
			const metrics = ctx.measureText(name);
			let fontHeight = metrics.emHeightAscent + metrics.emHeightDescent;
	
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
			let weightWidth = ctx.measureText(result).width;
	
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
			let mes = ctx.measureText('Weight');
			ctx.fillText('Farming', weightWidth + 75, canvas.height * 0.9 - (mes.emHeightAscent + mes.emHeightDescent));
	
			//Draw avatar
			if (avatar) {
				ctx.drawImage(avatar, canvas.width - (canvas.height * 0.8) - 50, (canvas.height - canvas.height * 0.8) / 2, canvas.height * 0.8, canvas.height * 0.8);
				ctx.restore();
			}
		
			attachment = new Discord.MessageAttachment(canvas.toBuffer(), 'weight.png');
	
			let reply;
	
			if (user?.dataValues?.cheating) {
				const embed = new Discord.MessageEmbed()
					.setColor('#03fc7b')
					.setDescription(`**This player is a __cheater__.** ${!profile.api ? ` They also turned off their api access.` : ``}`)
					.setFooter('Players are only marked as cheating when it\'s proven beyond a reasonable doubt.\nThey hold no position in any leaderboards.');
				reply = {
					files: [attachment],
					components: [row],
					embeds: [embed],
					allowedMentions: { repliedUser: false }
				}
			} else if (profile.api) {
				reply = {
					files: [attachment],
					components: [row],
					allowedMentions: { repliedUser: false }
				}
			} else {
				const embed = new Discord.MessageEmbed()
					.setColor('#03fc7b')
					.setDescription(`**This data is outdated!** ${playerName.replace(/\_/g, '\\_')} turned off their api access.`);
				reply = {
					files: [attachment],
					components: [row],
					embeds: [embed],
					allowedMentions: { repliedUser: false }
				}
			}
	
			interaction.editReply(reply).then(async () => {
				let reply = await interaction.fetchReply();
				let infoClicked = false;
	
				const collector = reply.createMessageComponentCollector({ componentType: 'BUTTON', time: 30000 });
	
				collector.on('collect', i => {
					if (i.user.id === interaction.user.id) {
						sendDetailedWeight(i, mainWeight, true);
						infoClicked = true;
						collector.stop();
					} else {
						i.reply({ content: `These buttons aren't for you!`, ephemeral: true });
					}
				});
	
				collector.on('end', collected => {
					if (infoClicked) return;
					try {
						const linkRow = new Discord.MessageActionRow().addComponents(
							new Discord.MessageButton()
								.setLabel('SkyCrypt')
								.setStyle('LINK')
								.setURL(`https://sky.shiiyu.moe/stats/${playerName}/${profile.cute_name}`),
							new Discord.MessageButton()
								.setLabel('Plancke')
								.setStyle('LINK')
								.setURL(`https://plancke.io/hypixel/player/stats/${playerName}`)
						);
						reply.edit({ components: [linkRow], allowedMentions: { repliedUser: false } })
					} catch (error) { console.log(error) }
				});
			}).catch(error => { console.log(error) });
		}
	
		async function sendDetailedWeight(interaction, weight, edit = false) {
			let result = "Hey what's up?";
			weight = Math.round((weight + mainBWeight) * 100) / 100;
	
			if (weight > 1) {
				result = weight.toString().replace(/\B(?<!\.\d*)(?=(\d{3})+(?!\d))/g, ",");
			} else if (weight === -1) {
				result = 'This player has collections API off!';
			} else {
				result = weight;
			}
	
			const embed = new Discord.MessageEmbed()
				.setColor('#03fc7b')
				.setTitle(`Stats for ${playerName.replace(/\_/g, '\\_')} on ${profile.cute_name}`)
				.addField('Farming Weight', !result ? '0 - Try some farming!' : result + ' ')
				.addField('Breakdown', getBreakdown(), edit)
				.setFooter('Created by Kaeso#5346    Questions? Use /info');
			
			if (!edit) {
				embed.setThumbnail(`https://mc-heads.net/head/${uuid}/left`)
			}
	
			if (user?.dataValues?.rank !== undefined && user?.dataValues?.rank !== 0 && mainProfileuuid === profile.profile_id && !edit) {
				embed.setDescription(`**${playerName.replace(/\_/g, '\\_')}** is rank **#${user?.dataValues?.rank}!**`)
			}
	
			if (mainBonus.size > 0) {
				embed.addField('Bonus', getBonus(), edit);
			}
	
			let notes = '';
			if (Object.keys(profile.members).length > 1) {
				notes += 'This player has been or is a co op member';
			}
	
			if (user?.dataValues?.cheating) { 
				notes += `\n**This player is a __cheater__.** ${!profile.api ? ` They also turned off their api access.` : ``}`;
			} else if (!profile.api) {
				notes += `\n**This data is outdated! ${playerName.replace(/\_/g, '\\_')} turned off their api access.**`;
			}
	
			if (notes !== '') {
				embed.addField('Notes', notes);
			}
	
			if (!edit) {
				interaction.editReply({ embeds: [embed], allowedMentions: { repliedUser: false } }).catch(error => {
					console.log(error);
				});
			} else {
				const row = new Discord.MessageActionRow().addComponents(
					new Discord.MessageButton()
						.setLabel('SkyCrypt')
						.setStyle('LINK')
						.setURL(`https://sky.shiiyu.moe/stats/${playerName}/${profile.cute_name}`),
					new Discord.MessageButton()
						.setLabel('Plancke')
						.setStyle('LINK')
						.setURL(`https://plancke.io/hypixel/player/stats/${playerName}`)
				);
				interaction.update({ embeds: [embed], allowedMentions: { repliedUser: false }, files: [], components: [row] });
			}
		}
	
		function getBreakdown() {
			//Sort collections
			const sortedCollections = new Map([...mainCollections.entries()].sort((a, b) => b[1] - a[1]));
			let breakdown = '';
			
			sortedCollections.forEach(function (value, key) {
				let percent = Math.floor(value / mainWeight * 100);
				breakdown += (percent > 1) ? `${key}: ${value}  [${percent}%]\n` : (percent > 1) ? `${key}: ${value}  [${percent}%]\n` : '';
			});
	
			return breakdown === '' ? "This player has no notable collections" : breakdown;
		}
	
		function getBonus() {
			//Sort bonus
			const sortedBounus = new Map([...mainBonus.entries()].sort((a, b) => b[1] - a[1]));
			let bonusText = '';
	
			sortedBounus.forEach(function (value, key) {
				bonusText += `${key}: ${value}\n`;
			});
	
			return bonusText === '' ? 'No bonus points :(' : bonusText;
		}
	}
};

