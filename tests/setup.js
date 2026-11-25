import { vi } from 'vitest';

// Strapi loads the plugin as CommonJS (dist/server/index.js), and Node can't import the ES module
// build of @strapi/strapi (it imports named exports from lodash). Give the tests the CommonJS build
// as well, so the action service and controller extend Strapi's real core service and controller.
vi.mock('@strapi/strapi', async () => {
	const { createRequire } = await import('node:module');
	return createRequire(import.meta.url)('@strapi/strapi');
});
