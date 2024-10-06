import { Signal, SignalRecieverOptions } from '../classes/Signal.js';
import { EliteEmbed } from '../classes/embeds.js';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

const settings: SignalRecieverOptions = {
	name: 'leaderboardInit',
	execute: execute
}

export default settings;

type Data = {
	channelId: string,
	leaderboardId: string
}

async function execute(signal: Signal) {
	if (!signal.isExpected<Data>()) return;

	const { 
		data: { channelId, leaderboardId },
		guild 
	} = signal;

	if (!guild || !channelId || !leaderboardId) return;

	const channel = guild.channels.cache.get(channelId) ?? await guild.channels.fetch(channelId);
	if (!channel?.isTextBased()) return;

	const embed = EliteEmbed()
		.setTitle('Setup Jacob Leaderboard!')
		.setDescription('Click the button below to setup the Jacob Leaderboard in this channel!');

	const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder()
			.setCustomId(`LBSETUP|${leaderboardId}`)
			.setLabel('Setup Leaderboard')
			.setStyle(ButtonStyle.Success)
	);

	channel?.send({ embeds: [embed], components: [row] }).catch(() => undefined);
}