class DataFormatter {
    
    constructor() { }

	static CUTOFFDATE = '1590824';

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
						jacob2: user.jacob2,
						jacob: await this.stripContests(user.jacob2)
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
						jacob2: user.jacob2,
						jacob: await this.stripContests(user.jacob2)
					}
				}
			}

			stripped.profiles.push(addedProfile);
		}
		
		return stripped;
	}

    static async stripContests(jacob) {
		const formattedData = {
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
				cactus: { value: 0, obtained: '', pos: null, par: null },
				carrot: { value: 0, obtained: '', pos: null, par: null },
				cocoa: { value: 0, obtained: '', pos: null, par: null },
				melon: { value: 0, obtained: '', pos: null, par: null },
				mushroom: { value: 0, obtained: '', pos: null, par: null },
				netherwart: { value: 0, obtained: '', pos: null, par: null },
				potato: { value: 0, obtained: '', pos: null, par: null },
				pumpkin: { value: 0, obtained: '', pos: null, par: null },
				sugarcane: { value: 0, obtained: '', pos: null, par: null },
				wheat: { value: 0, obtained: '', pos: null, par: null }
			}
		}

		const contests = jacob?.contests;
		if (contests) {
			for (let i = 0; i < Object.keys(contests).length; i++) {
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
				
                if (+date >= +this.CUTOFFDATE && formattedData.scores[crop].value < collected) {
					formattedData.scores[crop] = {
						value: +collected,
						obtained: date,
						pos: position,
						par: participants
					}
                }
					
				if (position === 0) {
					formattedData.firstplace++;
				}
				
				if (position + 1 && participants) {
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

    static async getBestData(saved, fresh) {
		try {
			if (saved?.data) { saved = saved.data; }
			
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
						members: freshProfile.members,
						api: true
					});
				} else {
					newData.profiles.push({
						profile_id: savedProfile.profile_id,
						cute_name: savedProfile.cute_name,
						members: savedProfile.members,
						api: false
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

    static async getBestContests(data) {
        const best = {
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
				cactus: { value: 0, obtained: '', profilename: '', pos: null, par: null },
				carrot: { value: 0, obtained: '', profilename: '', pos: null, par: null },
				cocoa: { value: 0, obtained: '', profilename: '', pos: null, par: null },
				melon: { value: 0, obtained: '', profilename: '', pos: null, par: null },
				mushroom: { value: 0, obtained: '', profilename: '', pos: null, par: null },
				netherwart: { value: 0, obtained: '', profilename: '', pos: null, par: null },
				potato: { value: 0, obtained: '', profilename: '', pos: null, par: null },
				pumpkin: { value: 0, obtained: '', profilename: '', pos: null, par: null },
				sugarcane: { value: 0, obtained: '', profilename: '', pos: null, par: null },
				wheat: { value: 0, obtained: '', profilename: '', pos: null, par: null }
			}
        }
        
        for (let i = 0; i < Object.keys(data.profiles).length; i++) {
            const profile = data.profiles[Object.keys(data.profiles)[i]];
            const player = profile.members[Object.keys(profile.members)[0]];

			const jacob = player.jacob;
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
                    const crop = Object.keys(jacob.scores)[j];
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
            }
        }
		return best;
	}

    static getDateFromContest(split) {
        let day = split[1].split('_')[1];
        day = (+day < 10) ? `0${day}` : day;

        let month = split[1].split('_')[0];
        month = (+month < 10) ? `0${month}` : month;
        
        let year = split[0];

        return '' + year + month + day;
    }

	static getReadableDate(date) {
		const dateStr = '' + date;

		let day = dateStr.slice(-2);
		let month = dateStr.slice(-4, -2);
		let year = dateStr.slice(0, -4);

		const months = [ 
			'Early Spring', 'Spring', 'Late Spring', 
			'Early Summer', 'Summer', 'Late Summer', 
			'Early Autumn', 'Autumn', 'Late Autumn', 
			'Early Winter', 'Winter', 'Late Winter',
		];

		const suffixed = this.appendOrdinalSuffix(+day);

		return `${months[+month - 1]} ${suffixed}, Year ${+year + 1}`; //Year is 1 behind in api
	}

	static appendOrdinalSuffix(i) {
		var j = i % 10,
			k = i % 100;
		if (j == 1 && k != 11) {
			return i + "st";
		}
		if (j == 2 && k != 12) {
			return i + "nd";
		}
		if (j == 3 && k != 13) {
			return i + "rd";
		}
		return i + "th";
	}

    static getGoodCropName(bad) {
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

	static getReadableCropName(crop) {
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

	static getApproxWeightByCrop(value, crop) {
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
}

module.exports = {
    DataFormatter
}