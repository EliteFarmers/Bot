import fs from 'fs';
import type { CommandGroup } from './commands/index.js';

export async function registerFiles<T>(
	folder: string,
	filter: (fileName: string) => boolean,
	callback: (data: T) => void,
) {
	const files = fs.readdirSync(`./src/${folder}`);

	for (const file of files.filter(filter)) {
		const imported = await import(`../${folder}/${file.replace('.ts', '.js')}`);
		callback(imported.default);
	}
}

export async function registerCommandGroups(
	folder: string,
	callback: (folder: string, group: CommandGroup) => Promise<void>,
) {
	const files = fs
		.readdirSync(`./src/${folder}`)
		.filter((fileName) => fs.lstatSync(`./src/${folder}/${fileName}`).isDirectory());

	for (const file of files) {
		const imported = await import(`../${folder}/${file}/command.js`);
		await callback(`${folder}/${file}`, imported.default);
	}
}
