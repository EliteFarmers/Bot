import { WeightStyle } from '../schemas/style.js';

export const DEFAULT_STYLE: WeightStyle = {
	decal: {
		start: { x: -400, y: 0 },
		end: { x: 1, y: 1 },
		crops: {
			cactus: './src/assets/decals/cactus.png',
			carrot: './src/assets/decals/carrot.png',
			cocoa: './src/assets/decals/cocoa_beans.png',
			melon: './src/assets/decals/melon.png',
			mushroom: './src/assets/decals/mushroom.png',
			wart: './src/assets/decals/nether_wart.png',
			potato: './src/assets/decals/potato.png',
			cane: './src/assets/decals/sugar_cane.png',
			wheat: './src/assets/decals/wheat.png',
			pumpkin: './src/assets/decals/pumpkin.png',
		},
	},
	elements: {
		background: {
			size: { x: 1920, y: 400 },
			fill: '#2c2d31',
			rects: [
				{
					start: { x: 0, y: 0 },
					end: { x: 25, y: 1 },
					fill: '#03fc7b',
					useEmbedColor: true,
				},
			],
			radius: 10,
			opacity: 1,
		},
		name: {
			position: { x: 45, y: 0.28 },
			maxWidth: 0.5,
			fontSize: 100,
		},
		weight: {
			position: { x: 40, y: 0.88 },
			maxWidth: 0.63,
			maxHeight: 100,
			fontSize: 256,
		},
		label: {
			position: { x: 20, y: -0.3 },
			maxWidth: 0.11,
			fontSize: 80,
		},
		head: {
			position: { x: -200, y: 0.5 },
			maxHeight: 0.75,
		},
		badge: {
			position: { x: 0.62, y: 20 },
			maxHeight: 100,
		},
		rank: {
			position: { x: 0.78, y: 20 },
			fontSize: 75,
			background: {
				padding: 22,
				radius: 10,
			},
		},
		rankWithBadge: {
			position: { x: 0.6, y: 20 },
			fontSize: 75,
			background: {
				padding: 22,
				radius: 10,
			},
		},
	},
};
