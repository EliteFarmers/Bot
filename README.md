# EliteDiscordBot

Calculates farming weight based on the collection averages found here: 
https://drive.google.com/file/d/16mZpN4OyRONEfrPdCrpuleVbZVwwT6_M/view?usp=sharing/

Bot invite link: https://discord.com/oauth2/authorize?client_id=845065148997566486&scope=applications.commands%20bot&permissions=2214718528

Made for the Elite Skyblock Farmers discord.

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
