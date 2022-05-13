import throttledQueue from 'throttled-queue';
import { hypixelApiKey } from '../config.json';
import fetch from 'node-fetch';
import { Snowflake } from 'discord.js';
import { UserData } from 'database/models/users';

const throttle = throttledQueue(2, 1000);

export default class Data {
    
	static CUTOFFDATE = '1590824';

	static async getUUID(playerName: string) {
		const uuid = await fetch(`https://api.mojang.com/users/profiles/minecraft/${playerName}`)
			.then((response) => response.json())
			.then((result: { name: string, id: string }) => {
				if (!result?.name) {
					throw new Error("That minecraft player doesn't exist");
				} else {
					return result;
				}
			})
			.catch((error) => {
				throw error;
			});
		return uuid;
	}
	
	static async getProfiles(uuid: string): Promise<RawAPIProfiles | undefined> {
		return new Promise((resolve) => {
			throttle(async function() {
				const response = await fetch(`https://api.hypixel.net/skyblock/profiles?uuid=${uuid}&key=${hypixelApiKey}`)
					.then((response) => {
						return response.json();
					}).then((result) => {
						if (result.success === true) {
							return result;
						}
						resolve(undefined);
					}).catch(() => {
						resolve(undefined);
					});
				resolve(response);
			});
		});
	}

	static async getStrippedProfiles(uuid: string) {
		const profileData = await Data.getProfiles(uuid);
		return (profileData) ? await Data.stripData(profileData, uuid) : undefined;
	}

	static async getOverview(uuid: string) {
		return new Promise((resolve) => {
			throttle(async function() {
				const response = await fetch(`https://api.hypixel.net/player?uuid=${uuid}&key=${hypixelApiKey}`)
					.then((response) => {
						return response.json();
					}).then((result) => {
						if (result.success) {
							return result;
						}
						resolve(undefined);
					}).catch(() => {
						resolve(undefined);
					});
				resolve(await response);
			});
		});
	}

	static async getDiscord(uuid: string) {
		return new Promise((resolve) => {
			throttle(async function() {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const data = await Data.getOverview(uuid) as any;
				if (data === undefined || !data?.success) resolve(undefined);
				
				resolve(data?.player?.socialMedia?.links?.DISCORD);
			});
		});
	}

	static async stripData(data: RawAPIProfiles, uuid: string) {
		if (!data || !data?.profiles) return undefined;

		const stripped: TotalProfileData = {
			success: data.success,
			profiles: []
		}
		
		for (const key in data.profiles) {
			const profile: RawAPIProfile = data.profiles[key];
			const user: RawAPIMember = profile.members[uuid];

			const addedProfile: ProfileData = {
				profile_id: profile.profile_id,
				cute_name: profile.cute_name,
				members: {},
				api: true
			}
			if (Object.keys(profile.members).length > 1) {
				addedProfile.members = {
					[uuid]: {
						experience_skill_farming: user.experience_skill_farming,
						collection: user.collection,
						crafted_generators: user.crafted_generators,
						jacob: await this.stripContests(user.jacob2)
					},
					lamecoop: { // Will be removed
						sad: true
					}
				}
			} else {
				addedProfile.members = {
					[uuid]: {
						experience_skill_farming: user.experience_skill_farming,
						collection: user.collection,
						crafted_generators: user.crafted_generators,
						jacob: await this.stripContests(user.jacob2)
					}
				}
			}
			// Future Migration

			// const key = Object.keys(data.profiles)[i];
			// const profile = data.profiles[key];
			// const player = profile.members[uuid];

			// let addedProfile = {
			// 	profile_id: profile.profile_id,
			// 	cute_name: profile.cute_name,
			// 	user: {
			// 		experience_skill_farming: player.experience_skill_farming,
			// 		collection: player.collection,
			// 		crafted_generators: player.crafted_generators,
			// 		jacob: await this.stripContests(player.jacob2),
			// 		coop: false
			// 	}
			// }
			// if (Object.keys(profile.members).length > 1) {
			// 	addedProfile.user.coop = true;
			// }

			stripped.profiles.push(addedProfile);
		}
		return stripped;
	}

