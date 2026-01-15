import { utc } from '@date-fns/utc';
import { Canvas } from '@napi-rs/canvas';
import { addHours, fromUnixTime, getUnixTime, startOfDay } from 'date-fns';
import {
	ActionRowBuilder,
	AttachmentBuilder,
	ButtonBuilder,
	ButtonInteraction,
	ButtonStyle,
	ChatInputCommandInteraction,
	MessageFlags,
} from 'discord.js';
import { FetchCollectionGraphs, FetchPlayerData, FetchSkillGraphs, UserSettings } from '../api/elite.js';
import { elitePlayerOption } from '../autocomplete/player.js';
import { CommandAccess, CommandType, EliteCommand, SlashCommandOptionType } from '../classes/commands/index.js';
import { EliteContainer } from '../classes/components.js';
import { ErrorEmbed, NotYoursReply, WarningEmbed } from '../classes/embeds.js';
import { escapeIgn, GetCropEmoji } from '../classes/Util.js';
import { getAccount } from '../classes/validate.js';

const GEXP_PER_HOUR = 9_000;

const command = new EliteCommand({
	name: 'gain',
	description: 'Get the collection gain of a player over the past week!',
	access: CommandAccess.Everywhere,
	type: CommandType.Slash,
	options: {
		player: elitePlayerOption,
		profile: {
			name: 'profile',
			description: 'Optionally specify a profile!',
			type: SlashCommandOptionType.String,
		},
	},
	execute: execute,
});

export default command;

function generateBarGraph(data: BarGraphData[], options: BarGraphOptions): Buffer | null {
	const { title, color, unit = '', playerName, profileName } = options;

	// Filter out last day if it's zero
	const filteredData = data.filter((d, i) => d.value > 0 || i !== data.length - 1);
	if (filteredData.length === 0) {
		return null;
	}

	const width = 600;
	const height = 220;
	const padding = { top: 65, right: 20, bottom: 30, left: 20 };

	const canvas = new Canvas(width, height);
	const ctx = canvas.getContext('2d');

	// Background with rounded corners
	ctx.fillStyle = '#2b2d31';
	ctx.beginPath();
	ctx.roundRect(0, 0, width, height, 12);
	ctx.fill();

	// Title
	ctx.fillStyle = '#ffffff';
	ctx.font = 'bold 16px "Open Sans"';
	ctx.textAlign = 'left';
	ctx.fillText(title, padding.left, 22);

	// Credit
	ctx.fillStyle = '#80848e';
	ctx.font = '10px "Open Sans"';
	ctx.fillText('elitebot.dev', padding.left, 38);

	// Date range and player info (right side)
	if (filteredData.length > 0) {
		const firstDate = new Date(filteredData[0].label);
		const lastDate = new Date(filteredData[filteredData.length - 1].label);

		const formatDate = (d: Date) => {
			const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
			return `${months[d.getMonth()]} ${d.getDate()}`;
		};

		ctx.fillStyle = '#80848e';
		ctx.font = '12px "Open Sans"';
		ctx.textAlign = 'right';

		const dateRange = `${formatDate(firstDate)} - ${formatDate(lastDate)} ${lastDate.getFullYear()}`;
		ctx.fillText(dateRange, width - padding.right, 18);

		if (playerName && profileName) {
			ctx.fillText(`${playerName} - ${profileName}`, width - padding.right, 34);
		}
	}

	const chartWidth = width - padding.left - padding.right;
	const chartHeight = height - padding.top - padding.bottom;

	const maxValue = Math.max(...filteredData.map((d) => d.value), 1);
	const barWidth = Math.min(40, (chartWidth / filteredData.length) * 0.7);
	const gap = (chartWidth - barWidth * filteredData.length) / (filteredData.length + 1);

	// Draw bars
	filteredData.forEach((d, i) => {
		const barHeight = (d.value / maxValue) * chartHeight;
		const x = padding.left + gap + i * (barWidth + gap);
		const y = padding.top + chartHeight - barHeight;

		ctx.fillStyle = color;

		ctx.beginPath();
		ctx.roundRect(x, y, barWidth, barHeight, [4, 4, 4, 4]);
		ctx.fill();

		// Date label - centered in bottom padding area
		ctx.fillStyle = '#80848e';
		ctx.font = '11px "Open Sans"';
		ctx.textAlign = 'center';
		const date = new Date(d.label);
		const dateStr = date.getDate().toString();
		const bottomY = padding.top + chartHeight;
		ctx.fillText(dateStr, x + barWidth / 2, bottomY + padding.bottom / 2 + 4);

		// Value label on top of bar
		if (barHeight > 1) {
			ctx.fillStyle = '#ffffff';
			ctx.font = 'bold 10px "Open Sans"';
			const valueStr = formatCompact(d.value) + unit;
			ctx.fillText(valueStr, x + barWidth / 2, y - 6);
		}
	});

	return canvas.toBuffer('image/png');
}

