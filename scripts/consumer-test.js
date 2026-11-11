/**
 * Consumer test: install the plugin the way users do and run the smoke test against it.
 *
 *   node scripts/consumer-test.js --dir <folder outside this repository> [--strapi <version>]
 *
 * Unlike the playground, which loads the plugin straight from this repository and shares its
 * node_modules, this test:
 *   1. builds the plugin and packs it with `npm pack`, exactly what gets published to npm;
 *   2. creates a fresh Strapi app in --dir (same config, content types and seed as the
 *      playground) that installs the plugin from that tarball with its own node_modules;
 *   3. installs the app with npm, only using versions published at least COOLDOWN_DAYS ago;
 *   4. runs playground/scripts/smoke-test.js against that app.
 *
 * That catches files missing from the npm package, dependencies the plugin uses but doesn't
 * declare, and incompatibilities with other Strapi or Node.js versions.
 *
 * Options:
 *   --dir <path>        Folder for the test app. Must be outside this repository, otherwise
 *                       Node.js would still find the repository's node_modules. Created if it
 *                       doesn't exist; it is reused (and cleaned) on the next run.
 *   --strapi <version>  Strapi version to test with: an exact version, `minimum` (the lowest
 *                       version the peerDependencies allow) or `current` (default: the version
 *                       in devDependencies)
 *   --tarball <path>    Use an already packed plugin instead of building and packing it
 *   --clean             Also remove the app's node_modules for a completely fresh install
 *
 * Environment:
 *   COOLDOWN_DAYS       Only install versions at least this many days old (default 7)
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const playgroundDir = path.join(repoRoot, 'playground');
const MARKER = '.publisher-consumer-test';
const COOLDOWN_DAYS = Number(process.env.COOLDOWN_DAYS || 7);

const getArg = (name) => {
	const index = process.argv.indexOf(name);
	return index > -1 ? process.argv[index + 1] : undefined;
};

const run = (command, args, options = {}) => {
	const result = spawnSync(command, args, { stdio: 'inherit', shell: process.platform === 'win32', ...options });
	if (result.status !== 0) {
		throw new Error(`\`${command} ${args.join(' ')}\` failed`);
	}
	return result;
};

const step = (message) => console.log(`\n▶ ${message}`);

const rootPackage = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
const playgroundPackage = JSON.parse(fs.readFileSync(path.join(playgroundDir, 'package.json'), 'utf8'));

const appDir = path.resolve(getArg('--dir') || path.join(os.tmpdir(), 'publisher-consumer-test'));
const resolveStrapiVersion = (requested = 'current') => {
	if (requested === 'current') return rootPackage.devDependencies['@strapi/strapi'];
	if (requested === 'minimum') {
		const minimum = rootPackage.peerDependencies['@strapi/strapi'].match(/\d+\.\d+\.\d+/)?.[0];
		if (!minimum) throw new Error('Could not read the minimum @strapi/strapi version from peerDependencies.');
		return minimum;
	}
	return requested;
};
const strapiVersion = resolveStrapiVersion(getArg('--strapi'));
const tarballArg = getArg('--tarball');
const nodeMajor = Number(process.versions.node.split('.')[0]);

/**
 * Make sure we only ever clean a folder this script created.
 */
const prepareAppDir = () => {
	const relative = path.relative(repoRoot, appDir);
	if (!relative.startsWith('..') && !path.isAbsolute(relative)) {
		throw new Error(`--dir must be outside the repository (got ${appDir}).`);
	}

	fs.mkdirSync(appDir, { recursive: true });
	const entries = fs.readdirSync(appDir).filter((entry) => entry !== '.DS_Store');
	if (entries.length && !entries.includes(MARKER)) {
		throw new Error(`${appDir} is not empty and was not created by this script. Use an empty folder.`);
	}

	const keep = new Set([MARKER, ...(process.argv.includes('--clean') ? [] : ['node_modules'])]);
	for (const entry of entries) {
		if (!keep.has(entry)) {
			fs.rmSync(path.join(appDir, entry), { recursive: true, force: true });
		}
	}
	// Always reinstall the plugin itself from the new tarball.
	fs.rmSync(path.join(appDir, 'node_modules', 'strapi-plugin-publisher'), { recursive: true, force: true });
	fs.writeFileSync(path.join(appDir, MARKER), 'Created by strapi-plugin-publisher scripts/consumer-test.js\n');
};

