import { factories } from '@strapi/strapi';
import { errors } from '@strapi/utils';

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
		const query = ctx.query || {};
		const locale = query.filters?.locale;
		let queryContext = ctx;

		if (locale !== undefined) {
			if (locale !== null && typeof locale !== 'string') {
				throw new errors.ValidationError('filters.locale must be a string or null');
			}

			// Exempt only the supported top-level locale filter. Keep the original
			// request and its auth context intact, including when validation fails.
			const filters = { ...query.filters };
			delete filters.locale;
			queryContext = Object.create(ctx, {
				query: { value: { ...query, filters } },
			});
		}

		await this.validateQuery(queryContext);
		const sanitizedQuery = await this.sanitizeQuery(queryContext);

		if (locale !== undefined) {
			// Query string serializers may encode null as an empty string or 'null'.
			sanitizedQuery.filters = {
				...sanitizedQuery.filters,
				locale: locale === null || locale === '' || locale === 'null' ? { $null: true } : locale,
			};
		}

		const { results, pagination } = await strapi
			.plugin('publisher')
			.service('action')
			.find(sanitizedQuery);

		const sanitizedResults = await this.sanitizeOutput(results, ctx);

		return this.transformResponse(sanitizedResults, { pagination });
	},
}));
