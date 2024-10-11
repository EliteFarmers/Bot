import {
	REST,
	RESTGetAPIApplicationCommandsResult,
	RESTPostAPIApplicationCommandsJSONBody,
	RESTPostAPIContextMenuApplicationCommandsJSONBody,
	Routes,
} from 'discord.js';
import dotenv from 'dotenv';
import { CommandGroup, EliteCommand } from './classes/commands/index.js';
import { registerCommandGroups, registerFiles } from './classes/register.js';
dotenv.config();

/*
 *  ===================================================================
 *	Command arguments on startup of script to do one-time operations
 *
 *		"deploy global" 	 - updates slash commands globally
 *		[REMOVED] "deploy <server id>" - updates slash commands in that server
 *		Append "clear" to remove slash commands from a server
 *  ===================================================================
 */

const commands = new Map<string, EliteCommand | CommandGroup>();
const proccessArgs = process.argv.slice(1);

async function loadCommands() {
	const filter = (fileName: string) => fileName.endsWith('.ts') || fileName.endsWith('.js');

	registerFiles<EliteCommand>('commands', filter, (cmd) => {
		commands.set(cmd.name, cmd);
	});

	const subFilter = (fileName: string) => filter(fileName) && !fileName.includes('command');

	registerCommandGroups('commands', async (folder, group) => {
		const command = new CommandGroup(group);

		registerFiles<EliteCommand>(folder, subFilter, (cmd) => {
			command.addSubcommand(cmd);
		});

		commands.set(command.name, command);
	});

	await new Promise<void>((resolve) => setTimeout(resolve, 3000));
}

const rest = new REST().setToken(process.env.BOT_TOKEN);

(async () => {
	await loadCommands();
	console.log('Loaded ' + commands.size + ' commands');
	const json = Array.from(commands.values())
		.map(getCommandJSON)
		.filter((json) => json) as RESTPostAPIApplicationCommandsJSONBody[];

	if (proccessArgs[1] === 'global') {
		// fs.writeFileSync('commands.json', JSON.stringify(json, null, 2));
		await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), {
			body: json,
		});
		console.log(`Probably updated ${json.length} slash commands globally`);
	} else if (proccessArgs[1] === 'single') {
		const name = proccessArgs[2];
		const command = json.find((cmd) => cmd.name === name);

		const existingCommands = (await rest.get(
			Routes.applicationCommands(process.env.CLIENT_ID),
		)) as RESTGetAPIApplicationCommandsResult;

		setTimeout(async function () {
			const existing = existingCommands?.find((cmd) => cmd.name === name);

			if (!command && existing) {
				await rest.delete(Routes.applicationCommand(process.env.CLIENT_ID, existing.id));
				console.log('Probably deleted that slash command globally');
				return;
			} else if (!command) {
				console.log('Could not find command with the name "' + name + '"');
				return;
			}

			if (!existing) {
				await rest.post(Routes.applicationCommands(process.env.CLIENT_ID), {
					body: command,
				});
				console.log('Probably created that slash command globally');
			} else {
				await rest.patch(Routes.applicationCommand(process.env.CLIENT_ID, existing.id), { body: command });
				console.log('Probably updated that slash command globally');
			}
		}, 3000);
	} else {
		console.log('Invalid arguments, please use "global" or "single <command name>"');
	}
})();

function getCommandJSON(
	command?: EliteCommand | CommandGroup,
): RESTPostAPIApplicationCommandsJSONBody | RESTPostAPIContextMenuApplicationCommandsJSONBody | undefined {
	if (!command) return;

	if (command instanceof CommandGroup) {
		return command.getCommandJSON();
	}

	if (command.isContextMenuCommand()) {
		const json = command.toJSON();
		return json as RESTPostAPIContextMenuApplicationCommandsJSONBody;
	}

	if (command.isChatInputCommand() && !command.isSubCommand() && command.slash) {
		const json = command.toJSON();
		return json as RESTPostAPIApplicationCommandsJSONBody;
	}
}
