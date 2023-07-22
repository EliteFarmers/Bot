import { EmbedBuilder } from "discord.js";

export function EliteEmbed() {
	return new EmbedBuilder()
		.setColor('#03fc7b')
		.setFooter({ text: 'Powered by Elite Farmers API - kaeso.dev', iconURL: 'https://elitebot.dev/favicon.ico' })
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