const packPlugin = () => {
	if (tarballArg) {
		const filename = path.basename(tarballArg);
		fs.copyFileSync(path.resolve(tarballArg), path.join(appDir, filename));
		step(`Using the packed plugin ${filename}`);
		return filename;
	}

	step('Building and packing the plugin');
	run('yarn', ['build'], { cwd: repoRoot });
	const result = spawnSync('npm', ['pack', '--json', '--pack-destination', appDir], {
		cwd: repoRoot,
		encoding: 'utf8',
		shell: process.platform === 'win32',
	});
	if (result.status !== 0) {
		throw new Error(`npm pack failed:\n${result.stderr}`);
	}
	const [{ filename, files }] = JSON.parse(result.stdout);
	console.log(`  ✔ ${filename} (${files.length} files)`);
	return filename;
};

const createApp = (tarball) => {
	step(`Creating a Strapi ${strapiVersion} app in ${appDir}`);

	fs.cpSync(path.join(playgroundDir, 'src'), path.join(appDir, 'src'), { recursive: true });
	fs.cpSync(path.join(playgroundDir, 'config'), path.join(appDir, 'config'), { recursive: true });
	fs.mkdirSync(path.join(appDir, 'public', 'uploads'), { recursive: true });

	// Same hooks as the playground, but the plugin comes from node_modules instead of `resolve`.
	fs.writeFileSync(
		path.join(appDir, 'config', 'plugins.js'),
		`const log = (hook) => async ({ strapi, uid, entity }) => {
	strapi.log.info(\`[playground] \${hook} \${uid} \${entity?.documentId}\`);
};

module.exports = () => ({
	publisher: {
		enabled: true,
		config: {
			hooks: {
				beforePublish: log('beforePublish'),
				afterPublish: log('afterPublish'),
				beforeUnpublish: log('beforeUnpublish'),
				afterUnpublish: log('afterUnpublish'),
			},
		},
	},
});
`
	);

	const appPackage = {
		name: 'publisher-consumer-test',
		private: true,
		version: '0.0.0',
		scripts: { develop: 'strapi develop', start: 'strapi start', build: 'strapi build' },
		dependencies: {
			'@strapi/strapi': strapiVersion,
			'@strapi/plugin-users-permissions': strapiVersion,
			// better-sqlite3 13 needs Node.js 22+
			'better-sqlite3': nodeMajor >= 22 ? rootPackage.devDependencies['better-sqlite3'] : '^12.4.1',
			react: playgroundPackage.dependencies.react,
			'react-dom': playgroundPackage.dependencies['react-dom'],
			'react-router-dom': playgroundPackage.dependencies['react-router-dom'],
			'styled-components': playgroundPackage.dependencies['styled-components'],
			'strapi-plugin-publisher': `file:./${tarball}`,
		},
		strapi: { uuid: 'publisher-consumer-test', telemetryDisabled: true },
	};
	fs.writeFileSync(path.join(appDir, 'package.json'), `${JSON.stringify(appPackage, null, 2)}\n`);
};

const installApp = () => {
	const before = new Date(Date.now() - COOLDOWN_DAYS * 24 * 60 * 60 * 1000).toISOString();
	step(`Installing the app with npm (only versions published before ${before})`);
	run('npm', ['install', '--no-audit', '--no-fund', '--before', before], { cwd: appDir });

	const installed = (name) => JSON.parse(fs.readFileSync(path.join(appDir, 'node_modules', name, 'package.json'), 'utf8')).version;
	console.log(
		`  ✔ Node.js ${process.versions.node}, @strapi/strapi ${installed('@strapi/strapi')}, ` +
			`strapi-plugin-publisher ${installed('strapi-plugin-publisher')}`
	);
};

const main = () => {
	prepareAppDir();
	const tarball = packPlugin();
	createApp(tarball);
	installApp();

	step('Running the smoke test against the app');
	const smoke = spawnSync(process.execPath, [path.join(playgroundDir, 'scripts', 'smoke-test.js'), '--app', appDir], {
		stdio: 'inherit',
	});
	process.exit(smoke.status ?? 1);
};

try {
	main();
} catch (error) {
	console.error(`\n❌ Consumer test failed: ${error.message}`);
	process.exit(1);
}