	static async stripContests(jacob: RawAPIJacobData) {
		const formattedData: StrippedContestData = {
			currentmedals: {
				bronze: jacob?.medals_inv?.bronze ?? 0,
				silver: jacob?.medals_inv?.silver ?? 0,
				gold: jacob?.medals_inv?.gold ?? 0
			},
			totalmedals: {
				bronze: 0,
				silver: 0,
				gold: 0
			},
			perks: {
				double_drops: jacob?.perks?.double_drops ?? 0,
				farming_level_cap: jacob?.perks?.farming_level_cap ?? 0
			},
			participations: 0,
			firstplace: 0,
			scores: {
				cactus: { value: 0, obtained: '' },
				carrot: { value: 0, obtained: '' },
				cocoa: { value: 0, obtained: '' },
				melon: { value: 0, obtained: '' },
				mushroom: { value: 0, obtained: '' },
				netherwart: { value: 0, obtained: '' },
				potato: { value: 0, obtained: '' },
				pumpkin: { value: 0, obtained: '' },
				sugarcane: { value: 0, obtained: '' },
				wheat: { value: 0, obtained: '' }
			},
			recents: {
				overall: [], cactus: [], carrot: [], cocoa: [], 
				melon: [], mushroom: [], netherwart: [], potato: [], 
				pumpkin: [], sugarcane: [], wheat: [] 
			}
		}

		const contests = jacob?.contests;
		if (contests) {
			for (let i = Object.keys(contests).length - 1; i >= 0; i--) {
				const key = Object.keys(contests)[i];
				const contest = contests[key];

				const collected = contest.collected;
				const position = contest.claimed_position;
				const participants = contest.claimed_participants;
			
				if (collected < 100) {
					continue;
				}
				formattedData.participations++;
                
				const split = key.split(':');
				const date = this.getDateFromContest(split);
				const crop = this.getGoodCropName(split[2]);
				if (!crop) continue;

				const valid = (+date >= +this.CUTOFFDATE);
				
				if (valid && formattedData.scores[crop].value < collected) {
					formattedData.scores[crop] = { 
						value: +collected, obtained: date, pos: position, par: participants 
					}
				}

				if (formattedData.recents.overall.length < 11) {
					formattedData.recents.overall.push({
						value: +collected, obtained: date, pos: position, par: participants, valid: valid, crop: crop
					})
				}
				
				if (formattedData.recents[crop].length < 11) {
					formattedData.recents[crop].push({
						value: +collected, obtained: date, pos: position, par: participants, valid: valid
					})
				}
					
				if (position === 0) formattedData.firstplace++;
				
				if (position !== undefined && participants) {
					if (position <= (participants * 0.05) + 1) {
						formattedData.totalmedals.gold++;
					} else if (position <= (participants * 0.25) + 1) {
						formattedData.totalmedals.silver++;
					} else if (position <= (participants * 0.60) + 1) {
						formattedData.totalmedals.bronze++;
					}
				}
			}
		}

		return formattedData;
	}

