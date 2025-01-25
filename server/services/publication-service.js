'use strict';

import getPluginService from '../utils/getPluginService';
import getPluginEntityUid from '../utils/getEntityUId';
import getDeepPopulate from '../utils/populate';

const actionUId = getPluginEntityUid('action');
console.log('actionUId', actionUId);
export default ({ strapi }) => ({
	/**
	 * Publish a single record
	 *
	 */
	// async publish(uid, entityId, data = {}) {
	// 	const populateRelations = strapi.config.get('server.webhooks.populateRelations', true);
	// 	const publishedEntity = await strapi.entityService.update(uid, entityId, {
	// 		data,
	// 		populate: populateRelations
	// 			? getDeepPopulate(uid, {})
	// 			: getDeepPopulate(uid, { countMany: true, countOne: true }),
	// 	});
	// 	const { hooks } = getPluginService('settingsService').get();
	// 	// emit publish event
	// 	await hooks.beforePublish({ strapi, uid, entity: publishedEntity });
	// 	await getPluginService('emitService').publish(uid, publishedEntity);
	// 	await hooks.afterPublish({ strapi, uid, entity: publishedEntity });
	// },
	async publish(uid, documentId, data = {}) {
		try {
			// Check if relations should be populated based on server config
			const populateRelations = strapi.config.get('server.webhooks.populateRelations', true);

			// Publish the document using Strapi's Document Service API
			const result = await strapi.db.document.publish({
				documentId,
				...data, // Additional parameters like locale or filters
				populate: populateRelations
					? getDeepPopulate(uid, {}) // Deeply populate relations if enabled
					: getDeepPopulate(uid, { countMany: true, countOne: true }), // Limited population otherwise
			});
			console.log('result in publish', result);

			// Get the first published entry from the result
			const publishedDocument = result.entries?.[0];

			// Execute lifecycle hooks before publishing
			const { hooks } = getPluginService('settingsService').get();
			await hooks.beforePublish({ strapi, uid, entity: publishedDocument });

			// Emit the publish event
			await getPluginService('emitService').publish(uid, publishedDocument);

			// Execute lifecycle hooks after publishing
			await hooks.afterPublish({ strapi, uid, entity: publishedDocument });

			return publishedDocument; // Return the published document
		} catch (error) {
			strapi.log.error('Failed to publish document:', error);
			throw new Error('Unable to publish the document');
		}
	},
	/**
	 * Unpublish a single record
	 *
	 */
	// async unpublish(uid, entityId) {
	// 	const populateRelations = strapi.config.get('server.webhooks.populateRelations', true);
	// 	const unpublishedEntity = await strapi.entityService.update(uid, entityId, {
	// 		data: {
	// 			publishedAt: null,
	// 		},
	// 		populate: populateRelations
	// 			? getDeepPopulate(uid, {})
	// 			: getDeepPopulate(uid, { countMany: true, countOne: true }),
	// 	});
	// 	const { hooks } = getPluginService('settingsService').get();
	// 	// emit unpublish event
	// 	await hooks.beforeUnpublish({ strapi, uid, entity: unpublishedEntity });
	// 	await getPluginService('emitService').unpublish(uid, unpublishedEntity);
	// 	await hooks.afterUnpublish({ strapi, uid, entity: unpublishedEntity });
	// },
	async unpublish(uid, documentId, data = {}) {
		try {
			// Check if relations should be populated based on server config
			const populateRelations = strapi.config.get('server.webhooks.populateRelations', true);

			// Unpublish the document using Strapi's Document Service API
			const result = await strapi.db.document.unpublish({
				documentId,
				...data, // Additional parameters like locale or filters
				populate: populateRelations
					? getDeepPopulate(uid, {}) // Deeply populate relations if enabled
					: getDeepPopulate(uid, { countMany: true, countOne: true }), // Limited population otherwise
			});

			// Get the first unpublished entry from the result
			const unpublishedDocument = result.entries?.[0];

			// Execute lifecycle hooks before unpublishing
			const { hooks } = getPluginService('settingsService').get();
			await hooks.beforeUnpublish({ strapi, uid, entity: unpublishedDocument });

			// Emit the unpublish event
			await getPluginService('emitService').unpublish(uid, unpublishedDocument);

			// Execute lifecycle hooks after unpublishing
			await hooks.afterUnpublish({ strapi, uid, entity: unpublishedDocument });

			return unpublishedDocument; // Return the unpublished document
		} catch (error) {
			strapi.log.error('Failed to unpublish document:', error);
			throw new Error('Unable to unpublish the document');
		}
	},
	/**
	 * Toggle a records publication state
	 *
	 */
	// async toggle(record, mode) {
	// 	// handle single content type, id is always 1
	// 	const entityId = record.entityId || 1;
	//
	// 	const entity = await strapi.entityService.findOne(record.entitySlug, entityId);
	//
	// 	// ensure entity exists before attempting mutations.
	// 	if (!entity) {
	// 		return;
	// 	}
	//
	// 	// ensure entity is in correct publication status
	// 	if (!entity.publishedAt && mode === 'publish') {
	// 		await this.publish(record.entitySlug, entityId, {
	// 			publishedAt: record.executeAt ? new Date(record.executeAt) : new Date(),
	// 		});
	// 	} else if (entity.publishedAt && mode === 'unpublish') {
	// 		await this.unpublish(record.entitySlug, entityId);
	// 	}
	//
	// 	// remove any used actions
	// 	strapi.entityService.delete(actionUId, record.id);
	// },
	async toggle(record, mode) {
		const { entitySlug: uid, documentId } = record;

		try {
			// Fetch the document to check its current publication state
			const document = await strapi.documents(uid).findOne({
				documentId,
				populate: getDeepPopulate(uid, {}),
			});

			// Ensure the document exists
			if (!document) {
				strapi.log.warn(`Document with ID ${documentId} not found.`);
				return;
			}

			// Toggle the publication state
			if (!document.publishedAt && mode === 'publish') {
				await this.publish(uid, documentId, {
					publishedAt: record.executeAt ? new Date(record.executeAt) : new Date(),
				});
			} else if (document.publishedAt && mode === 'unpublish') {
				await this.unpublish(uid, documentId);
			}

			// Delete any associated actions
			await strapi.documents('plugin::publisher.action').delete({
				documentId: record.id,
			});
		} catch (error) {
			strapi.log.error('Failed to toggle publication state:', error);
			throw new Error('Unable to toggle publication state');
		}
	},
});
