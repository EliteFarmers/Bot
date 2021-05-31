const Discord = require('discord.js');
const fetch = require('node-fetch');

class PlayerHandler {

	constructor() {
		this.player;
	}

	static cachedPlayers = new Discord.Collection();
	
	static async getProfiles(playerName) {
		const response = await fetch(`https://sky.shiiyu.moe/api/v2/profile/${playerName}`)
			.then(response => {
				return response.json();
			})
			.then(result => {
				if (result.error === undefined) {
					return result;
				} else {
					throw new Error(result.error);
				}
			})
			.catch(error => {
				throw new Error(error);
			});
		return await response;

	}

	static async getWeight(message, playerName, profileName = null) {
		if (this.cachedPlayers.has(playerName.toLowerCase())) {
			this.cachedPlayers.get(playerName.toLowerCase()).getWeight(message, profileName);
		} else {
			await this.createPlayer(message, playerName).then(() => {
				this.cachedPlayers.get(playerName.toLowerCase()).getWeight(message, profileName);
			}).catch(() => {
				message.edit(new Discord.MessageEmbed()
					.setColor('#03fc7b')
					.setTitle(`A skyblock profile with the username of "${playerName}" does\'t exist`)
					.setDescription('Or Sky Crypt\'s API is down')
					.setFooter('Created by Kaeso#5346'))
			})
		}
	}

	static async createPlayer(message, playerName) {
		await this.getProfiles(playerName).then(profiles => {
			this.cachedPlayers.set(playerName.toLowerCase(), new Player(playerName.toLowerCase(), profiles));
		}).catch(error => {
			throw new Error(error);
		});
		let player = new Player(playerName)
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

	constructor(playerName, data) {
		this.playerName = playerName;
		this.data = data;
		this.latestProfile;
		this.collections;

		this.timestamp = Date.now();
	}

	getWeight(message, profileName = null) {
		let profile = this.getProfile(profileName);

		if (profile.raw.collection === undefined) {
			message.edit(new Discord.MessageEmbed()
				.setColor('#03fc7b')
				.setTitle(`This player doesn't have collections API enabled on ${profile.cute_name}`)
				.setFooter('Created by Kaeso#5346'));
			return -1;
		}

		let { WHEAT, POTATO_ITEM, CARROT_ITEM, MUSHROOM_COLLECTION, PUMPKIN, MELON, SUGAR_CANE, CACTUS, NETHER_STALK } = profile.raw.collection;
		let COCOA = profile.raw.collection["INK_SACK:3"];
		
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
		
		let col = this.latestProfile.raw.collection;
		this.collections = new Map();
		
		//Normalize collections
		this.collections.set('Wheat', Math.round(WHEAT));
		this.collections.set('Carrot', Math.round(CARROT_ITEM / 3));
		this.collections.set('Potato', Math.round(POTATO_ITEM / 3));
		this.collections.set('Pumpkin', Math.round(PUMPKIN));
		this.collections.set('Melon', Math.round(MELON / 5));
		this.collections.set('Mushroom', Math.round(MUSHROOM_COLLECTION));
		this.collections.set('Cocoa', Math.round(col['INK_SACK:3'] / 3));
		this.collections.set('Cactus', Math.round(CACTUS));
		this.collections.set('Sugar Cane', Math.round(SUGAR_CANE / 2));
		this.collections.set('Nether Wart', Math.round(NETHER_STALK / 2.5));

		let weight = 0;

		this.collections.forEach(function(value, key) {
			weight += value / 100000;
		});

		this.sendWeight(message, Math.floor(weight * 100) / 100);
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
			.setTitle(`Stats for ${this.latestProfile.data.display_name} on ${this.latestProfile.cute_name}`)
			.setThumbnail(`https://visage.surgeplay.com/bust/${this.getUUID()}`)
			.addField('Farming Weight', !result ? 0 : result)
			.addField('Breakdown', this.getBreakdown(weight))
			.setFooter('Created by Kaeso#5346');

		message.edit(embed);
	}

	getProfile(profileName = null) {
		let profiles = this.data.profiles;

		for (let i = 0; i < Object.keys(profiles).length; i++) {
			let key = Object.keys(profiles)[i];
			let profile = profiles[key];

			if (profileName !== null && profile.cute_name.toLowerCase() === profileName.toLowerCase()) {
				this.latestProfile = profile;
				return profile;
			}
			
			if (this.latestProfile === undefined || profile.last_save > this.latestProfile.last_save) {
				this.latestProfile = profile;
			}
		}

		return this.latestProfile;
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

	getUUID() {
		return this.latestProfile.data.uuid;
	}
}

module.exports = {
	PlayerHandler,
	Player
}

