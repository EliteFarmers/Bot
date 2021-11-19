# Elite Discord Bot

![Verified](https://user-images.githubusercontent.com/24925519/142558888-665330c4-4652-49a2-a54a-01e03dfaa1d2.png)

Elite is a **verified** discord bot made for Hypixel Skyblock farmers, providing a custom weight system to compare stats. 
*Originally made for the Elite Skyblock Farmers discord.*


The bot calculates farming weight by computing a player's collections[^1] from the api and a few sources of bonus points listed below. Farming XP couldn't be used as the main metric due to XP being different per crop, and just not being useful in the sense of farming weight. If you'd like to see the top farmers by XP there's plenty of places to see that. 

Farming weight shows a more accurate number that represents total time spent farming, as peak farming only averages around 7 weight per hour no matter which crop.

### [Bot Invite Link](https://discord.com/api/oauth2/authorize?client_id=845065148997566486&permissions=277092550656&scope=applications.commands%20bot)

## Commands

Use the `/help` command to see the list in Discord!

A command argument wrapped in `(` `)` means that it's optional, while `[` `]` is required, Discord will reflect this.

---
### /weight
The heart and soul of the bot.

**Usage:** `/weight` `(playerName): <ign>` `(profile): <name>`

![weight](https://user-images.githubusercontent.com/24925519/142559076-5d6febfd-0a53-428d-b337-42cb3b4a4aca.png)

Clicking "More Info" reveals a specific breakdown of where your weight comes from.
Clicking "Jacob's Stats" does the same as `/jacob`

---
### /leaderboard
The fantastic flex, and largest letdown.

**Usage:** `/leaderboard` `(playerName): <ign>`

![leaderboard](https://user-images.githubusercontent.com/24925519/142559144-c2ffa8be-02a0-45e5-b63c-2afb20b2416c.png)

Specifying a player name will jump to their location on the leaderboard. Please note that scores may take up to 1 minute to update.

---
### /jacob
Check out your Jacob's contest stats! *Note: Still in development, features will be added*

**Usage:** `/jacob` `(playerName): <ign>` `(profile): <name>`

![jacob](https://user-images.githubusercontent.com/24925519/142559175-9cdce23d-0ffb-4265-b323-2821cd827675.png)

**Scores only valid after Autumn 24th, Year 160** because that was the date of the last nerf to farming. "All Crops" will show your highscore since the cutoff in each crop.

**Recent Contests:**

![Contests](https://user-images.githubusercontent.com/24925519/142559214-212b7987-e1bb-4952-a827-171f81f76918.png)

You can filter by crop and show up to 10 per.

---
### /info
For all your questions!

**Usage:** `/info`

![info](https://user-images.githubusercontent.com/24925519/142559256-1ffc3d17-1bc3-488e-b872-a62954b408f2.png)

---
### /verify
Link your Minecraft account so you no longer need to specify your player name! In order for this to work you must have your discord linked on Hypixel. Run the same command again to remove the link.

**Usage:** `/verify` `[playerName]: <ign>`

![verify](https://user-images.githubusercontent.com/24925519/142559304-3b211f68-19f8-4cf3-be4e-935126e304d0.png)

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
