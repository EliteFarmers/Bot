import { ButtonBuilder, ButtonStyle, ChannelType, Client, MessageFlags, WebhookClient } from 'discord.js';
import { FetchGuide } from '../api/elite.js';
import { EliteContainer } from '../classes/components.js';
import { Signal, SignalReceiverOptions } from '../classes/Signal.js';

const settings: SignalReceiverOptions = {
	name: 'audit_log',
	execute: execute,
};

export default settings;

type Data = {
	channelId: string;
	adminId: string;
	action: string;
	targetType: string;
	targetId?: string;
	details: string;
};

async function execute(signal: Signal) {
	console.log('Audit log signal received', signal);
	if (!signal.isExpected<Data>()) return;

	const {
		data: { channelId, adminId, action, targetType, details, targetId },
		guild,
	} = signal;

	if (!guild || !channelId) return;

	const channel = guild.channels.cache.get(channelId) ?? (await guild.channels.fetch(channelId));
	if (!channel?.isTextBased()) return;

	const embed = new EliteContainer().addText(
		`\`${action}\` - <@${adminId}> has performed action on target type \`${targetType}\`\n${details}`,
	);
	channel
		?.send({
			components: [embed],
			allowedMentions: { users: [] },
			flags: MessageFlags.IsComponentsV2,
		})
		.catch(() => undefined);

	// Nice user facing announcement for a log of new approved guides
	if (action === 'guide_approved' && targetId && process.env.GUIDES_WEBHOOK) {
		const webhook = process.env.GUIDES_WEBHOOK;

		const { data: guide } = await FetchGuide(targetId).catch(() => ({
			data: undefined,
		}));
		if (!guide) return;

		const guideEmbed = new EliteContainer();

		const description =
			(guide.description?.slice(0, 256) || 'No description provided.') +
			(guide.description?.length && guide.description.length > 256 ? '...' : '') +
			`\n-# By <@${guide.author.id}>`;

		if (guide.iconSkyblockId) {
			guideEmbed.addSectionComponents((section) =>
				section
					.setThumbnailAccessory((a) =>
						a.setURL('https://api.elitebot.dev/textures/items/' + guide.iconSkyblockId + '.webp'),
					)
					.addTextDisplayComponents((text) => text.setContent('## ' + guide.title))
					.addTextDisplayComponents((text) => text.setContent(description)),
			);
		} else {
			guideEmbed.addTitle('## ' + guide.title);
			guideEmbed.addDescription(description);
		}

		guideEmbed.addActionRowComponents<ButtonBuilder>((row) =>
			row.addComponents(
				new ButtonBuilder()
					.setLabel('View Guide')
					.setStyle(ButtonStyle.Link)
					.setURL(`https://elitebot.dev/guides/${guide.slug}`),
			),
		);

		const webhookClient = new WebhookClient({ url: webhook });
		const sent = await webhookClient
			.send({
				components: [guideEmbed],
				withComponents: true,
				flags: MessageFlags.IsComponentsV2,
				avatarURL: 'https://elitebot.dev/favicon.webp',
				username: 'Elite Guides',
			})
			.catch((e) => console.error('Failed to send guide approved webhook:', e));

		console.log('Sent guide approved webhook:', sent);

		if (sent) {
			if (guild.client.shard) {
				guild.client.shard?.broadcastEval(
					(client, sent) => {
						publish(client, sent);
					},
					{ context: sent },
				);
			} else {
				publish(guild.client, sent);
			}
		}

		channel
			.send({
				components: [guideEmbed],
				allowedMentions: { users: [] },
				flags: MessageFlags.IsComponentsV2,
			})
			.catch(console.error);
	}
}

async function publish(client: Client, sent: { channel_id: string; id: string }) {
	const msgChannel = await client.channels.fetch(sent.channel_id).catch(() => undefined);
	if (!msgChannel?.isTextBased() || msgChannel.type !== ChannelType.GuildAnnouncement) {
		return;
	}
	const sentMessage = await msgChannel.messages.fetch(sent.id).catch(() => undefined);
	if (!sentMessage) return;

	await new Promise((resolve) => setTimeout(resolve, 3000));

	await sentMessage.crosspost().catch(() => undefined);
}
