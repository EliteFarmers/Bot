class Util {

	static async waitForMessage(channel, filter, time) {
		return new Promise((resolve, reject) => {
			const collector = channel.createMessageCollector({ filter: filter, time: time, limit: 1 });

			collector.on('collect', message => {
				resolve(message);
			});

			collector.on('end', (collected) => {
				resolve(undefined);
			});
		});
	}


}

module.exports = { Util };