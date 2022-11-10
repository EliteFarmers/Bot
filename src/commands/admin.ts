import { Command } from '../classes/Command';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, CommandInteraction, ComponentType, EmbedBuilder, Message, PermissionFlagsBits } from 'discord.js';

const command: Command = {
	name: 'admin',
	description: 'Access the admin panel.',
	usage: '(token)',
	access: 'ALL',
	type: 'SLASH',
	slash: {
		name: 'admin',
		description: 'Get the admin panel!'
	},
	execute: execute
}

export default command;

async function execute(interaction: CommandInteraction) {
	if (!interaction.member || !interaction.guildId || !interaction.guild) {
		interaction.reply({ content: '**Error!**\nUse this command in a server only.', ephemeral: true }); 
		return; 
	}

	const server = await DataHandler.getServer(interaction.guildId) 
				?? await DataHandler.createServer(interaction.guildId);

	if (!server) {
		return interaction.reply({ content: '**Error!**\nSomething went wrong with grabbing/creating your server data. If this issue persists please contact Kaeso#5346', ephemeral: true }); 
	}			

	if (typeof interaction.member.permissions === 'string' || Array.isArray(interaction.member.roles)) {
		return interaction.reply({ content: '**Error!**\nLacking permissions to see member permissions or roles.', ephemeral: true }); 
	}

	if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator) && !interaction.member.roles.cache.some(role => role.id === server.adminrole)) {
		return interaction.reply({ content: '**Error!** This command is only for server Admins/authorized users!', ephemeral: true }); 
	}

	const dateNow = Date.now();
	const onCooldown = (dateNow < +(server.configshowedat ?? 0) + (10 * 60 * 1000));
	const commandsRegistered = await interaction.guild.commands.fetch().then(commands => commands.size > 0);

	const embed = new EmbedBuilder().setColor('#03fc7b')
		.setTitle('Server Admin Panel')
		.setDescription('Configure your server specific settings!')
		.addFields([
			{ name: 'WARNING', value: `**Role settings** require the \`Manage Roles\` permission.\n__And for the @Elite role to be above others in the hierarchy!__\n**Setting channels** requires the \`Read Messages\` permission.\n__This is only to view channels, the bot still **CANNOT** read messages!__\n⠀\n**You must change permissions manually, or [click here](https://discord.com/api/oauth2/authorize?client_id=845065148997566486&permissions=277361249280&scope=bot%20applications.commands) to reinvite the bot.**` },
			{ name: 'How?', value: 'Please click the buttons below in order to register the slash commands that you\'ll need in order to configure these settings. To prevent command clutter, you can remove these commands when you\'re finished and enable them when you need them.\n⠀\n`/config view` is useful! Browse all `/config` commands by looking through the slash commands GUI without typing anything after they\'re registered.' },
		])
		.setFooter({ text: 'Instead of "Read Messages" you can give the bot view access to specific channels\nCreated by Kaeso#5346' })

	if (onCooldown) {
		embed.addFields({ name: 'ATTENTION', value: `You have registered these commands recently, to prevent spam you can only remove these commands until the cooldown is over <t:${Math.floor((+(server.configshowedat ?? 0) + (10 * 60 * 1000)) / 1000)}:R>.` });
	}

	const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder()
			.setCustomId('register')
			.setLabel('Register /config')
			.setStyle(ButtonStyle.Success)
			.setDisabled(commandsRegistered || onCooldown),
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

	const message = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true }) as Message;

	const collector = message.createMessageComponentCollector({ componentType: ComponentType.Button, time: 30_000 });

	collector.on('collect', async inter => {
		if (inter.user.id !== interaction.user.id) {
			inter.reply({ content: 'These aren\'t your buttons! Begone!', ephemeral: true });
			return;
		}

		if (inter.customId === 'register') {
			try {
				if (!inter.guild) throw new Error();

				await inter.guild.commands.set([slashCommandData]);
				await inter.reply({ content: '**Success!** The `/config` command should now be available to you!', ephemeral: true });
			} catch (e) {
				await inter.reply({ content: 'Something went wrong! This is likely due to the bot lacking permissions to create slash commands. Please reinvite the bot with the link or fix this manually. If the issue still occurs contact Kaeso#5346', ephemeral: true });
			}
		} else if (inter.customId === 'clear') {
			try {
				if (!inter.guild) throw new Error();

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
		name: 'weight-role',
		description: 'Automatically give users in this server a role for a weight amount!',
		type: 1,
		options: [{
			name: 'weight',
			description: 'How much farming weight is required?',
			type: 4,
			required: true,
			choices: [
				{ name: 'Allow Any Linked User', value: 0 }, 
				{ name: '10 Weight', value: 10 }, 
				{ name: '50 Weight', value: 50 }, 
				{ name: '100 Weight', value: 100 }, 
				{ name: '250 Weight', value: 250 }, 
				{ name: '500 Weight', value: 500 }, 
				{ name: '750 Weight', value: 750 }, 
				{ name: '1000 Weight', value: 1000 }, 
				{ name: '1250 Weight', value: 1250 }, 
				{ name: '1500 Weight', value: 1500 }, 
				{ name: '1750 Weight', value: 1750 }, 
				{ name: '2000 Weight', value: 2000 }, 
				{ name: '2250 Weight', value: 2250 }, 
				{ name: '2500 Weight', value: 2500 }, 
				{ name: '2750 Weight', value: 2750 },
				{ name: '3000 Weight', value: 3000 },
				{ name: '3500 Weight', value: 3500 },
				{ name: '4000 Weight', value: 4000 },
				{ name: '4500 Weight', value: 4500 },
				{ name: '5000 Weight', value: 5000 }
			]
		}, {
			name: 'role',
			description: 'What role should be given as a reward?',
			type: 8,
			required: true
		}, {
			name: 'channel',
			description: 'If you\'d like, specify a channel to announce this user obtaining the role.',
			type: 7,
			required: false
		}]
	}, {
		name: 'weight-review',
		description: 'Specify these options to manually approve each weight-role auto-grant.',
		type: 1,
		options: [{
			name: 'channel',
			description: 'What channel should applications wait for review in?',
			type: 7,
			required: true
		}, {
			name: 'role',
			description: 'What role should be pinged and be able to approve applications?',
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
				value: 'scores',
				name: 'Scores - Clear your leaderboard scores, but keep the settings!',
			}, {
				value: 'admin-role',
				name: 'Admin Role - Remove the set role from having these permissions!',
			}, {
				value: 'weight-role',
				name: 'Weight-Role - Stop rewarding a role for a specific weight.',
			}, {
				value: 'weight-review',
				name: 'Weight-review - Remove the application process of the auto weight-role grant.',
			}, {
				value: 'weight-role-blacklist',
				name: 'Weight-Role Blacklist - Clear the blacklist of denied users!',
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