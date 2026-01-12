import { Client, MessageCreateOptions } from 'discord.js';
import { client } from '../bot.js';
import { ErrorEmbed } from './embeds.js';

// Redis Pub/Sub Message "Signal"
// This is the message that is recieved from the Redis server.
// It is used to signal the bot to do something from the EliteAPI.
// "Signal" is used as "Message" would be confusing with the Discord.js Message class.
export class Signal<T = unknown> {
	declare name: string;
	declare authorId: string;
	declare guildId: string;

	declare data: T;

	constructor(data: string) {
		let json;

		try {
			json = JSON.parse(data);
		} catch (_) {
			console.log(_);
			console.error('Failed to parse Redis message.');
			return;
		}

		this.name = json.name;
		this.authorId = json.authorId;
		this.guildId = json.guildId;

		this.data = json.data;
	}

	get guild() {
		if (!this.guildId) return undefined;
		return client.guilds.cache.get(this.guildId);
	}

	async getMember() {
		if (!this.authorId) return undefined;

		const guild = this.guild;
		if (!guild) return undefined;

		return guild.members.cache.get(this.authorId) ?? (await guild.members.fetch(this.authorId));
	}

	async dmUser(message: MessageCreateOptions) {
		const member = await this.getMember();
		if (!member) return;

		return member.send(message).catch(() => undefined);
	}

	async success(title: string, content: string) {
		const embed = ErrorEmbed(title).setDescription(content).setFooter({
			text: 'This action was triggered online via elitebot.dev.',
		});

		return this.dmUser({ embeds: [embed] });
	}

	async fail(title: string, content: string) {
		const embed = ErrorEmbed(title).setDescription(content).setFooter({
			text: 'This action was triggered online via elitebot.dev.',
		});

		return this.dmUser({ embeds: [embed] });
	}

	// This is used to check if the signal has a body.
	// Not really type safe, but it works.
	isExpected<Ty>(name?: string): this is Signal<Ty> {
		if (!name) return this.data !== undefined;
		return this.data !== undefined && this.name === name;
	}
}

export interface SignalReceiverOptions {
	name: string;
	permissions?: bigint;
	execute: (signal: Signal, client?: Client) => void;
}