function formatCompact(num: number): string {
	if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
	if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K';
	return num.toFixed(1);
}

async function execute(interaction: ChatInputCommandInteraction, settings?: UserSettings) {
	const playerNameInput = interaction.options.getString('player', false)?.trim();
	const profileNameInput = interaction.options.getString('profile', false)?.trim();

	await interaction.deferReply();

	const result = await getAccount(playerNameInput, profileNameInput, command, interaction.user.id);

	if (!result.success) {
		await interaction.editReply({ embeds: [result.embed] });
		return;
	}

	const { account, profile, name: playerName } = result;

	const [collectionsResult, skillsResult, playerDataResult] = await Promise.all([
		FetchCollectionGraphs(account.id, profile.profileId, 9, 1).catch(() => ({
			data: undefined,
		})),
		FetchSkillGraphs(account.id, profile.profileId, 9, 1).catch(() => ({
			data: undefined,
		})),
		FetchPlayerData(account.id).catch(() => ({ data: undefined })),
	]);

	const collections = collectionsResult.data;
	const skills = skillsResult.data;
	const playerData = playerDataResult.data;

	if (!collections) {
		const embed = ErrorEmbed("Couldn't fetch data!")
			.setDescription(`Something went wrong when getting data for "${escapeIgn(playerName)}".`)
			.setFooter({ text: 'Contact kaeso.dev if this continues to happen' });
		await interaction.deleteReply().catch(() => undefined);
		interaction.followUp({ embeds: [embed], ephemeral: true });
		return;
	}

	if (collections.length === 0) {
		const embed = WarningEmbed(`Crop Gain for ${escapeIgn(playerName)} (${profile.profileName})`).setDescription(
			`No collection data found. ${escapeIgn(
				playerName,
			)} may not have farmed recently or has collections API disabled.` +
				` [Check Online Profile](https://elitebot.dev/@${account.id})`,
		);

		interaction.editReply({ embeds: [embed] });
		return;
	}

	const cropDays = processCropData(collections);
	const skillDays = skills ? processSkillData(skills) : [];
	const uptimeDays = playerData?.guildMember?.expHistory ? processUptimeData(playerData.guildMember.expHistory) : [];

	let currentView: ViewType = 'crops';

	function buildViewButtonRow(active: ViewType): ActionRowBuilder<ButtonBuilder> {
		return new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder()
				.setCustomId('gain-view-crops')
				.setLabel('Crop Gains')
				.setEmoji('🌾')
				.setStyle(active === 'crops' ? ButtonStyle.Primary : ButtonStyle.Secondary),
			new ButtonBuilder()
				.setCustomId('gain-view-skills')
				.setLabel('Skill XP')
				.setEmoji('⚔️')
				.setStyle(active === 'skills' ? ButtonStyle.Primary : ButtonStyle.Secondary),
			new ButtonBuilder()
				.setCustomId('gain-view-uptime')
				.setLabel('Uptime')
				.setEmoji('🕐')
				.setStyle(active === 'uptime' ? ButtonStyle.Primary : ButtonStyle.Secondary),
			new ButtonBuilder().setCustomId('GAININFO').setLabel('Info').setStyle(ButtonStyle.Secondary),
			new ButtonBuilder()
				.setLabel(`@${account.name}/${profile.profileName}`)
				.setURL(`https://elitebot.dev/@${account.name}/${encodeURIComponent(profile.profileName)}`)
				.setStyle(ButtonStyle.Link),
		);
	}

	function buildGenericView<T extends { date: number }>(
		config: ViewConfig<T>,
	): {
		container: EliteContainer;
		attachment: AttachmentBuilder | null;
	} {
		const container = new EliteContainer(settings)
			.addTitle(`## ${config.title}`)
			.addDescription(`-# ${config.description}`)
			.addSeparator();

		let attachment: AttachmentBuilder | null = null;

		if (config.days.length === 0) {
			container.addText(config.emptyMessage ?? 'No data available.');
		} else {
			const maxValueLen = Math.max(...config.days.map((d) => config.formatValue(d).length));
			const formattedLines: string[] = [];

			for (const day of config.days) {
				const paddedValue = config.formatValue(day).padStart(maxValueLen, ' ');
				const details = config.formatDetails(day);
				formattedLines.push(`\`${paddedValue}\` <t:${day.date}:d>\n-# ${details}`);
			}

			formattedLines.reverse();

			if (formattedLines.length <= 3) {
				formattedLines.forEach((line) => container.addText(line));
			} else {
				const top3 = formattedLines.slice(0, 3).join('\n');
				const rest = formattedLines.slice(3).join('\n');
				const expandedText = '\n' + rest;

				container.addCollapsible({
					collapsed: {
						text: top3,
						button: `Show ${formattedLines.length - 3} more days`,
					},
					expanded: {
						text: expandedText,
						button: 'Show less',
						appendText: true,
					},
				});
			}

			const graphData: BarGraphData[] = config.days.map((d) => ({
				label: new Date(d.date * 1000).toISOString(),
				value: config.getValue(d),
			}));
			const buffer = generateBarGraph(graphData, config.graphOptions);

			if (buffer) {
				attachment = new AttachmentBuilder(buffer, { name: 'graph.png' });
				container.addSeparator();
				container.addMediaGalleryComponents((gallery) =>
					gallery.addItems((item) => item.setURL('attachment://graph.png')),
				);
			}
		}

		container.addFooter();
		return { container, attachment };
	}

	function formatCropDetails(day: DayProgress): string {
		const crops = Object.entries(day.crops)
			.filter(([, amount]) => amount > 0)
			.sort((a, b) => b[1] - a[1]);

		if (crops.length <= 0) return 'No crops collected';

		return crops
			.slice(0, 3)
			.map(([crop, amount]) => `${GetCropEmoji(crop)} ${amount.toLocaleString()}`)
			.join(' ⠀ ');
	}

	function formatSkillDetails(day: SkillDayProgress): string {
		const skills = Object.entries(day.skills)
			.filter(([, amount]) => amount > 0)
			.sort((a, b) => b[1] - a[1]);

		if (skills.length <= 0) return 'No skill XP gained';

		return skills
			.slice(0, 3)
			.map(([skill, amount]) => {
				const capitalized = skill.charAt(0).toUpperCase() + skill.slice(1);
				return `**${capitalized}:** ${amount.toLocaleString()}`;
			})
			.join(' ⠀ ');
	}

	function formatUptimeDetails(day: UptimeDayProgress): string {
		return `${day.gexp.toLocaleString()} GEXP`;
	}

	function formatUptimeValue(day: UptimeDayProgress): string {
		const hours = Math.floor(day.hours);
		const minutes = Math.round((day.hours - hours) * 60);
		return `${hours}h ${minutes}m`;
	}

	function buildCropsView() {
		const totalWeight = cropDays.reduce((sum, day) => sum + day.weight, 0);
		const dailyAverage = totalWeight / cropDays.length;

		const details = `**Total Farming Weight:** \`${totalWeight.toLocaleString()}\` (\`${dailyAverage.toLocaleString()}\`/day avg)`;

		return buildGenericView<DayProgress>({
			title: `Crop Gain for ${escapeIgn(playerName)}`,
			description: `View charts and older data [here!](https://elitebot.dev/@${account.id}/${profile.profileId}/charts)\n\n${details}`,
			days: cropDays,
			getValue: (d) => d.weight,
			formatValue: (d) => d.weight.toFixed(2),
			formatDetails: formatCropDetails,
			graphOptions: {
				title: 'Farming Weight Gain / Day',
				color: '#4ade80',
				playerName: account.name,
				profileName: profile.profileName,
			},
		});
	}

	function buildSkillsView() {
		const dailyAverage = skillDays.reduce((sum, day) => sum + day.totalXp, 0) / skillDays.length;
		const total = skillDays.reduce((sum, day) => sum + day.totalXp, 0);

		const details = `**Total Skill XP:** \`${total.toLocaleString()}\` (\`${formatCompact(dailyAverage)}\`/day avg)`;

		return buildGenericView<SkillDayProgress>({
			title: `Skill XP Gain for ${escapeIgn(playerName)}`,
			description: `Skill experience gained over the past ${skillDays.length} days.\n\n${details}`,
			days: skillDays,
			getValue: (d) => d.totalXp,
			formatValue: (d) => formatCompact(d.totalXp),
			formatDetails: formatSkillDetails,
			emptyMessage: 'No skill data available.',
			graphOptions: {
				title: 'Total XP Gain / Day',
				color: '#60a5fa',
				playerName: account.name,
				profileName: profile.profileName,
			},
		});
	}

	function buildUptimeView() {
		const guildName = account.playerData?.guildMember?.guild?.name;
		const guildId = account.playerData?.guildMember?.guild?.id;
		const guildDisplay = guildName ? `in [**${guildName}**](https://elitebot.dev/guild/${guildId})` : 'in a guild';

		const dailyAverage = uptimeDays.reduce((sum, day) => sum + day.gexp, 0) / uptimeDays.length;
		const total = uptimeDays.reduce((sum, day) => sum + day.gexp, 0);

		const details = `**Total GEXP:** \`${total.toLocaleString()}\` (\`${formatCompact(dailyAverage)}\`/day avg)`;

		return buildGenericView<UptimeDayProgress>({
			title: `Estimated Uptime for ${escapeIgn(playerName)}`,
			description: `Estimated playtime based on Hypixel Guild EXP gained ${guildDisplay}\n-# (~${GEXP_PER_HOUR.toLocaleString()} GEXP/hr)\n\n${details}`,
			days: uptimeDays,
			getValue: (d) => d.hours,
			formatValue: formatUptimeValue,
			formatDetails: formatUptimeDetails,
			emptyMessage: 'No guild exp history available. The player may not be in a guild.',
			graphOptions: {
				title: 'Hours Played / Day',
				color: '#f472b6',
				unit: 'h',
				playerName: account.name,
				profileName: profile.profileName,
			},
		});
	}

	function getViewData(view: ViewType): {
		container: EliteContainer;
		attachment: AttachmentBuilder | null;
	} {
		switch (view) {
			case 'crops':
				return buildCropsView();
			case 'skills':
				return buildSkillsView();
			case 'uptime':
				return buildUptimeView();
		}
	}

	const row = buildViewButtonRow(currentView);
	let currentData = getViewData(currentView);
	// activeContainer tracks the currently displayed container so we can handle interactions on it
	let activeContainer = currentData.container;

	const reply = await interaction.editReply({
		components: [activeContainer, row],
		files: currentData.attachment ? [currentData.attachment] : [],
		flags: [MessageFlags.IsComponentsV2],
	});

	const collector = reply.createMessageComponentCollector({
		time: 120_000,
	});

	collector.on('collect', async (inter) => {
		if (inter.user.id !== interaction.user.id) {
			return NotYoursReply(inter);
		}

		if (!inter.isButton()) return;
		collector.resetTimer();

		// Handle collapsible interactions using the active container
		if (inter.customId.startsWith('collapsible-')) {
			if (activeContainer.handleCollapsibleInteraction(inter)) {
				// If handled, update the message with the modified container state
				await (inter as ButtonInteraction).update({
					components: [activeContainer, row],
					flags: [MessageFlags.IsComponentsV2],
				});
				return;
			}
		}

		// Handle view switching
		if (inter.customId === 'gain-view-crops') {
			currentView = 'crops';
		} else if (inter.customId === 'gain-view-skills') {
			currentView = 'skills';
		} else if (inter.customId === 'gain-view-uptime') {
			currentView = 'uptime';
		} else {
			return;
		}

		// Rebuild container for new view
		const newData = getViewData(currentView);
		activeContainer = newData.container;
		currentData = newData; // Update currentData reference
		const newRow = buildViewButtonRow(currentView);

		await (inter as ButtonInteraction).update({
			components: [activeContainer, newRow],
			files: newData.attachment ? [newData.attachment] : [],
			flags: [MessageFlags.IsComponentsV2],
		});
	});

	collector.on('end', async () => {
		const { container: finalContainer, attachment: finalAttachment } = getViewData(currentView);
		finalContainer.disableEverything();
		const finalRow = buildViewButtonRow(currentView);
		finalRow.components.forEach((btn) => btn.setDisabled(true));
		await interaction
			.editReply({
				components: [finalContainer, finalRow],
				files: finalAttachment ? [finalAttachment] : [],
			})
			.catch(() => undefined);
	});
}

