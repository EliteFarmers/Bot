const Discord = require('discord.js');
const Canvas = require('canvas');
const fetch = require('node-fetch');
const throttledQueue = require('throttled-queue');
const { hypixelApiKey } = require('./config.json');
const { DataHandler } = require('./database.js');
const throttle = throttledQueue(2, 1000);

class PlayerHandler {

	constructor() {
		this.player;
	}

	static cachedPlayers = new Discord.Collection();

	static async getUUID(playerName) {
		const uuid = await fetch(`https://api.mojang.com/users/profiles/minecraft/${playerName}`)
			.then(response => response.json())
			.then(result => {
				if (result.success === false) {
					throw new Error("That minecraft player doesn't exist");
				} else {
					return result;
				}
			})
			.catch(error => {
				throw error;
			});
		return await uuid;
	}
	
	static async getProfiles(uuid) {
		const response = await fetch(`https://api.hypixel.net/skyblock/profiles?uuid=${uuid}&key=${hypixelApiKey}`)
			.then(response => {
				return response.json();
			})
			.then(result => {
				if (result.success === true) {
					return result;
				} else {
					throw new Error(result.error);
				}
			})
			.catch(error => {
				throw error;
			});
			return await response;
	}

	static async getWeight(message, playerName, detailed = false, profileName = null) {
		if (this.cachedPlayers.has(playerName.toLowerCase())) {
			this.cachedPlayers.get(playerName.toLowerCase()).getWeight(message, detailed, profileName);
		} else {
			throttle(async function() {
				await PlayerHandler.createPlayer(message, playerName).then(() => {
					PlayerHandler.cachedPlayers.get(playerName.toLowerCase()).getWeight(message, detailed, profileName);
				}).catch((error) => {
					PlayerHandler.cachedPlayers.delete(playerName.toLowerCase());
					message.reply({
						embeds: [new Discord.MessageEmbed()
							.setColor('#03fc7b')
							.setTitle(`A skyblock profile with the username of "${playerName}" does\'t exist`)
							.setDescription('Or Hypixel\'s API is down')
							.setFooter('Created by Kaeso#5346')],
						allowedMentions: { repliedUser: true }
					})
				})
			})
		}
	}

	static async createPlayer(message, playerName) {
		let properName = playerName;
		const uuid = await this.getUUID(playerName)
			.then(response => {
				properName = response.name;
				return response.id;
			}).catch(error => {
				throw error;
			});
		await this.getProfiles(uuid).then(profiles => {
			this.cachedPlayers.set(playerName.toLowerCase(), new Player(message, properName, uuid, profiles));
		}).catch(error => {
			throw error;
		});
	}

	static clearCache(minutes) {
		let time = Date.now();
		let seconds = minutes * 60;
		this.cachedPlayers.forEach(player => {
			if (player.timestamp < time - seconds) {
				this.cachedPlayers.delete(player.playerName.toLowerCase());
			}
		});
	}

}

class Player {

	constructor(message, playerName, uuid, data) {
		this.message = message;
		this.playerName = playerName;
		this.uuid = uuid
		this.data = data;

		this.latestProfile;
		this.profileuuid;
		this.mainProfileuuid;
		this.userData;

		this.attachment = null;

		this.collections;
		this.weight = 0;
		this.bonus;
		this.bonusWeight = 0;
		this.rank;

		this.timestamp = Date.now();
	}

