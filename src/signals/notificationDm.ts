import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	Client,
	EmbedBuilder,
	MessageActionRowComponentBuilder,
} from 'discord.js';
import { UpdateNotificationDeliveryAttempt } from '../api/elite';
import { Signal, SignalReceiverOptions } from '../classes/Signal';

const settings: SignalReceiverOptions = {
	name: 'notification_dm',
	execute,
};

export default settings;

type Data = {
	userId: string;
	attemptId: number;
	notificationId: number;
	title: string;
	message?: string | null;
	link?: string | null;
};

async function execute(signal: Signal, client?: Client) {
	if (!signal.isExpected<Data>() || !client) return;

	const { userId, attemptId, title, message, link } = signal.data;
	const embed = new EmbedBuilder()
		.setTitle(title.slice(0, 256))
		.setDescription((message || 'You have a new notification on Elite.').slice(0, 4096))
		.setTimestamp()
		.setFooter({ text: 'eliteskyblock.com' });

	const components = [] as ActionRowBuilder<MessageActionRowComponentBuilder>[];
	if (link) {
		const url = link.startsWith('http') ? link : `https://eliteskyblock.com${link.startsWith('/') ? '' : '/'}${link}`;
		components.push(
			new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
				new ButtonBuilder().setLabel('View').setStyle(ButtonStyle.Link).setURL(url),
			),
			new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
				new ButtonBuilder().setLabel('Settings').setStyle(ButtonStyle.Link).setURL('https://eliteskyblock.com/profile'),
			),
		);
	}

	try {
		const user = await client.users.fetch(userId);
		await user.send({
			embeds: [embed],
			components,
		});
		await UpdateNotificationDeliveryAttempt(attemptId, 'succeeded');
	} catch (error) {
		await UpdateNotificationDeliveryAttempt(
			attemptId,
			'failed',
			'dm_failed',
			error instanceof Error ? error.message : 'Failed to send Discord DM',
		);
	}
}
