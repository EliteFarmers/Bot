import { Events, Guild } from 'discord.js';
import { RequestGuildUpdate } from '../api/elite.js';

const settings = {
	event: Events.GuildCreate,
	execute: execute,
};

export default settings;

async function execute(guild: Guild) {
	if (!guild.id) return;
	await RequestGuildUpdate(guild.id).catch(() => ({ data: undefined }));
}
