import { Signal, SignalRecieverOptions } from '../classes/Signal.js';
import { EliteEmbed } from '../classes/embeds.js';
import { PermissionFlagsBits } from 'discord.js';

const settings: SignalRecieverOptions = {
	name: 'setRoles',
	permissions: PermissionFlagsBits.ManageRoles,
	execute: execute
}

export default settings;

type Data = {
	users: string[],
	roleId: string,
	reason: string,
}

async function execute(signal: Signal) {
	if (!signal.isExpected<Data>()) return;

	const { 
		data: { users, roleId, reason },
		guild 
	} = signal;

	if (!guild || !users || !roleId) return;

	const role = guild.roles.cache.get(roleId) ?? await guild.roles.fetch(roleId);
	if (!role) return signal.fail('Invalid Role!', `The role with the id \`${roleId}\` does not exist!`);

	// Check if the bot has perms to assign the role
	const botMember = guild.members.me;
	if (!botMember) return signal.fail('Invalid Bot Member!', 'The bot is not in the guild!');

	const botHighestRole = botMember.roles.highest;
	if (botHighestRole.comparePositionTo(role) <= 0) {
		return signal.fail('Invalid Role Position!', 'The bot\'s highest role is lower than the role you are trying to assign!');
	}

	// Assign the role to all users
	const failedUsers: string[] = [];

	for (const userId of users) {
		const member = guild.members.cache.get(userId) ?? await guild.members.fetch(userId);
		if (!member) {
			failedUsers.push(userId);
			continue;
		}

		try {
			await member.roles.add(role, reason);
		} catch (error) {
			failedUsers.push(userId);
		}
	}

	// Send the result to the user
	const embed = EliteEmbed()
		.setTitle('Set Roles')
		.setDescription(`Successfully set the role \`${role.name}\` to ${users.length - failedUsers.length} users!`);

	if (failedUsers.length > 0) {
		embed.addFields([{ 
			name: 'Failed Users', 
			value: failedUsers.map(id => `<@${id}>`).join('\n') 
		}]);
	}

	signal.dmUser({ embeds: [embed] });
}