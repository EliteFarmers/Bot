import { Command, CommandGroup, CommandType, SubCommand, registerCommandGroups, registerFiles } from './classes/Command.js';
import { PermissionsBitField, REST, RESTGetAPIApplicationCommandsResult, RESTPostAPIApplicationCommandsJSONBody, Routes, SlashCommandBuilder } from 'discord.js';
import dotenv from 'dotenv';
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

const commands = new Map<string, Command | CommandGroup>();
const proccessArgs = process.argv.slice(1);

async function loadCommands() {
	const filter = (fileName: string) => fileName.endsWith('.ts') || fileName.endsWith('.js');

	await registerFiles<Command>('commands', filter, (cmd) => {
		commands.set(cmd.name, cmd);
	});

	const subFilter = (fileName: string) => filter(fileName) && !fileName.includes('command');

	await registerCommandGroups('commands', async (folder, group) => {
		const command = new CommandGroup(group);

		await registerFiles<SubCommand>(folder, subFilter, (cmd) => {
			command.addSubcommand(cmd);
		});

		commands.set(command.name, command);
	});

	await new Promise<void>(resolve => setTimeout(resolve, 3000));
}

const rest = new REST().setToken(process.env.BOT_TOKEN);

(async () => {
	await loadCommands();
	console.log('Loaded ' + commands.size + ' commands');
	const json = Array.from(commands.values()).map(getCommandJSON).filter(json => json) as RESTPostAPIApplicationCommandsJSONBody[];

	if (proccessArgs[1] === 'global') {
		await rest.put(
			Routes.applicationCommands(process.env.CLIENT_ID),
			{ body: json },
		);
		console.log(`Probably updated ${json.length} slash commands globally`);
	} else if (proccessArgs[1] === 'single') {
		const name = proccessArgs[2];
		const command = json.find(cmd => cmd.name === name);

		const existingCommands = await rest.get(
			Routes.applicationCommands(process.env.CLIENT_ID),
		) as RESTGetAPIApplicationCommandsResult;

		setTimeout(async function() {
			const existing = existingCommands?.find(cmd => cmd.name === name);
			
			if (!command && existing) {
				await rest.delete(Routes.applicationCommand(process.env.CLIENT_ID, existing.id));
				console.log('Probably deleted that slash command globally');
				return;
			} else if (!command) {
				console.log('Could not find command with the name "' + name + '"');
				return;
			}

			if (!existing) {
				await rest.post(
					Routes.applicationCommands(process.env.CLIENT_ID),
					{ body: command },
				);
				console.log('Probably created that slash command globally');
			} else {
				await rest.patch(
					Routes.applicationCommand(process.env.CLIENT_ID, existing.id),
					{ body: command },
				);
				console.log('Probably updated that slash command globally');
			}
		}, 3000);
	}
})();

function getCommandJSON(command?: Command | CommandGroup): RESTPostAPIApplicationCommandsJSONBody | undefined {
	if (command instanceof CommandGroup) {
		return command.getCommandJSON();
	}

	if (!command) return;
	if (command.type !== CommandType.Slash && command.type !== CommandType.Combo && command.type !== CommandType.ContextMenu) {
		return;
	}
	
	if (!command.slash && command.type === CommandType.Slash) {
		command.slash = new SlashCommandBuilder();
	} else if (!command.slash) {
		return;
	}

	const slash = command.slash;

	if (!slash.name) {
		slash.setName(command.name);
	}

	if ('setDescription' in slash && !slash.description) {
		slash.setDescription(command.description);
	}
	
	if (command.permissions) {
		slash.setDefaultMemberPermissions(PermissionsBitField.resolve(command.permissions));
	}

	return command.slash.toJSON();
}