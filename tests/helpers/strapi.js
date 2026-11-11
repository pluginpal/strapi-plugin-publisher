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
	delete: vi.fn().mockResolvedValue({}),
	publish: vi.fn().mockResolvedValue({ documentId: 'doc', entries: [] }),
	unpublish: vi.fn().mockResolvedValue({ documentId: 'doc', entries: [] }),
});

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
 * `services` replaces or adds plugin services (e.g. a mocked publicationService); the real
 * settingsService and emitService are used by default.
 */
export const createStrapi = ({
	config = createConfig(),
	services = {},
	contentTypes = {},
	components = {},
} = {}) => {
	const documentServices = {};
	const documents = vi.fn((uid) => {
		documentServices[uid] ??= createDocumentService();
		return documentServices[uid];
	});
	documents.use = vi.fn();

	const dbQueries = {};
	const cronJobs = {};
	const pluginServices = {};

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
			add: vi.fn((tasks) => Object.assign(cronJobs, tasks)),
			remove: vi.fn((name) => {
				delete cronJobs[name];
			}),
		},
		log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
		config: {
			get: vi.fn((key) => (key === 'plugin::publisher' ? config : undefined)),
		},
		eventHub: { emit: vi.fn().mockResolvedValue(undefined) },
		contentAPI: {
			sanitize: { output: vi.fn(async (entity) => ({ ...entity, sanitized: true })) },
		},
		getModel: vi.fn((uid) => ({ uid, modelName: uid.split('.').pop() })),
		contentType: vi.fn((uid) => contentTypes[uid] ?? { uid, attributes: {} }),
		components,
		entityValidator: { validateEntityCreation: vi.fn().mockResolvedValue(undefined) },
		plugin: vi.fn((name) => {
			if (name === 'content-manager') {
				return {
					service: () => () => ({
						populateDeep: () => ({ build: async () => '*' }),
					}),
				};
			}
			return { service: (serviceName) => pluginServices[serviceName] };
		}),
	};

	Object.assign(pluginServices, {
		settingsService: settingsService({ strapi }),
		emitService: emitService({ strapi }),
		...services,
	});

	global.strapi = strapi;
	return {
		strapi,
		config,
		documents: documentServices,
		dbQueries,
		cronJobs,
		services: pluginServices,
	};
};
