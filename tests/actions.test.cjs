const assert = require('node:assert/strict');
const { afterEach, beforeEach, mock, test } = require('node:test');
const { sanitize, validate } = require('@strapi/utils');
const plugin = require('../dist/server/index.js');

const actionUid = 'plugin::publisher.action';
const articleUid = 'api::article.article';
const nextTurn = () => new Promise(setImmediate);
let controller;
let actionService;
let strapi;

beforeEach(() => {
	const schema = plugin.contentTypes.action.schema;
	const actionType = {
		...schema,
		uid: actionUid,
		attributes: {
			...schema.attributes,
			documentId: { type: 'string' },
			// i18n adds a private locale attribute to non-localized plugin types.
			locale: { ...schema.attributes.locale, private: true },
			secret: { type: 'string', private: true },
		},
	};
	const contentTypes = {
		[actionUid]: actionType,
		[articleUid]: { uid: articleUid, pluginOptions: { i18n: { localized: true } } },
	};
	const i18nServices = {
		'content-types': {
			isLocalizedContentType: (model) => model.pluginOptions?.i18n?.localized === true,
		},
		locales: { getDefaultLocale: async () => 'en' },
	};
	strapi = {
		contentTypes,
		contentType: (uid) => contentTypes[uid],
		getModel: (uid) => contentTypes[uid],
		config: { get: (_key, fallback) => fallback },
		plugin: (name) => {
			if (name === 'publisher') return { service: () => actionService };
			if (name === 'i18n') return { service: (service) => i18nServices[service] };
		},
		log: { info: mock.fn(), error: mock.fn() },
	};
	strapi.contentAPI = {
		validate: validate.createAPIValidators({ getModel: strapi.getModel }),
		sanitize: sanitize.createAPISanitizers({ getModel: strapi.getModel }),
	};
	global.strapi = strapi;
	actionService = plugin.services.action({ strapi });
	actionService.find = mock.fn(async () => ({
		results: [{ documentId: 'timer', entityId: 'article', locale: 'ja', secret: 'hidden' }],
		pagination: { page: 1, pageSize: 25, total: 1, pageCount: 1 },
	}));
	controller = plugin.controllers.actionController({ strapi });
});

afterEach(() => {
	delete global.strapi;
});

test('validates all other query parameters and preserves sanitization and auth', async () => {
	const query = {
		filters: { locale: 'ja', entityId: 'article', $or: [{ mode: 'publish' }, { mode: 'unpublish' }] },
		sort: 'executeAt:asc',
		fields: ['documentId', 'executeAt'],
		pagination: { page: 2, pageSize: 5 },
	};
	const original = structuredClone(query);
	const ctx = { query, state: { auth: { credentials: { id: 1 } } } };
	const validator = mock.method(strapi.contentAPI.validate, 'query');
	const sanitizer = mock.method(strapi.contentAPI.sanitize, 'query');
	const result = await controller.find(ctx);

	assert.equal(validator.mock.callCount(), 1);
	assert.equal(validator.mock.calls[0].arguments[2].auth, ctx.state.auth);
	assert.equal(sanitizer.mock.calls[0].arguments[2].auth, ctx.state.auth);
	assert.equal(ctx.query, query);
	assert.deepEqual(query, original);
	assert.deepEqual(actionService.find.mock.calls[0].arguments[0], original);
	assert.deepEqual(result.data, [{ documentId: 'timer', entityId: 'article' }]);
	assert.equal(result.meta.pagination.total, 1);
});

for (const locale of [null, '', 'null']) {
	test(`supports serialized null locale ${JSON.stringify(locale)}`, async () => {
		await controller.find({ query: { filters: { locale, entityId: 'article' } } });
		assert.deepEqual(actionService.find.mock.calls[0].arguments[0].filters, {
			entityId: 'article', locale: { $null: true },
		});
	});
}

test('keeps non-localized queries unchanged', async () => {
	const query = { filters: { entityId: 'article', mode: 'publish' } };
	await controller.find({ query });
	assert.deepEqual(actionService.find.mock.calls[0].arguments[0], query);
});

for (const locale of [[], ['en'], {}, { $eq: 'en' }, { $null: true }, 1, false]) {
	test(`rejects unsupported locale ${JSON.stringify(locale)} before listing actions`, async () => {
		await assert.rejects(controller.find({ query: { filters: { locale } } }), {
			name: 'ValidationError', message: 'filters.locale must be a string or null',
		});
		assert.equal(actionService.find.mock.callCount(), 0);
	});
}

for (const query of [
	{ filters: { missingField: 'x' } },
	{ filters: { locale: 'ja', missingField: 'x' } },
	{ filters: { locale: 'ja', secret: 'x' } },
	{ filters: { locale: 'ja', $or: [{ locale: 'en' }] } },
	{ filters: { locale: 'ja' }, sort: 'missingField:asc' },
	{ filters: { locale: 'ja' }, fields: ['missingField'] },
	{ filters: { locale: 'ja' }, populate: { missingField: true } },
]) {
	test(`retains core validation for ${JSON.stringify(query)}`, async () => {
		const original = structuredClone(query);
		const ctx = { query };
		await assert.rejects(controller.find(ctx), { name: 'ValidationError' });
		assert.equal(ctx.query, query);
		assert.deepEqual(query, original);
		assert.equal(actionService.find.mock.callCount(), 0);
	});
}

test('finishes normalizing locales before loading and scheduling existing actions', async () => {
	let finishNormalization;
	actionService.normalizeLegacyLocales = mock.fn(() => new Promise((resolve) => {
		finishNormalization = resolve;
	}));
	const pending = { documentId: 'legacy', locale: 'en', executeAt: '2999-01-01T00:00:00.000Z' };
	actionService.find = mock.fn(async () => ({ results: [pending] }));
	actionService.scheduleCronJob = mock.fn();
	plugin.bootstrap({ strapi });
	await nextTurn();
	assert.equal(actionService.normalizeLegacyLocales.mock.callCount(), 1);
	assert.equal(actionService.find.mock.callCount(), 0);
	finishNormalization();
	await nextTurn();
	assert.equal(actionService.find.mock.callCount(), 1);
	assert.equal(actionService.scheduleCronJob.mock.calls[0].arguments[0], pending);
});

test('does not execute or schedule hidden actions if normalization fails', async () => {
	actionService.normalizeLegacyLocales = mock.fn(async () => { throw new Error('Database unavailable'); });
	plugin.bootstrap({ strapi });
	await nextTurn();
	assert.equal(actionService.find.mock.callCount(), 0);
	assert.match(strapi.log.error.mock.calls[0].arguments[0], /Database unavailable/);
});

test('skips normalization when i18n is unavailable', async () => {
	strapi.plugin = () => undefined;
	await actionService.normalizeLegacyLocales();
});

test('skips normalization when no target content type is localized', async () => {
	delete strapi.contentTypes[articleUid];
	await actionService.normalizeLegacyLocales();
});

test('refuses to normalize localized schedules without a default locale', async () => {
	strapi.plugin('i18n').service('locales').getDefaultLocale = async () => undefined;
	await assert.rejects(actionService.normalizeLegacyLocales(), /without a default locale/);
});
