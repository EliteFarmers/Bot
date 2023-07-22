import { FetchGuild } from 'api/elite';
import { Command, CommandAccess, CommandType } from '../classes/Command';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, CommandInteraction, ComponentType, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { EliteEmbed, ErrorEmbed } from 'classes/embeds';

const command: Command = {
	name: 'admin',
	description: 'Access the admin panel.',
	usage: '(token)',
	access: CommandAccess.Guild,
	type: CommandType.Slash,
	permissions: [ 'Administrator' ],
	slash: new SlashCommandBuilder()
		.setName('admin')
		.setDescription('Access the admin panel!'),
	execute: execute
}

export default command;

async function execute(interaction: CommandInteraction) {
	if (!interaction.member || !interaction.guildId || !interaction.inCachedGuild()) {
		interaction.reply({ content: '**Error!**\nUse this command in a server only.', ephemeral: true }); 
		return; 
	}

	await interaction.deferReply();

	const server = await FetchGuild(interaction.guildId).then(res => res.data).catch(() => undefined);

	if (!server) {
		const embed = ErrorEmbed('Server not found!')
			.setDescription('Something went wrong with grabbing/creating your server data. If this issue persists please contact kaeso.dev');
		await interaction.deleteReply().catch(() => undefined);
		interaction.editReply({ embeds: [embed] }); 
		return;
	}			

	if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
		const embed = ErrorEmbed('Missing Permissions!')
			.setDescription('You must be an administrator to use this command.');
		await interaction.deleteReply().catch(() => undefined);
		interaction.editReply({ embeds: [embed] });
		return;
	}

	const commandsRegistered = await interaction.guild.commands.fetch().then(commands => commands.size > 0);

	const embed = EliteEmbed()
		.setTitle('Server Admin Panel')
		.setDescription('Configure your server specific settings!')
		.addFields([
			{ name: 'WARNING', value: `**Role settings** require the \`Manage Roles\` permission.\n__And for the @Elite role to be above others in the hierarchy!__\n**Setting channels** requires the \`Read Messages\` permission.\n__This is only to view channels, the bot still **CANNOT** read messages!__\n⠀\n**You must change permissions manually, or [click here](https://discord.com/api/oauth2/authorize?client_id=845065148997566486&permissions=277361249280&scope=bot%20applications.commands) to reinvite the bot.**` },
			{ name: 'How?', value: 'Please click the buttons below in order to register the slash commands that you\'ll need in order to configure these settings. To prevent command clutter, you can remove these commands when you\'re finished and enable them when you need them.\n⠀\n`/config view` is useful! Browse all `/config` commands by looking through the slash commands GUI without typing anything after they\'re registered.' },
		])

	const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder()
			.setCustomId('register')
			.setLabel('Register /config')
			.setStyle(ButtonStyle.Success)
			.setDisabled(commandsRegistered),
		new ButtonBuilder()
			.setCustomId('clear')
			.setLabel('Remove /config')
			.setStyle(ButtonStyle.Primary)
			.setDisabled(!commandsRegistered),
		new ButtonBuilder()
			.setCustomId('cancel')
			.setLabel('Cancel')
			.setStyle(ButtonStyle.Danger)
	);

	const message = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

	const collector = message.createMessageComponentCollector({ componentType: ComponentType.Button, time: 30_000 });

	collector.on('collect', async inter => {
		if (inter.user.id !== interaction.user.id) {
			inter.reply({ content: 'These aren\'t your buttons! Begone!', ephemeral: true });
			return;
		}

		if (inter.customId === 'register') {
			try {
				await inter.guild.commands.set([slashCommandData]);
				await inter.reply({ content: '**Success!** The `/config` command should now be available to you!', ephemeral: true });
			} catch (e) {
				await inter.reply({ content: 'Something went wrong! This is likely due to the bot lacking permissions to create slash commands. Please reinvite the bot with the link or fix this manually. If the issue still occurs contact Kaeso#5346', ephemeral: true });
			}
		} else if (inter.customId === 'clear') {
			try {
				await inter.guild.commands.set([]);
				await inter.reply({ content: '**Success!** The `/config` command should now be gone!', ephemeral: true });
			} catch (e) {
				await inter.reply({ content: 'Something went wrong! This is likely due to the bot lacking permissions to create slash commands. Please reinvite the bot with the link or fix this manually. If the issue still occurs contact Kaeso#5346', ephemeral: true });
			}
		} else {
			await inter.reply({ content: 'Canceled!', ephemeral: true });
		}

		collector.stop();
	});

	collector.on('end', async () => {
		message.delete().catch(() => {
			message.edit({ components: [] }).catch(() => undefined);
		})
	});
}

