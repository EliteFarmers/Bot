import { UserSettings } from "../api/elite.js";
import { ColorResolvable, EmbedBuilder, RepliableInteraction } from "discord.js";

export function EliteEmbed(settings?: UserSettings, footer = true) {
	const embed = new EmbedBuilder()

	if (settings?.features?.embedColor) {
		embed.setColor('#' + settings.features.embedColor as ColorResolvable);
	} else {
		embed.setColor('#03fc7b')
	}

	if (footer) {
		embed.setFooter({ text: 'Powered by Elite Farmers API - kaeso.dev', iconURL: 'https://elitebot.dev/favicon.webp' });
	}

	return embed;
}

export function ErrorEmbed(title: string) {
	return EliteEmbed()
		.setTitle(`Error: ${title}`)
		.setColor('#ff0000');
}

export function WarningEmbed(title: string) {
	return EliteEmbed()
		.setTitle(title)
		.setColor('#ffff00');
}

export function NotYoursEmbed() {
	return ErrorEmbed('Not Your Command!')
		.setDescription('Run the command yourself to interact with it!');
}

export function NotYoursReply(interaction: RepliableInteraction) {
	interaction.reply({
		embeds: [NotYoursEmbed().data],
		ephemeral: true,
	});
}

export const EmptyString = '\u200b';
export function EmptyField(inline = true) {
	return { name: '\u200b', value: '\u200b', inline };
}

export function PrefixFooter(embed: EmbedBuilder, prefix: string) {
	const current = embed.data.footer;
	embed.setFooter({
		iconURL: current?.icon_url ?? undefined,	
		text: `${prefix}\n${current?.text ?? ''}`.trim(), 
	});
	return embed;
}