import { Signal, SignalRecieverOptions } from '#classes/Signal.js';
import { ErrorEmbed } from '#classes/embeds.js';
import { AttachmentBuilder } from 'discord.js';

const settings: SignalRecieverOptions = {
	name: 'error',
	execute: execute
}

export default settings;

type Data = {
	ping: string,
	title: string,
	message: string,
	channelId: string,
}

async function execute(signal: Signal) {
	if (!signal.isExpected<Data>()) return;

	const { 
		data: { ping = "", title = "Server Error", message = "Unknown", channelId },
		guild 
	} = signal;

	if (!guild || !channelId) return;

	const channel = guild.channels.cache.get(channelId) ?? await guild.channels.fetch(channelId);
	if (!channel?.isTextBased()) return;

	const embed = ErrorEmbed(title)
		.setFields([
			{ name: 'Message', value: `\`\`\`${message.slice(0, 1000)}\`\`\`` },
		])
		.setTimestamp()

	// Make message into a text file if it's too long
	if (message.length > 1000) {
		const attachment = new AttachmentBuilder(Buffer.from(message), { name: 'error.txt' });

		channel?.send({ 
			content: ping ? `<@&${ping}>` : undefined,
			allowedMentions: { roles: ping ? [ ping ] : [] },
			files: [attachment],
			embeds: [embed], 
		}).catch(() => undefined);
	} else {
		channel?.send({ 
			content: ping ? `<@&${ping}>` : undefined,
			allowedMentions: { roles: ping ? [ ping ] : [] },
			embeds: [embed], 
		}).catch(() => undefined);
	}
}