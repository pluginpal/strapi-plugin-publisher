import getPluginService from '../utils/getPluginService';
import getPluginEntityUid from '../utils/getEntityUId';
import getDeepPopulate from '../utils/populate';

const actionUId = getPluginEntityUid('action');
export default ({ strapi }) => ({
	/**
	 * Publish a single record
	 *
	 */
	async publish(uid, entityId = {}) {
		const populateRelations = strapi.config.get('server.webhooks.populateRelations', true);
		const publishedEntity = await strapi.documents(uid).publish({
			documentId: entityId,
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
		const unpublishedEntity = await strapi.documents(uid).unpublish({
			documentId: entityId,
			populate: populateRelations
				? getDeepPopulate(uid, {})
				: getDeepPopulate(uid, { countMany: true, countOne: true }),
		});

		const { hooks } = getPluginService('settingsService').get();
		// Events emitten
		await hooks.beforeUnpublish({ strapi, uid, entity: unpublishedEntity });
		await getPluginService('emitService').unpublish(uid, unpublishedEntity);
		await hooks.afterUnpublish({ strapi, uid, entity: unpublishedEntity });
	},
	/**
	 * Toggle a records publication state
	 *
	 */
	async toggle(record, mode) {
		// handle single content type, id is always 1
		const entityId = record.entityId || 1;

		// const entity = await strapi.entityService.findOne(record.entitySlug, entityId);
			const entity = await strapi.documents(record.entitySlug).findOne({
				documentId: record.entityId,
			});

		// ensure entity exists before attempting mutations.
		if (!entity) {
			return;
		}

		// Check with boaz if this is a good way to check if the entity is already published
		if (mode === 'publish') {
			await this.publish(record.entitySlug, entityId, {
				publishedAt: record.executeAt ? new Date(record.executeAt) : new Date(),
			});
		} else if (mode === 'unpublish') {
			await this.unpublish(record.entitySlug, entityId);
		}

		// remove any used actions
		await strapi.documents(actionUId).delete({
			documentId: record.documentId,
		});
	},
});
