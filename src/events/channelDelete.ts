import { Events, GuildChannel } from 'discord.js';
import { RequestGuildUpdate } from '../api/elite.js';

const settings = {
	event: Events.ChannelDelete,
	execute: execute,
};

export default settings;

async function execute(channel: GuildChannel) {
	if (channel.isThread() || !channel.isTextBased() && channel.guildId) return;

	await RequestGuildUpdate(channel.guildId);
}