function processCropData(
	collections: {
		timestamp?: number;
		crops?: Record<string, number>;
		cropWeight?: number | string;
	}[],
): DayProgress[] {
	const dataPoints = collections.sort((a, b) => +(a.timestamp ?? 0) - +(b.timestamp ?? 0));
	const days: DayProgress[] = [];

	for (let i = 0; i < dataPoints.length; i++) {
		const point = dataPoints[i];
		const lastPoint = dataPoints.at(i + 1) ?? point;
		const cropGains = calculateGains(lastPoint.crops, point.crops);

		days.push({
			date: getDateFromTimestamp(lastPoint.timestamp),
			crops: cropGains,
			weight: +(lastPoint.cropWeight ?? 0) - +(point.cropWeight ?? 0),
		});
	}

	return trimDays(days, (d) => Object.values(d.crops).every((c) => c === 0));
}

function getDateFromTimestamp(timestamp: number | undefined): number {
	return getUnixTime(addHours(startOfDay(fromUnixTime(timestamp ?? 0, { in: utc }), { in: utc }), 12));
}

function calculateGains(
	current: Record<string, number> | undefined,
	previous: Record<string, number> | undefined,
): Record<string, number> {
	return Object.entries(current ?? {}).reduce<Record<string, number>>((gains, [key, value]) => {
		gains[key] = value - (previous?.[key] ?? 0);
		return gains;
	}, {});
}

