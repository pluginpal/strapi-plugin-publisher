import getPluginService from '../utils/getPluginService';
import getPluginEntityUid from '../utils/getEntityUId';
import logMessage from '../utils/logMessage';

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
      strapi.log.info(logMessage(`Successfully published document with id "${entityId}"${locale ? ` and locale "${locale}"` : ''} of type "${uid}".`));
			const { hooks } = getPluginService('settingsService').get();
			// emit publish event
			await hooks.beforePublish({ strapi, uid, entity: publishedEntity });
			await getPluginService('emitService').publish(uid, publishedEntity);
			await hooks.afterPublish({ strapi, uid, entity: publishedEntity });
		} catch (error) {
      strapi.log.error(logMessage(`An error occurred when trying to publish document with id "${entityId}"${locale ? ` and locale "${locale}"` : ''} of type "${uid}": "${error}"`));
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
      strapi.log.info(logMessage(`Successfully unpublished document with id "${entityId}"${locale ? ` and locale "${locale}"` : ''} of type "${uid}".`));
			const { hooks } = getPluginService('settingsService').get();
			// Emit events
			await hooks.beforeUnpublish({ strapi, uid, entity: unpublishedEntity });
			await getPluginService('emitService').unpublish(uid, unpublishedEntity);
			await hooks.afterUnpublish({ strapi, uid, entity: unpublishedEntity });
		} catch (error) {
      strapi.log.error(logMessage(`An error occurred when trying to unpublish document with id "${entityId}"${locale ? ` and locale "${locale}"` : ''} of type "${uid}": "${error}"`));
		}
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

		// Determine if the draft entity is newer than the published entity, if it's considered modified
		const isModified = isPublished && isDraft && draftEntity.updatedAt > publishedEntity.updatedAt;

		if (mode === 'publish' && ((!isPublished && isDraft) || isModified)) {
			await this.publish(record.entitySlug, entityId, {
				publishedAt: record.executeAt ? new Date(record.executeAt) : new Date(),
				locale: record.locale,
			});
		} else if (mode === 'unpublish' && isPublished) {
			await this.unpublish(record.entitySlug, entityId, {
				locale: record.locale,
			});
		}

		// Remove any used actions
		await strapi.documents(actionUId).delete({
			documentId: record.documentId,
		});
	},
});
