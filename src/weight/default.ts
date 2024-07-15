import { AttachmentBuilder } from "discord.js";
import { CustomFormatterOptions } from "./custom.js";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { CreateRoundCornerPath } from "classes/Util.js";

export async function createDefaultWeightImage({ account, profile, weightRank = -1, badgeUrl = '' }: CustomFormatterOptions) {
	const ign = account.name ?? 'Unknown';
	const uuid = account.id ?? 'Unknown';

	let result = '';
	const rWeight = Math.round((profile.totalWeight ?? 0) * 100) / 100;

	if (rWeight > 1) {
		result = rWeight.toString().replace(/\B(?<!\.\d*)(?=(\d{3})+(?!\d))/g, ",");
	} else if (rWeight === -1) {
		result = 'This player has collections API off!';
	} else {
		result = rWeight.toString();
	}

	/*
	The below code is not fun at all and just generally awful, but basically the only way to do all this so yeah.

	Different sections are commented but you sort of need to know what you're looking at already.
	*/

	const sources = profile.cropWeight;

	//Get image relating to their top collection
	let imagePath;
	if (sources) {
		const topCollection = Object.entries(sources).sort(([,a], [,b]) => ((b ?? 0) - (a ?? 0)))[0][0];
		imagePath = `./src/assets/images/${topCollection.toLowerCase().replace(' ', '_')}.png`;
	} else {
		imagePath = `./src/assets/images/wheat.png`
	}

	// Load crop image and avatar
	const images = [
		loadImage(imagePath),
		loadImage(`https://mc-heads.net/head/${uuid}/left`).catch(() => {
			return null;
		}),
		badgeUrl !== '' ? loadImage(badgeUrl).catch(() => {
			return null;
		}) : null
	];

	const [ background, avatar, badge ] = await Promise.all(images);
	if (!background || !avatar) {
		return null;
	}

	// Create our canvas and draw the crop image
	const canvas = createCanvas(background.width, background.height);
	const ctx = canvas.getContext('2d');

	CreateRoundCornerPath(ctx, 0, 0, canvas.width, canvas.height, 5);
	ctx.clip();
	ctx.drawImage(background, 0, 0, canvas.width, canvas.height);

	const badgeWidth = canvas.width * 0.15;
	const badgeHeight = badgeWidth / 3;
	const badgeXPos = canvas.width * 0.771 - badgeWidth;
	const badgeYPos = 14;
	const cornerRadius = 15;
	let finalXPos = badgeXPos;

	if (weightRank > 0) {
		ctx.save();
		ctx.fillStyle = '#09090b';

		const rankText = `  ${weightRank}`;

		ctx.font = '80px "Open Sans"';
		let fontSize = 80;
		do {
			fontSize--;
			ctx.font = fontSize + 'px ' + "Open Sans";
		} while (ctx.measureText(rankText).width > badgeWidth - 50);

		const metrics = ctx.measureText(rankText);
		const fontHeight = metrics.actualBoundingBoxAscent //+ metrics.actualBoundingBoxDescent;
	
		const width = metrics.width + 30;
		const x = badge ? badgeXPos - width - 15 : badgeXPos + badgeWidth - width - 15;
		finalXPos = x;

		CreateRoundCornerPath(ctx, x, badgeYPos, width, badgeHeight, cornerRadius);
		ctx.clip();
		ctx.fillRect(x, badgeYPos, width, badgeHeight);

		ctx.fillStyle = '#dddddd';
		ctx.fillText(rankText, x + 15, badgeHeight + badgeYPos - (badgeHeight - fontHeight) / 2);
		ctx.font = `${fontSize - 16}px "Open Sans"`
		ctx.fillText('#', x + 15, badgeHeight + badgeYPos - (badgeHeight - fontHeight) / 2);

		ctx.restore();
	}

	if (badge) {
		ctx.save();
		CreateRoundCornerPath(ctx, badgeXPos, badgeYPos, badgeWidth, badgeHeight, cornerRadius);
		ctx.clip();
		ctx.drawImage(badge, badgeXPos, badgeYPos, badgeWidth, badgeHeight);
		ctx.restore();
	}

	ctx.font = '100px "Open Sans"';
	let fontSize = 100;
	do {
		fontSize--;
		ctx.font = fontSize + 'px ' + "Open Sans";
	} while (ctx.measureText(ign).width > finalXPos - 100);

	const metrics = ctx.measureText(ign) as unknown as { emHeightAscent: number, emHeightDescent: number };
	const fontHeight = metrics.emHeightAscent + metrics.emHeightDescent;

	ctx.fillStyle = '#dddddd';
	ctx.fillText(ign, 55, 90 - (90 - fontHeight) / 2);
	ctx.save();

	//Add weight and label, then resize to fit
	ctx.font = '256px "Open Sans"';
	fontSize = 256;

	do {
		fontSize--;
		ctx.font = fontSize + 'px ' + "Open Sans";
	} while (ctx.measureText(result).width > canvas.width * 0.66);
	const weightWidth = ctx.measureText(result).width;

	ctx.fillStyle = '#dddddd';
	ctx.fillText(result, 50, canvas.height * 0.9);

	ctx.font = '56px "Open Sans"';
	fontSize = 56;

	do {
		fontSize--;
		ctx.font = fontSize + 'px ' + "Open Sans";
	} while (ctx.measureText('Weight').width + weightWidth > canvas.width - 530);

	ctx.fillStyle = '#dddddd';
	ctx.fillText('Weight', weightWidth + 60, canvas.height * 0.92);
	const mes = ctx.measureText('Weight') as unknown as { emHeightAscent: number, emHeightDescent: number };
	ctx.fillText('Farming', weightWidth + 60, canvas.height * 0.92 - (mes.emHeightAscent + mes.emHeightDescent));

	// Draw avatar
	if (avatar) {	
		const avatarSize = canvas.height * 0.8;
		const xOffset = canvas.width - (avatarSize) - 50;
		const yOffset = (canvas.height - avatarSize) / 2;
	
		ctx.drawImage(avatar, xOffset, yOffset, avatarSize, avatarSize);
		ctx.restore();
	}

	return new AttachmentBuilder(canvas.toBuffer("image/webp"), { name: 'weight.webp' });
}