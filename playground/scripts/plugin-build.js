/**
 * Helpers that connect `strapi-plugin watch` (which builds the plugin into `dist/`)
 * to the playground's `strapi develop`.
 *
 *   node plugin-build.js wait    Wait until the plugin has been built, then exit.
 *   node plugin-build.js watch   Restart Strapi whenever the plugin's server code is rebuilt.
 *
 * Why `watch` is needed: `strapi develop` only watches the playground folder, so it does not
 * notice rebuilds in `dist/server`. After a rebuild this script touches
 * `playground/config/plugins.js`, which Strapi treats as a change and restarts.
 * Admin changes do not need this, the admin dev server (Vite) reloads those itself.
 */
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const distFile = (...segments) => path.join(repoRoot, 'dist', ...segments);
const serverEntries = [distFile('server', 'index.js'), distFile('server', 'index.mjs')];
const allEntries = [...serverEntries, distFile('admin', 'index.js'), distFile('admin', 'index.mjs')];
const restartTrigger = path.resolve(__dirname, '..', 'config', 'plugins.js');

const POLL_INTERVAL_MS = 500;
const SETTLE_MS = 1000;
// Roughly how long `strapi develop` needs to restart before it watches files again.
const RESTART_WINDOW_MS = 15000;
const log = (message) => console.log(`[playground] ${message}`);

const latestMtime = (files) =>
	files.reduce((latest, file) => {
		try {
			return Math.max(latest, fs.statSync(file).mtimeMs);
		} catch {
			return latest;
		}
	}, 0);

const allExist = (files) => files.every((file) => fs.existsSync(file));

const wait = () => {
	log('Waiting for the plugin build in dist/ ...');
	let lastChange = 0;
	let lastMtime = 0;

	const timer = setInterval(() => {
		if (!allExist(allEntries)) {
			return;
		}

		const mtime = latestMtime(allEntries);
		if (mtime !== lastMtime) {
			lastMtime = mtime;
			lastChange = Date.now();
			return;
		}

		// Only continue once the build output has stopped changing.
		if (Date.now() - lastChange >= SETTLE_MS) {
			clearInterval(timer);
			log('Plugin build found, starting Strapi');
		}
	}, POLL_INTERVAL_MS);
};

const watch = () => {
	let lastSeen = latestMtime(serverEntries);
	let debounceTimer = null;
	let retryTimer = null;
	let lastTouch = 0;

	const touchRestartTrigger = (message) => {
		try {
			const now = new Date();
			fs.utimesSync(restartTrigger, now, now);
			lastTouch = now.getTime();
			log(message);
		} catch (error) {
			log(`Could not trigger a Strapi restart: ${error.message}`);
		}
	};

	setInterval(() => {
		const current = latestMtime(serverEntries);
		if (current === 0 || current === lastSeen) {
			return;
		}

		// The first build is picked up by Strapi on startup, no restart needed.
		const isFirstBuild = lastSeen === 0;
		lastSeen = current;
		if (isFirstBuild) {
			return;
		}

		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			// Strapi only starts watching files once it has fully booted. A touch while it is
			// still restarting would be missed, so touch once more after the restart window.
			const restartInProgress = Date.now() - lastTouch < RESTART_WINDOW_MS;
			touchRestartTrigger('Plugin server code rebuilt, restarting Strapi');
			if (restartInProgress) {
				clearTimeout(retryTimer);
				retryTimer = setTimeout(
					() => touchRestartTrigger('Restarting Strapi again to make sure it runs the latest build'),
					RESTART_WINDOW_MS
				);
			}
		}, SETTLE_MS);
	}, POLL_INTERVAL_MS);

	log('Watching dist/server for plugin rebuilds');
};

const command = process.argv[2];
if (command === 'wait') {
	wait();
} else if (command === 'watch') {
	watch();
} else {
	console.error('Usage: node plugin-build.js <wait|watch>');
	process.exit(1);
}