	async getWeight(message, detailed, profileName = null) {
		let userData = this.getUserdata(profileName);
		if (userData === null) {
			message.reply({
				embeds: [new Discord.MessageEmbed()
					.setColor('#03fc7b')
					.setTitle(`This player doesn't have a skyblock profile!`)
					.setFooter('Created by Kaeso#5346')],
				allowedMentions: { repliedUser: true }
			});
			return -1;
		}

		const player = await DataHandler.getPlayer(this.uuid);
		if (player !== null) {
			this.rank = player.dataValues.rank;
			this.mainProfileuuid = player.dataValues.profile;
		}
			
		if (userData.collection === undefined) {
			message.reply({
				embeds: [new Discord.MessageEmbed()
					.setColor('#03fc7b')
					.setTitle(`This player doesn't have collections API enabled on ${this.latestProfile.cute_name}`)
					.setFooter('Created by Kaeso#5346')],
				allowedMentions: { repliedUser: true }
			});
			return -1;
		}

		let { WHEAT, POTATO_ITEM, CARROT_ITEM, MUSHROOM_COLLECTION, PUMPKIN, MELON, SUGAR_CANE, CACTUS, NETHER_STALK } = userData.collection;
		let COCOA = userData.collection["INK_SACK:3"];
		
		//Set potentially empty values to 0
		if (!WHEAT) WHEAT = 0;
		if (!PUMPKIN) PUMPKIN = 0;
		if (!MUSHROOM_COLLECTION) MUSHROOM_COLLECTION = 0;
		if (!CARROT_ITEM) CARROT_ITEM = 0;
		if (!POTATO_ITEM) POTATO_ITEM = 0;
		if (!MELON) MELON = 0;
		if (!COCOA) COCOA = 0;
		if (!CACTUS) CACTUS = 0;
		if (!NETHER_STALK) NETHER_STALK = 0;
		if (!SUGAR_CANE) SUGAR_CANE = 0;
		
		this.collections = new Map();
		
		//Normalize collections
		this.collections.set('Wheat', Math.round(WHEAT / 1000) / 100);
		this.collections.set('Carrot', Math.round(CARROT_ITEM / 3000) / 100);
		this.collections.set('Potato', Math.round(POTATO_ITEM / 3000) / 100);
		this.collections.set('Pumpkin', Math.round(PUMPKIN * 1.41089 / 1000) / 100);
		this.collections.set('Melon', Math.round(MELON * 1.41089 / 5000) / 100);
		this.collections.set('Mushroom', Math.round(MUSHROOM_COLLECTION * 1.20763 / 1000) / 100);
		this.collections.set('Cocoa', Math.round(COCOA * 1.36581 / 3000) / 100);
		this.collections.set('Cactus', Math.round(CACTUS * 1.25551 / 1000) / 100);
		this.collections.set('Sugar Cane', Math.round(SUGAR_CANE / 2000) / 100);
		this.collections.set('Nether Wart', Math.round(NETHER_STALK / 2500) / 100);
		
		//Bonus sources
		this.bonus = new Map();
		
		//Farming level bonuses
		let farmingCap = userData.jacob2.perks.farming_level_cap ?? 0;
		if (userData.experience_skill_farming > 111672425 && farmingCap === 10) {
			this.bonus.set('Farming Level 60', 250);
		} else if (userData.experience_skill_farming > 55172425) {
			this.bonus.set('Farming Level 50', 100);
		}
		
		//Anita buff bonus
		let anitaBuff = userData.jacob2.perks.double_drops ?? 0;
		if (anitaBuff === 15) { //15 in API refers to 30 
			this.bonus.set('Max Anita Buff', 30);
		}
		
		//Calculate Amount of Gold medals won
		let earnedGolds = 0;
		let contests = userData.jacob2.contests;
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
		if (earnedGolds > 1000) {
			this.bonus.set('1,000 Gold Medals', 500);
		} else {
			let roundDown = Math.floor(earnedGolds / 50) * 50;
			if (roundDown > 0) {
				this.bonus.set(`${roundDown} Gold Medals`, roundDown / 2);
			}
		}
		
		//Tier 12 farming minions
		let tier12s = ['WHEAT_12', 'CARROT_12', 'POTATO_12', 'PUMPKIN_12', 'MELON_12', 'MUSHROOM_12', 'COCOA_12', 'CACTUS_12', 'SUGAR_CANE_12', 'NETHER_WARTS_12'];
		let obtained12s = 0;
		if ('crafted_generators' in userData) {
			let obtainedMinions = userData.crafted_generators;
			tier12s.forEach(minion => {
				obtained12s += (obtainedMinions.includes(minion)) ? 1 : 0;
			});
		}
		if (obtained12s > 0) {
			this.bonus.set(`${obtained12s}/10 Minions`, obtained12s * 5);
		}

		let bWeight = 0;
		this.bonus.forEach(function (value, key) {
			bWeight += value;
		});
		
		this.bonusWeight = bWeight;
		let weight = 0;

		this.collections.forEach(function (value, key) {
			weight += value;
		});

		weight = Math.floor(weight * 100) / 100;
		this.weight = weight;

		DataHandler.updatePlayer(this.uuid, this.playerName, this.profileuuid, weight + this.bonusWeight);
		if (detailed) {
			this.sendDetailedWeight(message, weight);
		} else {
			this.sendWeight(message, weight);
		}
	}

