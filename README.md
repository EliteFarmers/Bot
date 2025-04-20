# Elite Discord Bot

<img src="https://github.com/user-attachments/assets/30d29241-2ff1-4170-b2e7-83231c2cbab6" alt="verified discord app" style="width:400px;"/>

Elite is a verified discord bot made for Hypixel Skyblock farmers, providing a custom weight system to compare stats. 
*Originally made for the [Elite Skyblock Farmers](https://discord.gg/farms) discord.*

### Website: https://elitebot.dev/

Most features can be accessed through the website also! They both share the same backend API.

The bot calculates farming weight by computing a player's collections[^1] from the API and a few sources of bonus points listed below. Farming XP couldn't be used as the main metric due to XP being different per crop, and just not being useful in the sense of farming weight.

Farming weight shows a more accurate number that represents total time spent farming, as peak farming only averages around 7 weight per hour no matter which crop.

### [Click Me To Invite The Bot!](https://elitebot.dev/invite)

Support Discord Server: https://elitebot.dev/support


## Features
- Minecraft Account linking
- Jacob contest leaderboards for specific Discord servers
- Hourly pings for upcoming Jacob contests
- Admin dashboard on the website to manage your Discord server's settings [(find it here)](https://elitebot.dev/profile/servers)
- Check out the [commands list](COMMANDS.md) for more


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
	
	**Note:** When using the production API, authenticated routes such as for `/verify` will not work. You would need to run your own instance of the API to work on anything requiring auth. The redis connection also only matters if you are running your own instance of the API.

3. Install dependencies with `pnpm install`. (Run `npm install -g pnpm` if you don't have `pnpm` installed)

4. Run `pnpm run slash` to register the commands to your bot. This will only work if you have the bot token set up correctly. They *could* take up to an hour to show up in Discord. (It usually takes only a minute)

5. Run `pnpm run dev` to start the bot. This will run the bot in development mode, which will automatically restart the bot when you make changes to the code.

6. Try out the commands in Discord!

### Deployment - Docker

1. Fill out the `.env` file as described above.

2. Make sure you have an instance of the [API](https://github.com/EliteFarmers/API) running and the `ELITE_API_URL` is set to either your API's URL, or the local docker url (ex: `http://eliteapi:7008`). Remember to set the `DISCORD_BOT_TOKEN` in the API's `.env` file to the same value as the bot's `.env` file. Otherwise, the `/verify` command and other authenticated actions will not work.

3. Run `docker-compose up -d` to start the bot. This should just work, but if you run into any issues, please open an issue. (`docker-compose down` to stop the bot)
