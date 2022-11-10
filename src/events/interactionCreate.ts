import { AutocompleteInteraction, ButtonInteraction, CommandInteraction, GuildMember, Interaction } from 'discord.js';
import { commands } from '../index';
import { Command, CommandType } from '../classes/Command';
import { HasRole, isValidAccess } from '../classes/Util';
import DataHandler from '../classes/Database';

export default async function(interaction: Interaction) {
	if (interaction.isCommand()) return OnCommandInteraction(interaction);
	if (interaction.isButton()) return OnButtonInteraction(interaction);
	if (interaction.isAutocomplete()) return OnAutocompleteInteraction(interaction);
}

async function OnCommandInteraction(interaction: CommandInteraction) {

	const command = GetCommand(interaction.commandName, 'SLASH');
	if (!command) return;

	const hasPerms = await HasPermsAndAccess(command, interaction);
	if (!hasPerms) return;

	try {
		command.execute(interaction);
	} catch (error) {
		await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true }).catch(() => undefined);
	}
}

async function OnButtonInteraction(interaction: ButtonInteraction) {
	const args = interaction.customId.split('|');
	const commandName = args[0];

	const command = GetCommand(commandName, 'BUTTON');
	if (!command) return;

	const hasPerms = await HasPermsAndAccess(command, interaction);
	if (!hasPerms) return;

	try {
		command.execute(interaction);
	} catch (error) {
		await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true }).catch(() => undefined);
	}
}

async function OnAutocompleteInteraction(interaction: AutocompleteInteraction) {
	if (interaction.responded) return;
	const focused = interaction.options.getFocused(true);
	if (!focused) return;

	const typed = (focused.value ?? '').toString().toLowerCase();

	if (typed === '') {
		const top5 = DataHandler.leaderboard.slice(0, 5).map(user => { 
			return { name: user.ign ?? 'ERROR', value: user.ign ?? 'ERROR' }
		});
		return interaction.respond(top5);
	}

	const sortedNames = await DataHandler.getSortedNames();
	const options = [{ name: typed, value: typed }];

	// A rough sort that works for now
	const matches = sortedNames.filter(name => name.toLowerCase().startsWith(typed)).slice(0, 9).map(name => {
		return { name: name, value: name }
	});

	if (matches.length < 9) {
		matches.push(...sortedNames.filter(name => name.toLowerCase().substring(1).startsWith(typed)).slice(0, 9 - matches.length).map(name => {
			return { name: name, value: name }
		}));
	}
	
	if (matches.length <= 0) {
		const top5 = DataHandler.leaderboard.slice(0, 5).map(user => { 
			return { name: user.ign ?? 'ERROR', value: user.ign ?? 'ERROR' }
		});
		return interaction.respond([...options, ...top5]);
	}

	const total = [...options.filter(opt => opt.name.toLowerCase() !== matches[0]?.name.toLowerCase()), ...matches];

	interaction.respond(total);
}

function GetCommand(name: string, type: CommandType): Command | undefined {
	const command: Command | undefined = commands.get(name);

	if (!command) return undefined;
	// If type and command type are autocomplete it's valid
	if (command.type === 'AUTOCOMPLETE' && type === 'AUTOCOMPLETE') return command; 
	// If the types don't match or the type isn't combo than it's invalid
	if (![ 'COMBO', type ].includes(command.type)) return undefined;

	return command;
}

async function HasPermsAndAccess(command: Command, interaction: CommandInteraction | ButtonInteraction) {
	if (interaction.channel && !isValidAccess(command.access, interaction.channel.type)) return false;

	if (!interaction.guildId || !command.permissions || !(interaction.member instanceof GuildMember)) return true;

	if (command.adminRoleOverride) {
		const server = await DataHandler.getServer(interaction.guildId);

		if (server && server.adminrole) {
			const hasRole = HasRole(interaction.member, server.adminrole);

			if (!hasRole) {
				await interaction.reply({ 
					content: 'You don\'t have the required permissions for this command.', 
					allowedMentions: { repliedUser: true }, 
					ephemeral: true 
				});
			}

			return hasRole;
		}
	}

	// Get user permissions
	const perms = interaction.memberPermissions;
	// Return if lacking one
	if (!perms || !(command.permissions.every((perm) => perms.has(perm)))) {
		await interaction.reply({ 
			content: 'You don\'t have the required permissions for this command.', 
			allowedMentions: { repliedUser: true }, 
			ephemeral: true 
		});
		return false;
	}	

	return true;
}