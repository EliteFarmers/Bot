import { EliteCommand } from '../classes/commands/index';
import { linkCommand } from './link';

const command = new EliteCommand({
	...linkCommand,
	name: 'verify',
	description: 'Link your Minecraft account. (Will be removed, use /link instead)',
});

export default command;
