/**
 * Issue #212: admin users may only manage actions of content types they can publish, and only see
 * actions of content types they can read. The test users can only work with articles.
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { ARTICLE_UID, HOMEPAGE_UID, NO_PUBLISH_USER, PUBLISHER_USER } = require('../lib/config');
const { api, request } = require('../lib/client');
const {
	actionData,
	futureExecuteAt,
	getDraftArticle,
	getHomepage,
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
});
