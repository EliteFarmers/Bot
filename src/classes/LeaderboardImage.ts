import { Canvas, GlobalFonts, Image, loadImage } from '@napi-rs/canvas';
import { join } from 'path';
import { cwd } from 'process';
import { components } from '../api/api.js';
import { GetCropColor, GetCropURL } from './Util.js';

// Register font
GlobalFonts.registerFromPath(join(cwd(), 'src', 'assets', 'fonts', 'OpenSans-Regular.ttf'), 'Open Sans');

const imageCache = new Map<string, Image>();

async function loadAllCropImages(crops: string[]) {
	const headerUrls = crops.map((crop) => GetCropURL(crop) as string).filter((url): url is string => !!url);

	const promises = headerUrls.map(async (url) => {
		if (imageCache.has(url)) return;
		try {
			const img = await loadImage(url);
			imageCache.set(url, img);
		} catch (e) {
			console.error(`Failed to load image: ${url}`, e);
		}
	});

	await Promise.all(promises);
}

export async function GenerateLeaderboardImage(guildName: string, lb: components['schemas']['GuildJacobLeaderboard']) {
	const canvas = new Canvas(1600, 1020);
	const ctx = canvas.getContext('2d');
	ctx.imageSmoothingEnabled = false;

	// Background
	// ctx.fillStyle = '#2b2d31';
	// ctx.fillRect(0, 0, canvas.width, canvas.height);

	const cropList = [
		'Cactus',
		'Carrot',
		'Cocoa Beans',
		'Melon',
		'Moonflower',
		'Mushroom',
		'Nether Wart',
		'Potato',
		'Pumpkin',
		'Sugar Cane',
		'Sunflower',
		'Wheat',
		'Wild Rose',
	];

	await loadAllCropImages(cropList);

	// Layout configuration
	const startY = 20;
	const colWidth = 520;
	const rowHeight = 180; // Height per crop box
	const padding = 20;

	let col = 0;
	let row = 0;

	for (let i = 0; i < cropList.length; i++) {
		const cropName = cropList[i];
		const propName = getCropProperty(cropName);
		const scores = lb.crops?.[
			propName as keyof typeof lb.crops
		] as components['schemas']['GuildJacobLeaderboardEntry'][];

		const x = col * (colWidth + padding);
		const y = startY + row * (rowHeight + padding);

		ctx.fillStyle = '#383a40';
		ctx.beginPath();
		ctx.roundRect(x, y, colWidth, rowHeight, 15);
		ctx.fill();

		// Accent bar
		ctx.fillStyle = GetCropColor(cropName);
		ctx.beginPath();
		ctx.roundRect(x, y, 10, rowHeight, [15, 0, 0, 15]);
		ctx.fill();

		// Crop Icon
		const url = GetCropURL(cropName);
		if (url) {
			const img = imageCache.get(url);
			if (img) {
				ctx.drawImage(img, x + 20, y + 15, 50, 50);
			}
		}

		// Crop Name
		ctx.fillStyle = '#ffffff';
		ctx.font = 'bold 36px "Open Sans"';
		ctx.textAlign = 'left';
		ctx.fillText(cropName, x + 85, y + 55);

		// Scores
		ctx.font = '24px "Open Sans"';
		ctx.fillStyle = '#dbdee1';

		if (!scores || scores.length === 0) {
			ctx.fillText('No Scores Set Yet!', x + 20, y + 110);
		} else {
			scores.slice(0, 3).forEach((entry, index) => {
				const scoreY = y + 100 + index * 30;
				const rank = index + 1;
				const name = entry.ign ?? 'Unknown';
				const score = entry.record?.collected?.toLocaleString() ?? '0';

				// Truncate name if too long
				let displayName = name;
				if (displayName.length > 20) displayName = displayName.substring(0, 20) + '...';

				ctx.fillStyle = index === 0 ? '#ffffff' : '#b5bacc';
				if (index === 0) ctx.font = 'bold 26px "Open Sans"';
				else ctx.font = '24px "Open Sans"';

				ctx.fillText(`${rank}. ${score}`, x + 20, scoreY);

				// Right align name
				ctx.textAlign = 'right';
				ctx.fillText(displayName, x + colWidth - 20, scoreY);
				ctx.textAlign = 'left';
			});
		}

		// Update position
		col++;
		if (col >= 3) {
			col = 0;
			row++;
		}
	}

	// Watermark
	ctx.save();
	ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
	ctx.font = 'bold 30px "Open Sans"';
	ctx.textAlign = 'right';
	ctx.textBaseline = 'bottom';

	// Bottom right corner
	const watermarkX = canvas.width - 20;
	const watermarkY = canvas.height - 30;

	const lbName = lb.title ?? "Jacob's Contest Leaderboard";

	ctx.fillText(lbName, watermarkX, watermarkY);
	ctx.fillText(guildName, watermarkX, watermarkY - 40);
	ctx.fillText('elitebot.dev', watermarkX, watermarkY - 80);
	ctx.restore();

	return canvas.encode('png');
}

function getCropProperty(cropName: string) {
	switch (cropName) {
		case 'Sugar Cane':
			return 'sugarCane';
		case 'Cocoa Beans':
			return 'cocoaBeans';
		case 'Nether Wart':
			return 'netherWart';
		case 'Wild Rose':
			return 'wildRose';
		default:
			return cropName.toLowerCase();
	}
}
