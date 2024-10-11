import { CommandAccess, CommandGroup, CommandType } from '../../classes/commands/index.js';

const command = new CommandGroup({
	name: 'jacob',
	description: "Get jacob's stats of a player!",
	execute: () => undefined,
	access: CommandAccess.Everywhere,
	type: CommandType.Group,
});

export default command;
