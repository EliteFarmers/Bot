import { Signal, SignalRecieverOptions } from '../classes/Signal.js';
import { EliteEmbed } from '../classes/embeds.js';

const settings: SignalRecieverOptions = {
	name: 'wipe',
	execute: execute
}

export default settings;

type Data = {
	channelId: string,
	ign: string,
	uuid: string,
	profileId: string,
	discord: string,
}

async function execute(signal: Signal) {
	if (!signal.isExpected<Data>()) return;

	const { 
		data: { ign = "", uuid = "", discord = "", profileId = "", channelId },
		guild 
	} = signal;

	if (!guild || !channelId) return;

	const channel = guild.channels.cache.get(channelId) ?? await guild.channels.fetch(channelId);
	if (!channel?.isTextBased()) return;

	const ping = discord ? `<@${discord}>` : '';

	const embed = EliteEmbed()
		.setTitle('Player Wiped!')
		.setDescription(`**${ign}** ${ping ? `(${ping})` : ''} has been wiped!\n[Link to Profile](https://api.elitebot.dev/@${uuid}/${profileId})`)
		.setFields([
			{ name: 'UUID', value: `\`\`\`${uuid}\`\`\`` },
			{ name: 'Profile ID', value: `\`\`\`${profileId}\`\`\`` },
		])
		.setTimestamp()

	channel?.send({ 
		content: ping ? `<@&${ping}>` : undefined,
		allowedMentions: { roles: ping ? [ ping ] : [] },
		embeds: [embed], 
	}).catch(() => undefined);
}