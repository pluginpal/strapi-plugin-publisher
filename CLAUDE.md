# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`strapi-plugin-publisher` is a Strapi **v5** plugin (v2.x of the package; v1.x is Strapi v4) that schedules publishing and unpublishing of any content type with draft & publish enabled. Plugin id is `publisher` (from `package.json` → `strapi.name`), so the content-type UID is `plugin::publisher.action`.

## Commands

Use **Yarn 4** (`.yarn/releases`, `nodeLinker: node-modules`; a global Yarn 1 delegates to it via `yarnPath`), Node 22 for development (`.nvmrc`, CI; `@strapi/sdk-plugin` 6 needs it). The published plugin still supports Node 20–24 (`engines`).

- `yarn develop` — builds/watches the plugin and runs the playground Strapi app at http://localhost:1337/admin (login `admin@playground.test` / `Playground123!`)
- `yarn build` — `strapi-plugin build` into `dist/` (this is what CI publishes)
- `yarn watch` / `yarn watch:link` — watch build; `watch:link` publishes to Yalc for testing in an external Strapi project
- `yarn lint` — `eslint . --fix`; `yarn lint:check` lints without fixing (used by CI). `dist/` and generated playground files are in `.eslintignore`
- `yarn format` — Prettier
- `yarn playground:reset` — delete the playground SQLite DB (`playground/.tmp`)
- `yarn playground:strapi <cmd>` — run any Strapi CLI command in the playground
- `yarn verify` — `strapi-plugin verify`: checks the built package before publishing
- `yarn consumer-test --dir <empty folder outside the repo> [--strapi minimum|current|<version>] [--clean] [--tarball <tgz>]` — packs the plugin, creates a fresh Strapi app with its own npm-installed `node_modules` (plugin from the tarball, playground config/content types, `npm install --before` = 7-day cooldown) and runs the smoke test against it; catches packaging, undeclared-dependency and Strapi-version issues the playground can't
- `yarn playground:smoke [--skip-build] [--app <dir>]` — end-to-end smoke test (needs `yarn build`; `playground/scripts/smoke-test/`, Node's built-in `node:test`): builds the playground admin, starts it once on port 1339 with its own DB (`playground/.tmp/smoke-test.db`) and admin, then runs `tests/endpoints.js`, `tests/scheduling.js` (publish/unpublish actions for Article and Homepage run, are removed and call all four hooks) and `tests/permissions.js` (issue #212: a user without publish permission gets 403s and a filtered list; a non-super-admin who may publish articles can manage article actions but not homepage actions). Shared helpers live in `lib/` (`config`, `app` = build/start/stop, `client` = HTTP, `fixtures`). Test files are required from `index.js` instead of run with `node --test`, so Strapi starts only once. Run part of it with `node --test-reporter=spec --test-name-pattern="Permissions" playground/scripts/smoke-test`

There is no unit test suite. CI (`.github/workflows/ci.yml`) runs `yarn install --immutable`, lint, build, `verify`, `npm pack`, the playground smoke test and the consumer test (Node 20 + Strapi minimum, Node 24 + Strapi current) on every PR. The publish workflow uses `npm version`/`npm publish` (Yarn 4 has no `yarn publish`).

## Dependency cooldown

Only use dependency versions published at least 7 days ago. Yarn enforces this during resolution via `npmMinimalAgeGate: 7d` in `.yarnrc.yml` (also for transitive deps); it does not re-check entries already in `yarn.lock`. For urgent updates (e.g. security fixes), add the exact `name@version` to `npmPreapprovedPackages` in `.yarnrc.yml` with a comment explaining why, and remove it once the version is older than 7 days. Dependabot (`.github/dependabot.yml`) uses the same 7-day cooldown and ignores majors that must match the Strapi admin (react, react-dom, react-router-dom, react-intl, react-query, yup, styled-components) and ESLint/Babel majors (pending flat-config migration).

## Playground

`playground/` is a small Strapi app with realistic content, seeded as drafts (plus an auto-created super admin) in `playground/src/index.js`. All of it is draft & publish except Author and Category:
- **Article** (collection type): a **required** manyToOne relation to Author, a manyToMany relation to Categories, a required `shared.seo` component and a `blocks` dynamic zone. Keep `author` required: it is the regression coverage for scheduling entries with a filled required to-one relation (#240). The seeded "Incomplete article" is missing required fields (author, SEO), so scheduling it to be published shows validation errors.
- **Homepage** (single type): a required `blocks.hero` component (with a nested `shared.link`), a `sections` dynamic zone and SEO.
- **Page** (collection type, i18n `en` + `nl`): localized SEO, sections and a repeatable FAQ component. The seed creates the `nl` locale, two pages in both locales and "Nieuws" in `nl` only. Use it to test locale-restricted publish permissions.
- **Author** and **Category**: relation targets without draft & publish.
- Components live in `playground/src/components/{shared,blocks}`. `blocks.media` has a required media field, to test media validation.
- The seed only runs on an empty database; run `yarn playground:reset` after changing it.

- Its dependencies live in the **root** `package.json`; never run `yarn install` inside `playground/` (plugin and app must share one copy of Strapi/React).
- `playground/config/plugins.js` loads the plugin via `resolve:` an absolute path to the repo root, so Strapi uses the root `exports` → **`dist/`**, not the source. Changes only take effect after `strapi-plugin watch` rebuilds.
- `playground/scripts/plugin-build.js`: `wait` blocks Strapi startup until `dist/` exists and has settled; `watch` restarts Strapi on server rebuilds by touching `playground/config/plugins.js` (`strapi develop` doesn't watch `dist/`). Admin changes are hot-reloaded by Vite.
- The playground is excluded from the npm package via `.npmignore`.

## Architecture

Two halves, each built by `@strapi/sdk-plugin` from the entry points in `package.json` `exports`: `server/index.js` (JS) and `admin/src/index.ts` (TS/React).

### Server: how a scheduled action flows

1. **Storage** — Each schedule is an `action` document (`server/content-types/action-content-type`, table `actions`, hidden from Content Manager/CTB) with `executeAt`, `mode` (`publish` | `unpublish`), `entityId` (target `documentId`), `entitySlug` (target UID).
2. **API** — Admin and content-api routes both expose CRUD on `/actions` using the core controller (`factories.createCoreController`). Content-api access is managed by Users & Permissions / API tokens. Admin routes are open to every admin user, so they are restricted to the user's Content Manager permissions on the target content type (issue #212): the policy `plugin::publisher.can-manage-action` (`server/policies`) requires **publish** permission (incl. conditions and the action's locale) for POST/PUT/DELETE, and the route middleware `plugin::publisher.limit-to-readable-content-types` limits GET to content types the user can read. Both use `permissionService`. Admin also has `GET /settings` returning the plugin config (used by the admin UI for `contentTypes` whitelist and date picker options).
3. **Validation before scheduling** — `server/register.js` registers a **Document Service middleware** (`server/middlewares/validate-before-scheduling.js`). On create/update of a `publish` action it loads the target draft (deep-populated) and runs Strapi's entity validator plus a custom required-media/relation/component/dynamic-zone check, throwing a `ValidationError` so the admin can show field errors *at scheduling time* rather than failing silently later.
4. **Scheduling** — `server/services/action-service.js` extends the core service: `create`/`update`/`delete` add/replace/remove a one-off `strapi.cron` job named `publisherAction_<documentId>` that fires at `executeAt`. On boot, `server/config/cron-tasks.js` (called from `bootstrap`, deferred with `setImmediate`) loads all actions, immediately executes overdue ones, and schedules future ones. The `actions.syncFrequency` config option is still in the defaults/schema but is no longer used by this per-action mechanism.
5. **Execution** — `publicationService.toggle(record, mode)` compares published vs draft versions (publishes if never published or draft is newer; unpublishes if published), then **deletes the action**. `publish`/`unpublish` call the user's `before*` hooks (returning `false` aborts), use `strapi.documents(uid).publish/unpublish`, optionally overwrite `publishedAt` with `executeAt` via `strapi.db.query`, emit `entry.publish`/`entry.unpublish` on the eventHub (`emitService`, so webhooks fire), then call `after*` hooks. Errors are logged, not thrown.

Helpers: always get services through `getPluginService(name)` and prefix logs with `logMessage()` (`[strapi-plugin-publisher]: ...`). `strapi` is a global (declared readonly in ESLint).

Multi-instance deployments will execute the same action on every node (issue #194); the `before*` hook returning `false` is the documented coordination escape hatch — keep that contract intact.

### Admin

- `admin/src/index.ts` registers the plugin and, in `bootstrap`, adds `ActionManager` as a Content Manager **edit-view side panel**.
- `ActionManager` hides itself for types without draft & publish, while creating a new entry, or when the type isn't in the `contentTypes` setting; it renders one `Action` per mode (publish/unpublish), keyed by locale from the `plugins[i18n][locale]` query param.
- `hooks/usePublisher.tsx` wraps the `/publisher/actions` endpoints with react-query + `useFetchClient`; on a `ValidationError` response it pushes errors into the Content Manager edit form (`useForm('PublishAction', ...)`) so fields get highlighted.
- Translations in `admin/src/translations/{en,de,fr,nl}.json`; keys are prefixed with the plugin id via `getTrad()`.

## Conventions

- Tabs for indentation, single quotes, semicolons, LF, print width 100 (`.prettierrc.json`, root `.eslintrc.js`). ESLint config splits into `.eslintrc.backend.js` (server, Node) and `.eslintrc.frontend.js` (admin, React).
- Conventional Commits (`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`).
- Releases: publishing a GitHub release triggers `.github/workflows/npm-publish.yml`, which builds, sets `package.json` version from the tag (pre-release suffix → npm dist-tag), publishes, and commits the version bump back. Don't bump the version manually in PRs.
- When changing plugin config options, update both `server/config/index.js` (defaults) and `server/config/schema.js` (yup validator), plus the README config table.
