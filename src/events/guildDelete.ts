import { Events, Guild } from 'discord.js';
import { syncGuildPresence } from '../api/guild-presence';

const settings = {
	event: Events.GuildDelete,
	execute,
};

export default settings;

async function execute(guild: Guild) {
	if (!guild.id) return;
	await syncGuildPresence(guild.id, false);
}
