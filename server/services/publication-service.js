import getPluginService from '../utils/getPluginService';
import getPluginEntityUid from '../utils/getEntityUId';

const actionUId = getPluginEntityUid('action');
export default ({ strapi }) => ({
	/**
	 * Publish a single record
	 *
	 */
	async publish(uid, entityId, { locale }) {
		try {
			const publishedEntity = await strapi.documents(uid).publish({
				documentId: entityId,
				locale,
			});
			const { hooks } = getPluginService('settingsService').get();
			// emit publish event
			await hooks.beforePublish({ strapi, uid, entity: publishedEntity });
			await getPluginService('emitService').publish(uid, publishedEntity);
			await hooks.afterPublish({ strapi, uid, entity: publishedEntity });
		} catch (error) {
      strapi.log.error(`An error occurred when trying to publish document ${entityId} of type ${uid}: "${error}"`);
		}
	},
	/**
	 * Unpublish a single record
	 *
	 */
	async unpublish(uid, entityId, { locale }) {
		try {
			const unpublishedEntity = await strapi.documents(uid).unpublish({
				documentId: entityId,
				locale,
			});
			const { hooks } = getPluginService('settingsService').get();
			// Emit events
			await hooks.beforeUnpublish({ strapi, uid, entity: unpublishedEntity });
			await getPluginService('emitService').unpublish(uid, unpublishedEntity);
			await hooks.afterUnpublish({ strapi, uid, entity: unpublishedEntity });
		} catch (error) {
      strapi.log.error(`An error occurred when trying to unpublish document ${entityId} of type ${uid}: "${error}"`);
		}
	},
	/**
	 * Toggle a records publication state
	 *
	 */
	async toggle(record, mode) {
		// handle single content type, id is always 1
		const entityId = record.entityId || 1;
		console.log('record', record);
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

		const isLocalized = !!strapi.contentType(record.entitySlug).pluginOptions?.i18n?.localized;
		console.log('Is content type localized:', isLocalized);

		// Determine the current state of the entity
		const isPublished = !! publishedEntity;
		const isDraft = !! draftEntity;

		// Determine if the draft entity is newer than the published entity, if it's considered modified
		const isModified = isPublished && isDraft && draftEntity.updatedAt > publishedEntity.updatedAt;

		console.log('Locale being passed to publish:', record.locale);

		if (mode === 'publish' && ((!isPublished && isDraft) || isModified)) {
			await this.publish(record.entitySlug, entityId, {
				publishedAt: record.executeAt ? new Date(record.executeAt) : new Date(),
				locale: record.locale,
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
