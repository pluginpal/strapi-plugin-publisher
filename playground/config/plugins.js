const path = require('path');

module.exports = () => ({
	publisher: {
		enabled: true,
		// Load the plugin straight from this repository. Strapi reads the `exports`
		// in the root package.json, so the server and admin are loaded from `dist/`,
		// which `strapi-plugin watch` keeps up to date.
		// An absolute path is used on purpose: Strapi first tries `require.resolve()`
		// on this value, which would resolve a relative path from inside @strapi/core.
		resolve: path.resolve(__dirname, '..', '..'),
		config: {
			hooks: {
				beforePublish: async ({ strapi, uid, entity }) => {
					strapi.log.info(`[playground] beforePublish ${uid} ${entity?.documentId}`);
				},
				afterPublish: async ({ strapi, uid, entity }) => {
					strapi.log.info(`[playground] afterPublish ${uid} ${entity?.documentId}`);
				},
				beforeUnpublish: async ({ strapi, uid, entity }) => {
					strapi.log.info(`[playground] beforeUnpublish ${uid} ${entity?.documentId}`);
				},
				afterUnpublish: async ({ strapi, uid, entity }) => {
					strapi.log.info(`[playground] afterUnpublish ${uid} ${entity?.documentId}`);
				},
			},
		},
	},
});
