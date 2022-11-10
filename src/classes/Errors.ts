import { EmbedBuilder } from "discord.js";

export function ImproperUsageError(title: string, description: string, usage: string): EmbedBuilder {
	return new EmbedBuilder()
		.setColor('#CB152B')
		.setTitle(title)
		.setDescription(description)
		.addFields({
			name: 'Proper Usage:', 
			value: usage
		})
		.setFooter({ text: 'Created by Kaeso#5346' });
}