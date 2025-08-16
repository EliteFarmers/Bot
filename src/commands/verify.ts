import { EliteCommand } from '../classes/commands/index.js';
import { linkCommand } from './link.js';

const command = new EliteCommand({
	...linkCommand,
	name: 'verify',
	description: 'Link your Minecraft account. (Will be removed, use /link instead)',
});

export default command;
