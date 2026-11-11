import { factories } from '@strapi/strapi';

/**
 *  controller
 */
export default factories.createCoreController('plugin::publisher.action', ({ strapi }) => ({
	/**
	 * Every locale of a localized entry has its own actions, which store that locale. The action
	 * content type itself is not localized, so Strapi ignores `?locale=` and rejects
	 * `filters[locale]`. Support `?locale=` here so the admin can find the action of one locale.
	 */
	async find(ctx) {
		const { locale, ...query } = ctx.query ?? {};
		if (!locale) {
			return super.find(ctx);
		}
		if (typeof locale !== 'string') {
			return ctx.badRequest('The locale must be a string.');
		}

		ctx.query = query;
		await this.validateQuery(ctx);
		const sanitizedQuery = await this.sanitizeQuery(ctx);
		const { results, pagination } = await strapi
			.plugin('publisher')
			.service('action')
			.find({
				...sanitizedQuery,
				filters: { $and: [sanitizedQuery.filters ?? {}, { locale }] },
			});
		const sanitizedResults = await this.sanitizeOutput(results, ctx);
		return this.transformResponse(sanitizedResults, { pagination });
	},
}));
