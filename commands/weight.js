const Discord = require('discord.js');
const { PlayerHandler } = require('../calc.js');
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
				_profileName = option.value.trim();
			} else if (option.name === 'profile') {
				_profileName = option.value.trim();
			}
		}

		const uuid = await Data.getUUID(playerName);
		const user = await DataHandler.getPlayer(uuid);

		if (!playerName) {
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

		await interaction.deferReply();

		const fullData = await Data.getBestData(uuid);
		const requestedData = getUserdata(fullData, _profileName);
		let apiEnabled = true;
		let mainProfileuuid;
		let mainProfile;

		async function getUserdata(data, profileName = null) {
			// if (!this.data.profiles) {
			// 	return null;
			// }

			// if (user !== null) {
			// 	this.rank = user.dataValues.rank;
			// 	this.mainProfileuuid = user.dataValues.profile;
			// }

			let profiles = data.profiles;
			let bestProfile = null;
			let bestWeight = 0;
			let best = true;

			for (let i = 0; i < Object.keys(profiles).length; i++) {
				const key = Object.keys(profiles)[i];
				const profile = profiles[key];

				if (profileName !== null && profile.cute_name.toLowerCase() === profileName.toLowerCase()) {
					bestProfile = profile;
					best = false;
					break;
				}

				let weight = await computeWeight(profile.members[this.uuid]);
				let bonus = await computeBonusWeight(profile.members[this.uuid]);

				if (weight) {
					let total = weight + bonus;
					if (bestProfile) {
						if (total > bestWeight) {
							bestProfile = profile;
							bestWeight = total;
						}
					} else {
						bestProfile = profile;
						bestWeight = total;
					}
				}
			}

			if (!bestProfile) {
				bestData = 0
				return undefined;
			}
			//LEFT OFF HERE
			this.weight = bestData[0];
			this.bonusWeight = bestData[1];
			this.collections = bestData[2];
			this.bonus = bestData[3];
			this.bestProfile = bestData[4];
			this.profileuuid = this.profileData.profile_id;

			this.userData = this.bestProfile;
			this.api = this.apiFullyOff ? false : this.profileData?.api ?? true;
			return this.bestProfile;
		}

		async function computeWeight(userData) {
			if (!userData.collection) {
				return undefined;
			}

			let { WHEAT, POTATO_ITEM: POTATO, CARROT_ITEM: CARROT, MUSHROOM_COLLECTION: MUSHROOM, PUMPKIN, MELON, SUGAR_CANE: CANE, CACTUS, NETHER_STALK: WART } = userData.collection;
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

			let weight = 0;

			collections.forEach(function (value, key) {
				weight += value;
			});

			weight = Math.floor(weight * 100) / 100;

			return weight;
		}

		async function computeBonusWeight(userData) {
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

			return bonusWeight;
		}
	}
};

