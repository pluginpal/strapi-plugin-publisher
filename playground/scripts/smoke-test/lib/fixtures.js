/**
 * Test data: entries seeded by playground/src/index.js, scheduled actions and limited admin users.
 */
const assert = require('node:assert/strict');
const { ARTICLE_UID, HOMEPAGE_UID } = require('./config');
const { api } = require('./client');

/** A date far in the future, so the action doesn't run during the test. */
const futureExecuteAt = () => new Date(Date.now() + 60 * 60 * 1000).toISOString();

/** Request body for POST /publisher/actions, executed after `delayMs` (default: far in the future). */
const actionData = (mode, entityId, entitySlug, delayMs) => ({
	data: {
		mode,
		entityId,
		entitySlug,
		executeAt:
			delayMs === undefined ? futureExecuteAt() : new Date(Date.now() + delayMs).toISOString(),
	},
});

const getArticles = async () => {
	const { results } = await api(
		'GET',
		`/content-manager/collection-types/${ARTICLE_UID}?pageSize=100`
	);
	return results;
};

const getDraftArticle = async () => {
	const article = (await getArticles()).find((entry) => entry.status === 'draft');
	assert.ok(article, 'No draft article found (the playground seed should create one)');
	return article;
};

const getArticleStatus = async (documentId) =>
	(await getArticles()).find((article) => article.documentId === documentId)?.status;

const getHomepage = async () => {
	const { data: homepage } = await api('GET', `/content-manager/single-types/${HOMEPAGE_UID}`);
	assert.ok(homepage?.documentId, 'No homepage found (the playground seed should create one)');
	return homepage;
};

/**
 * Creates and registers an admin user with a new role that has the given Content Manager actions
 * on articles only, and returns their token.
 */
const createArticleUser = async ({ email, password }, roleName, actions) => {
	const { data: role } = await api('POST', '/admin/roles', {
		name: roleName,
		description: 'Smoke test',
	});
	await api('PUT', `/admin/roles/${role.id}/permissions`, {
		permissions: actions.map((action) => ({
			action: `plugin::content-manager.explorer.${action}`,
			subject: ARTICLE_UID,
			properties: action === 'publish' ? {} : { fields: ['title', 'content'] },
			conditions: [],
		})),
	});
	const { data: user } = await api('POST', '/admin/users', {
		email,
		firstname: 'Smoke',
		lastname: 'Test',
		roles: [role.id],
	});
	const { data: registration } = await api('POST', '/admin/register', {
		registrationToken: user.registrationToken,
		userInfo: { firstname: 'Smoke', lastname: 'Test', password },
	});
	assert.ok(registration?.token, `Registering ${email} did not return a token`);
	return registration.token;
};

module.exports = {
	futureExecuteAt,
	actionData,
	getDraftArticle,
	getArticleStatus,
	getHomepage,
	createArticleUser,
};
