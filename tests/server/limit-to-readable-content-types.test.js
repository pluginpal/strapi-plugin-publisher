import { beforeEach, describe, expect, it, vi } from 'vitest';
import actionController from '../../server/controllers/action-controller';
import limitToReadableContentTypes from '../../server/middlewares/limit-to-readable-content-types';
import { createKoaContext } from '../helpers/koa';
import { ARTICLE_UID, createStrapi } from '../helpers/strapi';

const READ = 'plugin::content-manager.explorer.read';

const draftAndPublishTypes = (uids) =>
	Object.fromEntries(
		uids.map((uid) => [uid, { uid, options: { draftAndPublish: true }, attributes: {} }])
	);

describe('limit-to-readable-content-types middleware (#212)', () => {
	const middleware = limitToReadableContentTypes();
	let next;
	let readable;
	let userAbility;

	// Uses the real permission service, with these content types (all with draft & publish).
	const setup = (uids) => createStrapi({ contentTypes: draftAndPublishTypes(uids) });

	beforeEach(() => {
		next = vi.fn().mockResolvedValue(undefined);
		readable = [ARTICLE_UID];
		userAbility = { can: vi.fn((action, uid) => action === READ && readable.includes(uid)) };
		setup([ARTICLE_UID, 'api::homepage.homepage']);
	});

	it('only lists actions of content types the user can read', async () => {
		const ctx = createKoaContext({}, { userAbility });

		await middleware(ctx, next);

		expect(ctx.query.filters).toEqual({ entitySlug: { $in: [ARTICLE_UID] } });
		expect(next).toHaveBeenCalledOnce();
	});

	it('keeps the filters of the request', async () => {
		const ctx = createKoaContext(
			{ filters: { mode: 'publish', entityId: 'article-1' }, sort: 'executeAt' },
			{ userAbility }
		);

		await middleware(ctx, next);

		expect(ctx.query).toEqual({
			filters: {
				$and: [{ mode: 'publish', entityId: 'article-1' }, { entitySlug: { $in: [ARTICLE_UID] } }],
			},
			sort: 'executeAt',
		});
	});

	it('answers with an empty list when the user cannot read any content type', async () => {
		// Strapi ignores an empty `$in`, which would list every action.
		readable = [];
		const ctx = createKoaContext({}, { userAbility });

		await middleware(ctx, next);

		expect(next).not.toHaveBeenCalled();
		expect(ctx.body).toEqual({
			data: [],
			meta: { pagination: { page: 1, pageSize: 25, pageCount: 0, total: 0 } },
		});
	});

	describe('with more readable content types than the arrayLimit (100) of the query parser', () => {
		const uids = Array.from({ length: 150 }, (_, i) => `api::type-${i}.type-${i}`);

		beforeEach(() => {
			setup(uids);
			readable = uids;
		});

		it('keeps all of them in the filter', async () => {
			const ctx = createKoaContext({ filters: { mode: 'publish' } }, { userAbility });

			await middleware(ctx, next);

			expect(ctx.query.filters.$and[1].entitySlug.$in).toEqual(uids);
		});

		it('keeps them when the action controller filters on the locale', async () => {
			const actionService = { find: vi.fn().mockResolvedValue({ results: [], pagination: {} }) };
			const { strapi } = createStrapi({
				contentTypes: draftAndPublishTypes(uids),
				services: { action: actionService },
			});
			const controller = actionController({ strapi });
			// Validating and sanitizing need Strapi's content API; pass the query through instead.
			vi.spyOn(controller, 'validateQuery').mockResolvedValue(undefined);
			vi.spyOn(controller, 'sanitizeQuery').mockImplementation(async (ctx) =>
				structuredClone(ctx.query)
			);
			vi.spyOn(controller, 'sanitizeOutput').mockImplementation(async (results) => results);
			const ctx = createKoaContext({ filters: { mode: 'publish' }, locale: 'nl' }, { userAbility });

			await middleware(ctx, () => controller.find(ctx));

			expect(actionService.find).toHaveBeenCalledWith({
				filters: {
					$and: [{ $and: [{ mode: 'publish' }, { entitySlug: { $in: uids } }] }, { locale: 'nl' }],
				},
			});
		});
	});
});
