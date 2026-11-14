/**
 *  service
 */

import { factories } from '@strapi/strapi';
import getPluginService from '../utils/getPluginService';
import logMessage from '../utils/logMessage';

/**
 * How far in the future an action may still be considered due when its cron job
 * fires. Cron jobs are registered per process, so in a multi-instance setup an
 * instance can hold a job scheduled from an outdated `executeAt`. Anything
 * further out than this tolerance is treated as a stale job rather than as
 * clock jitter.
 */
const STALE_JOB_TOLERANCE_MS = 60 * 1000;

export default factories.createCoreService('plugin::publisher.action', ({ strapi }) => ({
	/**
	 * Schedule a cron job for a specific action
	 */
	scheduleCronJob(action) {
		const taskName = `publisherAction_${action.documentId}`;
		const executeAt = new Date(action.executeAt);

		// Check if the execution time is in the future
		if (executeAt <= new Date()) {
			strapi.log.warn(logMessage(`Action ${action.documentId} has an executeAt time in the past, skipping cron job creation.`));
			return;
		}

		strapi.log.info(logMessage(`Scheduling cron job for action ${action.documentId} at ${executeAt.toISOString()}`));

		strapi.cron.add({
			[taskName]: {
				async task() {
					// Set when this job turned out to be stale, so it can be
					// rescheduled after the outdated job has been removed.
					let staleAction = null;

					try {
						// Fetch the action again to ensure it still exists
						const currentAction = await strapi.documents('plugin::publisher.action').findOne({
							documentId: action.documentId,
						});

						if (!currentAction) {
							strapi.log.warn(logMessage(`Action ${action.documentId} no longer exists, skipping execution.`));
							return;
						}

						// `removeCronJob`/`scheduleCronJob` only affect the process that
						// handled the request, so another instance may still hold a job
						// registered from an older `executeAt`. Re-check against the
						// stored value instead of trusting the moment we were woken up.
						const dueInMs = new Date(currentAction.executeAt).getTime() - Date.now();

						if (dueInMs > STALE_JOB_TOLERANCE_MS) {
							staleAction = currentAction;
							strapi.log.warn(logMessage(`Action ${action.documentId} is not due yet (executeAt: ${new Date(currentAction.executeAt).toISOString()}), skipping stale cron job and rescheduling it.`));
							return;
						}

						// Execute the publication action
						await getPluginService('publicationService').toggle(currentAction, currentAction.mode);

						strapi.log.info(logMessage(`Successfully executed action ${action.documentId}`));
					} catch (error) {
						strapi.log.error(logMessage(`Error executing action ${action.documentId}: ${error.message}`));
					} finally {
						// Remove the cron job after execution
						strapi.cron.remove(taskName);

						// Rescheduling has to happen after the removal above, otherwise
						// the freshly registered job would be removed again.
						if (staleAction) {
							setImmediate(() => {
								getPluginService('action').scheduleCronJob(staleAction);
							});
						}
					}
				},
				options: executeAt,
			},
		});
	},

	/**
	 * Remove a scheduled cron job
	 */
	removeCronJob(actionDocumentId) {
		const taskName = `publisherAction_${actionDocumentId}`;
		
		try {
			// `strapi.cron.remove` does not throw for an unknown task name, so without
			// this check the log would claim a removal even on instances that never
			// registered the job, hiding the fact that a stale job may live elsewhere.
			const hadLocalJob = Array.isArray(strapi.cron.jobs)
				&& strapi.cron.jobs.some((jobSpec) => jobSpec?.name === taskName);

			strapi.cron.remove(taskName);

			if (hadLocalJob) {
				strapi.log.info(logMessage(`Removed cron job for action ${actionDocumentId}`));
			} else {
				strapi.log.info(logMessage(`No local cron job found for action ${actionDocumentId}; other instances may still hold a stale job.`));
			}
		} catch (error) {
			strapi.log.warn(logMessage(`Could not remove cron job ${taskName}: ${error.message}`));
		}
	},

	/**
	 * Override create to schedule cron job
	 */
	async create(...args) {
		const result = await super.create(...args);
		
		// Schedule the cron job for this action
		this.scheduleCronJob(result);
		
		return result;
	},

	/**
	 * Override update to reschedule cron job
	 */
	async update(documentId, ...args) {
		// Remove the old cron job
		this.removeCronJob(documentId);
		
		const result = await super.update(documentId, ...args);
		
		// Schedule a new cron job with updated data
		this.scheduleCronJob(result);
		
		return result;
	},

	/**
	 * Override delete to remove cron job
	 */
	async delete(documentId, ...args) {
		// Remove the cron job before deleting
		this.removeCronJob(documentId);
		
		const result = await super.delete(documentId, ...args);
		
		return result;
	},
}));
