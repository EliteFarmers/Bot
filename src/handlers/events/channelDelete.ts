import { RequestGuildUpdate } from "#api/elite.js";
import { Events, GuildChannel } from "discord.js";

const settings = {
	event: Events.ChannelDelete,
	execute: execute
}

export default settings;

async function execute(channel: GuildChannel) {
	if (channel.isThread() || !channel.isTextBased()) return;

	await RequestGuildUpdate(channel.guild.id);
}