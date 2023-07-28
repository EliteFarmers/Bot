import { Command, CommandAccess, CommandType } from "../classes/Command.js";
import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, PermissionFlagsBits } from 'discord.js';
import { EliteEmbed, ErrorEmbed } from "../classes/embeds.js";
import { FetchGuildJacob } from "../api/elite.js";
import { GetCropEmoji, GetEmbeddedTimestamp } from "../classes/Util.js";
import { components } from "../api/api.js";
import { GetReadableDate } from "../classes/SkyblockDate.js";

const command: Command = {
	name: 'LBSETUP',
	description: 'Setup a jacob leaderboard!',
	permissions: PermissionFlagsBits.Administrator | PermissionFlagsBits.ManageGuild,
	access: CommandAccess.Guild,
	type: CommandType.Button,
	execute: execute
}

export default command;

async function execute(interaction: ButtonInteraction) {
	if (!interaction.inCachedGuild()) {
		const embed = ErrorEmbed('This command can only be used in a server!')
			.setDescription('If you are in a server, please wait a few minutes and try again.\nOtherwise I have no idea how you got this error.');
		interaction.reply({ embeds: [embed], ephemeral: true });
		return;
	}

	await interaction.deferReply({ ephemeral: true });

	const guild = await FetchGuildJacob(interaction.guildId).then((data) => data.data).catch(() => undefined);

	if (!guild) {
		const embed = ErrorEmbed('Jacob Leaderboards not available!')
			.setDescription('This server does not have Jacob Leaderboards enabled.\nIf you were expecting this to work, please contact "kaeso.dev" on Discord.\nThis feature is being remade currently, and will likely be a paid feature. Sorry for the inconvenience.');
		interaction.editReply({ embeds: [embed] });
		return;
	}

	const [, lbId ] = interaction.customId.split('|');
	const leaderboard = guild.leaderboards?.find((lb) => lb.id === lbId);

	if (!leaderboard) {
		const embed = ErrorEmbed('Leaderboard not found!')
			.setDescription('This leaderboard does not exist.\nIf you were expecting this to work, please contact "kaeso.dev" on Discord.\nThis feature is being remade currently, and will likely be a paid feature. Sorry for the inconvenience.');
		interaction.editReply({ embeds: [embed] });
		return;
	}

	const embed = EliteEmbed()
		.setTitle('Leaderboard Setup')
		.setDescription('Congrat!');
	interaction.editReply({ embeds: [embed] });

	const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder()
			.setCustomId(`LBSUBMIT|${lbId}`)
			.setLabel('Submit Scores')
			.setStyle(ButtonStyle.Secondary),
		new ButtonBuilder()
			.setLabel('View Online')
			.setURL(`https://elitebot.dev/server/${interaction.guildId}`)
			.setStyle(ButtonStyle.Link),
	);

	interaction.message.edit({ embeds: [getLeaderboardEmbed(leaderboard)], components: [row] }).catch(() => undefined);
}

function getLeaderboardEmbed(lb: components['schemas']['GuildJacobLeaderboard']) {
	const { cactus, carrot, cocoaBeans, melon, mushroom, netherWart, potato, pumpkin, sugarCane, wheat } = lb.crops ?? {};

	const embed = EliteEmbed()
		.setTitle('Jacob\'s Contest Leaderboard')
		.setDescription('These are the highscores set by your fellow server members!')
	
	let footerText = 'Scores are valid starting from ';
	if (!lb.startCutoff || lb.startCutoff === -1) {
		footerText += 'the beginning of Skyblock';
	}
	if (lb.startCutoff && lb.startCutoff !== -1) {
		footerText += GetReadableDate(lb.startCutoff);
	}

	if (lb.endCutoff && lb.endCutoff !== -1) {
		footerText += ` to ${GetReadableDate(lb.endCutoff)}`;
	}

	embed.setFooter({ text: footerText });

	embed.addFields([
		getField('Cactus', cactus),
		getField('Carrot', carrot),
		getField('Cocoa Beans', cocoaBeans),
		getField('Melon', melon),
		getField('Mushroom', mushroom),
		getField('Nether Wart', netherWart),
		getField('Potato', potato),
		getField('Pumpkin', pumpkin),
		getField('Sugar Cane', sugarCane),
		getField('Wheat', wheat),
	]);

	return embed;
}

function getField(crop: string, scores?: components['schemas']['GuildJacobLeaderboardEntry'][]) {
	if (!scores || scores.length === 0) return {
		name: crop,
		value: 'No Scores Set Yet!'
	};

	const first = scores[0];
	const otherScores = scores.slice(1).map((s, i) => {
		return `**${i + 2}.** <@${s.discordId}> - ${s.record?.collected?.toLocaleString()} [⧉](https://elitebot.dev/contest/${s.record?.timestamp ?? 0})`
	}).join('⠀ ⠀');

	const value = `
		${GetCropEmoji(crop)} <@${first.discordId}> - **${first.record?.collected?.toLocaleString()}** - ${GetEmbeddedTimestamp(first.record?.timestamp ?? 0)} [⧉](https://elitebot.dev/contest/${first.record?.timestamp ?? 0})
		${otherScores}
	`;

	return {
		name: `${crop} - ${first.ign}`, value
	};
}