'use strict';

const { getPluginService } = require('../utils/getPluginService');
const { getPluginEntityUid } = require('../utils/getEntityUId');
const { getDeepPopulate } = require('../utils/populate');

const actionUId = getPluginEntityUid('action');

module.exports = ({ strapi }) => ({
	/**
	 * Publish a single record
	 *
	 */
	async publish(uid, entityId, data = {}) {
		const populateRelations = strapi.config.get('server.webhooks.populateRelations', true);
		const publishedEntity = await strapi.entityService.update(uid, entityId, {
			data,
			populate: populateRelations
				? getDeepPopulate(uid, {})
				: getDeepPopulate(uid, { countMany: true, countOne: true }),
		});
		const { hooks } = getPluginService('settingsService').get();
		// emit publish event
		await hooks.beforePublish({ strapi, uid, entity: publishedEntity });
		await getPluginService('emitService').publish(uid, publishedEntity);
		await hooks.afterPublish({ strapi, uid, entity: publishedEntity });
	},

	/**
	 * Unpublish a single record
	 *
	 */
	async unpublish(uid, entityId) {
		const populateRelations = strapi.config.get('server.webhooks.populateRelations', true);
		const unpublishedEntity = await strapi.entityService.update(uid, entityId, {
			data: {
				publishedAt: null,
			},
			populate: populateRelations
				? getDeepPopulate(uid, {})
				: getDeepPopulate(uid, { countMany: true, countOne: true }),
		});
		const { hooks } = getPluginService('settingsService').get();
		// emit unpublish event
		await hooks.beforeUnpublish({ strapi, uid, entity: unpublishedEntity });
		await getPluginService('emitService').unpublish(uid, unpublishedEntity);
		await hooks.afterUnpublish({ strapi, uid, entity: unpublishedEntity });
	},

	/**
	 * Toggle a records publication state
	 *
	 */
	async toggle(record, mode) {
		console.log('toggle record', record);
		// handle single content type, id is always 1
		const entityId = record.entityId || 1;

		const entity = await strapi.entityService.findOne(record.entitySlug, entityId);

		// ensure entity exists before attempting mutations.
		if (!entity) {
			console.error(`Entity ${record.entitySlug} with id ${entityId} not found`);
			// remove any used actions related to deleted entity
		    strapi.entityService.delete(actionUId, record.id);
			return;
		}

		// ensure entity is in correct publication status
		if (!entity.publishedAt && mode === 'publish') {
			console.log('publishing', record.entitySlug, entityId);
			await this.publish(record.entitySlug, entityId, {
				publishedAt: record.executeAt ? new Date(record.executeAt) : new Date(),
			});
		} else if (entity.publishedAt && mode === 'unpublish') {
			await this.unpublish(record.entitySlug, entityId);
		}

		// remove any used actions
		strapi.entityService.delete(actionUId, record.id);
	},
});
