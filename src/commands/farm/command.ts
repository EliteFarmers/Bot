import { CommandAccess, CommandGroup, CommandType } from '../../classes/commands/index.js';

const command = new CommandGroup({
	name: 'farm',
	description: '',
	execute: () => undefined,
	access: CommandAccess.Everywhere,
	type: CommandType.Group,
});

export default command;
