/**
 * Builds, starts and stops the Strapi app under test, and keeps its output for when a test fails.
 */
const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const config = require('./config');
const { waitFor } = require('./client');

const logs = [];
let strapi;
let exited = false;

const progress = (message) => console.log(`▶ ${message}`);

const checkPrerequisites = () => {
	if (
		config.isPlayground &&
		!fs.existsSync(path.join(config.repoRoot, 'dist', 'server', 'index.js'))
	) {
		throw new Error('The plugin is not built. Run `yarn build` first.');
	}
	if (!fs.existsSync(config.strapiBin)) {
		throw new Error(`Strapi is not installed in ${config.appDir}`);
	}
};

const buildAdmin = () => {
	if (config.skipBuild) {
		// `strapi develop` empties the admin build folder and serves the admin from Vite instead.
		if (!fs.existsSync(path.join(config.appDir, 'build', 'index.html'))) {
			throw new Error(
				`The admin panel of ${config.appName} is not built (\`strapi develop\` removes build/). Run without --skip-build.`
			);
		}
		return;
	}

	progress(`Building the admin panel of ${config.appName} with the plugin`);
	const build = spawnSync(config.strapiBin, ['build'], {
		cwd: config.appDir,
		env: config.env,
		stdio: 'inherit',
	});
	if (build.status !== 0) {
		throw new Error('`strapi build` failed');
	}
};

/** Starts the app with a fresh, separate database and waits until it responds. */
const start = async () => {
	fs.rmSync(path.join(config.appDir, config.DATABASE_FILENAME), { force: true });

	progress(`Starting ${config.appName} on ${config.BASE_URL}`);
	strapi = spawn(config.strapiBin, ['start'], {
		cwd: config.appDir,
		env: config.env,
		detached: process.platform !== 'win32',
	});
	strapi.stdout.on('data', (chunk) => logs.push(chunk.toString()));
	strapi.stderr.on('data', (chunk) => logs.push(chunk.toString()));
	strapi.on('exit', () => {
		exited = true;
	});

	await waitFor(
		'the health endpoint',
		async () => {
			if (exited) {
				throw new Error('Strapi exited during startup');
			}
			const response = await fetch(`${config.BASE_URL}/_health`);
			return response.status === 204;
		},
		120000
	);
};

const stop = () => {
	if (!strapi || exited) return;
	try {
		if (process.platform === 'win32') strapi.kill();
		else process.kill(-strapi.pid, 'SIGTERM');
	} catch {
		// already stopped
	}
};

/** Everything Strapi has written to stdout and stderr so far. */
const getLogs = () => logs.join('');

const printLogs = () => {
	if (!logs.length) return;
	console.error('\n--- Strapi output ---');
	console.error(getLogs().split('\n').slice(-80).join('\n'));
};

module.exports = { checkPrerequisites, buildAdmin, start, stop, getLogs, printLogs };
