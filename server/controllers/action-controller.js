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
		const locale = ctx.query?.locale;
		if (!locale) {
			return super.find(ctx);
		}
		if (typeof locale !== 'string') {
			return ctx.badRequest('The locale must be a string.');
		}

		// Remove the locale from the parsed query in place. Assigning `ctx.query` turns the query back
		// into a query string, and parsing that again turns lists longer than the `strapi::query`
		// arrayLimit (default 100) into objects, which Strapi then silently drops as filters. That
		// includes filters a route middleware added, like the readable content types (issue #212).
		delete ctx.query.locale;
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
