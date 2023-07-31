# Elite Discord Bot

![Verified](https://user-images.githubusercontent.com/24925519/142558888-665330c4-4652-49a2-a54a-01e03dfaa1d2.png)

Elite is a **verified** discord bot made for Hypixel Skyblock farmers, providing a custom weight system to compare stats. 
*Originally made for the [Elite Skyblock Farmers](https://discord.gg/farms) discord.*

### Website: https://elitebot.dev/

The bot calculates farming weight by computing a player's collections[^1] from the API and a few sources of bonus points listed below. Farming XP couldn't be used as the main metric due to XP being different per crop, and just not being useful in the sense of farming weight.

Farming weight shows a more accurate number that represents total time spent farming, as peak farming only averages around 7 weight per hour no matter which crop.

### [Click Me To Invite The Bot!](https://elitebot.dev/invite)

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
## Contributing

Contributions are welcome! Please open an issue or pull request if you have any suggestions or bug fixes.

### Running The Project

1. Create a new application on the [Discord Developer Portal](https://discord.com/developers/applications) and add a bot user. Invite this bot to a server you own to test it out.

2. Create a copy of `.env.example` and rename it to `.env` in the root directory and edit the following:

	```env
	BOT_TOKEN="bot-token-here"

	ELITE_API_URL="https://api.elitebot.dev"
	```
	Enter your bot token in the `BOT_TOKEN` field. The `ELITE_API_URL` field can be left as is, but if you want to use [your instance of the API](https://github.com/EliteFarmers/API), change it to your API's URL. 
	
	**Note:** When using the production API, authenticated routes such as for `/verify` will not work. You would need to run your own instance of the API to work on anything requiring auth.

3. Install dependencies with `pnpm install`. (Run `npm install -g pnpm` if you don't have `pnpm` installed)

4. Run `pnpm run slash` to register the commands to your bot. This will only work if you have the bot token set up correctly. They *could* take up to an hour to show up in Discord. (It usually takes only a minute)

5. Run `pnpm run dev` to start the bot. This will run the bot in development mode, which will automatically restart the bot when you make changes to the code.

6. Try out the commands in Discord!

### Deployment - Docker

1. Fill out the `.env` file as described above.

2. Make sure you have an instance of the [API](https://github.com/EliteFarmers/API) running and the `ELITE_API_URL` is set to either your API's URL, or the local docker url (ex: `http://eliteapi:7008`). Remember to set the `DISCORD_BOT_TOKEN` in the API's `.env` file to the same value as the bot's `.env` file. Otherwise, the `/verify` command and other authenticated actions will not work.

3. Run `docker-compose up -d` to start the bot. This should just work, but if you run into any issues, please open an issue. (`docker-compose down` to stop the bot)
