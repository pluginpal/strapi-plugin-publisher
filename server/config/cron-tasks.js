'use strict';

import getPluginService from '../utils/getPluginService';

const registerCronTasks =  ({ strapi }) => {
	const settings = getPluginService('settingsService').get();	
	// create cron check
	strapi.cron.add({
		publisherCronTask: {
			options: settings.actions.syncFrequency,
			task: async () => {
				console.log('Running publisher cron task');

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
}

export default registerCronTasks;