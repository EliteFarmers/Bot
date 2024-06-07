import { RequestGuildUpdate } from "api/elite";
import { Events, Guild } from "discord.js";

const settings = {
	event: Events.GuildCreate,
	execute: execute
}

export default settings;

async function execute(guild: Guild) {
	await RequestGuildUpdate(guild.id).catch(() => ({ data: undefined }));
}