'use strict';

const { getPluginService } = require('../utils/getPluginService');

module.exports = {
	registerCronTasks: ({ strapi }) => {
		const settings = getPluginService('settingsService').get();

		// create cron check
		strapi.cron.add({
			publisherCronTask: {
				options: {
					rule: settings.actions.syncFrequency,
				},
				task: async () => {
					// fetch all actions that have passed
					const records = await getPluginService('action').find({
						filters: {
							executeAt: {
								$lte: Date.now(),
							},
						},
					});

					// process action records
					for (const record of records.results) {
						getPluginService('publicationService').toggle(record, record.mode);
					}
				},
			},
		});
	},
};
