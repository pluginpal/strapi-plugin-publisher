'use strict';

const { getPluginService } = require('../utils/getPluginService');

module.exports = {
	registerCronTasks: ({ strapi }) => {
		const settings = getPluginService('settingsService').get();

		// create cron check
		strapi.cron.add({
			[settings.actionSyncFrequency]: async ({ strapi }) => {
				// fetch all actions that have passed
				const records = await getPluginService(strapi, 'actionService').find({
					filters: {
						executeAt: {
							$lte: Date.now(),
						},
					},
				});

				// process action records
				for (const record of records) {
					getPluginService(strapi, 'publicationService').toggle(record, record.mode);
				}
			},
		});
	},
};
