import { AutocompleteInteraction, ButtonInteraction, CommandInteraction, Interaction, Permissions, PermissionString } from "discord.js";
import { commands } from "../index";
import { Command, CommandType } from "../classes/Command";
import { isValidAccess } from "../classes/Util";

export default async function(interaction: Interaction) {
	if (interaction.isCommand()) return OnCommandInteraction(interaction);
	if (interaction.isButton()) return OnButtonInteraction(interaction);
	if (interaction.isAutocomplete()) return OnAutocompleteInteraction(interaction);
}

async function OnCommandInteraction(interaction: CommandInteraction) {

	const command = GetCommand(interaction.commandName, 'SLASH');
	if (!command) return;

	if (!HasPermsAndAccess(command, interaction)) return;

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

	if (!HasPermsAndAccess(command, interaction)) return;

	try {
		command.execute(interaction);
	} catch (error) {
		await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true }).catch(() => undefined);
	}
}

async function OnAutocompleteInteraction(interaction: AutocompleteInteraction) {
	const commandName = interaction.commandName;

	if (!commands.has(commandName)) return;

	const command: Command | undefined = commands.get(commandName);
	if (!command || command.type !== 'AUTOCOMPLETE') return;

	try {
		command.execute(interaction);
	} catch (error) {
		console.log(error);
	}
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

	if (!interaction.guildId || !command.permissions) return true;

	// Get user permissions
	const perms = ((interaction.member?.permissions) as Readonly<Permissions>).toArray();
	// Return if lacking one
	if (!(command.permissions.every((perm) => perms.includes(perm as PermissionString)))) {
		await interaction.reply({ 
			content: 'You don\'t have the required permissions for this command.', 
			allowedMentions: { repliedUser: true }, 
			ephemeral: true 
		});
		return false;
	}	

	return true;
}