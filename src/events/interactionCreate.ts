import { ButtonInteraction, CommandInteraction, GuildMember, Interaction } from 'discord.js';
import { commands } from '../index';
import { Command, CommandType } from '../classes/Command';
import { HasRole, isValidAccess } from '../classes/Util';
import { FetchGuild } from 'api/elite';

export default async function(interaction: Interaction) {
	if (interaction.isCommand()) return OnCommandInteraction(interaction);
	if (interaction.isButton()) return OnButtonInteraction(interaction);
	//if (interaction.isAutocomplete()) return OnAutocompleteInteraction(interaction);
}

async function OnCommandInteraction(interaction: CommandInteraction) {

	const command = GetCommand(interaction.commandName, CommandType.Slash);
	if (!command) return;

	const hasPerms = await HasPermsAndAccess(command, interaction);
	if (!hasPerms) return;

	try {
		command.execute(interaction);
	} catch (error) {
		await interaction.reply({ 
			content: 'There was an error while executing this command!', 
			ephemeral: true 
		}).catch(() => undefined);
	}
}

async function OnButtonInteraction(interaction: ButtonInteraction) {
	const args = interaction.customId.split('|');
	const commandName = args[0];

	const command = GetCommand(commandName, CommandType.Button);
	if (!command) return;

	const hasPerms = await HasPermsAndAccess(command, interaction);
	if (!hasPerms) return;

	try {
		command.execute(interaction);
	} catch (error) {
		await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true }).catch(() => undefined);
	}
}

function GetCommand(name: string, type: CommandType): Command | undefined {
	const command: Command | undefined = commands.get(name);

	if (!command) return undefined;
	// If type and command type are autocomplete it's valid
	if (command.type === CommandType.Autocomplete && type === CommandType.Autocomplete) return command; 
	// If the types don't match or the type isn't combo than it's invalid
	if (command.type !== type || type !== CommandType.Combo) return undefined;

	return command;
}

async function HasPermsAndAccess(command: Command, interaction: CommandInteraction | ButtonInteraction) {
	if (interaction.channel && !isValidAccess(command.access, interaction.channel.type)) return false;

	if (!interaction.guildId || !command.permissions || !(interaction.member instanceof GuildMember)) return true;

	if (command.adminRoleOverride) {
		const { data: server } = await FetchGuild(interaction.guildId).catch(() => ({ data: undefined }));

		if (server && server.adminRole) {
			const hasRole = HasRole(interaction.member, server.adminRole as unknown as string);

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