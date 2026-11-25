/**
 * Issue #212: admin users may only manage actions of content types they can publish (including the
 * locales they can publish), and only see actions of content types they can read. The test users
 * can only work with articles, or with Dutch pages.
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const {
	ARTICLE_UID,
	HOMEPAGE_UID,
	PAGE_UID,
	NO_PUBLISH_USER,
	PUBLISHER_USER,
	DUTCH_PAGE_PUBLISHER_USER,
} = require('../lib/config');
const { api, request } = require('../lib/client');
const {
	actionData,
	futureExecuteAt,
	getDraftArticle,
	getHomepage,
	getPage,
	createUser,
	contentManagerPermissions,
	createArticleUser,
} = require('../lib/fixtures');

describe('Permissions (#212)', () => {
	let article;
	let homepage;

	before(async () => {
		article = await getDraftArticle();
		homepage = await getHomepage();
	});

	describe('user without publish permission', () => {
		let userToken;
		let articleAction;
		let homepageAction;

		before(async () => {
			userToken = await createArticleUser(NO_PUBLISH_USER, 'Smoke test no publish', [
				'create',
				'read',
				'update',
			]);
			// Created by the super admin, so there is something to update, delete and list.
			({ data: articleAction } = await api(
				'POST',
				'/publisher/actions',
				actionData('unpublish', article.documentId, ARTICLE_UID)
			));
			({ data: homepageAction } = await api(
				'POST',
				'/publisher/actions',
				actionData('unpublish', homepage.documentId, HOMEPAGE_UID)
			));
		});

		after(async () => {
			await api('DELETE', `/publisher/actions/${articleAction.documentId}`);
			await api('DELETE', `/publisher/actions/${homepageAction.documentId}`);
		});

		it('cannot schedule publish or unpublish actions', async () => {
			for (const mode of ['publish', 'unpublish']) {
				const { status } = await request(
					'POST',
					'/publisher/actions',
					actionData(mode, article.documentId, ARTICLE_UID),
					userToken
				);
				assert.equal(status, 403, `Scheduling a ${mode} action returned ${status}`);
			}
		});

		it('cannot update or delete actions', async () => {
			const url = `/publisher/actions/${articleAction.documentId}`;
			const update = await request(
				'PUT',
				url,
				{ data: { executeAt: futureExecuteAt() } },
				userToken
			);
			assert.equal(update.status, 403, `Updating an action returned ${update.status}`);
			const remove = await request('DELETE', url, undefined, userToken);
			assert.equal(remove.status, 403, `Deleting an action returned ${remove.status}`);
		});

		it('only sees actions of content types they can read', async () => {
			const { data: visible } = await api('GET', '/publisher/actions', undefined, userToken);
			const visibleIds = visible.map((action) => action.documentId);
			assert.ok(visibleIds.includes(articleAction.documentId), 'The article action is not listed');
			assert.ok(!visibleIds.includes(homepageAction.documentId), 'The homepage action is listed');
		});
	});

	describe('user with publish permission on articles', () => {
		let userToken;

		before(async () => {
			userToken = await createArticleUser(PUBLISHER_USER, 'Smoke test publisher', [
				'create',
				'read',
				'update',
				'publish',
			]);
		});

		it('can schedule, update, list and delete article actions', async () => {
			const { data: action } = await api(
				'POST',
				'/publisher/actions',
				actionData('publish', article.documentId, ARTICLE_UID),
				userToken
			);
			assert.ok(action?.documentId, 'Scheduling an article action did not return a documentId');

			await api(
				'PUT',
				`/publisher/actions/${action.documentId}`,
				{ data: { executeAt: futureExecuteAt() } },
				userToken
			);
			const { data: visible } = await api('GET', '/publisher/actions', undefined, userToken);
			assert.ok(
				visible.some((entry) => entry.documentId === action.documentId),
				'The article action is not listed'
			);
			await api('DELETE', `/publisher/actions/${action.documentId}`, undefined, userToken);
		});

		it('cannot schedule actions for content types they cannot publish', async () => {
			const { status } = await request(
				'POST',
				'/publisher/actions',
				actionData('publish', homepage.documentId, HOMEPAGE_UID),
				userToken
			);
			assert.equal(status, 403, `Scheduling a homepage action returned ${status}`);
		});
	});

	describe('user who may only publish Dutch pages', () => {
		let userToken;
		let page;
		let action;

		// "About us" ("Over ons" in nl) exists in en and nl; both locales share the documentId.
		const pageActionData = (locale) => {
			const body = actionData('unpublish', page.documentId, PAGE_UID);
			body.data.locale = locale;
			return body;
		};

		before(async () => {
			page = await getPage('Over ons', 'nl');
			userToken = await createUser(
				DUTCH_PAGE_PUBLISHER_USER,
				'Smoke test Dutch pages',
				contentManagerPermissions(PAGE_UID, ['read', 'publish'], {
					fields: ['title'],
					locales: ['nl'],
				})
			);
		});

		after(async () => {
			if (action) await api('DELETE', `/publisher/actions/${action.documentId}`);
		});

		it('can schedule and find an action for the Dutch page', async () => {
			({ data: action } = await api('POST', '/publisher/actions', pageActionData('nl'), userToken));
			assert.ok(action?.documentId, 'Scheduling a Dutch page action did not return a documentId');

			// Like the admin side panel: the readable content types and the locale are both filters.
			const query = new URLSearchParams({
				'filters[mode]': 'unpublish',
				'filters[entityId]': page.documentId,
				'filters[entitySlug]': PAGE_UID,
				locale: 'nl',
			});
			const { data: found } = await api('GET', `/publisher/actions?${query}`, undefined, userToken);
			assert.deepEqual(
				found.map((entry) => entry.documentId),
				[action.documentId]
			);
		});

		it('cannot schedule an action for the English page', async () => {
			const { status } = await request(
				'POST',
				'/publisher/actions',
				pageActionData('en'),
				userToken
			);
			assert.equal(status, 403, `Scheduling an English page action returned ${status}`);
		});

		it('cannot move its action to the English page', async () => {
			assert.ok(action, 'The Dutch page action was not created');
			const { status } = await request(
				'PUT',
				`/publisher/actions/${action.documentId}`,
				{ data: { locale: 'en' } },
				userToken
			);
			assert.equal(status, 403, `Moving the action to English returned ${status}`);
		});
	});
});
