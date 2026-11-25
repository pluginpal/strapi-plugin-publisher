import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import config from '../../server/config';
import actionContentType from '../../server/content-types/action-content-type';
import settingsController from '../../server/controllers/settings-controller';
import plugin from '../../server/index';
import validateBeforeScheduling from '../../server/middlewares/validate-before-scheduling';
import routes from '../../server/routes';
import pluginId from '../../server/utils/pluginId';
import { ACTION_UID, createConfig, createStrapi } from '../helpers/strapi';

const SERVER_DIR = join(import.meta.dirname, '../../server');

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
		{ method: 'GET', path: '/actions', handler: 'actionController.find' },
		{ method: 'POST', path: '/actions', handler: 'actionController.create' },
		{ method: 'PUT', path: '/actions/:id', handler: 'actionController.update' },
		{ method: 'DELETE', path: '/actions/:id', handler: 'actionController.delete' },
	];
	// Without `config`, so adding policies or middlewares to an admin route doesn't break this
	// test; test those where they are added.
	const withoutConfig = (router) =>
		router.routes.map(({ method, path, handler }) => ({ method, path, handler }));

	it('exposes the actions and settings in the admin API', () => {
		const expected = [
			...crud,
			{ method: 'GET', path: '/settings', handler: 'settingsController.find' },
		];

		expect(routes.admin.type).toBe('admin');
		expect(withoutConfig(routes.admin)).toHaveLength(expected.length);
		expect(withoutConfig(routes.admin)).toEqual(expect.arrayContaining(expected));
	});

	it('exposes the actions in the content API', () => {
		// Complete route objects: the content API relies on Strapi's own permissions for the action
		// content type, so a route config (policies, middlewares, auth) has to show up here.
		expect(routes['content-api'].type).toBe('content-api');
		expect(routes['content-api'].routes).toHaveLength(crud.length);
		expect(routes['content-api'].routes).toEqual(expect.arrayContaining(crud));
	});

	describe('admin route permissions (#212)', () => {
		const adminRoute = (method, path) =>
			routes.admin.routes.find((route) => route.method === method && route.path === path);

		it.each([
			['POST', '/actions'],
			['PUT', '/actions/:id'],
			['DELETE', '/actions/:id'],
		])('%s %s requires publish permission on the target', (method, path) => {
			expect(adminRoute(method, path).config.policies).toEqual([
				'plugin::publisher.can-manage-action',
			]);
		});

		it('GET /actions only lists actions of content types the user can read', () => {
			expect(adminRoute('GET', '/actions').config.middlewares).toEqual([
				'plugin::publisher.limit-to-readable-content-types',
			]);
		});
	});

	it('requires authentication on every route', () => {
		for (const router of Object.values(routes)) {
			for (const route of router.routes) {
				expect(route.config?.auth, `${route.method} ${route.path}`).not.toBe(false);
			}
		}
	});
});

describe('plugin entry (server/index.js)', () => {
	it('has a controller method for every route handler', () => {
		const { strapi } = createStrapi();

		for (const router of Object.values(plugin.routes)) {
			for (const { handler } of router.routes) {
				const [controllerName, method] = handler.split('.');
				const controller = plugin.controllers[controllerName];
				const instance = typeof controller === 'function' ? controller({ strapi }) : controller;
				expect(instance?.[method], handler).toBeTypeOf('function');
			}
		}
	});

	it('registers the policies and middlewares the routes use', () => {
		const prefix = `plugin::${pluginId}.`;
		for (const router of Object.values(plugin.routes)) {
			for (const { config: routeConfig = {} } of router.routes) {
				for (const [kind, names] of [
					['policies', routeConfig.policies ?? []],
					['middlewares', routeConfig.middlewares ?? []],
				]) {
					for (const name of names) {
						expect(name.startsWith(prefix), name).toBe(true);
						expect(plugin[kind][name.slice(prefix.length)], name).toBeTypeOf('function');
					}
				}
			}
		}
	});

	it('registers every service the plugin looks up by name', () => {
		const used = new Set();
		const files = readdirSync(SERVER_DIR, { recursive: true }).filter((f) => f.endsWith('.js'));
		for (const file of files) {
			const source = readFileSync(join(SERVER_DIR, file), 'utf8');
			const lookups = [
				...source.matchAll(/getPluginService\('([^']+)'\)/g),
				...source.matchAll(/plugin\('publisher'\)\s*\.service\('([^']+)'\)/g),
			];
			lookups.forEach(([, name]) => used.add(name));
		}

		expect(used).toContain('publicationService');
		expect(Object.keys(plugin.services)).toEqual(expect.arrayContaining([...used]));
	});

	it('registers the action content type under the uid the plugin uses', () => {
		expect(Object.keys(plugin.contentTypes)).toEqual(['action']);
		expect(plugin.contentTypes.action.schema).toBe(actionContentType);
		expect(`plugin::${pluginId}.action`).toBe(ACTION_UID);
	});

	it('schedules the existing actions in bootstrap, once all plugins are ready', async () => {
		const actionService = {
			find: vi.fn().mockResolvedValue({ results: [] }),
			scheduleCronJob: vi.fn(),
		};
		const { strapi } = createStrapi({ services: { action: actionService } });

		plugin.bootstrap({ strapi });

		expect(actionService.find).not.toHaveBeenCalled();
		await new Promise((resolve) => setImmediate(resolve));
		expect(actionService.find).toHaveBeenCalledOnce();
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

		plugin.register({ strapi });

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
