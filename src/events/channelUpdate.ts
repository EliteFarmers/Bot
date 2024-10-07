import { Events, GuildChannel } from 'discord.js';
import { UpdateGuildChannel } from '../api/elite.js';

const settings = {
	event: Events.ChannelUpdate,
	execute: execute,
};

export default settings;

async function execute(channel: GuildChannel) {
	if (channel.isThread() || !channel.isTextBased()) return;

	const me = channel.guild.members.me ?? (await channel.guild.members.fetchMe());
	const ownPermissions = channel.permissionsFor(me).bitfield.toString();

	await UpdateGuildChannel(channel.guild.id, {
		id: channel.id,
		name: channel.name,
		type: channel.type,
		position: channel.position,
		permissions: ownPermissions,
	});
}
