import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createStrapi } from '../helpers/strapi';

// Strapi's core controller, which the action controller extends.
const coreController = {
	find: vi.fn(),
	validateQuery: vi.fn(),
	sanitizeQuery: vi.fn(),
	sanitizeOutput: vi.fn(),
	transformResponse: vi.fn(),
};

vi.mock('@strapi/strapi', () => ({
	factories: {
		createCoreController:
			(uid, extend) =>
			({ strapi }) =>
				Object.setPrototypeOf(extend({ strapi }), coreController),
	},
}));

const { default: actionController } = await import('../../server/controllers/action-controller');

describe('action controller find', () => {
	let actionService;
	let controller;

	beforeEach(() => {
		actionService = {
			find: vi.fn().mockResolvedValue({ results: [{ documentId: 'a1' }], pagination: { page: 1 } }),
		};
		const { strapi } = createStrapi({ services: { action: actionService } });
		controller = actionController({ strapi });
		coreController.find.mockReset().mockResolvedValue('core-find');
		coreController.validateQuery.mockReset();
		coreController.sanitizeQuery.mockReset().mockImplementation(async (ctx) => ({ ...ctx.query }));
		coreController.sanitizeOutput.mockReset().mockImplementation(async (results) => results);
		coreController.transformResponse
			.mockReset()
			.mockImplementation((data, meta) => ({ data, meta }));
	});

	it("uses Strapi's find without a locale", async () => {
		const ctx = { query: { filters: { mode: 'publish' } } };

		await expect(controller.find(ctx)).resolves.toBe('core-find');

		expect(coreController.find).toHaveBeenCalledWith(ctx);
		expect(actionService.find).not.toHaveBeenCalled();
	});

	it('only returns the actions of the requested locale', async () => {
		const filters = { mode: 'publish', entityId: 'article-1', entitySlug: 'api::article.article' };
		const ctx = { query: { filters, locale: 'nl' } };

		const response = await controller.find(ctx);

		// The locale is removed from the query before Strapi validates it.
		expect(coreController.validateQuery).toHaveBeenCalledWith(
			expect.objectContaining({ query: { filters } })
		);
		expect(actionService.find).toHaveBeenCalledWith({
			filters: { $and: [filters, { locale: 'nl' }] },
		});
		expect(response).toEqual({ data: [{ documentId: 'a1' }], meta: { pagination: { page: 1 } } });
		expect(coreController.find).not.toHaveBeenCalled();
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
