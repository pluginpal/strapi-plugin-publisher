/**
 * End-to-end smoke test for the plugin, run against the playground or another Strapi app.
 *
 *   node playground/scripts/smoke-test.js [--skip-build] [--app <dir>]
 *
 * Without --app it tests the playground, which needs a built plugin in dist/ (`yarn build`).
 * With --app it tests a separate app that has the plugin installed from npm (or a packed
 * tarball) and is set up like the playground; see scripts/consumer-test.js. The script:
 *   1. builds the app's admin panel with the plugin (skip with --skip-build);
 *   2. starts the playground with a fresh, separate database;
 *   3. checks the health endpoint, the admin panel and the plugin settings endpoint;
 *   4. schedules publish actions for a collection type and a single type, and an unpublish
 *      action, and waits until the plugin has executed them;
 *   5. checks that the executed actions were removed and that all publisher hooks ran.
 *
 * Environment:
 *   SMOKE_PORT   Port to run the playground on (default 1339)
 *
 * It never touches your own playground database or admin user (playground/.tmp/data.db).
 */
const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..', '..');
const playgroundDir = path.resolve(__dirname, '..');
const appArgIndex = process.argv.indexOf('--app');
const appDir = appArgIndex > -1 ? path.resolve(process.argv[appArgIndex + 1]) : playgroundDir;
const isPlayground = appDir === playgroundDir;
// The playground uses the repository's node_modules; a separate app has its own.
const strapiBin = path.join(isPlayground ? repoRoot : appDir, 'node_modules', '.bin', process.platform === 'win32' ? 'strapi.cmd' : 'strapi');

const PORT = Number(process.env.SMOKE_PORT || 1339);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const DATABASE_FILENAME = '.tmp/smoke-test.db';
// The smoke test uses its own database, so this admin is created on startup by
// playground/src/index.js. Passing it explicitly overrides values in playground/.env.
const ADMIN = {
	email: 'smoke-test@playground.test',
	password: 'SmokeTest123!',
};
const ARTICLE_UID = 'api::article.article';
const HOMEPAGE_UID = 'api::homepage.homepage';
const ACTION_DELAY_MS = 5000;
const TIMEOUT_MS = 60000;

const env = {
	...process.env,
	HOST: '127.0.0.1',
	PORT: String(PORT),
	DATABASE_FILENAME,
	PLAYGROUND_ADMIN_EMAIL: ADMIN.email,
	PLAYGROUND_ADMIN_PASSWORD: ADMIN.password,
	STRAPI_TELEMETRY_DISABLED: 'true',
};

const step = (message) => console.log(`\n▶ ${message}`);
const ok = (message) => console.log(`  ✔ ${message}`);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const assert = (condition, message) => {
	if (!condition) {
		throw new Error(message);
	}
};

const waitFor = async (description, check, timeout = TIMEOUT_MS) => {
	const deadline = Date.now() + timeout;
	let lastError;
	while (Date.now() < deadline) {
		try {
			const result = await check();
			if (result) {
				return result;
			}
		} catch (error) {
			lastError = error;
		}
		await sleep(1000);
	}
	throw new Error(`Timed out waiting for ${description}${lastError ? ` (${lastError.message})` : ''}`);
};

let token;
const api = async (method, url, body) => {
	const response = await fetch(`${BASE_URL}${url}`, {
		method,
		headers: {
			'Content-Type': 'application/json',
			...(token ? { Authorization: `Bearer ${token}` } : {}),
		},
		body: body ? JSON.stringify(body) : undefined,
	});
	const text = await response.text();
	let json;
	try {
		json = text ? JSON.parse(text) : null;
	} catch {
		json = null;
	}
	if (!response.ok) {
		throw new Error(`${method} ${url} returned ${response.status}: ${text.slice(0, 300)}`);
	}
	return json;
};

const scheduleAction = async (mode, entityId, entitySlug) => {
	const executeAt = new Date(Date.now() + ACTION_DELAY_MS).toISOString();
	const { data } = await api('POST', '/publisher/actions', { data: { mode, entityId, entitySlug, executeAt } });
	assert(data?.documentId, `Creating a ${mode} action for ${entitySlug} did not return a documentId`);
	return data;
};

const getArticleStatus = async (documentId) => {
	const { results } = await api('GET', `/content-manager/collection-types/${ARTICLE_UID}?pageSize=100`);
	return results.find((article) => article.documentId === documentId)?.status;
};

