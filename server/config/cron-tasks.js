import getPluginService from '../utils/getPluginService';
import logMessage from '../utils/logMessage';

const registerCronTasks = ({ strapi }) => {
	// On startup, schedule cron jobs for all existing actions that are in the future
	// and execute actions that should have already been executed
	const scheduleExistingActions = async () => {
		try {
			// Find all pending actions
			const allActions = await getPluginService('action').find({
				pagination: {
					pageSize: 1000, // Get all actions
				},
			});

			const now = new Date();
			const futureActions = [];
			const pastActions = [];

			// Separate actions into past and future
			for (const record of allActions.results) {
				const executeAt = new Date(record.executeAt);
				if (executeAt > now) {
					futureActions.push(record);
				} else {
					pastActions.push(record);
				}
			}

			strapi.log.info(logMessage(`Found ${pastActions.length} past actions to execute and ${futureActions.length} future actions to schedule on startup.`));

			// Execute past actions immediately
			for (const record of pastActions) {
				try {
					await getPluginService('publicationService').toggle(record, record.mode);
					strapi.log.info(logMessage(`Executed overdue action ${record.documentId}`));
				} catch (error) {
					strapi.log.error(logMessage(`Error executing overdue action ${record.documentId}: ${error.message}`));
				}
			}

			// Schedule cron jobs for all future actions
			for (const record of futureActions) {
				getPluginService('action').scheduleCronJob(record);
			}
		} catch (error) {
			strapi.log.error(logMessage(`Error scheduling existing actions on startup: ${error.message}`));
		}
	};

	// Schedule existing actions after Strapi is fully started
	// Using setImmediate to ensure all services are initialized
	setImmediate(() => {
		scheduleExistingActions();
	});
};

export default registerCronTasks;