const slashCommandData = {
	name: 'config',
	description: 'Configure your server settings!',
	options: [{
		name: 'leaderboard',
		description: 'Set up your server\'s auto-updating Jacob leaderboard!',
		type: 1,
		options: [{
			name: 'channel',
			description: 'Where should the leaderboard be sent in?',
			type: 7,
			required: true
		}, {
			name: 'role',
			description: 'What role should be required to be placed the leaderboard?',
			type: 8,
			required: false
		}, {
			name: 'clear',
			description: 'Should the leaderboard be reset?',
			type: 5,
			required: false
		}]
	}, {
		name: 'leaderboard-notifs',
		description: 'Setup notifications for leaderboard movements!',
		type: 1,
		options: [{
			name: 'channel',
			description: 'Where should those pings be sent?',
			type: 7,
			required: true
		}, {
			name: 'role',
			description: 'What role should be pinged when there\'s a new placement on the leaderboard?',
			type: 8,
			required: false
		}]
	}, {
		name: 'admin-role',
		description: 'Allow one specified role access to these settings!',
		type: 1,
		options: [{
			name: 'role',
			description: 'Choose a trusted role to grant it access!',
			type: 8,
			required: true
		}]
	}, {
		name: 'cutoff-date',
		description: 'Please read about this command in "/config view" before using this.',
		type: 1,
		options: [{
			name: 'day',
			description: 'Set the day of the cutoff date! [1-31] (inclusive)',
			type: 4,
			required: true,
		}, {
			name: 'month',
			description: 'Set the month of the cutoff date!',
			type: 4,
			required: true,
			choices: [
				{ name: 'Early Spring', value: 1 }, 
				{ name: 'Spring', value: 2 }, 
				{ name: 'Late Spring', value: 3 }, 
				{ name: 'Early Summer', value: 4 }, 
				{ name: 'Summer', value: 5 }, 
				{ name: 'Late Summer', value: 6 }, 
				{ name: 'Early Autumn', value: 7 }, 
				{ name: 'Autumn', value: 8 }, 
				{ name: 'Late Autumn', value: 9 }, 
				{ name: 'Early Winter', value: 10 }, 
				{ name: 'Winter', value: 11 }, 
				{ name: 'Late Winter', value: 12 }
			]
		}, {
			name: 'year',
			description: 'Set the year of the cutoff date!',
			type: 4,
			required: true
		}]
	}, {
		name: 'exclude-range',
		description: 'Exclude a range of dates from the leaderboard!',
		type: 1,
		options: [{
			name: 'reason',
			description: 'What reason should be shown for this?',
			type: 3,
			required: true,
		}, {
			name: 'start-day',
			description: 'Set the day of the cutoff date! [1-31] (inclusive)',
			type: 4,
			required: true,
		}, {
			name: 'start-month',
			description: 'Set the month of the cutoff date!',
			type: 4,
			required: true,
			choices: [
				{ name: 'Early Spring', value: 1 }, 
				{ name: 'Spring', value: 2 }, 
				{ name: 'Late Spring', value: 3 }, 
				{ name: 'Early Summer', value: 4 }, 
				{ name: 'Summer', value: 5 }, 
				{ name: 'Late Summer', value: 6 }, 
				{ name: 'Early Autumn', value: 7 }, 
				{ name: 'Autumn', value: 8 }, 
				{ name: 'Late Autumn', value: 9 }, 
				{ name: 'Early Winter', value: 10 }, 
				{ name: 'Winter', value: 11 }, 
				{ name: 'Late Winter', value: 12 }
			]
		}, {
			name: 'start-year',
			description: 'Set the year of the cutoff date!',
			type: 4,
			required: true
		}, {
			name: 'end-day',
			description: 'Set the day of the cutoff date! [1-31] (inclusive)',
			type: 4,
			required: true,
		}, {
			name: 'end-month',
			description: 'Set the month of the cutoff date!',
			type: 4,
			required: true,
			choices: [
				{ name: 'Early Spring', value: 1 }, 
				{ name: 'Spring', value: 2 }, 
				{ name: 'Late Spring', value: 3 }, 
				{ name: 'Early Summer', value: 4 }, 
				{ name: 'Summer', value: 5 }, 
				{ name: 'Late Summer', value: 6 }, 
				{ name: 'Early Autumn', value: 7 }, 
				{ name: 'Autumn', value: 8 }, 
				{ name: 'Late Autumn', value: 9 }, 
				{ name: 'Early Winter', value: 10 }, 
				{ name: 'Winter', value: 11 }, 
				{ name: 'Late Winter', value: 12 }
			]
		}, {
			name: 'end-year',
			description: 'Set the year of the cutoff date!',
			type: 4,
			required: true
		}]
	}, {
		name: 'clear',
		description: 'Clear various settings.',
		type: 1,
		options: [{
			name: 'setting',
			description: 'Close the setting to clear!',
			type: 3,
			required: true,
			choices: [{
				value: 'all',
				name: 'All - Clear all server-specific settings',
			}, {
				value: 'leaderboard',
				name: 'Leaderboard - Clear your leaderboard settings',
			}, {
				value: 'exclude-range',
				name: 'Excluded Ranges - Clear date ranges that were excluded!',
			}, {
				value: 'admin-role',
				name: 'Admin Role - Remove the set role from having these permissions!',
			}]
		}]
	}, {
		name: 'view',
		description: 'View the config!',
		type: 1
	}, {
		name: 'remove-user',
		description: 'Remove a user from the leaderboard',
		type: 1,
		options: [{
			name: 'player',
			description: 'The Minecraft username of the player to remove!', 
			type: 3,
			required: true,
			autocomplete: true
		}]
	}]
}
