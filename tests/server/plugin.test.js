import { describe, expect, it, vi } from 'vitest';
import config from '../../server/config';
import actionContentType from '../../server/content-types/action-content-type';
import settingsController from '../../server/controllers/settings-controller';
import validateBeforeScheduling from '../../server/middlewares/validate-before-scheduling';
import register from '../../server/register';
import routes from '../../server/routes';
import { createConfig, createStrapi } from '../helpers/strapi';

describe('plugin config', () => {
	it('has defaults with no-op hooks', () => {
		const defaults = config.default();
		expect(defaults.components.dateTimePicker.step).toBe(5);
		for (const hook of ['beforePublish', 'afterPublish', 'beforeUnpublish', 'afterUnpublish']) {
			expect(defaults.hooks[hook]()).toBeUndefined();
		}
	});

	it('accepts the documented options', async () => {
		await expect(
			config.validator({
				...config.default(),
				contentTypes: ['api::article.article'],
				components: { dateTimePicker: { step: 15, locale: 'nl-NL' } },
			})
		).resolves.toBeUndefined();
	});

	it.each([
		['contentTypes is not a list', { contentTypes: 'api::article.article' }],
		['dateTimePicker.step is not a number', { components: { dateTimePicker: { step: 'often' } } }],
	])('rejects invalid config: %s', async (_, invalid) => {
		await expect(config.validator({ ...config.default(), ...invalid })).rejects.toThrow();
	});
});

describe('routes', () => {
	const crud = [
		['GET', '/actions', 'actionController.find'],
		['POST', '/actions', 'actionController.create'],
		['PUT', '/actions/:id', 'actionController.update'],
		['DELETE', '/actions/:id', 'actionController.delete'],
	];
	const toTuples = (router) =>
		router.routes.map(({ method, path, handler }) => [method, path, handler]);

	it('exposes the actions and settings in the admin API', () => {
		expect(routes.admin.type).toBe('admin');
		expect(toTuples(routes.admin)).toEqual(
			expect.arrayContaining([...crud, ['GET', '/settings', 'settingsController.find']])
		);
	});

	it('exposes the actions in the content API', () => {
		expect(routes['content-api'].type).toBe('content-api');
		expect(toTuples(routes['content-api'])).toEqual(expect.arrayContaining(crud));
	});
});

describe('settings controller', () => {
	it('returns the plugin config', async () => {
		const pluginConfig = createConfig({ contentTypes: ['api::article.article'] });
		createStrapi({ config: pluginConfig });
		const ctx = { send: vi.fn() };

		await settingsController.find(ctx);

		expect(ctx.send).toHaveBeenCalledWith({ data: pluginConfig });
	});
});

describe('register', () => {
	it('adds the validation middleware to the Document Service', () => {
		const { strapi } = createStrapi();

		register({ strapi });

		expect(strapi.documents.use).toHaveBeenCalledWith(validateBeforeScheduling);
	});
});

describe('action content type', () => {
	it('stores what is needed to execute an action and is hidden from the admin', () => {
		expect(Object.keys(actionContentType.attributes)).toEqual([
			'executeAt',
			'mode',
			'entityId',
			'entitySlug',
		]);
		expect(actionContentType.options.draftAndPublish).toBe(false);
		expect(actionContentType.pluginOptions['content-manager'].visible).toBe(false);
		expect(actionContentType.pluginOptions['content-type-builder'].visible).toBe(false);
	});
});
