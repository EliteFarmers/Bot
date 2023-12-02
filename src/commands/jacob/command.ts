import { CommandAccess, CommandGroupSettings, CommandType } from "../../classes/Command.js";

const command: CommandGroupSettings = {
	name: 'jacob',
	description: 'Get jacob\'s stats of a player!',
	access: CommandAccess.Everywhere,
	type: CommandType.Slash
}

export default command;