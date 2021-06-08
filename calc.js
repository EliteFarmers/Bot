const Discord = require('discord.js');
const fetch = require('node-fetch');
const throttledQueue = require('throttled-queue');
const { hypixelApiKey } = require('./config.json');
const { DataHandler } = require('./database');
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

	static async getWeight(message, playerName, profileName = null) {
		if (this.cachedPlayers.has(playerName.toLowerCase())) {
			this.cachedPlayers.get(playerName.toLowerCase()).getWeight(message, profileName);
		} else {
			throttle(async function() {
				await PlayerHandler.createPlayer(message, playerName).then(() => {
					PlayerHandler.cachedPlayers.get(playerName.toLowerCase()).getWeight(message, profileName);
				}).catch((error) => {
					console.log(error);
					PlayerHandler.cachedPlayers.delete(playerName.toLowerCase());
					message.edit(new Discord.MessageEmbed()
						.setColor('#03fc7b')
						.setTitle(`A skyblock profile with the username of "${playerName}" does\'t exist`)
						.setDescription('Or Hypixel\'s API is down')
						.setFooter('Created by Kaeso#5346'))
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
				this.cachedPlayers.delete(player.playerName);
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
		this.userData;
		this.collections;

		this.timestamp = Date.now();
	}

	getWeight(message, profileName = null) {
		let userData = this.getUserdata(profileName);

		if (userData.collection === undefined) {
			message.edit(new Discord.MessageEmbed()
				.setColor('#03fc7b')
				.setTitle(`This player doesn't have collections API enabled on ${this.latestProfile.cute_name}`)
				.setFooter('Created by Kaeso#5346'));
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

		let weight = 0;

		this.collections.forEach(function (value, key) {
			weight += value;
		});

		weight = Math.floor(weight * 100) / 100;

		DataHandler.updatePlayer(this.uuid, this.playerName, weight);
		this.sendWeight(message, weight);
	}

	sendWeight(message, weight) {
		let result = "You should never see this";

		if (weight > 1) {
			result = weight.toString().replace(/\B(?<!\.\d*)(?=(\d{3})+(?!\d))/g, ",");
		} else if (weight === -1) {
			result = 'This player has collection API off!';
		} else {
			result = weight;
		}

		const embed = new Discord.MessageEmbed()
			.setColor('#03fc7b')
			.setTitle(`Stats for ${this.playerName} on ${this.latestProfile.cute_name}`)
			.setThumbnail(`https://visage.surgeplay.com/bust/${this.uuid}`)
			.addField('Farming Weight', !result ? 0 : result)
			.addField('Breakdown', this.getBreakdown(weight))
			.setFooter('Created by Kaeso#5346');

		message.edit(embed);
	}

	getUserdata(profileName = null) {
		let profiles = this.data.profiles;

		for (let i = 0; i < Object.keys(profiles).length; i++) {
			let key = Object.keys(profiles)[i];
			let profile = profiles[key];

			if (profileName !== null && profile.cute_name.toLowerCase() === profileName.toLowerCase()) {
				this.latestProfile = profile;
				return profile.members[this.uuid];
			}
			
			if (this.latestProfile === undefined || profile.members[this.uuid].last_save > this.latestProfile.members[this.uuid].last_save) {
				this.latestProfile = profile;
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
			breakdown += (percent > 50) ? `\n${key}: ${value}  [${percent}%]\n` : (percent > 1) ? `${key}: ${value}  [${percent}%]\n` : '';
		});

		return breakdown === "" ? "This player has no notable collections" : breakdown;
	}
}

module.exports = {
	PlayerHandler,
	Player
}

