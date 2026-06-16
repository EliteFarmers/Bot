import { ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import { EliteContainer } from '../classes/components';
import { Signal, SignalReceiverOptions } from '../classes/Signal';

const settings: SignalReceiverOptions = {
	name: 'guide_activity',
	execute: execute,
};

export default settings;

type Data = {
	channelId: string;
	actorId: string;
	action: string;
	guideId: string;
	guideSlug?: string;
	guideTitle?: string;
	targetType?: string;
	targetId?: string;
	details?: string;
};

const actionLabels: Record<string, string> = {
	guide_image_uploaded: 'Image uploaded',
	guide_image_imported: 'Image imported',
	guide_litematic_uploaded: 'Litematic uploaded',
	guide_asset_deleted: 'Asset deleted',
	guide_comment_hoisted: 'Comment hoisted',
	guide_comment_hoist_cleared: 'Comment hoist cleared',
};

async function execute(signal: Signal) {
	if (!signal.isExpected<Data>()) return;

	const {
		data: { channelId, actorId, action, guideId, guideSlug, guideTitle, targetType, targetId, details },
		guild,
	} = signal;

	if (!guild || !channelId) return;

	const channel = guild.channels.cache.get(channelId) ?? (await guild.channels.fetch(channelId));
	if (!channel?.isTextBased()) return;

	const label = actionLabels[action] ?? action;
	const guideName = guideTitle?.trim() || `Guide ${guideId}`;
	const guideUrl = guideSlug ? `https://elitesb.gg/guides/${guideSlug}?draft=true` : undefined;
	const target = targetType && targetId ? `\nTarget: \`${targetType}:${targetId}\`` : '';
	const body = [
		`### ${label}`,
		`Actor: <@${actorId}>`,
		`Guide: ${guideUrl ? `[${guideName}](${guideUrl})` : `\`${guideName}\``} (\`${guideId}\`)${target}`,
		details ? `\n${truncate(details, 1500)}` : '',
	].join('\n');

	const container = new EliteContainer().addText(body);
	if (guideUrl) {
		container.addActionRowComponents<ButtonBuilder>((row) =>
			row.addComponents(new ButtonBuilder().setLabel('View Guide').setStyle(ButtonStyle.Link).setURL(guideUrl)),
		);
	}

	channel
		.send({
			components: [container],
			allowedMentions: { users: [] },
			flags: MessageFlags.IsComponentsV2,
		})
		.catch(() => undefined);
}

function truncate(value: string, maxLength: number) {
	return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value;
}