	static async getBestContests(data?: TotalProfileData) { //, uuid: string
		if (!data) return undefined;
		
		const best: BestContestData = {
			currentmedals: {
				bronze: 0,
				silver: 0,
				gold: 0
			},
			totalmedals: {
				bronze: 0,
				silver: 0,
				gold: 0
			},
			participations: 0,
			firstplace: 0,
			scores: {
				cactus: { value: 0, obtained: '', profilename: '' },
				carrot: { value: 0, obtained: '', profilename: '' },
				cocoa: { value: 0, obtained: '', profilename: '' },
				melon: { value: 0, obtained: '', profilename: '' },
				mushroom: { value: 0, obtained: '', profilename: '' },
				netherwart: { value: 0, obtained: '', profilename: '' },
				potato: { value: 0, obtained: '', profilename: '' },
				pumpkin: { value: 0, obtained: '', profilename: '' },
				sugarcane: { value: 0, obtained: '', profilename: '' },
				wheat: { value: 0, obtained: '', profilename: '' }
			},
			recents: {
				overall: [], cactus: [], carrot: [], cocoa: [], 
				melon: [], mushroom: [], netherwart: [], potato: [], 
				pumpkin: [], sugarcane: [], wheat: [] 
			}
		}
        
		const allRecents = {
			overall: new Map(), cactus: new Map(), carrot: new Map(), cocoa: new Map(), 
			melon: new Map(), mushroom: new Map(), netherwart: new Map(), potato: new Map(), 
			pumpkin: new Map(), sugarcane: new Map(), wheat: new Map() 
		}

		for (const profile of data.profiles) {
			const player = profile.members[Object.keys(profile.members)[0]] as ProfileMember;

			const jacob = player.jacob as BestContestData;
			
			if (jacob) {
				best.participations += jacob.participations;
				best.firstplace += jacob.firstplace;

				best.currentmedals.bronze += jacob.currentmedals.bronze;
				best.currentmedals.silver += jacob.currentmedals.silver;
				best.currentmedals.gold += jacob.currentmedals.gold;

				best.totalmedals.bronze += jacob.totalmedals.bronze;
				best.totalmedals.silver += jacob.totalmedals.silver;
				best.totalmedals.gold += jacob.totalmedals.gold;

				for (let j = 0; j < Object.keys(jacob.scores).length; j++) {
					const crop = Object.keys(jacob.scores)[j] as CropString;
					if (!crop) { break; }

					if (jacob.scores[crop].value > best.scores[crop].value) {
						best.scores[crop] = {
							value: jacob.scores[crop].value,
							obtained: jacob.scores[crop].obtained,
							profilename: profile.cute_name,
							pos: jacob.scores[crop].pos,
							par: jacob.scores[crop].par
						}
					}
				}

				if (!jacob.recents) continue;

				for (let j = 0; j < Object.keys(jacob.recents).length; j++) {
					const crop = Object.keys(jacob.recents)[j] as CropString | 'overall';
					const recents = jacob.recents[crop];
					
					for (let k = 0; k < recents.length; k++) {
						const contest = recents[k];
						if (crop === 'overall') {
							allRecents.overall.set(contest.obtained, {
								value: contest.value, obtained: contest.obtained, pos: contest.pos, 
								par: contest.par, valid: contest.valid, profilename: profile.cute_name, crop: contest.crop
							})	
						} else {
							allRecents[crop].set(contest.obtained, {
								value: contest.value, obtained: contest.obtained, pos: contest.pos, 
								par: contest.par, valid: contest.valid, profilename: profile.cute_name
							})	
						}
					}
				}
			}
		}

		for (let i = 0; i < Object.keys(allRecents).length; i++) {
			const crop = Object.keys(allRecents)[i] as CropString | 'overall';
			const recentMap = allRecents[crop];

			const sorted = [...recentMap.values()].sort((a, b) => b.obtained.localeCompare(a.obtained));
		
			best.recents[crop].push(...sorted.slice(0, 11));
		}
		return best;
	}

