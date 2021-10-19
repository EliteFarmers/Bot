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

	static async getOverview(uuid) {
		const response = await fetch(`https://api.hypixel.net/player?uuid=${uuid}&key=${hypixelApiKey}`)
			.then(async respon => {
				return await respon.json();
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

	//WORK ON THIS
	static async getDiscord(uuid) {
		return new Promise((resolve, reject) => {
			throttle(async function() {
				await PlayerHandler.getOverview(uuid).then(data => {
					if (!data.success) { return null; }
					let discord = data?.player?.socialMedia?.links?.DISCORD;
					if (discord) {
						resolve(discord);
					} else {
						resolve(undefined);
					}
				}).catch(error => {
					console.log(error);
					resolve(undefined);
				});
			});
		});
	}

	static async tryAgain(interaction, playerName, profileName = null) {
		const user = await DataHandler.getPlayerByName(playerName.toLowerCase());
		if (user?.dataValues?.profiledata && user?.dataValues?.ign && user?.dataValues?.uuid) {
			PlayerHandler.cachedPlayers.set(playerName.toLowerCase(), new Player(interaction, user.dataValues.ign, user.dataValues.uuid, user.dataValues.profiledata.data, true, profileName, false));
			return true;
		}
		return false;
	}

	static async getWeight(interaction, playerName, profileName = null) {
		if (this.cachedPlayers.has(playerName.toLowerCase())) {
			this.cachedPlayers.get(playerName.toLowerCase()).sendWeight(interaction, profileName);
		} else {
			throttle(async function() {
				await PlayerHandler.createPlayer(interaction, playerName).then(() => {
					PlayerHandler.cachedPlayers.get(playerName.toLowerCase()).sendWeight(interaction, profileName);
				}).catch(async (error) => {
					console.log(error);
					PlayerHandler.cachedPlayers.delete(playerName.toLowerCase());

					if (!await PlayerHandler.tryAgain(interaction, playerName, profileName)) {
						interaction.editReply({
							embeds: [new Discord.MessageEmbed()
								.setColor('#03fc7b')
								.setTitle(`A skyblock profile with the username of "${playerName}" doesn\'t exist`)
								.setDescription('Their API might also be turned off, or Hypixel\'s API is down')
								.setFooter('Created by Kaeso#5346')],
							allowedMentions: { repliedUser: true }
						});
					};
				})
			})
		}
	}

	static async createPlayer(interaction, playerName) {
		let properName = playerName;
		const uuid = await this.getUUID(playerName)
			.then(response => {
				properName = response.name;
				return response.id;
			}).catch(error => {
				if (typeof error !== fetch.FetchError) {
					console.log(error);
					throw error;
				}
			});
		await this.getProfiles(uuid).then(async profiles => {
			let data = await this.stripData(profiles, uuid);
			const user = await DataHandler.getPlayer(uuid);
			if (user?.dataValues?.profiledata?.data) {
				data = await PlayerHandler.getBestData(user.dataValues.profiledata.data, data); 
			}
			this.cachedPlayers.set(playerName.toLowerCase(), new Player(interaction, properName, uuid, data));
		}).catch(error => {
			console.log(error);
			throw error;
		});
	}

	static async saveData(player) {
		const user = await DataHandler.getPlayer(player.uuid);
		if (user?.dataValues?.profiledata) {
			try {
				let oldData = user.dataValues.profiledata;
				oldData.data = await getBestData(oldData.data, player.data);

				return await DataHandler.update({ profiledata: oldData }, { uuid: player.uuid });
			} catch (e) {}
		}
		const data = {
			data: player.data,
			cheating: {
				cheating: false,
				evidence: null
			}
		};
		return await DataHandler.update({ profiledata: data }, { uuid: player.uuid });
	}

	static async stripData(data, uuid) {
		let stripped = {
			success: data.success,
			profiles: []
		}

		for (let i = 0; i < Object.keys(data.profiles).length; i++) {
			let key = Object.keys(data.profiles)[i];
			let profile = data.profiles[key];
			let user = profile.members[uuid];

			let addedProfile = {
				profile_id: profile.profile_id,
				cute_name: profile.cute_name,
				members: {}
			}
			if (Object.keys(profile.members).length > 1) {
				addedProfile.members = {
					[uuid]: {
						experience_skill_farming: user.experience_skill_farming,
						collection: user.collection,
						crafted_generators: user.crafted_generators,
						jacob2: user.jacob2
					},
					lamecoop: {
						sad: null
					}
				}
			} else {
				addedProfile.members = {
					[uuid]: {
						experience_skill_farming: user.experience_skill_farming,
						collection: user.collection,
						crafted_generators: user.crafted_generators,
						jacob2: user.jacob2
					}
				}
			}

			stripped.profiles.push(addedProfile);
		}

		return stripped;
	}

	static async getBestData(saved, fresh, uuid) {
		try {
			const newData = {
				success: true,
				profiles: []
			}

			let length = Math.min(Object.keys(saved.profiles).length, Object.keys(fresh.profiles).length);
			for (let i = 0; i < length; i++) {
				const savedProfile = saved.profiles[Object.keys(saved.profiles)[i]];
				const freshProfile = fresh.profiles[Object.keys(fresh.profiles)[i]];

				if (freshProfile.members[Object.keys(freshProfile.members)[0]].collection) {
					newData.profiles.push({
						profile_id: freshProfile.profile_id,
						cute_name: freshProfile.cute_name,
						members: freshProfile.members
					});
				} else {
					newData.profiles.push({
						profile_id: savedProfile.profile_id,
						cute_name: savedProfile.cute_name,
						api: false,
						members: savedProfile.members
					});
				}
			}
			if (length < Object.keys(fresh.profiles).length) {
				for (let i = length; i < Object.keys(fresh.profiles).length; i++) {
					const profile = fresh.profiles[Object.keys(fresh.profiles)[i]];

					newData.profiles.push({
						profile_id: profile.profile_id,
						cute_name: profile.cute_name,
						members: profile.members
					});
				}
			}
			return newData;
		} catch (e) {
			console.log(e);
			return fresh;
		}
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

	constructor(interaction, playerName, uuid, data, send = false, profileName = null, api = true) {
		this.interaction = interaction;
		this.playerName = playerName;
		this.uuid = uuid;
		this.data = data;

		this.bestProfile;
		this.profileData;
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
		this.api = api;

		PlayerHandler.saveData(this);

		if (send) {
			this.sendWeight(interaction, profileName);
		}
	}

	async getWeight(userData) {
		if (userData === null) {
			return -1;
		}
			
		if (userData.collection === undefined) {
			// new Discord.MessageEmbed()
			// 		.setColor('#03fc7b')
			// 		.setTitle(`This player doesn't have collections API enabled on ${this.bestProfile.cute_name}`)
			// 		.setFooter('Created by Kaeso#5346')
			return -2;
		}

		let { WHEAT, POTATO_ITEM, CARROT_ITEM, MUSHROOM_COLLECTION, PUMPKIN, MELON, SUGAR_CANE, CACTUS, NETHER_STALK } = userData.collection;
		let COCOA = userData.collection["INK_SACK:3"]; //Dumb cocoa
		
		//Set potentially empty values to 0, and fix overflow
		if (!WHEAT) { WHEAT = 0; } else if (WHEAT < 0) { WHEAT += 4294967294; };
		if (!PUMPKIN) { PUMPKIN = 0; } else if (PUMPKIN < 0) { PUMPKIN += 4294967294; };
		if (!MUSHROOM_COLLECTION) { MUSHROOM_COLLECTION = 0; } else if (MUSHROOM_COLLECTION < 0) { MUSHROOM_COLLECTION += 4294967294; };
		if (!CARROT_ITEM) { CARROT_ITEM = 0; } else if (CARROT_ITEM < 0) { CARROT_ITEM += 4294967294; };
		if (!POTATO_ITEM) { POTATO_ITEM = 0; } else if (POTATO_ITEM < 0) { POTATO_ITEM += 4294967294; };
		if (!MELON) { MELON = 0; } else if (MELON < 0) { MELON += 4294967294; };
		if (!COCOA) { COCOA = 0; } else if (COCOA < 0) { COCOA += 4294967294; };
		if (!CACTUS) { CACTUS = 0; } else if (CACTUS < 0) { CACTUS += 4294967294; };
		if (!NETHER_STALK) { NETHER_STALK = 0; } else if (NETHER_STALK < 0) { NETHER_STALK += 4294967294; };
		if (!SUGAR_CANE) { SUGAR_CANE = 0; } else if (SUGAR_CANE < 0) { SUGAR_CANE += 4294967294; };
		
		let collections = new Map();
		
		//Normalize collections
		collections.set('Wheat', Math.round(WHEAT / 1000) / 100);
		collections.set('Carrot', Math.round(CARROT_ITEM / 3000) / 100);
		collections.set('Potato', Math.round(POTATO_ITEM / 3000) / 100);
		collections.set('Pumpkin', Math.round(PUMPKIN * 1.41089 / 1000) / 100);
		collections.set('Melon', Math.round(MELON * 1.41089 / 5000) / 100);
		collections.set('Mushroom', Math.round(MUSHROOM_COLLECTION * 1.20763 / 664) / 100);
		collections.set('Cocoa', Math.round(COCOA * 1.36581 / 3000) / 100);
		collections.set('Cactus', Math.round(CACTUS * 1.25551 / 2000) / 100);
		collections.set('Sugar Cane', Math.round(SUGAR_CANE / 2000) / 100);
		collections.set('Nether Wart', Math.round(NETHER_STALK / 2500) / 100);
		
		//Bonus sources
		let bonus = new Map();
		
		if (userData.jacob2) {
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
			} catch (e) {}
		}
		
		//Tier 12 farming minions
		let tier12s = ['WHEAT_12', 'CARROT_12', 'POTATO_12', 'PUMPKIN_12', 'MELON_12', 'MUSHROOM_12', 'COCOA_12', 'CACTUS_12', 'SUGAR_CANE_12', 'NETHER_WARTS_12'];
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

		let bonusWeight = 0;
		bonus.forEach(function (value, key) {
			bonusWeight += value;
		});
		
		let weight = 0;

		collections.forEach(function (value, key) {
			weight += value;
		});

		weight = Math.floor(weight * 100) / 100;

		return [
			weight,
			bonusWeight,
			collections,
			bonus,
			userData
		];
	}

	async getUserdata(profileName = null) {
		if (!this.data.profiles) {
			return null;
		}

		const user = await DataHandler.getPlayer(this.uuid);
		if (user !== null) {
			this.rank = user.dataValues.rank;
			this.mainProfileuuid = user.dataValues.profile;
		}

		// let data = await PlayerHandler.getBestData(user.dataValues.profiledata.data, this.data, this.uuid);
		let profiles = this.data.profiles;
		let bestData = null;
		let best = false;

		for (let i = 0; i < Object.keys(profiles).length; i++) {
			let key = Object.keys(profiles)[i];
			let profile = profiles[key];

			if (profileName !== null && profile.cute_name.toLowerCase() === profileName.toLowerCase()) {
				let calc = await this.getWeight(profile.members[this.uuid]).then(data => {
					this.profileData = profile;
					bestData = data;
				});
				break;
			} else {
				best = true;
			}

			let calc = await this.getWeight(profile.members[this.uuid]).then(data => {
				if (data !== -1 && data !== -2) {
					let weight = data[0] + data[1];
					if (bestData) {
						if (weight > (bestData[0] + bestData[1])) {
							bestData = data;
							this.profileData = profile;
						}
					} else {
						bestData = data;
						this.profileData = profile;
					}
				}
			})
		}

		if (!bestData) {
			this.weight = 0
			this.bonusWeight = 0
			return null;
		}

		this.weight = bestData[0];
		this.bonusWeight = bestData[1];
		this.collections = bestData[2];
		this.bonus = bestData[3];
		this.bestProfile = bestData[4];
		this.profileuuid = this.profileData.profile_id;

		this.userData = this.bestProfile;
		this.api = this.profileData?.api ?? true;
		return this.bestProfile;
	}

	async sendWeight(interaction, profileName = null) {
		let userData = await this.getUserdata(profileName);

		if (!userData && !await PlayerHandler.tryAgain(interaction, this.playerName, profileName)) {
			const embed = new Discord.MessageEmbed()
				.setColor('#03fc7b')
				.setTitle(`Stats for ${this.playerName}`)
				.addField('Farming Weight', 'Zero! - Try some farming!\nOr turn on API access and help make Skyblock a better place.')
				.setFooter('Created by Kaeso#5346')
				.setThumbnail(`https://mc-heads.net/head/${this.uuid}/left`);

			interaction.editReply({embeds: [embed]});
			return;
		}

		DataHandler.updatePlayer(this.uuid, this.playerName, this.profileuuid, this.weight + this.bonusWeight);
		
		const row = new Discord.MessageActionRow().addComponents(
			new Discord.MessageButton()
				.setCustomId('info')
				.setLabel('More Info')
				.setStyle('SUCCESS'),
			new Discord.MessageButton()
				.setLabel('SkyCrypt')
				.setStyle('LINK')
				.setURL(`https://sky.shiiyu.moe/stats/${this.playerName}/${this.profileData.cute_name}`),
			new Discord.MessageButton()
				.setLabel('Plancke')
				.setStyle('LINK')
				.setURL(`https://plancke.io/hypixel/player/stats/${this.playerName}`)
		);
		
		let result = "Hey what's up?";
		let rWeight = Math.round((this.weight + this.bonusWeight) * 100) / 100;

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
		if (this.collections) {
			const topCollection = new Map([...this.collections.entries()].sort((a, b) => b[1] - a[1])).entries().next().value[0];
			imagePath = `./images/${topCollection.toLowerCase().replace(' ', '_')}.png`;
		} else {
			imagePath = `./images/wheat.png`
		}

		const { registerFont, createCanvas } = require('canvas');
		registerFont('./fonts/OpenSans-Regular.ttf', { family: 'Open Sans' });
		let attachment;

		//Load crop image and avatar
		const background = await Canvas.loadImage(imagePath)
		const avatar = await Canvas.loadImage(`https://mc-heads.net/head/${this.uuid}/left`).catch(collected => {
			console.log("Couldn't load image")
			return null;
		});

		//Create our canvas and draw the crop image
		const canvas = createCanvas(background.width, background.height);
		const ctx = canvas.getContext('2d');

		ctx.drawImage(background, 0, 0, canvas.width, canvas.height);
	
		//Add name and rank, then resize to fit
		let name = this.playerName;
		if (this.rank !== undefined && this.rank !== 0 && this.mainProfileuuid === this.profileuuid) {
			name = (`${this.playerName} - #${this.rank}`);
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

		if (this.api) {
			reply = {
				files: [attachment],
				components: [row],
				allowedMentions: { repliedUser: false }
			}
		} else {
			const embed = new Discord.MessageEmbed()
				.setColor('#03fc7b')
				.setTitle(`This data is outdated! ${this.playerName} turned off their api access.`);
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
					this.sendDetailedWeight(i, this.weight, true);
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
							.setURL(`https://sky.shiiyu.moe/stats/${this.playerName}/${this.profileData.cute_name}`),
						new Discord.MessageButton()
							.setLabel('Plancke')
							.setStyle('LINK')
							.setURL(`https://plancke.io/hypixel/player/stats/${this.playerName}`)
					);
					reply.edit({ components: [linkRow], allowedMentions: { repliedUser: false } })
				} catch (error) { console.log(error) }
			});
		}).catch(error => { console.log(error) });
	}

	sendDetailedWeight(interaction, weight, edit = false) {
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
			.setTitle(`Stats for ${this.playerName} on ${this.profileData.cute_name}`)
			.addField('Farming Weight', !result ? '0 - Try some farming!' : result + ' ')
			.addField('Breakdown', this.getBreakdown(weight - this.bonusWeight), edit)
			.setFooter('Created by Kaeso#5346    Questions? Use /info');
		
		if (!edit) {
			embed.setThumbnail(`https://mc-heads.net/head/${this.uuid}/left`)
		}

		if (this.rank !== undefined && this.rank !== 0 && this.mainProfileuuid === this.profileuuid && !edit) {
			embed.setDescription(`**${this.playerName}** is rank **#${this.rank}!**`)
		}

		if (this.bonus.size > 0) {
			embed.addField('Bonus', this.getBonus(), edit);
		}

		let notes = '';
		if (this.profileData.members) {
			if (Object.keys(this.profileData.members).length > 1) {
				notes += 'This player has been or is a co op member';
			}
		}

		if (!this.api) {
			notes += `\n**This data is outdated! ${this.playerName} turned off their api access.**`;
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
					.setURL(`https://sky.shiiyu.moe/stats/${this.playerName}/${this.profileData.cute_name}`),
				new Discord.MessageButton()
					.setLabel('Plancke')
					.setStyle('LINK')
					.setURL(`https://plancke.io/hypixel/player/stats/${this.playerName}`)
			);
			interaction.update({ embeds: [embed], allowedMentions: { repliedUser: false }, files: [], components: [row] });
		}
	}

	getBreakdown(weight) {
		//Sort collections
		const sortedCollections = new Map([...this.collections.entries()].sort((a, b) => b[1] - a[1]));
		let breakdown = '';
		
		sortedCollections.forEach(function (value, key) {
			let percent = Math.floor(value / weight * 100);
			breakdown += (percent > 1) ? `${key}: ${value}  [${percent}%]\n` : (percent > 1) ? `${key}: ${value}  [${percent}%]\n` : '';
		});

		return breakdown === '' ? "This player has no notable collections" : breakdown;
	}

	getBonus() {
		//Sort bonus
		const sortedBounus = new Map([...this.bonus.entries()].sort((a, b) => b[1] - a[1]));
		let bonusText = '';

		sortedBounus.forEach(function (value, key) {
			bonusText += `${key}: ${value}\n`;
		});

		return bonusText === '' ? 'No bonus points :(' : bonusText;
	}
}

module.exports = {
	PlayerHandler,
	Player
}