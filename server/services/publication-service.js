import getPluginService from '../utils/getPluginService';
import getPluginEntityUid from '../utils/getEntityUId';

const actionUId = getPluginEntityUid('action');
export default ({ strapi }) => ({
	/**
	 * Publish a single record
	 *
	 */
	async publish(uid, entityId = {}) {
		const publishedEntity = await strapi.documents(uid).publish({
			documentId: entityId,
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
		const unpublishedEntity = await strapi.documents(uid).unpublish({
			documentId: entityId,
		});
		const { hooks } = getPluginService('settingsService').get();
		// Emit events
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

		// Find the published entity
		const publishedEntity = await strapi.documents(record.entitySlug).findOne({
			documentId: entityId,
			status: 'published',
		});

		// Find the draft version of the entity
		const draftEntity = await strapi.documents(record.entitySlug).findOne({
			documentId: entityId,
			status: 'draft',
		});

		// Determine the current state of the entity
		const isPublished = !! publishedEntity;
		const isDraft = !! draftEntity;

		if (mode === 'publish' && ! isPublished && isDraft) {
			await this.publish(record.entitySlug, entityId, {
				publishedAt: record.executeAt ? new Date(record.executeAt) : new Date(),
			});
		} else if (mode === 'unpublish' && isPublished) {
			await this.unpublish(record.entitySlug, entityId);
		}

		// Remove any used actions
		await strapi.documents(actionUId).delete({
			documentId: record.documentId,
		});
	},
});
