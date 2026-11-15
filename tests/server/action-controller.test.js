import { errors } from '@strapi/utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import actionController from '../../server/controllers/action-controller';
import { createStrapi } from '../helpers/strapi';

describe('action controller find', () => {
	let actionService;
	let controller;
	let coreFind;
	let validatedQuery;

	beforeEach(() => {
		actionService = {
			find: vi.fn().mockResolvedValue({ results: [{ documentId: 'a1' }], pagination: { page: 1 } }),
		};
		const { strapi } = createStrapi({ services: { action: actionService } });
		// The controller extends Strapi's real core controller. Validating and sanitizing the query
		// and output need Strapi's content API, so they are replaced with spies that change what
		// they get: skipping one of them would change the result.
		controller = actionController({ strapi });
		coreFind = vi.spyOn(Object.getPrototypeOf(controller), 'find').mockResolvedValue('core-find');
		validatedQuery = undefined;
		vi.spyOn(controller, 'validateQuery').mockImplementation(async (ctx) => {
			validatedQuery = structuredClone(ctx.query);
		});
		vi.spyOn(controller, 'sanitizeQuery').mockResolvedValue({
			filters: { mode: 'publish' },
			fields: ['executeAt'],
		});
		vi.spyOn(controller, 'sanitizeOutput').mockImplementation(async (results) =>
			results.map((action) => ({ ...action, sanitized: true }))
		);
	});

	it("uses Strapi's find without a locale", async () => {
		const ctx = { query: { filters: { mode: 'publish' } } };

		await expect(controller.find(ctx)).resolves.toBe('core-find');

		expect(coreFind).toHaveBeenCalledWith(ctx);
		expect(actionService.find).not.toHaveBeenCalled();
	});

	it('only returns the actions of the requested locale', async () => {
		const filters = { mode: 'publish', entityId: 'article-1', entitySlug: 'api::article.article' };
		const ctx = { query: { filters, locale: 'nl' } };

		const response = await controller.find(ctx);

		// The locale is removed from the query before Strapi validates it.
		expect(validatedQuery).toEqual({ filters });
		// The sanitized query is used, with the locale added to its filters.
		expect(actionService.find).toHaveBeenCalledWith({
			fields: ['executeAt'],
			filters: { $and: [{ mode: 'publish' }, { locale: 'nl' }] },
		});
		// The output is sanitized for the user making the request (ctx.state.auth).
		expect(controller.sanitizeOutput).toHaveBeenCalledWith([{ documentId: 'a1' }], ctx);
		expect(response).toEqual({
			data: [{ documentId: 'a1', sanitized: true }],
			meta: { pagination: { page: 1 } },
		});
		expect(coreFind).not.toHaveBeenCalled();
	});

	it('only filters on the locale when there are no other filters', async () => {
		controller.sanitizeQuery.mockResolvedValue({});

		await controller.find({ query: { locale: 'nl' } });

		expect(actionService.find).toHaveBeenCalledWith({
			filters: { $and: [{}, { locale: 'nl' }] },
		});
	});

	it('does not look up any actions when the query is invalid', async () => {
		controller.validateQuery.mockRejectedValue(new errors.ValidationError('Invalid key'));

		await expect(
			controller.find({ query: { filters: { secret: true }, locale: 'nl' } })
		).rejects.toBeInstanceOf(errors.ValidationError);

		expect(actionService.find).not.toHaveBeenCalled();
	});

	it('rejects a locale that is not a string', async () => {
		const ctx = {
			query: { locale: ['nl', 'en'] },
			badRequest: vi.fn().mockReturnValue('bad-request'),
		};

		await expect(controller.find(ctx)).resolves.toBe('bad-request');

		expect(actionService.find).not.toHaveBeenCalled();
	});
});
