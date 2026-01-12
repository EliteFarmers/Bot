import { MessageFlags, TextDisplayBuilder } from 'discord.js';
import { FetchProduct } from '../api/elite.js';
import { EliteContainer } from '../classes/components.js';
import { Signal, SignalReceiverOptions } from '../classes/Signal.js';

const settings: SignalReceiverOptions = {
	name: 'purchase',
	execute: execute,
};

export default settings;

type Data = {
	userId: string;
	skuId: string;
	skuName: string;
};

async function execute(signal: Signal) {
	if (!signal.isExpected<Data>()) return;

	const { guild, data } = signal;
	const channelId = process.env.ENTITLEMENT_CHANNEL;

	if (!guild || !channelId) return;

	const channel = guild.channels.cache.get(channelId) ?? (await guild.channels.fetch(channelId));
	if (!channel?.isTextBased()) return;

	const url = `https://discord.com/application-directory/${guild.client.application.id}/store/${signal.data.skuId}`;

	const { data: product } = await FetchProduct(signal.data.skuId).catch(() => ({
		data: undefined,
	}));

	const container = new EliteContainer()
		.addTitle('### New Purchase!', false)
		.addDescription(`New purchase from <@${data.userId}> for product \`${product?.name}\`!`);

	channel
		?.send({
			components: [new TextDisplayBuilder().setContent(url.toString()), container],
			flags: MessageFlags.IsComponentsV2,
		})
		.catch(() => undefined);
}
