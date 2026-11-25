/**
 * End-to-end smoke test for the plugin, run against the playground or another Strapi app.
 *
 *   node --test-reporter=spec playground/scripts/smoke-test [--skip-build] [--app <dir>]
 *   (or `yarn playground:smoke`; add --test-name-pattern="Permissions" to run part of it)
 *
 * Without --app it tests the playground, which needs a built plugin in dist/ (`yarn build`).
 * With --app it tests a separate app that has the plugin installed from npm (or a packed
 * tarball) and is set up like the playground; see scripts/consumer-test.js.
 *
 * Before the tests it builds the app's admin panel (skip with --skip-build) and starts the app
 * once, with a fresh, separate database. The tests use node:test and live in tests/:
 *   - endpoints:   the admin panel and the plugin settings endpoint;
 *   - scheduling:  publish and unpublish actions for a collection type and a single type run on
 *                  schedule, are removed and call all publisher hooks;
 *   - permissions: admin users can only manage actions of content types they may publish, and
 *                  only see actions of content types they may read (issue #212).
 *
 * The test files are loaded here rather than run with `node --test`, which would start a separate
 * process, and so a separate Strapi app, for every file.
 *
 * Environment:
 *   SMOKE_PORT   Port to run the app on (default 1339)
 *
 * It never touches your own playground database or admin user (playground/.tmp/data.db).
 */
const { before, after } = require('node:test');
const app = require('./lib/app');
const { loginAsAdmin } = require('./lib/client');

before(async () => {
	app.checkPrerequisites();
	app.buildAdmin();
	await app.start();
	await loginAsAdmin();
});

after(() => app.stop());

// node:test sets a failing exit code once all tests have run; show what Strapi logged.
process.on('exit', (code) => {
	if (code !== 0) app.printLogs();
});

require('./tests/endpoints');
require('./tests/scheduling');
require('./tests/permissions');