function trimDays<T>(days: T[], isEmpty: (day: T) => boolean): T[] {
	if (days.length > 1 && isEmpty(days.at(-1) as T)) {
		days.pop();
	}
	while (days.length > 9) {
		days.shift();
	}
	return days;
}

function processSkillData(skills: { timestamp?: number; skills?: Record<string, number> }[]): SkillDayProgress[] {
	const dataPoints = skills.sort((a, b) => +(a.timestamp ?? 0) - +(b.timestamp ?? 0));
	const days: SkillDayProgress[] = [];

	for (let i = 0; i < dataPoints.length; i++) {
		const point = dataPoints[i];
		const lastPoint = dataPoints.at(i + 1) ?? point;
		const skillGains = calculateGains(lastPoint.skills, point.skills);
		const totalXp = Object.values(skillGains).reduce((sum, val) => sum + Math.max(0, val), 0);

		days.push({
			date: getDateFromTimestamp(lastPoint.timestamp),
			skills: skillGains,
			totalXp,
		});
	}

	return trimDays(days, (d) => Object.values(d.skills).every((s) => s === 0));
}

function processUptimeData(expHistory: Record<string, number>): UptimeDayProgress[] {
	return Object.entries(expHistory)
		.map(([dateStr, gexp]) => {
			const [year, month, day] = dateStr.split('-').map(Number);
			const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
			return {
				date: Math.floor(date.getTime() / 1000),
				gexp,
				hours: gexp / GEXP_PER_HOUR,
			};
		})
		.slice(0, 9)
		.reverse();
}

type ViewType = 'crops' | 'skills' | 'uptime';

type DayProgress = {
	date: number;
	crops: Record<string, number>;
	weight: number;
};

type SkillDayProgress = {
	date: number;
	skills: Record<string, number>;
	totalXp: number;
};

type UptimeDayProgress = {
	date: number;
	gexp: number;
	hours: number;
};

interface BarGraphData {
	label: string;
	value: number;
}

interface BarGraphOptions {
	title: string;
	color: string;
	unit?: string;
	playerName?: string;
	profileName?: string;
}

interface ViewConfig<T> {
	title: string;
	description: string;
	days: T[];
	getValue: (day: T) => number;
	formatValue: (day: T) => string;
	formatDetails: (day: T) => string;
	graphOptions: BarGraphOptions;
	emptyMessage?: string;
}
