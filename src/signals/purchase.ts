import { Signal, SignalRecieverOptions } from '../classes/Signal.js';
import { EliteEmbed } from '../classes/embeds.js';

const settings: SignalRecieverOptions = {
	name: 'error',
	execute: execute
}

export default settings;

type Data = {
	userId: string,
	skuId: string,
	skuName: string,
}

async function execute(signal: Signal) {
	if (!signal.isExpected<Data>()) return;

	const { guild, data } = signal;
	console.log('New purchase!', data);
	const channelId = process.env.ENTITLEMENT_CHANNEL;

	if (!guild || !channelId) return;

	console.log('Sending purchase to channel', channelId);
	const channel = guild.channels.cache.get(channelId) ?? await guild.channels.fetch(channelId);
	if (!channel?.isTextBased()) return;

	const url = `https://discord.com/application-directory/${guild.client.application.id}/store/${signal.data.skuId}`;
	console.log('URL:', url);

	const embed = EliteEmbed()
		.setTitle('New Purchase!')
		.setDescription(`New purchase from <@${data.userId}> for product \`${data.skuName}\`!`)
		.setTimestamp()

	channel?.send({ 
		content: url,
		embeds: [embed], 
	}).catch(() => undefined);
}