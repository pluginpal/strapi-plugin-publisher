import { createRequire } from 'node:module';

// The qs that Strapi's `strapi::query` middleware uses, resolved through @strapi/strapi and
// @strapi/core, with that middleware's default options (@strapi/core/dist/middlewares/query.js).
const requireFromHere = createRequire(import.meta.url);
const strapiCoreEntry = createRequire(requireFromHere.resolve('@strapi/strapi')).resolve(
	'@strapi/core'
);
const qs = createRequire(strapiCoreEntry)('qs');
const STRAPI_QS_OPTIONS = { strictNullHandling: true, arrayLimit: 100, depth: 20 };

/**
 * A Koa context for a request with this query, whose `query` works like it does in Strapi:
 * `strapi::query` replaces Koa's request.query with a getter that parses the query string with qs
 * (cached per query string, so changes to the parsed object stick) and a setter that serialises an
 * object back into the query string. Koa's ctx.query delegates to request.query.
 *
 * So assigning `ctx.query` is not a no-op: arrays longer than the arrayLimit (100) come back as
 * objects, which Strapi's query transformer drops.
 */
export const createKoaContext = (query, { userAbility = {} } = {}) => {
	const request = { querystring: qs.stringify(query), querycache: {} };
	Object.defineProperty(request, 'query', {
		get() {
			this.querycache[this.querystring] ??= qs.parse(this.querystring, STRAPI_QS_OPTIONS);
			return this.querycache[this.querystring];
		},
		set(value) {
			this.querystring = qs.stringify(value);
		},
	});
	return {
		request,
		state: { userAbility },
		get query() {
			return request.query;
		},
		set query(value) {
			request.query = value;
		},
	};
};