	async sendWeight(message, weight) {
		const filter = i => i.customID === 'info' && i.user.id === message.author.id;
		
		const row = new Discord.MessageActionRow().addComponents(
			new Discord.MessageButton()
				.setCustomID('info')
				.setLabel('More Info')
				.setStyle('SUCCESS'),
			new Discord.MessageButton()
				.setLabel('SkyCrypt')
				.setStyle('LINK')
				.setURL(`https://sky.shiiyu.moe/stats/${this.uuid}`)
		);
		
		if (false) {
		// if (this.attachment !== null) {
			message.reply({
				files: [this.attachment],
				components: [row],
				allowedMentions: { repliedUser: false }
			}).then(sentEmbed => {
				sentEmbed.awaitMessageComponentInteraction(filter, { time: 15000 })
					.then(i => {
						this.sendDetailedWeight(i, weight, true);
					})
					.catch(error => {
						sentEmbed.edit({ components: [], allowedMentions: { repliedUser: false } })
					});
			});
		} else {
			let result = "Hey what's up?";
			weight = Math.round((weight + this.bonusWeight) * 100) / 100;

			if (weight > 1) {
				result = weight.toString().replace(/\B(?<!\.\d*)(?=(\d{3})+(?!\d))/g, ",");
			} else if (weight === -1) {
				result = 'This player has collections API off!';
			} else {
				result = weight;
			}


			/*
			The below code is not fun at all and just generally awful, but basically the only way to do all this so yeah.
	
			Different sections are commented but you sort of need to know what you're looking at already.
			*/


			//Get image relating to their top collection
			const topCollection = new Map([...this.collections.entries()].sort((a, b) => b[1] - a[1])).entries().next().value[0];
			let imagePath = `./images/${topCollection.toLowerCase().replace(' ', '_')}.png`;

			const { registerFont, createCanvas } = require('canvas');
			registerFont('./fonts/Raleway-Regular.ttf', { family: 'Raleway' });
			let attachment;

			//Load crop image and avatar
			const background = await Canvas.loadImage(imagePath)
			const avatar = await Canvas.loadImage(`https://mc-heads.net/head/${this.uuid}/left`).catch(collected => {
				avatar = null;
			});

			//Create our canvas and draw the crop image
			const canvas = createCanvas(background.width, background.height);
			const ctx = canvas.getContext('2d');

			ctx.drawImage(background, 750, 0, canvas.width, canvas.height);
		
			//Fill in the body and add green stripe
			ctx.fillStyle = "#2f3136";
			ctx.fillRect(0, 0, 1495, 400);
			ctx.fillStyle = "#03fc7b";
			ctx.fillRect(0, 0, 20, 400);
		
			//Add name and rank, then resize to fit
			let name = this.playerName;
			if (this.rank !== undefined && this.rank !== 0 && this.mainProfileuuid === this.profileuuid) {
				name = (`${this.playerName} - #${this.rank}`);
			}

			ctx.font = '100px "Raleway"';
			let fontSize = 100;
			do {
				fontSize--;
				ctx.font = fontSize + 'px ' + "Raleway";
			} while (ctx.measureText(name).width > canvas.width * 0.66);

			const metrics = ctx.measureText(name);
			let fontHeight = metrics.emHeightAscent + metrics.emHeightDescent;

			ctx.fillStyle = '#dddddd';
			ctx.fillText(name, 55, 90 - (90 - fontHeight) / 2);
			ctx.save();

			//Add weight and label, then resize to fit
			ctx.font = '256px "Sans"';
			fontSize = 256;

			do {
				fontSize--;
				ctx.font = fontSize + 'px ' + "Sans";
			} while (ctx.measureText(result).width > canvas.width * 0.66);
			let weightWidth = ctx.measureText(result).width;

			ctx.fillStyle = '#dddddd';
			ctx.fillText(result, 50, canvas.height * 0.9);

			ctx.font = '64px "Sans"';
			fontSize = 64;

			do {
				fontSize--;
				ctx.font = fontSize + 'px ' + "Sans";
			} while (ctx.measureText('Weight').width + weightWidth > canvas.width - 505);

			ctx.fillStyle = '#dddddd';
			ctx.fillText('Weight', weightWidth + 50, canvas.height * 0.9);

			//Draw avatar
			if (avatar) {
				ctx.drawImage(avatar, canvas.width - (canvas.height * 0.8) - 50, (canvas.height - canvas.height * 0.8) / 2, canvas.height * 0.8, canvas.height * 0.8);
				ctx.restore();
			}
		
			// if (this.profileuuid === this.mainProfileuuid) {
			// 	this.attachment = new Discord.MessageAttachment(canvas.toBuffer(), 'weight.png');
			// }
		
			message.reply({
				files: [this.attachment],
				components: [row],
				allowedMentions: { repliedUser: false }
			}).then(sentEmbed => {
				sentEmbed.awaitMessageComponentInteraction(filter, { time: 15000 })
					.then(i => {
						this.sendDetailedWeight(i, this.weight, true);
					})
					.catch(error => {
						sentEmbed.edit({ components: [], allowedMentions: { repliedUser: false } })
					});
			});
		}
	}

