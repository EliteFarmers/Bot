import { Crop } from 'farming-weight';

interface farmInfo {
	name: string;
	description?: string;
	crops: Crop[];
	speed: {
		speed: number;
		depthStrider?: 1 | 2 | 3;
		soulSand: boolean;
		buildVersion: "1.8.9" | "1.21"
		method: 'straight' | 'running into wall' | 'angled into wall' | 'crouching';
	};
	angle: {
		yaw: number;
		pitch: number;
	};
	bps: number;
	laneDepth: number;
	tutorials?: {
		thread?: string;
		video?: string;
		garden?: string;
		schematic?: string;
	};
	authors?: string[];
	replacedBy?: string[];
	notes?: string[];
}

const blackCatNote = 'Despite the name, this farm **does not** use a black cat pet anymore';

export const farmsData: Record<string, farmInfo> = {
	idkdomPumpkin: {
		name: 'IdkDom Melon/Pumpkin',
		crops: [Crop.Melon, Crop.Pumpkin],
		speed: {
			speed: 155,
			soulSand: false,
			buildVersion: "1.8.9",
			method: 'straight',
		},
		angle: {
			yaw: 0,
			pitch: 28.5,
		},
		bps: 19.5,
		laneDepth: 3,
		tutorials: {
			video: 'https://www.youtube.com/watch?v=Zy_w332uUic',
			garden: 'IdkDom',
		},
		authors: ['IdkDom'],
		replacedBy: ['easierMelon', 'chisslMelon'],
	},
	blackCatMelon: {
		name: 'SunTzu & MelonKingDe Black Cat Melon',
		crops: [Crop.Melon, Crop.Pumpkin],
		speed: {
			speed: 400,
			depthStrider: 3,
			soulSand: true,
			buildVersion: "1.8.9",
			method: 'running into wall',
		},
		angle: {
			yaw: 0,
			pitch: -59,
		},
		bps: 19.8,
		laneDepth: 3,
		tutorials: {
			thread: 'https://discord.com/channels/1096051612373487687/1159960881287942234',
			video: 'https://www.youtube.com/watch?v=5k9c7qK0l58',
			garden: 'MelonKingDe',
		},
		authors: ['AgitatedSnake92', 'MelonKingDe', 'SunTzu101'],
		replacedBy: ['easierMelon', 'chisslMelon'],
		notes: [blackCatNote],
	},
	easierMelon: {
		name: 'Easier to Build Melon/Pumpkin',
		crops: [Crop.Melon, Crop.Pumpkin],
		speed: {
			speed: 400,
			depthStrider: 3,
			soulSand: true,
			buildVersion: "1.8.9",
			method: 'running into wall',
		},
		angle: {
			yaw: 0,
			pitch: -59,
		},
		bps: 19.8,
		laneDepth: 3,
		tutorials: {
			thread: 'https://discord.com/channels/1096051612373487687/1358514959247741068',
			video: 'https://www.youtube.com/watch?v=s4HV0RyWcoI',
			garden: 'IdkVenom',
		},
		authors: ['AgitatedSnake92', 'MelonKingDe', 'SunTzu101', 'IdkVenom', 'DeadlyIPanda'],
	},
	chisslMelon: {
		name: 'Chissl Waterless Melon/Pumpkin',
		crops: [Crop.Melon, Crop.Pumpkin],
		speed: {
			speed: 365,
			soulSand: false,
			buildVersion: "1.8.9", // todo: check
			method: 'straight', // todo: check
		},
		angle: {
			yaw: 0,
			pitch: 59,
		},
		bps: 19.9,
		laneDepth: 3,
		tutorials: {
			garden: 'Chissl',
		},
		authors: ['Chissl'],
		notes: ['Very difficult and time consuming to build, only worthwhile for extreme farmers'],
	},
	dropdownWheat: {
		name: 'Dropdown Wheat/Potato/Carrot/Netherwart',
		crops: [Crop.Wheat, Crop.Potato, Crop.Carrot, Crop.NetherWart],
		speed: {
			speed: 93,
			depthStrider: 3,
			soulSand: false,
			buildVersion: "1.8.9",
			method: 'straight',
		},
		angle: {
			yaw: 0,
			pitch: 3,
		},
		bps: 19.8,
		laneDepth: 5,
		replacedBy: ['aceWheat', 'draipWheat', 'z109Wheat'],
		notes: ['Annoying to use', 'Not infinite even at garden 15', 'Requires 5 plots, no less'],
	},
	aceWheat: {
		name: 'Ace Wheat/Potato/Carrot/Netherwart',
		crops: [Crop.Wheat, Crop.Potato, Crop.Carrot, Crop.NetherWart],
		speed: {
			speed: 347,
			depthStrider: 2,
			soulSand: true,
			buildVersion: "1.8.9",
			method: 'running into wall',
		},
		angle: {
			yaw: 0,
			pitch: 3,
		},
		bps: 20,
		laneDepth: 5,
		tutorials: {
			video: 'https://www.youtube.com/watch?v=hz4lGUz0JP4',
			garden: 'SageUk',
		},
		authors: ['AgitatedSnake92'],
	},
	draipWheat: {
		name: 'Draip Looping Wheat/Potato/Carrot/Netherwart',
		crops: [Crop.Wheat, Crop.Potato, Crop.Carrot, Crop.NetherWart],
		speed: {
			speed: 328,
			depthStrider: 3,
			soulSand: false,
			buildVersion: "1.8.9",
			method: 'angled into wall',
		},
		angle: {
			yaw: 45,
			pitch: 3,
		},
		bps: 20,
		laneDepth: 3,
		tutorials: {
			thread: 'https://discord.com/channels/1096051612373487687/1159965565218201721',
			video: 'https://www.youtube.com/watch?v=gcJ5U7SyA-c',
		},
		authors: ['Draip'],
		notes: [
			'Nice for pest farming because it loops, but it doesn require more plots than other designs',
			'Lanes can be as deep as you want, deeper means laneswitches are easier',
		],
	},
	z109Wheat: {
		name: 'Z109 Sprial Wheat/Potato/Carrot/Netherwart',
		crops: [Crop.Wheat, Crop.Potato, Crop.Carrot, Crop.NetherWart],
		speed: {
			speed: 328,
			depthStrider: 3,
			soulSand: false,
			buildVersion: "1.8.9",
			method: 'angled into wall',
		},
		angle: {
			yaw: 45,
			pitch: 3,
		},
		bps: 20,
		laneDepth: 3,
		tutorials: {
			thread: 'https://discord.com/channels/1096051612373487687/1253213095984365629',
			video: 'https://www.youtube.com/watch?v=9yVNsafjOCA',
			garden: 'Z109',
		},
		authors: ['Z109'],
	},
	blackCatWheat: {
		name: 'Black Cat Wheat/Potato/Carrot',
		crops: [Crop.Wheat, Crop.Potato, Crop.Carrot],
		speed: {
			speed: 347,
			depthStrider: 2,
			soulSand: true,
			buildVersion: "1.8.9",
			method: 'running into wall',
		},
		angle: {
			yaw: 0,
			pitch: 3,
		},
		bps: 19.9,
		laneDepth: 5,
		tutorials: {
			thread: 'https://discord.com/channels/1096051612373487687/1159961248545374290',
			video: 'https://www.youtube.com/watch?v=KBGIuETQI-g',
			garden: 'MelonKingDe',
		},
		authors: ['AgitatedSnake92', 'MelonKingDe', 'SunTzu101'],
		replacedBy: ['aceWheat', 'draipWheat', 'z109Wheat'],
		notes: [blackCatNote],
	},
	blackCatNetherwart: {
		name: 'Black Cat Nether Wart',
		crops: [Crop.NetherWart],
		speed: {
			speed: 347,
			depthStrider: 2,
			soulSand: true,
			buildVersion: "1.8.9",
			method: 'running into wall',
		},
		angle: {
			yaw: 0,
			pitch: 3,
		},
		bps: 19.9,
		laneDepth: 5,
		tutorials: {
			thread: 'https://discord.com/channels/1096051612373487687/1159961642952556636',
			video: 'https://www.youtube.com/watch?v=n218KDmL-5s',
			garden: 'MelonKingDe',
		},
		authors: ['AgitatedSnake92', 'MelonKingDe', 'SunTzu101'],
		replacedBy: ['aceWheat', 'draipWheat', 'z109Wheat'],
		notes: [blackCatNote],
	},
	sdsMushroom: {
		name: 'Slanted Downward Spiral (SDS) Mushroom',
		crops: [Crop.Mushroom],
		speed: {
			speed: 233,
			depthStrider: 3,
			soulSand: true,
			buildVersion: "1.8.9",
			method: 'angled into wall',
		},
		angle: {
			yaw: 16,
			pitch: 5.5,
		},
		bps: 19.7,
		laneDepth: 4,
		tutorials: {
			thread: 'https://discord.com/channels/1096051612373487687/1159960305300930631',
			video: 'https://www.youtube.com/watch?v=QyWf0DO831g',
			garden: 'MelonKingDe',
		},
		authors: ['AgitatedSnake92', 'MelonKingDe', 'SunTzu101'],
		replacedBy: ['idkpoisonMushroom'],
	},
	idkpoisonMushroom: {
		name: 'IdkPoison_ Mushroom',
		crops: [Crop.Mushroom],
		speed: {
			speed: 259,
			soulSand: false,
			buildVersion: "1.8.9",
			method: 'angled into wall',
		},
		angle: {
			yaw: 0, // todo: fix
			pitch: 0,
		},
		bps: 19.9,
		laneDepth: 4,
		tutorials: {
			garden: 'IdkPoison_',
		},
		authors: ['IdkPoison_'],
	},
	blackCatCocoa: {
		name: 'Black Cat Cocoa',
		crops: [Crop.CocoaBeans],
		speed: {
			speed: 400,
			depthStrider: 3,
			soulSand: true,
			buildVersion: "1.8.9",
			method: 'running into wall',
		},
		angle: {
			yaw: 0,
			pitch: -45,
		},
		bps: 19.95,
		laneDepth: 3,
		tutorials: {
			thread: 'https://discord.com/channels/1096051612373487687/1159959995329298443',
			video: 'https://www.youtube.com/watch?v=WWR2duiwxK4',
			garden: 'FarmingHub',
		},
		authors: ['AgitatedSnake92'],
		notes: [blackCatNote],
	},
	singleLaneCocoa: {
		name: 'Single Lane Cocoa',
		crops: [Crop.CocoaBeans],
		speed: {
			speed: 215,
			soulSand: false,
			buildVersion: "1.8.9",
			method: 'running into wall',
		},
		angle: {
			yaw: 0,
			pitch: -45,
		},
		bps: 19.97,
		laneDepth: 3,
		tutorials: {
			garden: 'not_a_cowfr',
		},
		authors: ['not a cow', 'Binrich'],
		notes: ["Easier to build than regular cocoa, but wont work if you don't hold D"],
	},
	blackCatCactus: {
		name: 'Black Cat Cactus',
		crops: [Crop.Cactus],
		speed: {
			speed: 464,
			depthStrider: 3,
			soulSand: false,
			buildVersion: "1.8.9",
			method: 'straight',
		},
		angle: {
			yaw: 0,
			pitch: 0,
		},
		bps: 19.9,
		laneDepth: 1,
		tutorials: {
			thread: 'https://discord.com/channels/1096051612373487687/1159959766748119050',
			video: 'https://www.youtube.com/watch?v=Kj7qxeq1jEw',
			garden: 'MelonKingDe',
		},
		authors: ['AgitatedSnake92', 'MelonKingDe', 'SunTzu101'],
		notes: [
			'Despite the name, this farm **does not** use a black cat pet anymore, instead, cactus knife raises speed cap now',
		],
	},
	aceCactus: {
		name: 'Ace Cactus',
		crops: [Crop.Cactus],
		speed: {
			speed: 464,
			depthStrider: 3,
			soulSand: false,
			buildVersion: "1.8.9",
			method: 'straight',
		},
		angle: {
			yaw: 0,
			pitch: 0,
		},
		bps: 19.9,
		laneDepth: 1,
		tutorials: {
			garden: 'LunaSappho',
		},
		authors: ['AgitatedSnake92'],
		notes: ["Don't worry about getting over 400 speed, cactus knife raises speed cap by 100"],
	},
	regularCane: {
		name: 'Regular Sugar Cane',
		crops: [Crop.SugarCane],
		speed: {
			speed: 328,
			soulSand: false,
			buildVersion: "1.8.9",
			method: 'angled into wall',
		},
		angle: {
			yaw: 45,
			pitch: 0,
		},
		bps: 19.98,
		laneDepth: 2,
		tutorials: {
			thread: 'https://discord.com/channels/1096051612373487687/1159960545487761479',
			video: 'https://www.youtube.com/watch?v=nQ5yjQU9gmo',
			garden: 'FarmingHub',
		},
	},
	farminghubCane: {
		name: 'FarmingHub Sugar Cane',
		crops: [Crop.SugarCane],
		speed: {
			speed: 328,
			soulSand: false,
			buildVersion: "1.8.9",
			method: 'angled into wall',
		},
		angle: {
			yaw: 45,
			pitch: 0,
		},
		bps: 20,
		laneDepth: 2,
		tutorials: {
			garden: 'FarmingHub',
		},
		authors: ['AgitatedSnake92'],
	},
};

// designs
// ✅=done ❌=not done yet

// sds mush ✅
// idkpoison mush ✅

// draip wheat ✅
// ace wheat (sageuk as garden?) ✅
// z109 wheat ✅
// clovis' wierd ass dropdown design ❌
// black cat wheat ✅

// black cat netherwart ✅

// cow cocoa ✅
// farminghub cocoa ✅

// ace cactus (visi luna) ✅
// regular cactus ❌
// black cat cactus ✅

// regular cane, link melonking vid ✅
// farminghub cane ✅

// maybe have farm info contain which keys always held and which keys alernate between

// maybe clac method used via things like
// 0  yaw = straight
// non 0 yaw = angled into wall
// 0 yaw and movement key si always held = running into wall
// idk how it would work for like draip and z109 though, maybe not a good idea then
