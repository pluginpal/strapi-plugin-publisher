import { errors } from '@strapi/utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import validateBeforeScheduling from '../../server/middlewares/validate-before-scheduling';
import { ACTION_UID, ARTICLE_UID, createStrapi } from '../helpers/strapi';

const articleModel = {
	uid: ARTICLE_UID,
	attributes: {
		title: { type: 'string', required: true },
		cover: { type: 'media', required: true },
		gallery: { type: 'media', multiple: true },
		author: { type: 'relation', relation: 'manyToOne' },
		tags: { type: 'relation', relation: 'manyToMany', required: true },
		seo: { type: 'component', component: 'shared.seo' },
		slides: { type: 'component', component: 'shared.slide', repeatable: true },
		blocks: { type: 'dynamiczone', components: ['shared.slide'] },
	},
};

const components = {
	'shared.seo': { attributes: { image: { type: 'media', required: true } } },
	'shared.slide': { attributes: { image: { type: 'media', required: true } } },
};

const validDraft = {
	documentId: 'article-1',
	locale: 'en',
	title: 'Hello',
	cover: { id: 1 },
	tags: [{ id: 1 }],
};

const publishAction = (data = {}) => ({
	uid: ACTION_UID,
	action: 'create',
	params: {
		data: {
			mode: 'publish',
			entityId: 'article-1',
			entitySlug: ARTICLE_UID,
			executeAt: '2030-01-01',
			...data,
		},
	},
});

describe('validation before scheduling a publish action', () => {
	let strapi;
	let articles;
	let next;

	beforeEach(() => {
		({ strapi } = createStrapi({ contentTypes: { [ARTICLE_UID]: articleModel }, components }));
		articles = strapi.documents(ARTICLE_UID);
		articles.findOne.mockImplementation(async ({ status }) =>
			status === 'draft' ? validDraft : null
		);
		next = vi.fn().mockResolvedValue('next-result');
	});

	const expectValidationErrors = async (context, paths) => {
		const error = await validateBeforeScheduling(context, next).catch((e) => e);
		expect(error).toBeInstanceOf(errors.ValidationError);
		expect(error.details.errors.map((e) => e.path)).toEqual(paths);
		expect(next).not.toHaveBeenCalled();
		return error;
	};

	describe('when it does not apply', () => {
		it('ignores other content types', async () => {
			await validateBeforeScheduling({ uid: ARTICLE_UID, action: 'create', params: {} }, next);
			expect(next).toHaveBeenCalledOnce();
			expect(articles.findOne).not.toHaveBeenCalled();
		});

		it.each(['findMany', 'findOne', 'delete'])('ignores the %s operation', async (action) => {
			await validateBeforeScheduling({ ...publishAction(), action }, next);
			expect(next).toHaveBeenCalledOnce();
			expect(articles.findOne).not.toHaveBeenCalled();
		});

		it('does not validate unpublish actions', async () => {
			await validateBeforeScheduling(publishAction({ mode: 'unpublish' }), next);
			expect(next).toHaveBeenCalledOnce();
			expect(articles.findOne).not.toHaveBeenCalled();
		});
	});

	it('lets a valid publish action through', async () => {
		await expect(validateBeforeScheduling(publishAction(), next)).resolves.toBe('next-result');

		expect(strapi.entityValidator.validateEntityCreation).toHaveBeenCalledWith(
			articleModel,
			validDraft,
			{ isDraft: false, locale: 'en' },
			null
		);
	});

	it('validates the draft in the locale of the action', async () => {
		await validateBeforeScheduling(publishAction({ locale: 'nl' }), next);

		expect(articles.findOne).toHaveBeenCalledWith(
			expect.objectContaining({ status: 'draft', locale: 'nl' })
		);
		expect(articles.findOne).toHaveBeenCalledWith(
			expect.objectContaining({ status: 'published', locale: 'nl' })
		);
	});

	it('throws a NotFoundError when there is no draft', async () => {
		articles.findOne.mockResolvedValue(null);

		await expect(validateBeforeScheduling(publishAction(), next)).rejects.toBeInstanceOf(
			errors.NotFoundError
		);
		expect(next).not.toHaveBeenCalled();
	});

	it("returns the errors of Strapi's validator, e.g. an empty required title", async () => {
		strapi.entityValidator.validateEntityCreation.mockRejectedValue(
			new errors.ValidationError('Invalid', {
				errors: [{ path: ['title'], message: 'title must be defined.' }],
			})
		);

		const error = await expectValidationErrors(publishAction(), [['title']]);

		expect(error.details.errors[0].message).toBe('title must be defined.');
	});

	it("adds missing required media and relations to Strapi's errors", async () => {
		articles.findOne.mockResolvedValue({ ...validDraft, cover: null, tags: [] });
		strapi.entityValidator.validateEntityCreation.mockRejectedValue(
			new errors.ValidationError('Invalid', { errors: [{ path: ['title'], message: 'required' }] })
		);

		await expectValidationErrors(publishAction(), [['title'], ['cover'], ['tags']]);
	});

	it("catches a missing required media field that Strapi's validator lets through", async () => {
		articles.findOne.mockResolvedValue({ ...validDraft, cover: null });

		await expectValidationErrors(publishAction(), [['cover']]);
	});

	it('catches a missing required to-many relation', async () => {
		articles.findOne.mockResolvedValue({ ...validDraft, tags: [] });

		await expectValidationErrors(publishAction(), [['tags']]);
	});

	it('checks required fields inside components, repeatable components and dynamic zones', async () => {
		articles.findOne.mockResolvedValue({
			...validDraft,
			seo: { image: null },
			slides: [{ image: { id: 1 } }, { image: null }],
			blocks: [{ __component: 'shared.slide', image: null }],
		});

		await expectValidationErrors(publishAction(), [
			['seo', 'image'],
			['slides', 1, 'image'],
			['blocks', 0, 'image'],
		]);
	});

	it('rethrows errors that are not validation errors', async () => {
		strapi.entityValidator.validateEntityCreation.mockRejectedValue(
			new Error('database is locked')
		);

		await expect(validateBeforeScheduling(publishAction(), next)).rejects.toThrow(
			'database is locked'
		);
	});

	describe('when an action is updated', () => {
		const update = (data) => ({
			uid: ACTION_UID,
			action: 'update',
			params: { documentId: 'action-1', data },
		});

		it('validates the stored action merged with the changes', async () => {
			strapi.documents(ACTION_UID).findOne.mockResolvedValue({
				documentId: 'action-1',
				mode: 'publish',
				entityId: 'article-1',
				entitySlug: ARTICLE_UID,
				locale: 'de',
			});

			await validateBeforeScheduling(update({ executeAt: '2030-02-01' }), next);

			expect(strapi.documents(ACTION_UID).findOne).toHaveBeenCalledWith({ documentId: 'action-1' });
			expect(articles.findOne).toHaveBeenCalledWith(
				expect.objectContaining({ documentId: 'article-1', locale: 'de' })
			);
			expect(next).toHaveBeenCalledOnce();
		});

		it('blocks changing an unpublish action into an invalid publish action', async () => {
			strapi.documents(ACTION_UID).findOne.mockResolvedValue({
				mode: 'unpublish',
				entityId: 'article-1',
				entitySlug: ARTICLE_UID,
			});
			articles.findOne.mockResolvedValue({ ...validDraft, cover: null });

			await expectValidationErrors(update({ mode: 'publish' }), [['cover']]);
		});
	});
});
