/**
 *  service
 */

import { factories } from '@strapi/strapi';
import getPluginService from '../utils/getPluginService';
import logMessage from '../utils/logMessage';

export default factories.createCoreService('plugin::publisher.action', ({ strapi }) => ({
	/**
	 * Keep legacy schedules visible in the locale they would execute against.
	 * Update stored locales without recreating actions or scheduling jobs.
	 */
	async normalizeLegacyLocales() {
		const i18n = strapi.plugin('i18n');
		if (!i18n) return;

		const localizedTypes = Object.values(strapi.contentTypes)
			.filter((contentType) => i18n.service('content-types').isLocalizedContentType(contentType))
			.map((contentType) => contentType.uid);

		if (localizedTypes.length === 0) return;

		const defaultLocale = await i18n.service('locales').getDefaultLocale();
		if (!defaultLocale) {
			throw new Error('Cannot normalize publisher actions without a default locale.');
		}

		// Preserve IDs and execution times; leave explicit locales and
		// schedules for non-localized content types unchanged. Safe to rerun.
		await strapi.db.query('plugin::publisher.action').updateMany({
			where: {
				locale: { $null: true },
				entitySlug: { $in: localizedTypes },
			},
			data: { locale: defaultLocale },
		});
	},

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
					try {
						// Fetch the action again to ensure it still exists
						const currentAction = await strapi.documents('plugin::publisher.action').findOne({
							documentId: action.documentId,
						});

						if (!currentAction) {
							strapi.log.warn(logMessage(`Action ${action.documentId} no longer exists, skipping execution.`));
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
			strapi.cron.remove(taskName);
			strapi.log.info(logMessage(`Removed cron job for action ${actionDocumentId}`));
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