	static async takeNewestData(saved?: TotalProfileData, fresh?: TotalProfileData) {

		if (saved === undefined && fresh === undefined) return undefined;
		if (saved === undefined && fresh !== undefined) return fresh;
		if (fresh === undefined) return saved;
		
		try {
			// Handling for *old* data, will be migrated at some point
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			if ((saved as any)?.data) saved = (((saved as any)?.data) as TotalProfileData);
			if (saved === undefined) return fresh;
			
			const newData: TotalProfileData = {
				success: true,
				profiles: []
			}

			// Loop through all saved profiles first
			for (const profile of saved.profiles) {
				// If the profile is somehow already added to newData, skip it
				if (newData.profiles.some(p => p.profile_id === profile.profile_id)) continue;
				// Check if the profile exists on the new data (it should unless deleted)
				const freshProfile = fresh.profiles.find(p => p.profile_id === profile.profile_id);

				// Get the member data from the fresh profile
				const freshMember = freshProfile.members[Object.keys(freshProfile.members)[0]];
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				if ((freshMember as any)?.sad !== undefined) continue;

				const savedMember = profile.members[Object.keys(profile.members)[0]];

				const members: ProfileMembers = {
					[Object.keys(freshProfile.members)[0]]: {
						// These should always exist
						crafted_generators: (freshMember as ProfileMember).crafted_generators,
						jacob: (freshMember as ProfileMember).jacob,
						// If it exists on the new data, use that, otherwise use the old.
						collection: ((freshMember as ProfileMember)?.collection) 
							? (freshMember as ProfileMember).collection 
							: (savedMember as ProfileMember)?.collection ?? {},
						experience_skill_farming: ((freshMember as ProfileMember)?.experience_skill_farming) 
							? (freshMember as ProfileMember).experience_skill_farming 
							: (savedMember as ProfileMember)?.experience_skill_farming ?? 0,
					}
				}

				// Bad handling of coops, will be fixed
				if (Object.keys(freshProfile.members).length > 1) {
					members.lamecoop = { sad: true };
				}

				// Finally add the constructed profile
				newData.profiles.push({
					profile_id: freshProfile.profile_id,
					cute_name: freshProfile.cute_name,
					api: (freshMember as ProfileMember)?.collection !== undefined,
					members: members
				})
			}

			// Get all profiles that are new
			const newProfiles = fresh.profiles.filter(p => !saved?.profiles.some(s => s.profile_id === p.profile_id));

			// Add all new profiles with api: true
			for (const profile of newProfiles) {
				if (newData.profiles.some(p => p.profile_id === profile.profile_id)) continue;
				
				newData.profiles.push({ ...profile, api: true });
			}

			// console.log(newData);
			return newData;
		} catch (e) {
			// console.log(e);
			return fresh;
		}
	}

	static async getBestData(saved: TotalProfileData | undefined, uuid: string) {
		const fresh = await Data.getStrippedProfiles(uuid);
		if (!saved && fresh) {
			return fresh;
		} else if (saved && !fresh) {
			return saved;
		} else if (!saved && !fresh) {
			return undefined;
		}
		return await Data.takeNewestData(saved, fresh);
	}

	static async getLatestContestData(user: UserData, fetchnewdata = true): Promise<BestContestData | undefined> {
		return new Promise((resolve) => {
			(async function() {
				if (fetchnewdata || !user?.contestdata || !user?.contestdata?.recents) {
					// if (!user.profiledata) {
					// 	resolve(undefined);
					// 	return;
					// }
					const fullData = await Data.getBestData(user?.profiledata ?? undefined, user.uuid);
					const data = await Data.getBestContests(fullData); //, user?.uuid);
					resolve(data);
				} else {
					const data = user?.contestdata;
					resolve(data ?? undefined);
				}
			}());
		});
	}

	static async getAllValidContests(uuid: string, cutoff: number) {
		try {
			const data = await this.getProfiles(uuid);
			if (!data) return undefined;
	
			const contests: { [key: string]: ContestScore } = {};
	
			for (const profile of data.profiles) {
				for (const memberuuid in profile.members) {
					if (memberuuid !== uuid) continue;
	
					const member = profile.members[memberuuid];
	
					for (const contestKey in member.jacob2.contests) {
						const contest = member.jacob2.contests[contestKey];
		
						const collected = contest.collected;
						if (collected < 100) continue;
										
						const split = contestKey.split(':');
						const date = this.getDateFromContest(split);
						const crop = this.getGoodCropName(split[2]);
	
						if (!crop || parseInt(date) < cutoff || (contests[crop]?.value ?? 0) > collected) continue;
	
						contests[crop] = {
							value: collected,
							obtained: date,
							crop: crop,
							profilename: profile.cute_name,
							pos: contest.claimed_position,
							par: contest.claimed_participants,
							valid: true
						}
					}
				}
			}
	
			return contests;
		} catch (e) {
			return undefined;
		}
	}

