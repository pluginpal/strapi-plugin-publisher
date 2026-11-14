import getPluginService from '../utils/getPluginService';

/**
 * Admin route middleware for listing actions: only returns actions of content types the user may
 * read in the Content Manager (issue #212).
 */
export default () => async (ctx, next) => {
	const readableContentTypes = getPluginService('permissionService').getReadableContentTypes(
		ctx.state.userAbility,
	);

	// Strapi ignores an empty `$in` filter, which would list every action, so answer directly.
	if (readableContentTypes.length === 0) {
		ctx.body = { data: [], meta: { pagination: { page: 1, pageSize: 25, pageCount: 0, total: 0 } } };
		return;
	}

	const permissionFilter = { entitySlug: { $in: readableContentTypes } };
	const { filters } = ctx.query;

	// Change the parsed query in place instead of assigning `ctx.query = ...`: the setter turns the
	// object back into a query string, and parsing that again silently ignores filters with arrays
	// longer than the `strapi::query` arrayLimit (default 100).
	ctx.query.filters = filters ? { $and: [filters, permissionFilter] } : permissionFilter;

	await next();
};