const run = async (logs) => {
	if (isPlayground) {
		assert(fs.existsSync(path.join(repoRoot, 'dist', 'server', 'index.js')), 'The plugin is not built. Run `yarn build` first.');
	}
	assert(fs.existsSync(strapiBin), `Strapi is not installed in ${appDir}`);

	fs.rmSync(path.join(appDir, DATABASE_FILENAME), { force: true });

	if (!process.argv.includes('--skip-build')) {
		step(`Building the admin panel of ${isPlayground ? 'the playground' : appDir} with the plugin`);
		const build = spawnSync(strapiBin, ['build'], { cwd: appDir, env, stdio: 'inherit' });
		assert(build.status === 0, '`strapi build` failed');
		ok('Admin panel built');
	}

	step(`Starting ${isPlayground ? 'the playground' : appDir} on ${BASE_URL}`);
	const strapi = spawn(strapiBin, ['start'], { cwd: appDir, env, detached: process.platform !== 'win32' });
	strapi.stdout.on('data', (chunk) => logs.push(chunk.toString()));
	strapi.stderr.on('data', (chunk) => logs.push(chunk.toString()));
	let exited = false;
	strapi.on('exit', () => {
		exited = true;
	});

	const stop = () => {
		if (exited) return;
		try {
			if (process.platform === 'win32') strapi.kill();
			else process.kill(-strapi.pid, 'SIGTERM');
		} catch {
			// already stopped
		}
	};

	try {
		await waitFor('the health endpoint', async () => {
			assert(!exited, 'Strapi exited during startup');
			const response = await fetch(`${BASE_URL}/_health`);
			return response.status === 204;
		}, 120000);
		ok('Health endpoint responds');

		const admin = await fetch(`${BASE_URL}/admin`);
		assert(admin.ok && (await admin.text()).includes('<script'), `GET /admin returned ${admin.status}`);
		ok('Admin panel is served');

		step('Logging in and checking the plugin endpoints');
		const login = await api('POST', '/admin/login', ADMIN);
		token = login?.data?.token;
		assert(token, 'Login did not return a token');
		ok(`Logged in as ${ADMIN.email}`);

		const settings = await api('GET', '/publisher/settings');
		assert(settings?.data?.components?.dateTimePicker, 'GET /publisher/settings did not return the plugin config');
		ok('Plugin settings endpoint works');

		step('Scheduling publish actions for a collection type and a single type');
		const { results: articles } = await api('GET', `/content-manager/collection-types/${ARTICLE_UID}`);
		const article = articles.find((entry) => entry.status === 'draft');
		assert(article, 'No draft article found to publish (the playground seed should create one)');

		const { data: homepage } = await api('GET', `/content-manager/single-types/${HOMEPAGE_UID}`);
		assert(homepage?.documentId, 'No homepage draft found (the playground seed should create one)');

		const articleAction = await scheduleAction('publish', article.documentId, ARTICLE_UID);
		const homepageAction = await scheduleAction('publish', homepage.documentId, HOMEPAGE_UID);
		ok(`Scheduled article ${article.documentId} and homepage ${homepage.documentId}`);

		await waitFor('the article to be published', async () => (await getArticleStatus(article.documentId)) === 'published');
		ok('Article was published on schedule');

		await waitFor('the homepage to be published', async () => {
			const { data } = await api('GET', `/content-manager/single-types/${HOMEPAGE_UID}?status=published`);
			return Boolean(data?.publishedAt);
		});
		ok('Homepage (single type) was published on schedule');

		const { data: remaining } = await api('GET', '/publisher/actions');
		const leftOver = remaining.filter((action) => [articleAction.documentId, homepageAction.documentId].includes(action.documentId));
		assert(leftOver.length === 0, 'Executed publish actions were not removed');
		ok('Executed actions were removed');

		step('Scheduling an unpublish action');
		await scheduleAction('unpublish', article.documentId, ARTICLE_UID);
		await waitFor('the article to be unpublished', async () => (await getArticleStatus(article.documentId)) === 'draft');
		ok('Article was unpublished on schedule');

		step('Checking that the publisher hooks ran');
		// afterUnpublish runs just after the status change, so give the log line a moment to arrive.
		const hooks = ['beforePublish', 'afterPublish', 'beforeUnpublish', 'afterUnpublish'];
		const missingHooks = () => hooks.filter((hook) => !logs.join('').includes(`[playground] ${hook}`));
		try {
			await waitFor('the publisher hooks to log', () => missingHooks().length === 0, 10000);
		} catch {
			throw new Error(`These hooks did not run: ${missingHooks().join(', ')}`);
		}
		ok('beforePublish, afterPublish, beforeUnpublish and afterUnpublish ran');
	} finally {
		stop();
	}
};

const logs = [];
run(logs)
	.then(() => {
		console.log('\n✅ Smoke test passed');
		process.exit(0);
	})
	.catch((error) => {
		console.error(`\n❌ Smoke test failed: ${error.message}`);
		if (logs.length) {
			console.error('\n--- Strapi output ---');
			console.error(logs.join('').split('\n').slice(-80).join('\n'));
		}
		process.exit(1);
	});
