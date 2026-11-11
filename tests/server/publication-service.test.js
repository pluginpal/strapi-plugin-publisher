import { beforeEach, describe, expect, it, vi } from 'vitest';
import publicationService from '../../server/services/publication-service';
import { ACTION_UID, ARTICLE_UID, createConfig, createStrapi } from '../helpers/strapi';

const EXECUTE_AT = '2030-01-01T10:00:00.000Z';

/**
 * Let `findOne` return the given draft and published versions, like the Document Service does
 * for `status: 'draft'` / `status: 'published'`. Without a status it returns the draft.
 */
const mockVersions = (articles, { draft = null, published = null }) => {
	articles.findOne.mockImplementation(async ({ status }) =>
		status === 'published' ? published : draft
	);
};

describe('publication service', () => {
	let strapi;
	let config;
	let articles;
	let actions;
	let service;

	beforeEach(() => {
		({ strapi, config } = createStrapi({ config: createConfig() }));
		articles = strapi.documents(ARTICLE_UID);
		actions = strapi.documents(ACTION_UID);
		service = publicationService({ strapi });
	});

	describe('toggle (executing a scheduled action)', () => {
		const action = (mode, extra = {}) => ({
			documentId: 'action-1',
			mode,
			entityId: 'article-1',
			entitySlug: ARTICLE_UID,
			executeAt: EXECUTE_AT,
			...extra,
		});

		it('publishes a draft that was never published, with executeAt as publishedAt', async () => {
			mockVersions(articles, { draft: { documentId: 'article-1', updatedAt: '2029-12-01' } });
			const publish = vi.spyOn(service, 'publish').mockResolvedValue();

			await service.toggle(action('publish'), 'publish');

			expect(publish).toHaveBeenCalledWith(ARTICLE_UID, 'article-1', {
				publishedAt: new Date(EXECUTE_AT),
				locale: undefined,
			});
		});

		it('publishes when the draft is newer than the published version', async () => {
			mockVersions(articles, {
				draft: { updatedAt: '2029-12-02T00:00:00.000Z' },
				published: { updatedAt: '2029-12-01T00:00:00.000Z' },
			});
			const publish = vi.spyOn(service, 'publish').mockResolvedValue();

			await service.toggle(action('publish'), 'publish');

			expect(publish).toHaveBeenCalledOnce();
		});

		it('does not publish again when the published version is up to date', async () => {
			mockVersions(articles, {
				draft: { updatedAt: '2029-12-01T00:00:00.000Z' },
				published: { updatedAt: '2029-12-01T00:00:00.000Z' },
			});
			const publish = vi.spyOn(service, 'publish').mockResolvedValue();

			await service.toggle(action('publish'), 'publish');

			expect(publish).not.toHaveBeenCalled();
		});

		it('unpublishes a published entry', async () => {
			mockVersions(articles, {
				draft: { updatedAt: '2029-12-01' },
				published: { updatedAt: '2029-12-01' },
			});
			const unpublish = vi.spyOn(service, 'unpublish').mockResolvedValue();

			await service.toggle(action('unpublish', { locale: 'nl' }), 'unpublish');

			expect(unpublish).toHaveBeenCalledWith(ARTICLE_UID, 'article-1', { locale: 'nl' });
		});

		it('does nothing when unpublishing an entry that is not published', async () => {
			mockVersions(articles, { draft: { updatedAt: '2029-12-01' } });
			const unpublish = vi.spyOn(service, 'unpublish').mockResolvedValue();

			await service.toggle(action('unpublish'), 'unpublish');

			expect(unpublish).not.toHaveBeenCalled();
		});

		it('looks up the versions in the locale of the action', async () => {
			mockVersions(articles, { draft: { updatedAt: '2029-12-01' } });
			vi.spyOn(service, 'publish').mockResolvedValue();

			await service.toggle(action('publish', { locale: 'de' }), 'publish');

			expect(articles.findOne).toHaveBeenCalledWith({
				documentId: 'article-1',
				status: 'published',
				locale: 'de',
			});
			expect(articles.findOne).toHaveBeenCalledWith({
				documentId: 'article-1',
				status: 'draft',
				locale: 'de',
			});
			expect(service.publish).toHaveBeenCalledWith(
				ARTICLE_UID,
				'article-1',
				expect.objectContaining({ locale: 'de' })
			);
		});

		it.each(['publish', 'unpublish'])('always removes the executed %s action', async (mode) => {
			mockVersions(articles, {});

			await service.toggle(action(mode), mode);

			expect(actions.delete).toHaveBeenCalledWith({ documentId: 'action-1' });
		});
	});

	describe('publish', () => {
		it('runs beforePublish, publishes, emits entry.publish and runs afterPublish', async () => {
			const draft = { documentId: 'article-1', title: 'Draft' };
			const published = { documentId: 'article-1', entries: [] };
			articles.findOne.mockResolvedValue(draft);
			articles.publish.mockResolvedValue(published);

			await service.publish(ARTICLE_UID, 'article-1', { locale: 'en' });

			expect(config.hooks.beforePublish).toHaveBeenCalledWith({
				strapi,
				uid: ARTICLE_UID,
				entity: draft,
			});
			expect(articles.publish).toHaveBeenCalledWith({ documentId: 'article-1', locale: 'en' });
			expect(strapi.eventHub.emit).toHaveBeenCalledWith('entry.publish', {
				model: 'article',
				entry: { ...published, sanitized: true },
			});
			expect(config.hooks.afterPublish).toHaveBeenCalledWith({
				strapi,
				uid: ARTICLE_UID,
				entity: published,
			});
		});

		it('is cancelled when beforePublish returns false', async () => {
			config.hooks.beforePublish.mockResolvedValue(false);

			await service.publish(ARTICLE_UID, 'article-1', {});

			expect(articles.publish).not.toHaveBeenCalled();
			expect(strapi.eventHub.emit).not.toHaveBeenCalled();
			expect(config.hooks.afterPublish).not.toHaveBeenCalled();
		});

		it.each([undefined, null, true])('continues when beforePublish returns %s', async (result) => {
			config.hooks.beforePublish.mockResolvedValue(result);

			await service.publish(ARTICLE_UID, 'article-1', {});

			expect(articles.publish).toHaveBeenCalledOnce();
		});

		it('sets publishedAt to the scheduled time', async () => {
			const publishedAt = new Date(EXECUTE_AT);
			const updated = { documentId: 'article-1', publishedAt };
			articles.publish.mockResolvedValue({ documentId: 'article-1', entries: [{ id: 42 }] });
			articles.findOne
				.mockResolvedValueOnce({ documentId: 'article-1' })
				.mockResolvedValueOnce(updated);

			await service.publish(ARTICLE_UID, 'article-1', { locale: 'en', publishedAt });

			expect(strapi.db.query).toHaveBeenCalledWith(ARTICLE_UID);
			expect(strapi.db.query(ARTICLE_UID).update).toHaveBeenCalledWith({
				where: { id: 42 },
				data: { publishedAt },
			});
			expect(articles.findOne).toHaveBeenLastCalledWith({
				documentId: 'article-1',
				locale: 'en',
				status: 'published',
			});
			expect(config.hooks.afterPublish).toHaveBeenCalledWith({
				strapi,
				uid: ARTICLE_UID,
				entity: updated,
			});
		});

		it('logs errors instead of throwing them', async () => {
			articles.publish.mockRejectedValue(new Error('database is locked'));

			await expect(service.publish(ARTICLE_UID, 'article-1', {})).resolves.toBeUndefined();

			expect(strapi.log.error).toHaveBeenCalledWith(expect.stringContaining('database is locked'));
			expect(config.hooks.afterPublish).not.toHaveBeenCalled();
		});
	});

	describe('unpublish', () => {
		it('runs beforeUnpublish, unpublishes, emits entry.unpublish and runs afterUnpublish', async () => {
			const entity = { documentId: 'article-1' };
			const unpublished = { documentId: 'article-1', entries: [] };
			articles.findOne.mockResolvedValue(entity);
			articles.unpublish.mockResolvedValue(unpublished);

			await service.unpublish(ARTICLE_UID, 'article-1', { locale: 'fr' });

			expect(config.hooks.beforeUnpublish).toHaveBeenCalledWith({
				strapi,
				uid: ARTICLE_UID,
				entity,
			});
			expect(articles.unpublish).toHaveBeenCalledWith({ documentId: 'article-1', locale: 'fr' });
			expect(strapi.eventHub.emit).toHaveBeenCalledWith('entry.unpublish', {
				model: 'article',
				entry: { ...unpublished, sanitized: true },
			});
			expect(config.hooks.afterUnpublish).toHaveBeenCalledWith({
				strapi,
				uid: ARTICLE_UID,
				entity: unpublished,
			});
		});

		it('is cancelled when beforeUnpublish returns false', async () => {
			config.hooks.beforeUnpublish.mockResolvedValue(false);

			await service.unpublish(ARTICLE_UID, 'article-1', {});

			expect(articles.unpublish).not.toHaveBeenCalled();
			expect(config.hooks.afterUnpublish).not.toHaveBeenCalled();
		});

		it('logs errors instead of throwing them', async () => {
			config.hooks.beforeUnpublish.mockRejectedValue(new Error('hook failed'));

			await expect(service.unpublish(ARTICLE_UID, 'article-1', {})).resolves.toBeUndefined();

			expect(articles.unpublish).not.toHaveBeenCalled();
			expect(strapi.log.error).toHaveBeenCalledWith(expect.stringContaining('hook failed'));
		});
	});
});