	sendDetailedWeight(message, weight, edit = false) {
		let result = "Hey what's up?";
		weight = Math.round((weight + this.bonusWeight) * 100) / 100;

		if (weight > 1) {
			result = weight.toString().replace(/\B(?<!\.\d*)(?=(\d{3})+(?!\d))/g, ",");
		} else if (weight === -1) {
			result = 'This player has collections API off!';
		} else {
			result = weight;
		}

		const embed = new Discord.MessageEmbed()
			.setColor('#03fc7b')
			.setTitle(`Stats for ${this.playerName} on ${this.latestProfile.cute_name}`)
			.setThumbnail(`https://mc-heads.net/head/${this.uuid}/left`)
			.addField('Farming Weight', !result ? 0 : result)
			.addField('Breakdown', this.getBreakdown(weight - this.bonusWeight))
			.setFooter('Created by Kaeso#5346');

		if (this.rank !== undefined && this.rank !== 0 && this.mainProfileuuid === this.profileuuid) {
			embed.setDescription(`**${this.playerName}** is rank **#${this.rank}!**`)
		}

		if (this.bonus.size > 0) {
			embed.addField('Bonus', this.getBonus());
		}

		if (Object.keys(this.latestProfile.members).length > 1) {
			embed.addField('Notes', 'This player has been or is a co op member');
		}

		if (!edit) {
			message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
		} else {
			message.update({ embeds: [embed], allowedMentions: { repliedUser: false }, files: [], components: [] });
		}
	}

	getUserdata(profileName = null) {
		if (!this.data.profiles) {
			return null;
		}
		let profiles = this.data.profiles;

		for (let i = 0; i < Object.keys(profiles).length; i++) {
			let key = Object.keys(profiles)[i];
			let profile = profiles[key];
			
			if (profileName !== null && profile.cute_name.toLowerCase() === profileName.toLowerCase()) {
				this.latestProfile = profile;
				this.profileuuid = profile.profile_id;

				return profile.members[this.uuid];
			}
			
			if (this.latestProfile === undefined || profile.members[this.uuid].last_save > this.latestProfile.members[this.uuid].last_save) {
				this.latestProfile = profile;
				this.profileuuid = profile.profile_id;
			}
		}

		this.userData = this.latestProfile.members[this.uuid];
		return this.latestProfile.members[this.uuid];
	}

	getBreakdown(weight) {
		//Sort collections
		const sortedCollections = new Map([...this.collections.entries()].sort((a, b) => b[1] - a[1]));
		let breakdown = "";
		
		sortedCollections.forEach(function (value, key) {
			let percent = Math.floor(value / weight * 100);
			breakdown += (percent > 1) ? `${key}: ${value}  [${percent}%]\n` : (percent > 1) ? `${key}: ${value}  [${percent}%]\n` : '';
		});

		return breakdown === "" ? "This player has no notable collections" : breakdown;
	}

	getBonus() {
		//Sort bonus
		const sortedBounus = new Map([...this.bonus.entries()].sort((a, b) => b[1] - a[1]));
		let bonusText = " ";

		sortedBounus.forEach(function (value, key) {
			bonusText += `${key}: ${value}\n`;
		});

		return bonusText;
	}
}

module.exports = {
	PlayerHandler,
	Player
}

