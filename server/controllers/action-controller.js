import { factories } from '@strapi/strapi';

/**
 *  controller
 */
export default factories.createCoreController('plugin::publisher.action', ({ strapi }) => ({
	/**
	 * Override `find` to support filtering actions by locale.
	 *
	 * Strapi v5 treats `locale` as a system level i18n parameter, so
	 * `sanitizeQuery` strips it from the attribute filters. Because publisher
	 * actions are a plugin content type without i18n enabled, we have to
	 * restore the filter ourselves after sanitization, otherwise every locale
	 * of a document would share the same scheduled action.
	 */
	async find(ctx) {
		const sanitizedQuery = await this.sanitizeQuery(ctx);
		const { filters: rawFilters } = ctx.query || {};

		if (rawFilters?.locale !== undefined) {
			const { locale } = rawFilters;

			if (!sanitizedQuery.filters) {
				sanitizedQuery.filters = {};
			}

			// `'null'` guards against query string serializers that turn `null`
			// into the literal string.
			if (locale === null || locale === '' || locale === 'null') {
				sanitizedQuery.filters.locale = null;
			} else if (typeof locale === 'string') {
				sanitizedQuery.filters.locale = locale;
			}
		}

		const { results, pagination } = await strapi
			.plugin('publisher')
			.service('action')
			.find(sanitizedQuery);

		const sanitizedResults = await this.sanitizeOutput(results, ctx);

		return this.transformResponse(sanitizedResults, { pagination });
	},
}));
