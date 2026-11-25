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

/** Let `findOne` return `draft` for the draft and nothing for the published version. */
const mockDraft = (articles, draft) => {
	articles.findOne.mockImplementation(async ({ status }) => (status === 'draft' ? draft : null));
};

describe('validation before scheduling a publish action', () => {
	let strapi;
	let articles;
	let populateBuilder;
	let next;

	beforeEach(() => {
		let contentManagerServices;
		({ strapi, contentManagerServices } = createStrapi({
			contentTypes: { [ARTICLE_UID]: articleModel },
			components,
		}));
		populateBuilder = contentManagerServices['populate-builder'];
		articles = strapi.documents(ARTICLE_UID);
		mockDraft(articles, validDraft);
		next = vi.fn().mockResolvedValue('next-result');
	});

	const expectValidationErrors = async (context, paths) => {
		const error = await validateBeforeScheduling(context, next).catch((e) => e);
		expect(error).toBeInstanceOf(errors.ValidationError);
		// The status keeps the response a 400 when the app has several @strapi/utils copies (#244).
		expect(error.status).toBe(400);
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
		// Without a locale in the action, the published version is looked up in the draft's locale.
		expect(articles.findOne).toHaveBeenCalledWith(
			expect.objectContaining({ status: 'published', locale: 'en' })
		);
	});

	it('loads the deep-populated draft and published version in the locale of the action', async () => {
		// Without a deep populate, relations, media and components would be missing from the draft
		// and every required one would be reported as empty.
		const populate = { deep: true };
		populateBuilder.builder.build.mockResolvedValue(populate);

		await validateBeforeScheduling(publishAction({ locale: 'nl' }), next);

		expect(populateBuilder).toHaveBeenCalledWith(ARTICLE_UID);
		expect(populateBuilder.builder.populateDeep).toHaveBeenCalledWith(Infinity);
		expect(articles.findOne).toHaveBeenCalledWith({
			documentId: 'article-1',
			status: 'draft',
			locale: 'nl',
			populate,
		});
		expect(articles.findOne).toHaveBeenCalledWith({
			documentId: 'article-1',
			status: 'published',
			locale: 'nl',
			populate,
		});
	});

	it.each([
		[undefined, 'No draft found for api::article.article with documentId "article-1".'],
		['nl', 'No draft found for api::article.article with documentId "article-1" and locale "nl".'],
	])('throws a NotFoundError when there is no draft (locale %s)', async (locale, message) => {
		articles.findOne.mockResolvedValue(null);

		const error = await validateBeforeScheduling(publishAction({ locale }), next).catch((e) => e);

		expect(error).toBeInstanceOf(errors.NotFoundError);
		expect(error.status).toBe(404);
		expect(error.message).toBe(message);
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

	it("falls back to the error's name and a default message", async () => {
		strapi.entityValidator.validateEntityCreation.mockRejectedValue(
			new errors.ValidationError('Invalid', { errors: [{ name: 'title' }] })
		);

		const error = await expectValidationErrors(publishAction(), ['title']);

		expect(error.details.errors[0].message).toBe('This field is required');
	});

	it('accepts dynamic zone items without a component type', async () => {
		mockDraft(articles, { ...validDraft, blocks: [{ image: null }] });

		await expect(validateBeforeScheduling(publishAction(), next)).resolves.toBe('next-result');
	});

	it('requires required components and dynamic zones to have content', async () => {
		strapi.contentType.mockReturnValue({
			uid: ARTICLE_UID,
			attributes: {
				seo: { type: 'component', component: 'shared.seo', required: true },
				slides: { type: 'component', component: 'shared.slide', repeatable: true, required: true },
				blocks: { type: 'dynamiczone', components: ['shared.slide'], required: true },
			},
		});
		mockDraft(articles, { documentId: 'article-1', seo: null, slides: [], blocks: [] });

		await expectValidationErrors(publishAction(), [['seo'], ['slides'], ['blocks']]);
	});

	it('requires a required multiple media field to have files', async () => {
		strapi.contentType.mockReturnValue({
			uid: ARTICLE_UID,
			attributes: { photos: { type: 'media', multiple: true, required: true } },
		});
		mockDraft(articles, { documentId: 'article-1', photos: [] });

		await expectValidationErrors(publishAction(), [['photos']]);
	});

	describe('required relations (#240)', () => {
		const TO_ONE = ['manyToOne', 'oneToOne', 'morphOne', 'morphToOne'];
		const TO_MANY = ['oneToMany', 'manyToMany', 'morphMany', 'morphToMany'];

		/** An article with only a required `owner` relation of the given type. */
		const mockRequiredRelation = (relation, draft) => {
			strapi.contentType.mockReturnValue({
				uid: ARTICLE_UID,
				attributes: {
					owner: { type: 'relation', relation, target: 'api::author.author', required: true },
				},
			});
			mockDraft(articles, { documentId: 'article-1', ...draft });
		};

		it.each(TO_ONE)('accepts a filled required %s relation', async (relation) => {
			mockRequiredRelation(relation, { owner: { id: 1, documentId: 'author-1' } });

			await expect(validateBeforeScheduling(publishAction(), next)).resolves.toBe('next-result');
		});

		it.each(TO_ONE)('rejects an empty required %s relation', async (relation) => {
			mockRequiredRelation(relation, { owner: null });

			await expectValidationErrors(publishAction(), [['owner']]);
		});

		it.each(TO_ONE)('rejects a required %s relation that is missing', async (relation) => {
			mockRequiredRelation(relation, {});

			await expectValidationErrors(publishAction(), [['owner']]);
		});

		it.each(TO_MANY)('accepts a required %s relation with entries', async (relation) => {
			mockRequiredRelation(relation, { owner: [{ id: 1, documentId: 'author-1' }] });

			await expect(validateBeforeScheduling(publishAction(), next)).resolves.toBe('next-result');
		});

		it.each(TO_MANY)('rejects a required %s relation without entries', async (relation) => {
			mockRequiredRelation(relation, { owner: [] });

			await expectValidationErrors(publishAction(), [['owner']]);
		});

		describe('inside components and dynamic zones', () => {
			beforeEach(() => {
				strapi.contentType.mockReturnValue({
					uid: ARTICLE_UID,
					attributes: {
						byline: { type: 'component', component: 'shared.byline' },
						credits: { type: 'component', component: 'shared.credits', repeatable: true },
						blocks: { type: 'dynamiczone', components: ['shared.quote'] },
					},
				});
				strapi.components = {
					'shared.byline': {
						attributes: { author: { type: 'relation', relation: 'manyToOne', required: true } },
					},
					'shared.credits': {
						attributes: { people: { type: 'relation', relation: 'manyToMany', required: true } },
					},
					'shared.quote': {
						attributes: { source: { type: 'relation', relation: 'oneToOne', required: true } },
					},
				};
			});

			it('accepts filled required to-one relations', async () => {
				mockDraft(articles, {
					documentId: 'article-1',
					byline: { author: { id: 1 } },
					blocks: [{ __component: 'shared.quote', source: { id: 2 } }],
				});

				await expect(validateBeforeScheduling(publishAction(), next)).resolves.toBe('next-result');
			});

			it('rejects empty required relations with their path', async () => {
				mockDraft(articles, {
					documentId: 'article-1',
					byline: { author: null },
					credits: [{ people: [{ id: 1 }] }, { people: [] }],
					blocks: [{ __component: 'shared.quote', source: null }],
				});

				await expectValidationErrors(publishAction(), [
					['byline', 'author'],
					['credits', 1, 'people'],
					['blocks', 0, 'source'],
				]);
			});
		});
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
