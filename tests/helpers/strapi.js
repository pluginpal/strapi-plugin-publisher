import { vi } from 'vitest';
import emitService from '../../server/services/emit-service';
import settingsService from '../../server/services/settings-service';

export const ACTION_UID = 'plugin::publisher.action';
export const ARTICLE_UID = 'api::article.article';

/**
 * A fake document service for one content type. Every method is a mock, so tests can set
 * return values and check how the plugin called it.
 */
const createDocumentService = () => ({
	findOne: vi.fn().mockResolvedValue(null),
	findMany: vi.fn().mockResolvedValue([]),
	create: vi.fn(),
	update: vi.fn(),
	// Like the Document Service: the documentId and the deleted entries (locales).
	delete: vi.fn().mockResolvedValue({ documentId: 'doc', entries: [] }),
	publish: vi.fn().mockResolvedValue({ documentId: 'doc', entries: [] }),
	unpublish: vi.fn().mockResolvedValue({ documentId: 'doc', entries: [] }),
});

/**
 * A fake of the content manager's `populate-builder` service: `populateBuilder(uid)` returns a
 * chainable builder like the real one. There is one builder per fake, available as
 * `populateBuilder.builder`, so tests can check the calls or change what `build()` resolves to
 * (`'*'` by default).
 */
const createPopulateBuilder = () => {
	const builder = {
		populateFromQuery: vi.fn(() => builder),
		populateDeep: vi.fn(() => builder),
		countRelations: vi.fn(() => builder),
		build: vi.fn(async () => '*'),
	};
	const populateBuilder = vi.fn(() => builder);
	populateBuilder.builder = builder;
	return populateBuilder;
};

/**
 * Plugin config as it ends up after Strapi merged the user config with the defaults
 * (server/config/index.js). All hooks are mocks.
 */
export const createConfig = (overrides = {}) => ({
	enabled: true,
	actions: { syncFrequency: '*/1 * * * *' },
	components: { dateTimePicker: { step: 5 } },
	...overrides,
	hooks: {
		beforePublish: vi.fn(),
		afterPublish: vi.fn(),
		beforeUnpublish: vi.fn(),
		afterUnpublish: vi.fn(),
		...overrides.hooks,
	},
});

/**
 * Minimal stand-in for the global `strapi` object with just the APIs the plugin uses.
 * It is also installed as `global.strapi`, because the plugin uses the global in some places.
 *
 * - `services` replaces or adds plugin services (e.g. a mocked publicationService); the real
 *   settingsService and emitService are used by default.
 * - `contentTypes` and `components` are the models, keyed by uid (`strapi.contentType(uid)`,
 *   `strapi.contentTypes`, `strapi.components`).
 * - `contentManagerServices` replaces or adds services of the content-manager plugin; by default
 *   it only has a fake `populate-builder` (see createPopulateBuilder).
 *
 * Like in Strapi, `strapi.plugin(name)` is undefined for plugins other than `publisher` and
 * `content-manager`, and the cron service keeps every job that is added, also when two jobs have
 * the same name (`getCronJobs(name)`).
 */
export const createStrapi = ({
	config = createConfig(),
	services = {},
	contentTypes = {},
	components = {},
	contentManagerServices = {},
} = {}) => {
	const documentServices = {};
	const documents = vi.fn((uid) => {
		documentServices[uid] ??= createDocumentService();
		return documentServices[uid];
	});
	documents.use = vi.fn();

	const dbQueries = {};
	// The last job added per name, and every added job (Strapi's cron service keeps both when a
	// name is added twice).
	const cronJobs = {};
	let scheduledCronJobs = [];
	const getCronJobs = (name) =>
		scheduledCronJobs.filter((job) => job.name === name).map(({ job }) => job);
	const pluginServices = {};
	const cmServices = { 'populate-builder': createPopulateBuilder(), ...contentManagerServices };

	const strapi = {
		documents,
		db: {
			query: vi.fn((uid) => {
				dbQueries[uid] ??= { update: vi.fn().mockResolvedValue({}) };
				return dbQueries[uid];
			}),
		},
		cron: {
			jobs: cronJobs,
			add: vi.fn((tasks) => {
				for (const [name, job] of Object.entries(tasks)) {
					scheduledCronJobs.push({ name, job });
					cronJobs[name] = job;
				}
			}),
			// Like Strapi's: removes every job with that name, and only throws without a name.
			remove: vi.fn((name) => {
				if (!name) throw new Error('You must provide a name to remove a cron job.');
				scheduledCronJobs = scheduledCronJobs.filter((job) => job.name !== name);
				delete cronJobs[name];
			}),
		},
		log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
		config: {
			get: vi.fn((key, defaultValue) => (key === 'plugin::publisher' ? config : defaultValue)),
		},
		eventHub: { emit: vi.fn().mockResolvedValue(undefined) },
		contentAPI: {
			sanitize: { output: vi.fn(async (entity) => ({ ...entity, sanitized: true })) },
		},
		getModel: vi.fn((uid) => ({ uid, modelName: uid.split('.').pop() })),
		contentType: vi.fn((uid) => contentTypes[uid] ?? { uid, attributes: {} }),
		contentTypes,
		components,
		entityValidator: { validateEntityCreation: vi.fn().mockResolvedValue(undefined) },
		plugin: vi.fn((name) => {
			if (name === 'publisher') {
				return { service: (serviceName) => pluginServices[serviceName] };
			}
			if (name === 'content-manager') {
				return {
					service: (serviceName) => {
						if (!cmServices[serviceName]) {
							throw new Error(
								`The fake content-manager has no "${serviceName}" service, pass it in createStrapi({ contentManagerServices }).`
							);
						}
						return cmServices[serviceName];
					},
				};
			}
			return undefined;
		}),
	};

	Object.assign(pluginServices, {
		settingsService: settingsService({ strapi }),
		emitService: emitService({ strapi }),
		...services,
	});

	vi.stubGlobal('strapi', strapi);
	return {
		strapi,
		config,
		documents: documentServices,
		dbQueries,
		cronJobs,
		getCronJobs,
		services: pluginServices,
		contentManagerServices: cmServices,
	};
};
