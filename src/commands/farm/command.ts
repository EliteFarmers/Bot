import { CommandAccess, CommandGroup, CommandType } from '../../classes/commands/index.js';

const command = new CommandGroup({
	name: 'farm',
	description: 'Commands to view farm designs',
	execute: () => undefined,
	access: CommandAccess.Everywhere,
	type: CommandType.Group,
});

export default command;
