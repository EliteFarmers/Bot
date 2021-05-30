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

	static async getUUID(playerName) {
		await fetch(`https://api.mojang.com/users/profiles/minecraft/${playerName}`)
			.then(response => response.json())
			.then(result => {
				console.log('Success:', result);
				return result.id;
			})
			.catch(error => {
				throw new Error(error);
			});
	}

	static async getWeight(message, playerName, profileName = null) {
		if (this.cachedPlayers.has(playerName.toLowerCase())) {
			this.cachedPlayers.get(playerName.toLowerCase()).getWeight(message, profileName);
		} else {
			await this.createPlayer(message, playerName).then(() => {
				this.cachedPlayers.get(playerName.toLowerCase()).getWeight(message, profileName);
			})
		}
	}

	static async createPlayer(message, playerName) {
		await this.getProfiles(playerName).then(profiles => {
			this.cachedPlayers.set(playerName.toLowerCase(), new Player(playerName.toLowerCase(), profiles));
		}).catch(error => {
			message.channel.send(`A skyblock profile account with the username of "${playerName}" does\'t exist or Sky Crypt\'s API is down.\n${error}`);
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

		this.timestamp = Date.now();
	}

	getWeight(message, profileName = null) {
		let profile = this.getProfile(profileName);

		if (profile.raw.collection === undefined) {
			return -1;
		}

		let { WHEAT, POTATO_ITEM, CARROT_ITEM, MUSHROOM_COLLECTION, PUMPKIN, MELON, SUGAR_CANE, CACTUS, NETHER_STALK } = profile.raw.collection;
		let COCOA = profile.raw.collection["INK_SACK:3"];
		
		//Normalized collections
		//Wheat, Pumpkin, and Mushroom are all 1
		if (!WHEAT) WHEAT = 0;
		if (!PUMPKIN) PUMPKIN = 0;
		if (!MUSHROOM_COLLECTION) MUSHROOM_COLLECTION = 0;
		if (!CARROT_ITEM) CARROT_ITEM = 0; else CARROT_ITEM /= 3;
		if (!POTATO_ITEM) POTATO_ITEM = 0; else POTATO_ITEM /= 3;
		if (!MELON) MELON = 0; else MELON /= 5;
		if (!COCOA) COCOA = 0; else COCOA /= 3;
		if (!CACTUS) CACTUS = 0; else CACTUS /= 2;
		if (!NETHER_STALK) NETHER_STALK = 0; else NETHER_STALK /= 2.5;
		if (!SUGAR_CANE) SUGAR_CANE = 0; else SUGAR_CANE /= 2;

		let collections = [WHEAT, PUMPKIN, MUSHROOM_COLLECTION, CARROT_ITEM, POTATO_ITEM, MELON, COCOA, CACTUS, NETHER_STALK, SUGAR_CANE];

		let sum = (+WHEAT ?? 0) + (+POTATO_ITEM ?? 0) + (+CARROT_ITEM ?? 0) + (+MUSHROOM_COLLECTION ?? 0) + (+PUMPKIN ?? 0) + (+MELON ?? 0) + (+SUGAR_CANE ?? 0) + (+CACTUS ?? 0) + (+NETHER_STALK ?? 0) + (+COCOA ?? 0);		let weight = (sum < 10000) ? Math.round(sum * 100) / 10000000 : Math.round(sum / 1000) / 100;

		this.sendWeight(message, weight);
	}

	sendWeight(message, weight) {
		let result = "You should never see this";

		if (weight > 1) {
			result = weight.toString().replace(/\B(?<!\.\d*)(?=(\d{3})+(?!\d))/g, ",");
		} else if (weight === -1) {
			result = 'This player has collection API off!';
		} else {
			result = weight
		}

		const embed = new Discord.MessageEmbed()
			.setColor('#03fc7b')
			.setTitle(`Farming weight for ${this.latestProfile.data.display_name}`)
			.setThumbnail(`https://crafatar.com/renders/head/${this.getUUID()}`)
			.addField('Weight', result)
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

	getUUID() {
		return this.latestProfile.data.uuid;
	}
}

module.exports = {
	PlayerHandler,
	Player
}

