/**
 * Settings of the smoke test: which app it runs against, on which port, and the users it uses.
 */
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..', '..', '..');
const playgroundDir = path.join(repoRoot, 'playground');
const appArgIndex = process.argv.indexOf('--app');
const appDir = appArgIndex > -1 ? path.resolve(process.argv[appArgIndex + 1]) : playgroundDir;
const isPlayground = appDir === playgroundDir;

const PORT = Number(process.env.SMOKE_PORT || 1339);
const DATABASE_FILENAME = '.tmp/smoke-test.db';

// The smoke test uses its own database, so this admin is created on startup by
// playground/src/index.js. Passing it explicitly overrides values in playground/.env.
const ADMIN = {
	email: 'smoke-test@playground.test',
	password: 'SmokeTest123!',
};

module.exports = {
	repoRoot,
	appDir,
	isPlayground,
	appName: isPlayground ? 'the playground' : appDir,
	skipBuild: process.argv.includes('--skip-build'),
	// The playground uses the repository's node_modules; a separate app has its own.
	strapiBin: path.join(
		isPlayground ? repoRoot : appDir,
		'node_modules',
		'.bin',
		process.platform === 'win32' ? 'strapi.cmd' : 'strapi'
	),
	BASE_URL: `http://127.0.0.1:${PORT}`,
	DATABASE_FILENAME,
	ADMIN,
	// Created by the permission tests to check users who aren't super admins (issue #212).
	NO_PUBLISH_USER: {
		email: 'smoke-test-no-publish@playground.test',
		password: 'SmokeTestNoPublish123!',
	},
	PUBLISHER_USER: {
		email: 'smoke-test-publisher@playground.test',
		password: 'SmokeTestPublisher123!',
	},
	ARTICLE_UID: 'api::article.article',
	HOMEPAGE_UID: 'api::homepage.homepage',
	env: {
		...process.env,
		HOST: '127.0.0.1',
		PORT: String(PORT),
		DATABASE_FILENAME,
		PLAYGROUND_ADMIN_EMAIL: ADMIN.email,
		PLAYGROUND_ADMIN_PASSWORD: ADMIN.password,
		STRAPI_TELEMETRY_DISABLED: 'true',
	},
};