	static getDateFromContest(split: string[]) {
		let day = split[1].split('_')[1];
		day = (+day < 10) ? `0${day}` : day;

		let month = split[1].split('_')[0];
		month = (+month < 10) ? `0${month}` : month;
        
		const year = split[0];

		return '' + year + month + day;
	}

	static getReadableDate(date: string | number) {
		const dateStr = '' + date;

		const day = dateStr.slice(-2);
		const month = dateStr.slice(-4, -2);
		const year = dateStr.slice(0, -4);

		const months = [ 
			'Early Spring', 'Spring', 'Late Spring', 
			'Early Summer', 'Summer', 'Late Summer', 
			'Early Autumn', 'Autumn', 'Late Autumn', 
			'Early Winter', 'Winter', 'Late Winter',
		];

		const suffixed = this.appendOrdinalSuffix(+day);

		return `${months[+month - 1]} ${suffixed}, Year ${+year + 1}`; //Year is 1 behind in api
	}

	static appendOrdinalSuffix(i: number) {
		const j = i % 10; 
		const k = i % 100;

		if (j == 1 && k != 11) return i + "st";
		if (j == 2 && k != 12) return i + "nd";
		if (j == 3 && k != 13) return i + "rd";
		
		return i + "th";
	}

	static getGoodCropName(bad: string) {
		if (bad === 'WHEAT') return 'wheat';
		if (bad === 'MELON') return 'melon';
		if (bad === 'CACTUS') return 'cactus';
		if (bad === 'PUMPKIN') return 'pumpkin';
		if (bad === 'CARROT_ITEM') return 'carrot';
		if (bad === 'POTATO_ITEM') return 'potato';
		if (bad === 'SUGAR_CANE') return 'sugarcane';
		if (bad === 'NETHER_STALK') return 'netherwart';
		if (bad === 'MUSHROOM_COLLECTION') return 'mushroom';
		if (bad === 'INK_SACK' || bad === 'INK_SACK:3') return 'cocoa';

		return null;
	}

	static getReadableCropName(crop: CropString | string) {
		if (crop === 'wheat') return 'Wheat';
		if (crop === 'melon') return 'Melon';
		if (crop === 'cactus') return 'Cactus';
		if (crop === 'pumpkin') return 'Pumpkin';
		if (crop === 'carrot') return 'Carrot';
		if (crop === 'potato') return 'Potato';
		if (crop === 'sugarcane') return 'Sugar Cane';
		if (crop === 'netherwart') return 'Nether Wart';
		if (crop === 'mushroom') return 'Mushroom';
		if (crop === 'cocoa') return 'Cocoa Beans';

		return null;
	}

	static getApproxWeightByCrop(value: number, crop: CropString) {
		if (crop === 'wheat') return value / 100000;
		if (crop === 'melon') return value / 355000;
		if (crop === 'cactus') return value / 158000;
		if (crop === 'pumpkin') return value / 71000;
		if (crop === 'carrot') return value / 300000;
		if (crop === 'potato') return value / 300000;
		if (crop === 'sugarcane') return value / 200000;
		if (crop === 'netherwart') return value / 250000;
		if (crop === 'mushroom') return value / 55000;
		if (crop === 'cocoa') return value / 220000;

		return null;
	}

	static getCropURL(crop: CropString | string) {
		// Melon and cactus courtesy of https://github.com/thepotatoking55/2D-block-texture-pack/
		if (crop === 'wheat') return 'https://media.discordapp.net/attachments/850812400747544657/958131911308488735/unknown.png';
		if (crop === 'melon') return 'https://media.discordapp.net/attachments/850812400747544657/958131910310248518/unknown.png';
		if (crop === 'cactus') return 'https://media.discordapp.net/attachments/850812400747544657/958131911543386192/unknown.png';
		if (crop === 'pumpkin') return 'https://media.discordapp.net/attachments/850812400747544657/958131910721302588/unknown.png';
		if (crop === 'carrot') return 'https://media.discordapp.net/attachments/850812400747544657/958131911916654622/unknown.png';
		if (crop === 'potato') return 'https://media.discordapp.net/attachments/850812400747544657/958154868739153940/potato2.png';
		if (crop === 'sugarcane') return 'https://media.discordapp.net/attachments/850812400747544657/958131911757267035/unknown.png';
		if (crop === 'netherwart') return 'https://media.discordapp.net/attachments/850812400747544657/958131911111376937/unknown.png';
		if (crop === 'mushroom') return 'https://media.discordapp.net/attachments/850812400747544657/958154868521058344/mushrooms.png';
		if (crop === 'cocoa') return 'https://media.discordapp.net/attachments/850812400747544657/958131912143167558/unknown.png';

		return undefined;
	}

