/**
 * Schedules real publish and unpublish actions and waits until the plugin executes them. The tests
 * build on each other (publish, then unpublish, then check the hooks), so they run in order.
 */
const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const { ARTICLE_UID, HOMEPAGE_UID } = require('../lib/config');
const { api, waitFor } = require('../lib/client');
const { getLogs } = require('../lib/app');
const { actionData, getDraftArticle, getArticleStatus, getHomepage } = require('../lib/fixtures');

// Soon enough to keep the test fast, late enough to be scheduled instead of executed right away.
const ACTION_DELAY_MS = 5000;

const scheduleAction = async (mode, entityId, entitySlug) => {
	const { data } = await api(
		'POST',
		'/publisher/actions',
		actionData(mode, entityId, entitySlug, ACTION_DELAY_MS)
	);
	assert.ok(
		data?.documentId,
		`Creating a ${mode} action for ${entitySlug} did not return a documentId`
	);
	return data;
};

describe('Scheduling', () => {
	let article;
	let homepage;

	before(async () => {
		article = await getDraftArticle();
		homepage = await getHomepage();
	});

	it('publishes a collection type and a single type on schedule and removes the actions', async () => {
		const articleAction = await scheduleAction('publish', article.documentId, ARTICLE_UID);
		const homepageAction = await scheduleAction('publish', homepage.documentId, HOMEPAGE_UID);

		await waitFor(
			'the article to be published',
			async () => (await getArticleStatus(article.documentId)) === 'published'
		);
		await waitFor('the homepage to be published', async () => {
			const { data } = await api(
				'GET',
				`/content-manager/single-types/${HOMEPAGE_UID}?status=published`
			);
			return Boolean(data?.publishedAt);
		});

		const { data: remaining } = await api('GET', '/publisher/actions');
		const executedIds = [articleAction.documentId, homepageAction.documentId];
		assert.deepEqual(
			remaining.filter((action) => executedIds.includes(action.documentId)),
			[],
			'Executed publish actions were not removed'
		);
	});

	it('unpublishes an entry on schedule', async () => {
		await scheduleAction('unpublish', article.documentId, ARTICLE_UID);
		await waitFor(
			'the article to be unpublished',
			async () => (await getArticleStatus(article.documentId)) === 'draft'
		);
	});

	it('calls the before and after publish and unpublish hooks', async () => {
		// afterUnpublish runs just after the status change, so give the log line a moment to arrive.
		const hooks = ['beforePublish', 'afterPublish', 'beforeUnpublish', 'afterUnpublish'];
		const missingHooks = () => hooks.filter((hook) => !getLogs().includes(`[playground] ${hook}`));
		await waitFor('the publisher hooks to log', () => missingHooks().length === 0, 10000).catch(
			() => {
				throw new Error(`These hooks did not run: ${missingHooks().join(', ')}`);
			}
		);
	});
});
