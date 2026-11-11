# Contributing to Strapi Publisher Plugin

We appreciate your interest in contributing to the **Strapi Publisher Plugin**! 🚀
This document outlines the guidelines for contributing to this project.

## 🏛 Community Guidelines
We strive to maintain a welcoming and inclusive environment. Please be respectful and follow the [Contributor Covenant Code of Conduct](https://www.contributor-covenant.org/).

---

## 🔧 Development Workflow
This repository contains a **playground**: a small Strapi app in the [`playground`](./playground) folder that loads the plugin straight from this repository. You don't need a separate Strapi project or Yalc to test your changes.

### 1️⃣ Fork the repository
[Go to the repository](https://github.com/pluginpal/strapi-plugin-publisher) and fork it to your own GitHub account.

### 2️⃣ Clone your fork
```bash
git clone git@github.com:YOUR_USERNAME/strapi-plugin-publisher.git
```

### 3️⃣ Install dependencies
Navigate into the project directory and install dependencies:
```bash
cd strapi-plugin-publisher && yarn install
```
The repository uses **Yarn 4**, which is committed in `.yarn/releases`. Any globally installed `yarn` (also Yarn 1) automatically switches to it, or run `corepack enable` once.
This also installs everything the playground needs. Don't run `yarn install` inside the `playground` folder: the plugin and the playground have to share a single copy of Strapi and React.

### 4️⃣ Start the playground
```bash
yarn develop
```
This single command:
- builds the plugin and rebuilds it on every change (`strapi-plugin watch`);
- starts the playground with `strapi develop` once the first build is ready;
- restarts Strapi when the plugin's **server** code is rebuilt. **Admin** changes are reloaded by the admin dev server.

Open [http://localhost:1337/admin](http://localhost:1337/admin) and log in with the super admin that is created on the first start:

| Email | Password |
|-------|----------|
| `admin@playground.test` | `Playground123!` |

The playground comes with an **Article** collection type and a **Homepage** single type, both with draft & publish enabled and seeded with draft content, so you can schedule (un)publish actions right away. The publisher hooks in [`playground/config/plugins.js`](./playground/config/plugins.js) log every (un)publish to the terminal.

### 🛠 Playground commands
| Command | Description |
|---------|-------------|
| `yarn develop` | Build/watch the plugin and run the playground |
| `yarn playground:reset` | Delete the playground database (`playground/.tmp`) to start fresh |
| `yarn playground:strapi <command>` | Run any Strapi CLI command in the playground, e.g. `yarn playground:strapi console` |
| `yarn playground:smoke` | Run the end-to-end smoke test (needs `yarn build` first, see below) |

To change the port or the admin credentials, copy `playground/.env.example` to `playground/.env`. The admin credentials are only used when the database has no admin user yet, so run `yarn playground:reset` after changing them.

### 🔗 Testing in your own Strapi project (optional)
To test the plugin in another Strapi project, you can still use [Yalc](https://github.com/wclr/yalc). Install it globally first:
```bash
npm i -g yalc
```
Then run this in the plugin repository:
```bash
yarn watch:link
```
and in your Strapi project:
```bash
npx yalc add --link strapi-plugin-publisher && yarn install && yarn develop
```

---

## ✅ Commit Message Convention
We follow the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) format:
- `fix`: Bug fixes (e.g., `fix: resolve issue with publish scheduling`)
- `feat`: New features (e.g., `feat: add new logging system`)
- `refactor`: Code improvements without functional changes
- `docs`: Documentation updates
- `chore`: Tooling or maintenance changes

Example:
```bash
git commit -m "feat: add support for multiple publish schedules"
```

---

## 🔍 Checks
Every pull request runs the [CI workflow](./.github/workflows/ci.yml). You can run the same checks locally:

| Command | Description |
|---------|-------------|
| `yarn lint:check` | Run ESLint without changing files (what CI runs) |
| `yarn lint` | Run ESLint and auto-fix issues |
| `yarn test` | Run the unit tests (Vitest, a few seconds). `yarn test:watch` reruns them on changes, `yarn test:coverage` adds a coverage report |
| `yarn build` | Build the plugin into `dist/` |
| `yarn verify` | Check the built package (`package.json` exports and files) before publishing |
| `yarn playground:smoke` | Build the playground admin with the plugin, start it on port 1339 with a separate database, schedule publish/unpublish actions for a collection type and a single type, and check that they run and that all hooks are called. Add `--skip-build` to skip the admin build. Your own playground database is not touched. |

### 📦 Consumer test
The playground loads the plugin straight from this repository and shares its `node_modules`. To test the plugin the way users install it, run:
```bash
yarn consumer-test --dir ../plugin-test/strapi-publisher
```
This builds and packs the plugin with `npm pack`, creates a fresh Strapi app in that folder with the plugin installed from the tarball (its own `node_modules`, installed with npm), and runs the smoke test against it. It catches files missing from the npm package, dependencies the plugin uses but doesn't declare, and incompatibilities with other Strapi versions.

- `--dir` must be an empty folder **outside** this repository (it is reused on the next run).
- `--strapi minimum` tests the lowest Strapi version allowed by `peerDependencies`; `--strapi current` (default) the version in `devDependencies`. An exact version also works.
- `--clean` also removes the app's `node_modules` for a fully fresh install.

CI runs the consumer test for the minimum Strapi version on Node.js 20 and the current Strapi version on Node.js 24.

### 🧪 Unit tests
The unit tests in [`tests/server`](./tests/server) test the server code without a running Strapi: [`tests/helpers/strapi.js`](./tests/helpers/strapi.js) provides a fake `strapi` object whose APIs are Vitest mocks. They cover what the publisher does with an action:
- **scheduling** (`action-service`): creating, rescheduling and cancelling an action adds, replaces and removes its cron job, and the cron job executes the latest version of the action;
- **executing** (`publication-service`): when an entry is (un)published, the `before*` hooks that can cancel it, the `after*` hooks, the `entry.publish`/`entry.unpublish` events, `publishedAt` set to the scheduled time, and removing the executed action;
- **startup** (`cron-tasks`): overdue actions are executed and future ones scheduled;
- **validation** (`validate-before-scheduling`): a publish action is refused when the entry is missing required fields, media, relations or component fields;
- **plugin setup**: config defaults and validation, routes, the settings endpoint and the action content type.

Add or update a test when you change one of these. The smoke test still checks that it all works together in a real Strapi.

### ⏳ Dependency cooldown
To reduce the risk of installing a freshly published, compromised or broken release, Yarn only installs dependency versions that have been on the npm registry for **at least 7 days** (`npmMinimalAgeGate` in [`.yarnrc.yml`](./.yarnrc.yml)). This also applies to transitive dependencies, and it protects your own machine because the check happens during `yarn install`. [Dependabot](./.github/dependabot.yml) also waits 7 days before proposing an update.

If `yarn add` or `yarn up` fails with `All versions satisfying "..." are quarantined`, the version is younger than 7 days: wait a few days, or pick an older version.

**Urgent updates.** If a dependency update can't wait (for example a security fix that was released today), add the exact version to `npmPreapprovedPackages` in [`.yarnrc.yml`](./.yarnrc.yml), with a comment explaining why:
```yaml
npmPreapprovedPackages:
  - "ws@8.22.2" # Fixes CVE-2026-1234, cannot wait 7 days
```
The exception only applies to that exact version and shows up in the pull request for review. Remove it once the version is older than 7 days.

---

## 📬 Submitting a Pull Request
> **First time contributing?** Check out [this guide](https://egghead.io/series/how-to-contribute-to-an-open-source-project-on-github).

### 🔹 Guidelines:
- Keep pull requests **small and focused on a single change**.
- Ensure the **checks pass** (`yarn lint:check`, `yarn test`, `yarn build` and `yarn playground:smoke`) before submitting.
- If updating the UI, include **screenshots**.
- Follow the **Pull Request Template** when submitting a PR.
- **Discuss major API changes** with maintainers by opening an issue first.

---

## 🐞 Reporting Bugs
If you find a bug, please **create an issue** on GitHub:
- **Clearly describe the problem**
- Include **steps to reproduce**
- Attach **screenshots/logs if possible**

[Create a new issue](https://github.com/pluginpal/strapi-plugin-publisher/issues/new).

---

## 💡 Feature Requests
If you have an idea for a **new feature**, open an issue and describe:
- **Why is this feature needed?**
- **How would it work?**

Feature requests should **align with the plugin's goals**.

---

Thank you for contributing! 🎉
