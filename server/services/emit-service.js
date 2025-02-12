const ENTRY_PUBLISH = 'entry.publish';
const ENTRY_UNPUBLISH = 'entry.unpublish';

export default ({ strapi }) => ({
	async emit(event, uid, entity) {
		const model = strapi.getModel(uid);

		const sanitizedEntity = await strapi.contentAPI.sanitize.output(entity, model);

		await strapi.eventHub.emit(event, {
			model: model.modelName,
			entry: sanitizedEntity,
		});
	},

	async publish(uid, entity) {
		await this.emit(ENTRY_PUBLISH, uid, entity);
	},

	async unpublish(uid, entity) {
		await this.emit(ENTRY_UNPUBLISH, uid, entity);
	},
});