	static getCropHex(crop: CropString | string) {
		if (crop === 'wheat') return '#d5da45';
		if (crop === 'melon') return '#bb170b';
		if (crop === 'cactus') return '#3b5b1d';
		if (crop === 'pumpkin') return '#a0560b';
		if (crop === 'carrot') return '#ff8e09';
		if (crop === 'potato') return '#e9ba62';
		if (crop === 'sugarcane') return '#82a859';
		if (crop === 'netherwart') return '#5c151a';
		if (crop === 'mushroom') return '#725643';
		if (crop === 'cocoa') return '#61381d';

		// Default green
		return '#03fc7b';
	}
}

export interface BaseContestData {
	currentmedals: MedalInventory,
	totalmedals: MedalInventory,
	participations: number,
	firstplace: number,
}

export interface StrippedContestData extends BaseContestData {
	perks: FarmingPerks,
	scores: FarmingContestScores,
	recents: RecentFarmingContests
}

export interface BestContestData extends BaseContestData {
	scores: FarmingContestScores,
	recents: RecentFarmingContests
}

export type MedalInventory = {
	bronze: number,
	silver: number,
	gold: number
}

export type FarmingPerks = {
	double_drops: number,
	farming_level_cap: number
}

export type FarmingContestScores = {
	[key in CropString]: ContestScore;
};

export interface ContestScore {
	value: number, 
	obtained: string, 
	pos?: number, 
	par?: number,
	profilename?: string,
	valid?: boolean,
	crop?: string,
	user?: Snowflake,
	ign?: string,
}

export type RecentFarmingContests = {
	[key in CropString]: ContestScore[];
} & {
	overall: ContestScore[]
};

export type CropString = 'cactus' | 'carrot' | 'cocoa' | 'melon' | 'mushroom' | 'netherwart' | 'potato' | 'pumpkin' | 'sugarcane' | 'wheat';

export type TotalProfileData = {
	success: boolean,
	profiles: ProfileData[]
}

type ProfileData = {
	profile_id: string,
	cute_name: string,
	members: ProfileMembers,
	api: boolean
}

type ProfileMembers = { 
	[key: string]: ProfileMemberData
}

export type ProfileMember = {
	experience_skill_farming: number,
	collection: { 
		[key: string]: number 
	},
	crafted_generators: string[],
	jacob: StrippedContestData
}

type ProfileMemberData =  ProfileMember | { sad: boolean }; // Temporary alternate type (was my old and bad way to tell if you were a coop member)

type RawAPIProfiles = {
	success: boolean,
	profiles: RawAPIProfile[]
}

type RawAPIProfile = {
	profile_id: string,
	members: {
		[key: string]: RawAPIMember
	},
	cute_name: string,
	game_mode: string, // Probably will use soon
	[key: string]: unknown // Not using anything else
}

type RawAPIMember = {
	last_save: number,
	experience_skill_farming: number,
	collection: { 
		[key: string]: number 
	},
	crafted_generators: string[],
	jacob2: RawAPIJacobData,
	[key: string]: unknown // Not using anything else
}

type RawAPIJacobData = {
	medals_inv: MedalInventory,
	perks: FarmingPerks,
	talked: boolean,
	contests: {
		[key: string]: RawAPIFarmingContest
	}
}

type RawAPIFarmingContest = {
	collected: number,
	claimed_rewards?: true,
	claimed_position?: number,
	claimed_participants?: number
}
