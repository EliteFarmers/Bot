# EliteDiscordBot

Elite is a discord bot made for Hypixel Skyblock farmers, providing a custom weight system to compare stats. 
*Originally made for the Elite Skyblock Farmers discord.*

The bot calculates farming weight by computing a player's collections[^1] from the api and a few sources of bonus points listed below. Farming XP couldn't be used as the main metric due to XP being different per crop, and just not being useful in the sense of farming weight. If you'd like to see the top farmers by XP there's plenty of places to see that. 

Farming weight shows a more accurate number that represents total time spent farming, as peak farming only averages around 7 weight per hour no matter which crop.

### [Bot Invite Link](https://discord.com/oauth2/authorize?client_id=845065148997566486&scope=applications.commands%20bot&permissions=2214718528)

## Commands

Use the `/help` command to see the list in Discord!

A command argument wrapped in `(` `)` means that it's optional, while `[` `]` is required, Discord will reflect this.

---
### /weight
The heart and soul of the bot.

**Usage:** `/weight` `(playerName): <ign>` `(profile): <name>`

![weight](https://user-images.githubusercontent.com/24925519/141417392-bd4ec50f-6e88-482f-9032-220080806d41.png)

Clicking "More Info" reveals a specific breakdown of where your weight comes from.

---
### /leaderboard
The fantastic flex, and largest letdown.

**Usage:** `/leaderboard` `(playerName): <ign>`

![leaderboard](https://user-images.githubusercontent.com/24925519/141417369-183d77c4-91a7-4dde-9377-d638a648e29d.png)

Specifying a player name will jump to their location on the leaderboard. Please note that scores may take up to 1 minute to update.

---
### /jacob
Check out your Jacob's contest stats! *Note: Still in development, features will be added*

**Usage:** `/jacob` `(playerName): <ign>` `(profile): <name>`

![jacob](https://user-images.githubusercontent.com/24925519/141417352-36eb900c-b5f5-44da-87ac-a4e4a28c7f59.png)

**Scores only valid after Autumn 24th, Year 160** because that was the date of the last nerf to farming. "All Crops" will show your highscore since the cutoff in each crop.

---
### /info
For all your questions!

**Usage:** `/info`

![info](https://user-images.githubusercontent.com/24925519/141417324-7897b082-5970-40c9-9795-2c2820009c7d.png)

---
### /verify
Link your Minecraft account so you no longer need to specify your player name! In order for this to work you must have your discord linked on Hypixel. Run the same command again to remove the link.

**Usage:** `/verify` `[playerName]: <ign>`

![verify](https://user-images.githubusercontent.com/24925519/141417282-8fbff27c-8955-448b-a599-db1d3a20973f.png)

---
## Setup

Requires a config.json file that looks like this:
```
{
	"prefix": ".",
	"token": "",
	"hypixelApiKey": "",
	"dbUri": "",
	"secret": "",
	"superusers": [
		"",
	]
}
```
The secret can be generated from running generateSecret in auth.js and inputted into Google authenticator.
Superusers is a list of discord ids

The database is postgres based.

Ignore this: HODG HOM SON

[^1]: Based on the collection averages found [here](https://drive.google.com/file/d/16mZpN4OyRONEfrPdCrpuleVbZVwwT6_M/view?usp=sharing/).
